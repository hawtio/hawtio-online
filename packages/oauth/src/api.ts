import { log, UserProfile } from './globals'
import { oAuthService } from './oauth-service'

let userProfile: UserProfile | null = null

async function findUserProfile(): Promise<UserProfile> {
  if (await oAuthService.isActive()) {
    log.debug('Active Auth plugin:', oAuthService.getUserProfile().getOAuthType())
    return oAuthService.getUserProfile()
  } else {
    return Promise.reject('No user profile can be found')
  }
}

export async function getActiveProfile(): Promise<UserProfile> {
  if (!userProfile) {
    log.debug("Finding 'userProfile' from the active OAuth plugins")
    userProfile = await findUserProfile()
  }

  return userProfile
}
