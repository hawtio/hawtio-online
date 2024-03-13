import { FetchUserHook, LogoutHook, userService } from '@hawtio/react'
import { OAuthConfig, ProtocolService } from './api'
import { FormService } from './form'
import {
  METADATA_KEY_HAWTIO_MODE,
  METADATA_KEY_HAWTIO_NAMESPACE,
  PATH_OSCONSOLE_CLIENT_CONFIG,
  UserProfile,
  log,
} from './globals'
import { OSOAuthService } from './openshift'
import { fetchPath, relToAbsUrl } from './utils'

class OAuthService {
  private readonly userProfile: Promise<UserProfile>
  private resolveUserProfile = (_: UserProfile) => {
    // no-op
  }
  private readonly config: Promise<OAuthConfig>
  private readonly protocolService: Promise<ProtocolService>

  constructor() {
    log.debug('Initialising OAuth Service')
    this.userProfile = new Promise<UserProfile>(resolve => {
      this.resolveUserProfile = resolve
    })
    this.config = this.loadOAuthConfig()
    this.protocolService = this.processConfig()
  }

  private async loadOAuthConfig(): Promise<OAuthConfig> {
    const config = await fetchPath<OAuthConfig | null>(PATH_OSCONSOLE_CLIENT_CONFIG, {
      success: (data: string) => {
        log.debug('Loaded', PATH_OSCONSOLE_CLIENT_CONFIG, ':', data)
        return JSON.parse(data)
      },
      error: () => null,
    })
    if (!config) {
      throw new Error('Cannot find the osconsole configuration')
    }
    return config
  }

  private async processConfig(): Promise<ProtocolService> {
    const config = await this.config
    log.debug('OAuth config to be processed:', config)

    const { master_uri, master_kind, hawtio, openshift, form } = config
    const userProfile = new UserProfile()
    userProfile.setMasterUri(relToAbsUrl(master_uri))
    userProfile.setMasterKind(master_kind)
    userProfile.addMetadata(METADATA_KEY_HAWTIO_MODE, hawtio.mode)
    if (hawtio.mode === 'namespace') {
      if (!hawtio.namespace) {
        log.warn('Namespace should be provided from', PATH_OSCONSOLE_CLIENT_CONFIG, 'when hawtio mode is namespace')
      }
      userProfile.addMetadata(METADATA_KEY_HAWTIO_NAMESPACE, hawtio.namespace ?? 'hawtio')
    }

    let protoService: ProtocolService | null = null
    if (openshift) {
      protoService = new OSOAuthService(openshift, userProfile)
    } else if (form) {
      protoService = new FormService(form, userProfile)
    }

    if (!protoService) {
      throw new Error('Cannot initialise service as no protocol service can be initialised')
    }

    log.debug('Loaded user profile:', userProfile)
    this.resolveUserProfile(userProfile)
    return protoService
  }

  /**
   * Service has a working protocol service and
   * fully logged-in
   */
  async isLoggedIn(): Promise<boolean> {
    const userProfile = await this.userProfile
    if (userProfile.hasError()) {
      log.debug('Cannot login as user profile has error: ', userProfile.getError())
      return false
    }

    const protoService = await this.protocolService
    return (await protoService.isLoggedIn()) && userProfile.isActive()
  }

  getUserProfile(): Promise<UserProfile> {
    return this.userProfile
  }

  registerUserHooks() {
    log.debug('Registering OAuth user hooks')
    const fetchUser: FetchUserHook = async resolve => {
      const protoService = await this.protocolService
      return protoService.fetchUser(resolve)
    }
    userService.addFetchUserHook('online-oauth', fetchUser)

    const logout: LogoutHook = async () => {
      const protoService = await this.protocolService
      return protoService.logout()
    }
    userService.addLogoutHook('online-oauth', logout)
  }
}

export const oAuthService = new OAuthService()
