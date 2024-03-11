import { FormConfig } from './form'
import { UserProfile, log } from './globals'
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
