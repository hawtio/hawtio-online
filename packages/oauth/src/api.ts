import { FetchUserHook, LogoutHook, ResolveUser } from '@hawtio/react'
import { FormConfig } from './form'
import { UserProfile, log } from './globals'
import { oAuthService } from './oauth-service'
import { OpenShiftOAuthConfig } from './openshift'

export interface OAuthConfig {
  master_uri: string
  master_kind: 'openshift' | 'kubernetes'
  hawtio: Hawtio
  form?: FormConfig
  openshift?: OpenShiftOAuthConfig
  token?: string
}

export type HawtioMode = 'cluster' | 'namespace'

export interface Hawtio {
  mode: HawtioMode
  namespace?: string
}

export interface ProtocolService {
  isLoggedIn(): Promise<boolean>
  fetchUser(resolve: ResolveUser): Promise<boolean>
  logout(): Promise<boolean>
}

let userProfile: UserProfile | null = null

async function findUserProfile(): Promise<UserProfile> {
  const loggedIn = await oAuthService.isLoggedIn()
  if (!loggedIn) {
    throw new Error('No user profile is yet available')
  }

  const userProfile = await oAuthService.getUserProfile()
  log.debug('Active Auth plugin:', userProfile.getAuthType())
  return userProfile
}

export async function getActiveProfile(): Promise<UserProfile> {
  if (!userProfile) {
    log.debug("Finding 'userProfile' from the active OAuth plugins")
    userProfile = await findUserProfile()
  }

  return userProfile
}
