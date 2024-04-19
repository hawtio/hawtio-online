import { LOGOUT_ENDPOINT, log } from '../globals'
import { isBlank } from './strings'

/**
 * Join the supplied strings together using '/', stripping any leading/ending '/'
 * from the supplied strings if needed, except the first and last string.
 */
export function joinPaths(...paths: string[]): string {
  const tmp: string[] = []
  paths.forEach((path, index) => {
    if (isBlank(path)) {
      return
    }
    if (path === '/') {
      tmp.push('')
      return
    }
    if (index !== 0 && path.match(/^\//)) {
      path = path.slice(1)
    }
    if (index < paths.length - 1 && path.match(/\/$/)) {
      path = path.slice(0, path.length - 1)
    }
    if (!isBlank(path)) {
      tmp.push(path)
    }
  })
  return tmp.join('/')
}

async function logoutRedirectAvailable(): Promise<boolean> {
  const response = await fetch(LOGOUT_ENDPOINT)
  if (!response || response.status >= 400) {
    log.debug('Warning: Server does not have a logout page. Redirecting to login provider directly ...')
    return false
  }

  return true
}

export function logoutUri(): URL {
  return new URL(relToAbsUrl(LOGOUT_ENDPOINT))
}

export function logoutRedirect(redirectUri: URL): void {
  // Have a logout page so append redirect uri to its url
  const targetUri = logoutUri()
  targetUri.searchParams.append('redirect_uri', redirectUri.toString())

  logoutRedirectAvailable().then(exists => {
    if (exists) redirect(targetUri)
    else redirect(redirectUri)
  })
}

export function validateRedirectURI(redirectUri: URL) {
  const currentUrl = new URL(window.location.href)
  const { hostname, port, protocol } = redirectUri
  return (
    hostname === currentUrl.hostname &&
    port === currentUrl.port &&
    protocol === currentUrl.protocol &&
    ['http:', 'https:'].includes(protocol)
  )
}

export function sanitizeUri(url: URL) {
  const searchParams = url.searchParams

  if (searchParams.toString() !== '') {
    searchParams.forEach((value, key) => {
      searchParams.set(key, encodeURIComponent(value))
    })
  }
  return url.href
}

export function redirect(target: URL) {
  log.debug('Redirecting to URI:', target)
  // Redirect to the target URI
  window.location.href = target.toString()
}

export function relToAbsUrl(relativeUrl: string): string {
  return new URL(relativeUrl, window.location.origin).href
}
