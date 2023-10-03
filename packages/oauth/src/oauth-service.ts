import { log, OAuthProtoService, UserProfile } from './globals'
import { fetchPath } from './utils'
import {
  DEFAULT_HAWTIO_MODE,
  DEFAULT_HAWTIO_NAMESPACE,
  HAWTIO_MODE_KEY,
  HAWTIO_NAMESPACE_KEY,
} from './metadata'
import { OAuthConfig, PATH_OSCONSOLE_CLIENT_CONFIG } from './globals'
import { OSOAuthService } from './openshift'
import { relToAbsUrl } from './utils/utils'

class OAuthService {
  private userProfile: UserProfile = new UserProfile()

  private readonly config: Promise<OAuthConfig | null>
  private readonly protoService: Promise<OAuthProtoService | null>
  private readonly active: Promise<boolean>

  constructor() {
    log.debug('Initialising OAuth Service')
    this.config = this.loadOAuthConfig()
    this.protoService = this.processConfig()
    this.active = this.isProtoServiceActive()
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

    log.debug('Adding hawtio-mode to profile metadata')
    const hawtioMode = config.hawtio?.mode || DEFAULT_HAWTIO_MODE
    this.userProfile.addMetadata(HAWTIO_MODE_KEY, hawtioMode)
    if (hawtioMode !== DEFAULT_HAWTIO_MODE)
      this.userProfile.addMetadata(HAWTIO_NAMESPACE_KEY, config.hawtio?.namespace || DEFAULT_HAWTIO_NAMESPACE)

    let protoService: OAuthProtoService | null = null
    if (config.form) {
      // return new FormService(config.form)
      log.debug("*** FORM SERVICE TO BE IMPLEMENTED")
      protoService = null
    } else if (config.openshift) {
      protoService = new OSOAuthService(config.openshift, this.userProfile)
    } else {
      this.userProfile.setError(new Error('Cannot initialise service due to no protocol configuration'))
    }

    return protoService
  }

  private async isProtoServiceActive(): Promise<boolean> {
    const protoService = await this.protoService
    if (!protoService) {
      return false
    }

    if (this.userProfile.hasError()) {
      log.debug('Cannot login as user profile has error: ', this.userProfile.getError())
      return false
    }

    return await protoService.isActive()
  }

  async isActive(): Promise<boolean> {
    await this.active
    return this.userProfile.isActive()
  }

  getUserProfile(): UserProfile {
    return this.userProfile
  }

  async registerUserHooks(): Promise<void> {
    log.debug('Registering oAuth user hooks')

    const protoService = await this.protoService
    const active = protoService?.isActive ?? false
    if (!active) {
      log.debug('Cannot register user hooks as OAuth Protocol Service is not active')
      return
    }

    protoService?.registerUserHooks()
  }
}

export const oAuthService = new OAuthService()
