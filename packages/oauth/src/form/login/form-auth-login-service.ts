import { hawtio } from '@hawtio/react'
import { log } from '../../globals'
import { oAuthService } from '../../oauth-service'
import {
  FetchOptions,
  fetchPath,
  joinPaths,
  redirect,
  relToAbsUrl,
  sanitizeUri,
  secureStore,
  validateRedirectURI,
} from '../../utils'
import { FORM_TOKEN_STORAGE_KEY } from '../globals'

export type ValidationCallback = {
  success: () => void
  error: (err: Error) => void
}

class FormAuthLoginService {
  login(token: string, callback: ValidationCallback) {
    if (!token || token.trim() === '') {
      callback.error(new Error('Token is empty'))
      return
    }

    this.validateToken(token, callback)
  }

  private validateToken(token: string, callback: ValidationCallback) {
    const masterUri = oAuthService.getUserProfile().getMasterUri()
    if (!masterUri) {
      callback.error(new Error('Master URI is not found'))
      return
    }

    const fetchOptions: FetchOptions = {
      headers: { Authorization: `Bearer ${token}` },
    }

    fetchPath<void>(
      joinPaths(masterUri, 'api'),
      {
        success: async (_: string) => {
          // eslint-disable-line
          log.debug('Connected to master uri api')
          callback.success()
          await this.saveTokenAndRedirect(token)
          return
        },
        error: err => {
          callback.error(new Error('Cannot validate token', { cause: err }))
          return
        },
      },
      fetchOptions,
    )
  }

  private async saveTokenAndRedirect(token: string) {
    await secureStore(FORM_TOKEN_STORAGE_KEY, token)
    const uri = this.redirectUri()
    redirect(new URL(uri))
  }

  private redirectUri(): string {
    const currentUri = new URL(window.location.href)
    const searchParams: URLSearchParams = currentUri.searchParams
    if (searchParams.has('redirect_uri')) {
      const uri = new URL(searchParams.get('redirect_uri') as string)
      if (validateRedirectURI(uri)) {
        return sanitizeUri(uri)
      } else {
        log.error('invalid redirect_uri', uri.toString())
      }
    }

    return relToAbsUrl(hawtio.getBasePath() || window.location.origin)
  }
}

export const formAuthLoginService = new FormAuthLoginService()
