import { Logger } from '@hawtio/react'
import { FormConfig } from './form'
import { OpenShiftOAuthConfig } from './openshift'

export const moduleName = 'hawtio-oauth'
export const log = Logger.get(moduleName)
export const PATH_OSCONSOLE_CLIENT_CONFIG = 'osconsole/config.json'

export interface OAuthConfig {
  master_uri?: string
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
  isActive(): Promise<boolean>
  registerUserHooks(): void
}

export class UserProfile {
  // Type of oauth is the profile, eg. openshift, form
  private oAuthType: string = 'unknown'
  private masterUri?: string
  private token?: string
  private error: Error | null = null
  private metadata: Record<string, unknown> = {}

  getOAuthType() {
    return this.oAuthType
  }

  setOAuthType(oAuthType: string) {
    this.oAuthType = oAuthType
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

  addMetadata<T>(key: string, value: T) {
    this.metadata[key] = value
  }

  getMetadata(): Record<string, unknown> {
    return this.metadata
  }

  metadataValue<T>(key: string) {
    return this.metadata[key] as T
  }
}
