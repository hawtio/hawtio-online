import $ from 'jquery'
import { log, OAuthProtoService, UserProfile } from '../globals'
import { fetchPath, isBlank, getCookie } from '../utils'
import { CLUSTER_CONSOLE_KEY } from '../metadata'
import {
  DEFAULT_CLUSTER_VERSION,
  EXPIRES_IN_KEY,
  OBTAINED_AT_KEY,
  TOKEN_TYPE_KEY,
  CLUSTER_VERSION_KEY,
  OAUTH_OS_PROTOCOL_MODULE,
  OpenShiftOAuthConfig,
  ResolveUser,
} from './globals'
import { buildUserInfoUri, checkToken, currentTimeSeconds, doLogout, tokenHasExpired } from './support'
import { userService } from '@hawtio/react'

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

export class OSOAuthService implements OAuthProtoService {
  private userInfoUri = ''
  private keepaliveInterval = 10
  private keepAliveHandler: NodeJS.Timeout | null = null

  private userProfile: UserProfile
  private readonly adaptedConfig: Promise<OpenShiftOAuthConfig | null>
  private readonly login: Promise<boolean>

  constructor(openShiftConfig: OpenShiftOAuthConfig, userProfile: UserProfile) {
    log.debug('Initialising Openshift OAuth Service')
    this.userProfile = userProfile
    this.userProfile.setOAuthType(OAUTH_OS_PROTOCOL_MODULE)
    this.adaptedConfig = this.processConfig(openShiftConfig)
    this.login = this.createLogin()
  }

