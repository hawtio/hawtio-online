import { FormConfig } from './form'
import { KUBERNETES_MASTER_KIND, OPENSHIFT_MASTER_KIND, log } from './globals'
import { oAuthService } from './oauth-service'
import { OpenShiftOAuthConfig } from './openshift'

export interface OAuthConfig {
  master_uri?: string
  master_kind: string
  hawtio?: Hawtio
  form?: FormConfig
  openshift?: OpenShiftOAuthConfig
  token?: string
}

export interface Hawtio {
  mode: string
  namespace?: string
}

export interface OAuthProtoService {
  isLoggedIn(): Promise<boolean>
  registerUserHooks(): void
}

export class UserProfile {
  // Type of oauth is the profile, eg. openshift, form
  private oAuthType = 'unknown'
  private masterUri?: string
  private masterKind?: string
  private token?: string
  private error: Error | null = null
  private metadata: Record<string, unknown> = {}

  getOAuthType() {
    return this.oAuthType
  }

  setOAuthType(oAuthType: string) {
    this.oAuthType = oAuthType
  }

  isActive(): boolean {
    return this.hasToken() || this.hasError()
  }

  hasToken(): boolean {
    return this.getToken().length > 0
  }

  getToken(): string {
    return this.token ?? ''
  }

  setToken(token: string) {
    this.token = token
  }

  getMasterUri(): string {
    return this.masterUri ?? ''
  }

  setMasterUri(masterUri: string) {
    this.masterUri = masterUri
  }

  getMasterKind(): string {
    return this.masterKind ?? ''
  }

  setMasterKind(masterKind: string) {
    const ucType = masterKind.toUpperCase()
    if (ucType === KUBERNETES_MASTER_KIND || ucType === OPENSHIFT_MASTER_KIND) this.masterKind = ucType
    else {
      log.warn(`Unknown value set for master_kind in config (${masterKind}). Defaulting master kind to kubernetes`)
      this.masterKind = KUBERNETES_MASTER_KIND
    }
  }

  hasError() {
    return this.error !== null
  }

  getError() {
    return this.error
  }

  setError(error: Error) {
    this.error = new Error('Openshift OAuth Error', { cause: error })
    log.error(error)
  }

  addMetadata<T>(key: string, value: T) {
    this.metadata[key] = value
  }

  getMetadata(): Record<string, unknown> {
    return this.metadata
  }

  metadataValue<T>(key: string) {
    return this.metadata[key] as T
  }
}

let userProfile: UserProfile | null = null

async function findUserProfile(): Promise<UserProfile> {
  const loggedIn = await oAuthService.isLoggedIn()
  if (loggedIn) {
    log.debug('Active Auth plugin:', oAuthService.getUserProfile().getOAuthType())
    return oAuthService.getUserProfile()
  } else {
    return Promise.reject('No user profile is yet available')
  }
}

export async function getActiveProfile(): Promise<UserProfile> {
  if (!userProfile) {
    log.debug("Finding 'userProfile' from the active OAuth plugins")
    userProfile = await findUserProfile()
  }

  return userProfile
}

export function getOAuthType(): string | null {
  const profile: UserProfile = !userProfile ? oAuthService.getUserProfile() : userProfile
  if (!profile) return null

  return profile.getOAuthType()
}
