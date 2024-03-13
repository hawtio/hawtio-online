export const OAUTH_OS_PROTOCOL_MODULE = 'hawtio-oauth-openshift'

export const EXPIRES_IN_KEY = 'expires_in'
export const TOKEN_TYPE_KEY = 'token_type'
export const OBTAINED_AT_KEY = 'obtainedAt'
export const CLUSTER_VERSION_KEY = 'cluster-version'
export const DEFAULT_CLUSTER_VERSION = '<unknown>'

export type OpenShiftOAuthConfig = {
  oauth_metadata_uri?: string
  issuer?: string
  oauth_authorize_uri?: string
  oauth_client_id: string
  scope: string
  cluster_version?: string
  web_console_url?: string
}
