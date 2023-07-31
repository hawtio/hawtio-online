import $ from 'jquery'
import { userService } from '@hawtio/react'
import { log, UserProfile } from '../globals'
import { fetchPath, isBlank, getCookie } from '../utils'
import {
  CLUSTER_VERSION_KEY,
  DEFAULT_CLUSTER_VERSION,
  DEFAULT_HAWTIO_MODE,
  DEFAULT_HAWTIO_NAMESPACE,
  HAWTIO_MODE_KEY,
  HAWTIO_NAMESPACE_KEY
} from '../metadata'
import {
  moduleName,
  PATH_OSCONSOLE_CLIENT_CONFIG,
  OpenShiftConfig,
  ResolveUser,
  TokenMetadata
} from './globals'
import {
  buildKeepaliveUri,
  checkToken,
  currentTimeSeconds,
  doLogout,
  tokenHasExpired
} from './support'

export class OSOAuthUserProfile extends UserProfile implements TokenMetadata {
  access_token?: string
  token_type?: string
  expires_in?: number
  obtainedAt?: number
}

export interface IOSOAuthService {
  isActive(): Promise<boolean>
  registerUserHooks(): void
}

class OSOAuthService implements IOSOAuthService {
  private userProfile: OSOAuthUserProfile = new OSOAuthUserProfile(moduleName)
  private keepaliveUri: string = ''
  private keepaliveInterval: number = 10
  private keepAliveHandler: NodeJS.Timeout | null = null

  private readonly rawConfig: Promise<OpenShiftConfig | null>
  private readonly adaptedConfig: Promise<OpenShiftConfig | null>
  private readonly login: Promise<boolean>

  constructor() {
    log.debug('Initialising Openshift OAuth Service')
    this.rawConfig = this.loadOSOAuthConfig()
    this.adaptedConfig = this.processConfig()
    this.login = this.createLogin()
  }

  private async loadOSOAuthConfig(): Promise<OpenShiftConfig | null> {
    return fetchPath<OpenShiftConfig | null>(PATH_OSCONSOLE_CLIENT_CONFIG, {
      success: (data: string) => {
        log.debug('Loaded', PATH_OSCONSOLE_CLIENT_CONFIG, ':', data)
        return JSON.parse(data)
      },
      error: (err) => {
        this.userProfile.setError(err)
        return null
      }
    })
  }

  private async processConfig(): Promise<OpenShiftConfig|null> {
    const config = await this.rawConfig
    if (!config || !config.openshift) {
      this.userProfile.setError(new Error("Cannot find the openshift auth configuration"))
      return null
    }
    log.debug('OS OAuth config to be processed: ', config)

    const openshiftAuth = config.openshift
    if (openshiftAuth.oauth_authorize_uri)
      return config

    // Try to fetch authorize uri from metadata uri
    if (!openshiftAuth.oauth_metadata_uri) {
      this.userProfile.setError(new Error("Cannot determine authorize uri as no metadata uri"))
      return null
    }

    log.debug('Fetching OAuth server metadata from:', openshiftAuth.oauth_metadata_uri)
    return fetchPath<OpenShiftConfig | null>(openshiftAuth.oauth_metadata_uri, {
      success: (data: string) => {
        log.debug('Loaded', openshiftAuth.oauth_metadata_uri, ':', data)
        const metadata = JSON.parse(data)
        openshiftAuth.oauth_authorize_uri = metadata.authorization_endpoint
        openshiftAuth.issuer = metadata.issuer

        if (isBlank(openshiftAuth.oauth_authorize_uri) || isBlank(openshiftAuth.oauth_client_id)) {
          this.userProfile.setError(new Error('Invalid openshift auth config'))
          return null
        }

        this.keepaliveUri = buildKeepaliveUri(config)

        return config
      },
      error: (err) => {
        const e: Error = new Error("Failed to contact the oauth metadata uri", {cause: err})
        this.userProfile.setError(e)
        return null
      }
    })
  }

