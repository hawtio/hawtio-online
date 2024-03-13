import { log, UserProfile } from '../globals'
import { logoutRedirect, redirect, relToAbsUrl, secureDispose, secureRetrieve, secureStore } from '../utils'
import { EXPIRES_IN_KEY, OBTAINED_AT_KEY, OpenShiftOAuthConfig } from './globals'

export type TokenMetadata = {
  accessToken?: string
  tokenType?: string
  expiresIn?: number
  obtainedAt?: number
}

const OS_TOKEN_STORAGE_KEY = 'online.oauth.openshift.credentials'

export function currentTimeSeconds(): number {
  return Math.floor(new Date().getTime() / 1000)
}

export function buildUserInfoUri(masterUri: string, config: OpenShiftOAuthConfig): string {
  let uri: URL
  if (masterUri) {
    uri = new URL(relToAbsUrl(masterUri) + '/apis/user.openshift.io/v1/users/~')
  } else {
    uri = new URL(`${config.oauth_authorize_uri}/apis/user.openshift.io/v1/users/~`)
  }

  return uri.toString()
}

export function forceRelogin(url: URL, config: OpenShiftOAuthConfig) {
  clearTokenStorage()

  const targetUri = buildLoginUrl(config, { url: url.toString() })
  logoutRedirect(targetUri)
}

export function buildLoginUrl(config: OpenShiftOAuthConfig, options: { url: string }): URL {
  if (!config) {
    log.debug('Cannot login due to config not being properly defined')
    throw new Error('Cannot complete login process due to incorrect configuration profile')
  }

  const clientId = config.oauth_client_id
  const targetURI = config.oauth_authorize_uri
  const scope = config.scope

  const url = new URL(targetURI as string)

  /**
   * The authorization uri uses the searchParams for holding
   * the parameters while the token response uri returns the token
   * and metadata in the hash
   */
  url.searchParams.append('client_id', clientId)
  url.searchParams.append('response_type', 'token')
  url.searchParams.append('state', options.url)
  url.searchParams.append('redirect_uri', options.url)
  url.searchParams.append('scope', scope)

  return url
}

/**
 * Extracts token from the hash part of the URL.
 *
 * If a token is found, it stores the token to the local storage and redirects to
 * the original URL so that the login check flow can be reiterated with the stored
 * token.
 *
 * If no token is found, it just returns null and lets the subsequent steps to
 * prompt the user to login.
 */
async function extractToken(url: URL): Promise<TokenMetadata | null> {
  log.debug('Extract token from URL - search:', url.search, 'hash:', url.hash)

  //
  // Error has occurred on the lines of a scoping denied
  //
  const searchParams = new URLSearchParams(url.search)
  if (searchParams.has('error')) {
    const error = searchParams.get('error_description') ?? 'unknown login error occurred'
    throw new Error(error)
  }

  const fragmentParams = new URLSearchParams(url.hash.substring(1))

  log.debug('Extract token from URI - fragmentParams:', fragmentParams)
  const accessToken = fragmentParams.get('access_token') ?? undefined
  const tokenType = fragmentParams.get('token_type') ?? undefined
  if (!accessToken || tokenType?.toLowerCase() !== 'bearer') {
    log.debug('No token in URL')
    return null
  }

  log.debug('Got token')
  const credentials: TokenMetadata = {
    accessToken,
    tokenType,
    expiresIn: parseInt(fragmentParams.get('expires_in') ?? '0') ?? 0,
    obtainedAt: currentTimeSeconds(),
  }

  await secureStore(OS_TOKEN_STORAGE_KEY, JSON.stringify(credentials))

  // Remove hash fragments from URL
  fragmentParams.delete('token_type')
  fragmentParams.delete('access_token')
  fragmentParams.delete('expires_in')
  fragmentParams.delete('scope')
  fragmentParams.delete('state')
  url.hash = fragmentParams.toString()

  // Redirect to new location
  redirect(url)

  return credentials
}

export function clearTokenStorage() {
  secureDispose(OS_TOKEN_STORAGE_KEY)
}

export function tokenHasExpired(profile: UserProfile): boolean {
  // if no token metadata then remaining will end up as (-1 - now())
  let remaining = -1
  if (!profile) return true // no profile so no token

  if (!profile.getToken()) return true // no token then must have expired!

  const obtainedAt = profile.metadataValue<number>(OBTAINED_AT_KEY) ?? 0
  const expiry = profile.metadataValue<number>(EXPIRES_IN_KEY) ?? 0
  if (obtainedAt) {
    remaining = obtainedAt + expiry - currentTimeSeconds()
  }

  return remaining <= 0
}

export async function checkToken(url: URL): Promise<TokenMetadata | null> {
  let answer: TokenMetadata | null = null

  try {
    const tokenJson = await secureRetrieve(OS_TOKEN_STORAGE_KEY)
    if (tokenJson) {
      answer = JSON.parse(tokenJson)
    }
  } catch (err) {
    clearTokenStorage()
    log.warn('Error extracting OSOAuth credentials:', err)
  }

  if (!answer) {
    log.debug('Extracting token from URL:', url)
    try {
      answer = await extractToken(url)
    } catch (err) {
      log.warn('Error extracting token from URL:', err)
    }
  }

  log.debug('Using extracted credentials:', answer)
  return answer
}
