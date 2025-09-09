import { AuthenticationResult, configManager, LogoutHook, ResolveUser, TaskState, userService } from '@hawtio/react'
import { OAuthConfig, OAuthDelegateService } from './api'
import { FormService } from './form'
import { AUTH_METHOD, KUBERNETES_MASTER_KIND, PATH_OSCONSOLE_CLIENT_CONFIG, UserProfile, log } from './globals'
import { DEFAULT_HAWTIO_MODE, DEFAULT_HAWTIO_NAMESPACE, HAWTIO_MODE_KEY, HAWTIO_NAMESPACE_KEY } from './metadata'
import { OSOAuthService } from './openshift'
import { fetchPath, relToAbsUrl } from './utils'

class OAuthService {
  private readonly config: Promise<OAuthConfig | null>
  private readonly delegateService: Promise<OAuthDelegateService | null>

  // Contains JWT access_token and information about user.
  private readonly userProfile: UserProfile = new UserProfile()

  constructor() {
    log.debug('Initialising OAuth Service')
    configManager.initItem('oAuth Configuration', TaskState.started, 'config')
    this.config = this.loadOAuthConfig()
    this.delegateService = this.processConfig()
  }

  private async loadOAuthConfig(): Promise<OAuthConfig | null> {
    return fetchPath<OAuthConfig | null>(PATH_OSCONSOLE_CLIENT_CONFIG, {
      success: (data: string) => {
        log.debug('Loaded', PATH_OSCONSOLE_CLIENT_CONFIG, ':', data)
        return JSON.parse(data)
      },
      error: err => {
        this.userProfile.setError(err)
        return null
      },
    })
  }

  private async processConfig(): Promise<OAuthDelegateService | null> {
    const config = await this.config
    if (!config) {
      this.userProfile.setError(new Error('Cannot find the osconsole configuration'))
      return null
    }
    log.debug('OAuth config to be processed:', config)

    log.debug('Adding master uri to profile')
    this.userProfile.setMasterUri(relToAbsUrl(config.master_uri ?? '/master'))
    this.userProfile.setMasterKind(config.master_kind ?? KUBERNETES_MASTER_KIND)

    log.debug('Adding hawtio-mode to profile metadata')
    const hawtioMode = config.hawtio?.mode ?? DEFAULT_HAWTIO_MODE
    this.userProfile.addMetadata(HAWTIO_MODE_KEY, hawtioMode)
    if (hawtioMode !== DEFAULT_HAWTIO_MODE)
      this.userProfile.addMetadata(HAWTIO_NAMESPACE_KEY, config.hawtio?.namespace ?? DEFAULT_HAWTIO_NAMESPACE)

    let delegateService: OAuthDelegateService | null = null
    if (config.form) {
      delegateService = new FormService(config.form, this.userProfile)
    } else if (config.openshift) {
      delegateService = new OSOAuthService(config.openshift, this.userProfile)
    }

    if (!delegateService) {
      this.userProfile.setError(new Error('Cannot initialise service as no protocol service can be initialised'))
    }

    // add a method, so user can explicitly initiate oAuth login
    configManager
      .configureAuthenticationMethod({
        method: AUTH_METHOD,
        login: this.delegateLogin,
      })
      .then(() => {
        // only now finish the initialization task
        configManager.initItem('oAuth Configuration', TaskState.finished, 'config')
      })

    return delegateService
  }

  private delegateLogin = async (): Promise<AuthenticationResult> => {
    const delegateService = await this.delegateService
    if (!delegateService) {
      return AuthenticationResult.configuration_error
    }
    if (!window.isSecureContext) {
      log.error("Can't perform oAuth authentication in non-secure context")
      return AuthenticationResult.security_context_error
    }

    // this will cause redirect, so there's nothing to await for
    // after redirect we'll go through constructor(), init() and loadUserProfile() again
    // Therefore, if it gets to here then this is a configuration error.
    return AuthenticationResult.configuration_error
  }

  /**
   * Service has a working protocol service delegate
   * but not necessarily logged in yet
   */
  async isActive(): Promise<boolean> {
    const delegateService = await this.delegateService
    return delegateService !== null
  }

  /**
   * Service has a working protocol service and
   * fully logged-in
   */
  async isLoggedIn(): Promise<boolean> {
    const delegateService = await this.delegateService
    if (!delegateService) {
      return false
    }

    if (this.userProfile.hasError()) {
      log.debug('Cannot login as user profile has an error: ', this.userProfile.getError())
      return false
    }

    const loginStatus = await delegateService.loginStatus()
    return loginStatus === AuthenticationResult.ok && this.userProfile.isActive()
  }

  getUserProfile(): UserProfile {
    return this.userProfile
  }

  async registerUserHooks(): Promise<void> {
    log.debug('Registering oAuth user hooks')
    const fetchUser = async (resolve: ResolveUser) => {
      const delegateService = await this.delegateService
      if (!delegateService || this.userProfile.hasError()) {
        return {
          isIgnore: false,
          isError: this.userProfile.hasError(),
          loginMethod: AUTH_METHOD,
        }
      }

      const status = await delegateService.fetchUser(resolve)
      return { isIgnore: false, isError: !status, loginMethod: AUTH_METHOD }
    }

    userService.addFetchUserHook(AUTH_METHOD, fetchUser)

    const logout: LogoutHook = async () => {
      const delegateService = await this.delegateService
      return delegateService?.logout() ?? false
    }
    userService.addLogoutHook(AUTH_METHOD, logout)
  }
}

export const oAuthService = new OAuthService()
