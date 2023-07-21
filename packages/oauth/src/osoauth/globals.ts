import { Logger } from '@hawtio/react'
import { UserProfile } from '../globals'

export const moduleName = 'hawtio-oauth-openshift'
export const log = Logger.get(moduleName)

export interface OpenShiftConfig {
  master_uri?: string
  openshift?: OpenShiftOAuthConfig
  token?: string
}

export interface OpenShiftOAuthConfig {
  oauth_metadata_uri?: string
  issuer?: string
  oauth_authorize_uri?: string
  oauth_client_id: string
  scope: string
}

class OpenShiftAuth implements OpenShiftConfig {
  master_uri?: string
  openShiftAuthConfig?: OpenShiftOAuthConfig
  token?: string

  getOpenShiftAuthConfig(): OpenShiftOAuthConfig {
    return this.openShiftAuthConfig as OpenShiftOAuthConfig
  }

  setOpenShiftAuthConfig(osConfig: OpenShiftOAuthConfig) {
    this.openShiftAuthConfig = osConfig
  }
}

export const openShiftAuth: OpenShiftAuth = new OpenShiftAuth()

export interface TokenMetadata {
  access_token?: string,
  token_type?: string,
  expires_in?: string,
  obtainedAt?: number
}

export type OSUserProfile = UserProfile & TokenMetadata

export const userProfile: OSUserProfile = new UserProfile(moduleName)
