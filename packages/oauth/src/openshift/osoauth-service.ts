import { AuthenticationResult, PUBLIC_USER, ResolveUser, userService } from '@hawtio/react'
import * as fetchIntercept from 'fetch-intercept'
import { OAuthDelegateService } from '../api'
import { AUTH_METHOD, UserProfile, log } from '../globals'
import { CLUSTER_CONSOLE_KEY } from '../metadata'
import { fetchPath, getCookie, isBlank, logoutUri, redirect } from '../utils'
import {
  CLUSTER_VERSION_KEY,
  DEFAULT_CLUSTER_VERSION,
  EXPIRES_IN_KEY,
  OAUTH_OS_PROTOCOL_MODULE,
  OBTAINED_AT_KEY,
  OpenShiftOAuthConfig,
  TOKEN_TYPE_KEY,
} from './globals'
import {
  buildLoginUrl,
  buildUserInfoUri,
  checkToken,
  currentTimeSeconds,
  forceRelogin,
  tokenHasExpired,
} from './support'

interface UserObject {
  kind: string
  apiVersion: string
  metadata: {
    name: string
    selfLink: string
    creationTimestamp: string | null
  }
  groups: string[]
}

interface Headers {
  Authorization: string
  'Content-Type': string
  'X-XSRF-TOKEN'?: string
}

export class OSOAuthService implements OAuthDelegateService {
  private userInfoUri = ''
  private keepaliveInterval = 10
  private keepAliveHandler: NodeJS.Timeout | null = null

  private readonly adaptedConfig: Promise<OpenShiftOAuthConfig | null>
  private readonly login: Promise<AuthenticationResult>
  private fetchUnregister?: () => void

  constructor(
    openShiftConfig: OpenShiftOAuthConfig,
    private readonly userProfile: UserProfile,
  ) {
    log.debug('Initialising OpenShift OAuth Service')
    this.userProfile.setOAuthType(OAUTH_OS_PROTOCOL_MODULE)
    this.adaptedConfig = this.processConfig(openShiftConfig)
    this.login = this.createLogin()
  }

  private async processConfig(config: OpenShiftOAuthConfig): Promise<OpenShiftOAuthConfig | null> {
    log.debug('OpenShift OAuth config to be processed:', config)

    if (config.oauth_authorize_uri) return config

    // Try to fetch authorize uri from metadata uri
    if (!config.oauth_metadata_uri) {
      this.userProfile.setError(new Error('Cannot determine authorize uri as no metadata uri'))
      return null
    }

    // See if web_console_url has been added to config
    if (!isBlank(config.web_console_url)) {
      log.debug('Adding web console URI to user profile:', config.web_console_url)
      this.userProfile.addMetadata(CLUSTER_CONSOLE_KEY, config.web_console_url)
    }

    log.debug('Fetching OAuth server metadata from:', config.oauth_metadata_uri)
    return fetchPath<OpenShiftOAuthConfig | null>(config.oauth_metadata_uri, {
      success: (data: string) => {
        log.debug('Loaded', config.oauth_metadata_uri, ':', data)
        const metadata = JSON.parse(data)
        config.oauth_authorize_uri = metadata.authorization_endpoint
        config.issuer = metadata.issuer

        if (isBlank(config.oauth_authorize_uri) || isBlank(config.oauth_client_id)) {
          this.userProfile.setError(new Error('Invalid OpenShift auth config'))
          return null
        }

        this.userInfoUri = buildUserInfoUri(this.userProfile.getMasterUri(), config)

        return config
      },
      error: err => {
        const e = new Error('Failed to contact the oauth metadata uri', { cause: err })
        this.userProfile.setError(e)
        return null
      },
    })
  }

  private setupFetch(config: OpenShiftOAuthConfig) {
    if (this.userProfile.hasError()) {
      return
    }

    log.debug('Intercept Fetch API to attach OpenShift auth token to authorization header')
    this.fetchUnregister = fetchIntercept.register({
      request: (url, requestConfig) => {
        log.debug('Fetch intercepted for oAuth authentication')

        if (tokenHasExpired(this.userProfile)) {
          const reason = `Cannot navigate to ${url} as token expired so need to logout`
          log.debug(reason)

          // Unregister this fetch handler before logging out
          this.fetchUnregister?.()

          this.doLogout(config)
        }

        // Include any requestConfig headers to ensure they are retained
        let headers: Headers = {
          Authorization: `Bearer ${this.userProfile.getToken()}`,
          'Content-Type': 'application/json',
        }

        // For CSRF protection with Spring Security
        const token = getCookie('XSRF-TOKEN')
        if (token) {
          log.debug('Set XSRF token header from cookies')
          headers = {
            ...headers,
            'X-XSRF-TOKEN': token,
          }
        }

        /*
         * if requestConfig exists and already has a set of headers
         */
        if (requestConfig && requestConfig.headers) {
          headers = { ...requestConfig.headers, ...headers }
        }

        // headers must be 2nd so that it overwrites headers property in requestConfig
        return [url, { ...requestConfig, headers }]
      },
    })
  }