  private async processConfig(config: OpenShiftOAuthConfig): Promise<OpenShiftOAuthConfig | null> {
    if (!config) {
      this.userProfile.setError(new Error('Cannot find the openshift auth configuration'))
      return null
    }
    log.debug('OS OAuth config to be processed: ', config)

    if (config.oauth_authorize_uri) return config

    // Try to fetch authorize uri from metadata uri
    if (!config.oauth_metadata_uri) {
      this.userProfile.setError(new Error('Cannot determine authorize uri as no metadata uri'))
      return null
    }

    // See if web_console_url has been added to config
    if (config.web_console_url && config.web_console_url.length > 0) {
      log.debug(`Adding web console URI to user profile ${config.web_console_url}`)
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
          this.userProfile.setError(new Error('Invalid openshift auth config'))
          return null
        }

        this.userInfoUri = buildUserInfoUri(this.userProfile.getMasterUri(), config)

        return config
      },
      error: err => {
        const e: Error = new Error('Failed to contact the oauth metadata uri', { cause: err })
        this.userProfile.setError(e)
        return null
      },
    })
  }

  private setupFetch(config: OpenShiftOAuthConfig) {
    if (!config || this.userProfile.hasError()) {
      return
    }

    log.debug('Intercept Fetch API to attach Openshift auth token to authorization header')
    const { fetch: originalFetch } = window
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      log.debug('Fetch intercepted for oAuth authentication')

      if (tokenHasExpired(this.userProfile)) {
        return new Promise((resolve, _) => {
          const reason = `Cannot navigate to ${input} as token expired so need to logout`
          log.debug(reason)
          doLogout(config)
          resolve(Response.error())
        })
      }

      init = { ...init }
      init.headers = {
        ...init.headers,
        Authorization: `Bearer ${this.userProfile.getToken()}`,
      }

      // For CSRF protection with Spring Security
      const token = getCookie('XSRF-TOKEN')
      if (token) {
        log.debug('Set XSRF token header from cookies')
        init.headers = {
          ...init.headers,
          'X-XSRF-TOKEN': token,
        }
      }

      return originalFetch(input, init)
    }
  }

  private setupJQueryAjax(config: OpenShiftOAuthConfig) {
    if (!config || this.userProfile.hasError()) {
      return
    }

    log.debug('Set authorization header to Openshift auth token for AJAX requests')
    const beforeSend = (xhr: JQueryXHR, settings: JQueryAjaxSettings) => {
      if (tokenHasExpired(this.userProfile)) {
        log.debug(`Cannot navigate to ${settings.url} as token expired so need to logout`)
        doLogout(config)
        return
      }

      // Set bearer token is used
      xhr.setRequestHeader('Authorization', `Bearer ${this.userProfile.getToken()}`)

      // For CSRF protection with Spring Security
      const token = getCookie('XSRF-TOKEN')
      if (token) {
        log.debug('Set XSRF token header from cookies')
        xhr.setRequestHeader('X-XSRF-TOKEN', token)
      }
      return // To suppress ts(7030)
    }

    $.ajaxSetup({ beforeSend })
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
        doLogout(config)
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
      doLogout(config)
      return true
    }

    log.debug('User Profile has good token so nothing to do')
    return false
  }

  private async createLogin(): Promise<boolean> {
    const config = await this.adaptedConfig
    if (!config) {
      return false
    }

    if (this.userProfile.hasError()) {
      log.debug('Cannot login as user profile has an error: ', this.userProfile.getError())
      return false
    }

    const currentURI = new URL(window.location.href)
    try {
      this.clearKeepAlive()

      log.debug('Checking token for validity')
      const tokenParams = checkToken(currentURI)
      if (!tokenParams) {
        log.debug('No Token so initiating new login')
        doLogout(config)
        return false
      }

      log.debug('Populating user profile with token metadata')
      /* Populate the profile with the new token */
      this.userProfile.addMetadata<number>(EXPIRES_IN_KEY, tokenParams.expires_in || 0)
      this.userProfile.addMetadata<string>(TOKEN_TYPE_KEY, tokenParams.token_type || '')
      this.userProfile.addMetadata<number>(OBTAINED_AT_KEY, tokenParams.obtainedAt || 0)

      this.userProfile.setToken(tokenParams.access_token || '')

      if (this.checkTokenExpired(config)) return false

      /* Promote the hawtio mode to expose to third-parties */
      log.debug('Adding cluster version to profile metadata')
      this.userProfile.addMetadata<string>(CLUSTER_VERSION_KEY, config.cluster_version || DEFAULT_CLUSTER_VERSION)

      // Need fetch for keepalive
      this.setupFetch(config)
      this.setupJQueryAjax(config)

      this.setupKeepAlive(config)
      return true
    } catch (error) {
      this.userProfile.setError(error instanceof Error ? error : new Error('Error from checking token'))
      return false
    }
  }

  async isLoggedIn(): Promise<boolean> {
    return await this.login
  }

  registerUserHooks() {
    log.debug('Registering oAuth user hooks')
    const fetchUser = async (resolve: ResolveUser) => {
      const config = await this.adaptedConfig
      const login = await this.login
      if (!config || !login || this.userProfile.hasError()) {
        resolve({ username: '', isLogin: false })
        return false
      }

      if (this.userProfile.getToken()) {
        const userInfo = await fetchPath<UserObject | null>(this.userInfoUri, {
          success: (data: string) => {
            return JSON.parse(data)
          },
          error: () => null,
        })

        let username = this.userProfile.getToken() // default
        if (userInfo && userInfo.metadata?.name) {
          username = userInfo.metadata?.name
        }

        resolve({ username: username, isLogin: true })
        userService.setToken(this.userProfile.getToken())
      }

      return true
    }
    userService.addFetchUserHook(OAUTH_OS_PROTOCOL_MODULE, fetchUser)

    const logout = async () => {
      log.debug('Running oAuth logout hook')
      const config = await this.adaptedConfig
      const login = await this.login
      if (!config || !login || this.userProfile.hasError()) {
        return false
      }

      log.info('Log out Openshift')
      try {
        doLogout(config)
      } catch (error) {
        log.error('Error logging out Openshift:', error)
      }
      return true
    }
    userService.addLogoutHook(OAUTH_OS_PROTOCOL_MODULE, logout)
  }
}
