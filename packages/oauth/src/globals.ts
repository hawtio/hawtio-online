import { Logger } from '@hawtio/react'

export const moduleName = 'hawtio-oauth'
export const log = Logger.get(moduleName)

export class UserProfile {
  private oauthType: string // which type of oauth is the profile, eg. google, openshift, github
  private masterUri?: string
  private token?: string
  private error: Error | null = null
  private metadata: Record<string, string> = {}

  constructor(oauthType: string) {
    this.oauthType = oauthType
  }

  getOAuthType() {
    return this.oauthType
  }

  isActive(): boolean {
    return this.hasToken() || this.hasError()
  }

  hasToken(): boolean {
    return this.getToken().length > 0
  }

  getToken(): string {
    return this.token ? this.token : ''
  }

  setToken(token: string) {
    this.token = token
  }

  getMasterUri(): string {
    return this.masterUri ? this.masterUri : ''
  }

  setMasterUri(masterUri: string) {
    this.masterUri = masterUri
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

  addMetadata(key: string, value: string) {
    this.metadata[key] = value
  }

  getMetadata(): Record<string, string> {
    return this.metadata
  }

  metadataValue(key: string) {
    return this.metadata[key]
  }
}
