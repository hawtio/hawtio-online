import { OAuthConfig, OAuthProtoService } from './api'
import { FormService } from './form'
import { KUBERNETES_MASTER_KIND, PATH_OSCONSOLE_CLIENT_CONFIG, UserProfile, log } from './globals'
import { DEFAULT_HAWTIO_MODE, DEFAULT_HAWTIO_NAMESPACE, HAWTIO_MODE_KEY, HAWTIO_NAMESPACE_KEY } from './metadata'
import { OSOAuthService } from './openshift'
import { fetchPath, relToAbsUrl } from './utils'

class OAuthService {
  private readonly userProfile: UserProfile = new UserProfile()

  private readonly config: Promise<OAuthConfig | null>
  private readonly protoService: Promise<OAuthProtoService | null>

  constructor() {
    log.debug('Initialising OAuth Service')
    this.config = this.loadOAuthConfig()
    this.protoService = this.processConfig()
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

  private async processConfig(): Promise<OAuthProtoService | null> {
    const config = await this.config
    if (!config) {
      this.userProfile.setError(new Error('Cannot find the osconsole configuration'))
      return null
    }
    log.debug('OAuth config to be processed: ', config)

    log.debug('Adding master uri to profile')
    this.userProfile.setMasterUri(relToAbsUrl(config.master_uri || '/master'))
    this.userProfile.setMasterKind(config.master_kind || KUBERNETES_MASTER_KIND)

    log.debug('Adding hawtio-mode to profile metadata')
    const hawtioMode = config.hawtio?.mode || DEFAULT_HAWTIO_MODE
    this.userProfile.addMetadata(HAWTIO_MODE_KEY, hawtioMode)
    if (hawtioMode !== DEFAULT_HAWTIO_MODE)
      this.userProfile.addMetadata(HAWTIO_NAMESPACE_KEY, config.hawtio?.namespace || DEFAULT_HAWTIO_NAMESPACE)

    let protoService: OAuthProtoService | null = null
    if (config.form) {
      protoService = new FormService(config.form, this.userProfile)
    } else if (config.openshift) {
      protoService = new OSOAuthService(config.openshift, this.userProfile)
    }

    if (!protoService) {
      this.userProfile.setError(new Error('Cannot initialise service as no protocol service can be initialised'))
    }

    return protoService
  }

  private async isProtoServiceLoggedIn(): Promise<boolean> {
    const protoService = await this.protoService
    if (!protoService) {
      return false
    }

    if (this.userProfile.hasError()) {
      log.debug('Cannot login as user profile has error: ', this.userProfile.getError())
      return false
    }

    return await protoService.isLoggedIn()
  }

  /**
   * Service has a working protocol service delegate
   * but not necessarily logged in yet
   */
  async isActive(): Promise<boolean> {
    const protoService = await this.protoService
    return protoService !== null
  }

  /**
   * Service has a working protocol service and
   * fully logged-in
   */
  async isLoggedIn(): Promise<boolean> {
    const protoServiceActive = await this.isProtoServiceLoggedIn()
    return protoServiceActive && this.userProfile.isActive()
  }

  getUserProfile(): UserProfile {
    return this.userProfile
  }

  async registerUserHooks(): Promise<void> {
    log.debug('Registering oAuth user hooks')

    const protoService = await this.protoService
    const loggedIn = (await protoService?.isLoggedIn()) ?? false
    if (!loggedIn) {
      log.debug('Cannot register user hooks as OAuth Protocol Service is not logged-in')
      return
    }

    protoService?.registerUserHooks()
  }
}

export const oAuthService = new OAuthService()
