export const moduleName = 'hawtio-oauth-openshift'

export const PATH_OSCONSOLE_CLIENT_CONFIG = 'osconsole/config.json'

export interface OpenShiftOAuthConfig {
  oauth_metadata_uri?: string
  issuer?: string
  oauth_authorize_uri?: string
  oauth_client_id: string
  scope: string
  cluster_version?: string
}

export interface Hawtio {
  mode: string
  namespace?: string
}

export interface OpenShiftConfig {
  master_uri?: string
  hawtio?: Hawtio
  token?: string
  openshift?: OpenShiftOAuthConfig
}

export interface TokenMetadata {
  access_token?: string
  token_type?: string
  expires_in?: number
  obtainedAt?: number
}

export type User = {
  username: string
  isLogin: boolean
}

export type ResolveUser = (user: User) => void
