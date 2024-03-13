import { Logger } from '@hawtio/react'

export const pluginName = 'hawtio-online-oauth'
export const log = Logger.get(pluginName)
export const PATH_OSCONSOLE_CLIENT_CONFIG = 'osconsole/config.json'
export const LOGOUT_ENDPOINT = '/auth/logout'

export const METADATA_KEY_HAWTIO_MODE = 'hawtio-mode'
export const METADATA_KEY_HAWTIO_NAMESPACE = 'hawtio-namespace'
export const METADATA_KEY_CLUSTER_CONSOLE = 'cluster-console'

export type AuthType = 'oauth' | 'form'
export type MasterKind = 'openshift' | 'kubernetes'

export class UserProfile {
  /**
   * Type of auth with the profile: oauth or form
   */
  private authType: AuthType = 'oauth'
  private masterUri?: string
  private masterKind?: MasterKind
  private token?: string
  private error?: Error
  private metadata: Record<string, unknown> = {}

  isActive(): boolean {
    return this.hasToken() || !this.hasError()
  }

  hasToken(): boolean {
    return this.getToken().length > 0
  }

  isOpenShift(): boolean {
    return this.getMasterKind() === 'openshift'
  }

  getAuthType(): AuthType {
    return this.authType
  }

  setAuthType(type: AuthType) {
    this.authType = type
  }

  getToken(): string {
    return this.token ?? ''
  }

  setToken(token: string) {
    this.token = token
  }

  getMasterUri(): string {
    return this.masterUri ?? ''
  }

  setMasterUri(masterUri: string) {
    this.masterUri = masterUri
  }

  getMasterKind(): MasterKind {
    return this.masterKind ?? 'openshift'
  }

  setMasterKind(masterKind: MasterKind) {
    this.masterKind = masterKind
  }

  hasError(): boolean {
    return this.error !== undefined
  }

  getError(): Error | undefined {
    return this.error
  }

  setError(cause: Error) {
    this.error = new Error('OpenShift OAuth Error', { cause })
    log.error(cause)
  }

  addMetadata(key: string, value: unknown) {
    this.metadata[key] = value
  }

  getMetadata(): Record<string, unknown> {
    return this.metadata
  }

  metadataValue<T>(key: string): T {
    return this.metadata[key] as T
  }
}
