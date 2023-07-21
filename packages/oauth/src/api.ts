import { UserProfile, log } from './globals'
import * as osOAuth from './osoauth'

let userProfile: UserProfile|null = null

function findUserProfile(): UserProfile|null {
  if (osOAuth.userProfile.isActive()) {
    log.debug("Active OAuth plugin:", osOAuth.moduleName)
    return osOAuth.userProfile
  }

  return null
}

export function getActiveProfile(): UserProfile|null {
  if (! userProfile) {
    log.debug("Finding 'userProfile' from the active OAuth plugin")
    userProfile = findUserProfile()
  }
  return userProfile
}

export function getProfileErrors(): Error[] {
  const errors: Error[] = []
  if (osOAuth.userProfile.hasError()) {
    errors.push(osOAuth.userProfile.getError() as Error)
  }

  return errors
}

/**
 * Retrieves the oauth token from the user profile.
 *  - Try the user profile from options, if provided
 *  - Try the current userProfile is set
 *  - Try finding the the userProfile is available
 */
export function getOAuthToken(options?: {profile: UserProfile}): string|null {
  let profile: UserProfile|null
  if (options && options.profile)
    profile = options.profile
  else if (userProfile)
    profile = userProfile
  else {
    profile = findUserProfile()
  }

  if (!profile)
    return null

  return profile.getToken().length > 0 ? profile.getToken() : null
}

// TODO - replace with keycloak method of updating window.fetch - see keycloak-service.ts
export function oAuthFetch(url: URL|RequestInfo, options: RequestInit | undefined, profile?: UserProfile) {
  const enhanced = { ...options }

  const token = getOAuthToken(profile ? {profile: profile} : undefined)
  if (token) {
    enhanced.headers = {
      ...enhanced.headers,
      Authorization: `Bearer ${token}`,
    }
  }

  return fetch(url, enhanced)
}