  private setupFetch(config: OpenShiftConfig) {
    if (!config || this.userProfile.hasError()) {
      return
    }

    log.debug('Intercept Fetch API to attach Openshift auth token to authorization header')
    const { fetch: originalFetch } = window
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      log.debug('Fetch intercepted for oAuth authentication')

      if (tokenHasExpired(this.userProfile)) {
        return new Promise((resolve, reject) => {
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

  private setupJQueryAjax(config: OpenShiftConfig) {
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

  private setupKeepAlive(url: URL, config: OpenShiftConfig) {
    const keepAlive = async () => {
      log.debug("Running oAuth keepAlive function")
      const response = await fetch(this.keepaliveUri, {method: 'GET'})
      if (response.ok) {
        const keepaliveJson = await response.json()
        if (!keepaliveJson) {
          this.userProfile.setError(new Error("Cannot parse the keepalive json response"))
          return
        }

        const obtainedAt = this.userProfile.obtainedAt || 0
        const expiry = this.userProfile.expires_in || 0
        if (obtainedAt) {
          const remainingTime = obtainedAt + expiry - currentTimeSeconds()
          if (remainingTime > 0) {
            this.keepaliveInterval = Math.min(Math.round(remainingTime / 4), 24 * 60 * 60)
            log.debug("Resetting keepAlive interval to " + this.keepaliveInterval)
          }
        }
        if (!this.keepaliveInterval) {
          this.keepaliveInterval = 10
        }
        log.debug("userProfile:", this.userProfile)
      } else {
        log.debug("keepAlive response failure so re-login")
        // The request may have been cancelled as the browser refresh request in
        // extractToken may be triggered before getting the AJAX response.
        // In that case, let's just skip the error and go through another refresh cycle.
        // See http://stackoverflow.com/questions/2000609/jquery-ajax-status-code-0 for more details.
        log.error('Failed to fetch user info, status: ', response.statusText)
        doLogout(url, config)
      }
    }

    this.keepAliveHandler = setTimeout(keepAlive, this.keepaliveInterval)
  }

  private clearKeepAlive() {
    if (!this.keepAliveHandler)
      return

    clearTimeout(this.keepAliveHandler)
    this.keepAliveHandler = null
  }

  private checkTokenExpired(config: OpenShiftConfig) {
    if (!this.userProfile.hasToken())
      return true // no token so must be expired

    if (tokenHasExpired(this.userProfile)) {
      log.debug("Token has expired so logging out")
      doLogout(config)
      return true
    }

    log.debug("User Profile has good token so nothing to do")
    return false
  }

  private async createLogin(): Promise<boolean> {
    const config = await this.adaptedConfig
    if (!config) {
      return false
    }

    if (this.userProfile.hasError()) {
      log.debug("Cannot login as user profile has error: ", this.userProfile.getError())
      return false
    }

    const currentURI = new URL(window.location.href)
    try {

      this.clearKeepAlive()

      log.debug("Checking token for validity")
      const tokenParams = checkToken(currentURI)
      if (!tokenParams) {
        log.debug("No Token so initiating new login")
        doLogout(config)
        return false
      }

      log.debug("Populating user profile with token metadata")
      /* Populate the profile with the new token */
      this.userProfile.expires_in = tokenParams.expires_in
      this.userProfile.token_type = tokenParams.token_type
      this.userProfile.obtainedAt = tokenParams.obtainedAt || 0
      this.userProfile.setToken(tokenParams.access_token || '')
      this.userProfile.setMasterUri(config.master_uri || '')

      if (this.checkTokenExpired(config)) return false

      /* Promote the hawtio mode to expose to third-parties */
      log.debug("Adding cluster version to profile metadata")
      this.userProfile.addMetadata(CLUSTER_VERSION_KEY, config.openshift?.cluster_version || DEFAULT_CLUSTER_VERSION)

      log.debug("Adding hawtio-mode to profile metadata")
      const hawtioMode = config.hawtio?.mode || DEFAULT_HAWTIO_MODE
      this.userProfile.addMetadata(HAWTIO_MODE_KEY, hawtioMode)
      if (hawtioMode !== DEFAULT_HAWTIO_MODE)
      this.userProfile.addMetadata(HAWTIO_NAMESPACE_KEY, config.hawtio?.namespace || DEFAULT_HAWTIO_NAMESPACE)

      // Need fetch for keepalive
      this.setupFetch(config)
      this.setupJQueryAjax(config)

      this.setupKeepAlive(currentURI, config)
      return true

    } catch (error) {
      this.userProfile.setError(error instanceof Error ? error : new Error('Error from checking token'))
      return false
    }
  }

  async isActive(): Promise<boolean> {
    await this.login
    return this.userProfile.isActive()
  }

  getUserProfile(): OSOAuthUserProfile {
    return this.userProfile
  }

  registerUserHooks() {
    log.debug('Registering oAuth user hooks')
    const fetchUser = async (resolve: ResolveUser) => {
      const config = await this.adaptedConfig
      const login = await this.login
      if (!config || !login || this.userProfile.hasError()) {
        return false
      }

      if (this.userProfile.getToken()) {
        resolve({ username: this.userProfile.getToken(), isLogin: true })
        userService.setToken(this.userProfile.getToken())
      }

      return true
    }
    userService.addFetchUserHook(moduleName, fetchUser)

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
    userService.addLogoutHook(moduleName, logout)
  }

}

export const osOAuthService = new OSOAuthService()