  private setupKeepAlive(config: OpenShiftOAuthConfig) {
    const keepAlive = async () => {
      log.debug('Running oAuth keepAlive function')
      const response = await fetch(this.userInfoUri, { method: 'GET' })
      if (response.ok) {
        const keepaliveJson = await response.json()
        if (!keepaliveJson) {
          this.userProfile.setError(new Error('Cannot parse the keepalive json response'))
          return
        }

        const obtainedAt = this.userProfile.metadataValue<number>(OBTAINED_AT_KEY) || 0
        const expiry = this.userProfile.metadataValue<number>(EXPIRES_IN_KEY) || 0
        if (obtainedAt) {
          const remainingTime = obtainedAt + expiry - currentTimeSeconds()
          if (remainingTime > 0) {
            this.keepaliveInterval = Math.min(Math.round(remainingTime / 4), 24 * 60 * 60)
            log.debug('Resetting keepAlive interval to ' + this.keepaliveInterval)
          }
        }
        if (!this.keepaliveInterval) {
          this.keepaliveInterval = 10
        }
        log.debug('userProfile:', this.userProfile)
      } else {
        log.debug('keepAlive response failure so re-login')
        // The request may have been cancelled as the browser refresh request in
        // extractToken may be triggered before getting the AJAX response.
        // In that case, let's just skip the error and go through another refresh cycle.
        // See http://stackoverflow.com/questions/2000609/jquery-ajax-status-code-0 for more details.
        log.error('Failed to fetch user info, status: ', response.statusText)
        this.doLogout(config)
      }
    }

    this.keepAliveHandler = setTimeout(keepAlive, this.keepaliveInterval)
  }

  private clearKeepAlive() {
    if (!this.keepAliveHandler) return

    clearTimeout(this.keepAliveHandler)
    this.keepAliveHandler = null
  }

  private checkTokenExpired(config: OpenShiftOAuthConfig) {
    if (!this.userProfile.hasToken()) return true // no token so must be expired

    if (tokenHasExpired(this.userProfile)) {
      log.debug('Token has expired so logging out')
      this.doLogout(config)
      return true
    }

    log.debug('User Profile has good token so nothing to do')
    return false
  }

  private async createLogin(): Promise<AuthenticationResult> {
    const config = await this.adaptedConfig
    if (!config) {
      return AuthenticationResult.configuration_error
    }

    if (this.userProfile.hasError()) {
      log.debug('Cannot login as user profile has an error:', this.userProfile.getError())
      return AuthenticationResult.configuration_error
    }

    const currentURI = new URL(window.location.href)
    if (currentURI.pathname === logoutUri().pathname) {
      //Reset the logout path to the base path
      currentURI.pathname = currentURI.pathname.replace(logoutUri().pathname, '/')
    }

    try {
      this.clearKeepAlive()

      log.debug('Checking token for validity')
      const tokenParams = await checkToken(currentURI)
      if (!tokenParams) {
        log.debug('No Token so initiating new login')
        this.tryLogin(config, currentURI)
        return AuthenticationResult.connect_error
      }

      log.debug('Populating user profile with token metadata')
      // Populate the profile with the new token
      this.userProfile.addMetadata<number>(EXPIRES_IN_KEY, tokenParams.expires_in ?? 0)
      this.userProfile.addMetadata<string>(TOKEN_TYPE_KEY, tokenParams.token_type ?? '')
      this.userProfile.addMetadata<number>(OBTAINED_AT_KEY, tokenParams.obtainedAt ?? 0)

      this.userProfile.setToken(tokenParams.access_token ?? '')

      if (this.checkTokenExpired(config)) return AuthenticationResult.connect_error

      // Promote the hawtio mode to expose to third-parties
      log.debug('Adding cluster version to profile metadata')
      this.userProfile.addMetadata<string>(CLUSTER_VERSION_KEY, config.cluster_version ?? DEFAULT_CLUSTER_VERSION)

      // Need fetch for keepalive
      this.setupFetch(config)

      this.setupKeepAlive(config)
      return AuthenticationResult.ok
    } catch (error) {
      const e = error instanceof Error ? error : new Error('Error from checking token')
      this.userProfile.setError(e)
      return AuthenticationResult.connect_error
    }
  }

  private tryLogin(config: OpenShiftOAuthConfig, uri: URL) {
    const targetUri = buildLoginUrl(config, { uri: uri.toString() })
    redirect(targetUri)
  }

  private doLogout(config: OpenShiftOAuthConfig): void {
    this.fetchUnregister?.()

    const currentURI = new URL(window.location.href)
    // The following request returns 403 when delegated authentication with an
    // OAuthClient is used, as possible scopes do not grant permissions to access the OAuth API:
    // See https://github.com/openshift/origin/issues/7011
    //
    // So little point in trying to delete the token. Lets do in client-side only
    //
    forceRelogin(currentURI, config)
  }

  loginStatus(): Promise<AuthenticationResult> {
    return this.login
  }

  async fetchUser(resolve: ResolveUser): Promise<boolean> {
    log.debug('OAuth - Running fetchUser hook')
    const config = await this.adaptedConfig
    const login = await this.login
    if (!config || login !== AuthenticationResult.ok || this.userProfile.hasError()) {
      // OpenShift OAuth provides a dedicated login page
      resolve({ username: PUBLIC_USER, isLogin: false, loginMethod: AUTH_METHOD })
      return false
    }

    if (this.userProfile.getToken()) {
      const userInfo = await fetchPath<UserObject | null>(this.userInfoUri, {
        success: data => JSON.parse(data),
        error: () => null,
      })

      let username = this.userProfile.getToken() // default
      if (userInfo?.metadata?.name) {
        username = userInfo.metadata.name
      }

      resolve({ username, isLogin: true, loginMethod: AUTH_METHOD })
      userService.setToken(this.userProfile.getToken())
    }

    return true
  }

  async logout(): Promise<boolean> {
    log.debug('OAuth - Running logout hook')
    const config = await this.adaptedConfig
    const login = await this.login
    if (!config || login !== AuthenticationResult.ok || this.userProfile.hasError()) {
      return false
    }

    log.info('Log out OpenShift')
    try {
      this.doLogout(config)
    } catch (error) {
      log.error('Error logging out OpenShift:', error)
    }
    return true
  }
}
