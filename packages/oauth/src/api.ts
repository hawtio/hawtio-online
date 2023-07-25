import { log, UserProfile } from './globals'
import { osOAuthService } from './osoauth/osoauth-service'

let userProfile: UserProfile|null = null

async function findUserProfile(): Promise<UserProfile|null> {
  if (await osOAuthService.isActive()) {
    log.debug("Active OAuth plugin:", osOAuthService.getUserProfile().getOAuthType())
    return osOAuthService.getUserProfile()
  }

  return null
}

export async function getActiveProfile(): Promise<UserProfile|null> {
  if (! userProfile) {
    log.debug("Finding 'userProfile' from the active OAuth plugins")
    userProfile = await findUserProfile()
  }
  return userProfile
}
