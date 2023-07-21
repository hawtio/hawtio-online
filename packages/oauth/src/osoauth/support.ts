import { log } from '../globals'
import { oAuthFetch } from '../api'
import { openShiftAuth, TokenMetadata, userProfile } from './globals'

const OS_TOKEN_STORAGE_KEY = 'osAuthCreds'

export function currentTimeSeconds(): number {
  return Math.floor(new Date().getTime() / 1000)
}

export function doLogout(): void {
  const currentURI = new URL(window.location.href)
  const uri = new URL(`${openShiftAuth.master_uri}/apis/oauth.openshift.io/v1/oauthaccesstokens/${userProfile.getToken()}`)

  // The following request returns 403 when delegated authentication with an
  // OAuthClient is used, as possible scopes do not grant permissions to access the OAuth API:
  // See https://github.com/openshift/origin/issues/7011

  oAuthFetch(uri.toString(), { method: 'DELETE' })
    .then((response) => {
      if (response?.ok) {
        clearTokenStorage()
        doLogin({ uri: currentURI.toString() })
      }
    })
}

export function doLogin(options: { uri: string }): void {
  const osAuth = openShiftAuth.getOpenShiftAuthConfig()
  const clientId = osAuth.oauth_client_id
  const targetURI = osAuth.oauth_authorize_uri
  const scope = osAuth.scope

  const uri = new URL(targetURI as string)

  /**
   * The authorization uri uses the searchParams for holding
   * the parameters while the token response uri returns the token
   * and metadata in the hash
   */
  uri.searchParams.append('client_id', clientId)
  uri.searchParams.append('response_type', 'token')
  uri.searchParams.append('state', options.uri)
  uri.searchParams.append('redirect_uri', options.uri)
  uri.searchParams.append('scope', scope)

  const target = uri.toString()
  log.debug("Redirecting to URI:", target)

  // Redirect to the target URI
  window.location.href = target
}

export function extractToken(uri: URL): TokenMetadata|null {
  log.debug("Extract token from URI - query:", uri.search)

  const fragmentParams = new URLSearchParams(uri.hash.substring(1))

  log.debug("Extract token from URI - fragmentParams:", fragmentParams)
  if (!fragmentParams.has('access_token') ||
      (fragmentParams.get('token_type') !== 'bearer' && fragmentParams.get('token_type') !== "Bearer")) {
    log.debug("No token in URI")
    return null
  }

  log.debug("Got token")
  const credentials: TokenMetadata = {
    token_type: fragmentParams.get('token_type') || '',
    access_token: fragmentParams.get('access_token') || '',
    expires_in: fragmentParams.get('expires_in') || '',
    obtainedAt: currentTimeSeconds()
  }
  localStorage.setItem(OS_TOKEN_STORAGE_KEY, JSON.stringify(credentials))

  fragmentParams.delete('token_type')
  fragmentParams.delete('access_token')
  fragmentParams.delete('expires_in')
  fragmentParams.delete('scope')
  fragmentParams.delete('state')

  uri.hash = fragmentParams.toString()

  const target = uri.toString()
  log.debug("redirecting to:", target)

  // Redirect to new location
  window.location.href = target

  return credentials
}

export function clearTokenStorage(): void {
  localStorage.removeItem(OS_TOKEN_STORAGE_KEY)
}

export function checkToken(uri: URL): TokenMetadata {
  let answer: any

  const tokenJson = localStorage.getItem(OS_TOKEN_STORAGE_KEY)

  if (tokenJson) {
    try {
      answer = JSON.parse(tokenJson)
    } catch (e) {
      clearTokenStorage()
      userProfile.setError(new Error("Error extracting osAuthCreds value:", {cause: e}))
    }
  }
  if (!answer) {
    log.debug("Extracting token from uri", answer)
    answer = extractToken(uri)
  }

  log.debug("Using extracted credentials:", answer)
  return answer
}
