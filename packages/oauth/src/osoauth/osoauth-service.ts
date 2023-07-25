import $ from 'jquery'
import { userService } from '@hawtio/react'
import { log, UserProfile } from '../globals'
import { fetchPath, isBlank, getCookie } from '../utils'
import { moduleName, OpenShiftConfig, PATH_OSCONSOLE_CLIENT_CONFIG, ResolveUser, TokenMetadata } from './globals'
import { buildKeepaliveUri, checkToken, clearTokenStorage, currentTimeSeconds, doLogin, doLogout, tokenExpired } from './support'

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

        return config
      },
      error: (err) => {
        const e: Error = new Error("Cannot parse the oauth metadata uri", {cause: err})
        this.userProfile.setError(e)
        return null
      }
    })
  }

  private async setupFetch() {
    const config = await this.adaptedConfig
    if (!config || this.userProfile.hasError()) {
      return
    }

    log.debug('Intercept Fetch API to attach Openshift auth token to authorization header')
    const { fetch: originalFetch } = window
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const logPrefix = 'Fetch -'
      log.debug(logPrefix, 'Fetch intercepted for Keycloak authentication')

      if (tokenExpired(this.userProfile)) {
        return new Promise((resolve, reject) => {
          log.debug(logPrefix, 'Try to update token for request:', input)
          this.login
            .then(status => {
              if(status) {
                log.debug(logPrefix, 'Keycloak token refreshed. Set new value to userService')
                userService.setToken(this.userProfile.getToken())
                log.debug(logPrefix, 'Re-sending request after successfully updating token:', input)
                resolve(fetch(input, init))
              } else {
                log.debug(logPrefix, 'Logging out due to token update failed')
                userService.logout()
                reject()
              }
            })
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
        log.debug(logPrefix, 'Set XSRF token header from cookies')
        init.headers = {
          ...init.headers,
          'X-XSRF-TOKEN': token,
        }
      }

      return originalFetch(input, init)
    }
  }

  private async setupJQueryAjax() {
    const config = await this.adaptedConfig
    if (!config || this.userProfile.hasError()) {
      return
    }

    log.debug('Set authorization header to Openshift auth token for AJAX requests')
    const beforeSend = (xhr: JQueryXHR, settings: JQueryAjaxSettings) => {
      const logPrefix = 'jQuery -'

      if (tokenExpired(this.userProfile)) {
        log.debug(logPrefix, 'Try to update token for request:', settings.url)

        this.login
          .then(status => {
            if(status) {
              log.debug(logPrefix, 'Openshift token refreshed. Set new value to userService')
              userService.setToken(this.userProfile.getToken())
              log.debug(logPrefix, 'Re-sending request after successfully updating Keycloak token:', settings.url)
              $.ajax(settings)
            } else {
              log.debug(logPrefix, 'Logging out due to token update failed')
              userService.logout()
            }
          })

        return false
      }

      // Set bearer token is used
      xhr.setRequestHeader('Authorization', `Bearer ${this.userProfile.getToken()}`)

      // For CSRF protection with Spring Security
      const token = getCookie('XSRF-TOKEN')
      if (token) {
        log.debug(logPrefix, 'Set XSRF token header from cookies')
        xhr.setRequestHeader('X-XSRF-TOKEN', token)
      }

      return // To suppress ts(7030)
    }
    $.ajaxSetup({ beforeSend })
  }

  private async createLogin(): Promise<boolean> {
    const config = await this.adaptedConfig
    if (!config)
      return false

    if (this.userProfile.hasError())
      return false

    if (this.userProfile.access_token && ! tokenExpired(this.userProfile))
      return true

    const currentURI = new URL(window.location.href)
    try {
      const tokenParams = checkToken(currentURI)
      if (!tokenParams) {
        log.debug("No Token so initiating new login")
        clearTokenStorage()
        doLogin(config, { uri: currentURI.toString()})
        return true
      }

      /* Populate the profile with the new token */
      this.userProfile.expires_in = tokenParams.expires_in
      this.userProfile.token_type = tokenParams.token_type
      this.userProfile.obtainedAt = tokenParams.obtainedAt || 0
      this.userProfile.setToken(tokenParams.access_token || '')
      this.userProfile.setMasterUri(config.master_uri || '')
    } catch (error) {
      this.userProfile.setError(error instanceof Error ? error : new Error('Error from checking token'))
      return false
    }

    // Need fetch for keepalive
    await this.setupFetch()
    await this.setupJQueryAjax()

    this.keepaliveUri = buildKeepaliveUri(config)

    const keepAlive = async () => {
      console.log("Running keepAlive function")
      const response = await fetch(this.keepaliveUri, {method: 'GET'})
      if (response.ok) {
        const keepaliveJson = await response.json()
        if (!keepaliveJson) {
          console.log("keepAlive json failed")
          this.userProfile.setError(new Error("Cannot parse the keepalive json response"))
          return
        }

        const obtainedAt = this.userProfile.obtainedAt || 0
        const expiry = this.userProfile.expires_in || 0
        if (obtainedAt) {
          const remainingTime = obtainedAt + expiry - currentTimeSeconds()
          if (remainingTime > 0) {
            this.keepaliveInterval = Math.min(Math.round(remainingTime / 4), 24 * 60 * 60)
            console.log("Resetting keepAlive interval to " + this.keepaliveInterval)
          }
        }
        if (!this.keepaliveInterval) {
          this.keepaliveInterval = 10
        }
        log.debug("userProfile:", this.userProfile)
      } else {
        console.log("keepAlive response was NOT ok!")
        // The request may have been cancelled as the browser refresh request in
        // extractToken may be triggered before getting the AJAX response.
        // In that case, let's just skip the error and go through another refresh cycle.
        // See http://stackoverflow.com/questions/2000609/jquery-ajax-status-code-0 for more details.
        log.error('Failed to fetch user info, status: ', response.statusText)
        clearTokenStorage()
        doLogin(config, { uri: currentURI.toString() })
      }
    }

    setTimeout(keepAlive, this.keepaliveInterval)

    return true
  }

  async isActive(): Promise<boolean> {
    await this.login
    return this.userProfile.isActive()
  }

  getUserProfile(): OSOAuthUserProfile {
    return this.userProfile
  }

  registerUserHooks() {
    const fetchUser = async (resolve: ResolveUser) => {
      const login = await this.login
      if (!login || this.userProfile.hasError()) {
        return false
      }

      if (this.userProfile.getToken()) {
        resolve({ username: this.userProfile.getToken(), isLogin: true })
        userService.setToken(this.userProfile.getToken())
      }

      this.setupJQueryAjax()
      this.setupFetch()

      return true
    }
    userService.addFetchUserHook(moduleName, fetchUser)

    const logout = async () => {
      const config = await this.adaptedConfig
      const login = await this.login
      if (!config || !login || this.userProfile.hasError()) {
        return false
      }

      log.info('Log out Openshift')
      try {
        doLogout(config, this.userProfile)
      } catch (error) {
        log.error('Error logging out Openshift:', error)
      }
      return true
    }
    userService.addLogoutHook(moduleName, logout)
  }

}

export const osOAuthService = new OSOAuthService()
