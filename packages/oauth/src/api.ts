import { ResolveUser } from '@hawtio/react'
import { FormConfig } from './form'
import { OpenShiftOAuthConfig } from './openshift'

export type OAuthConfig = {
  master_uri: string
  master_kind: 'openshift' | 'kubernetes'
  hawtio: Hawtio
  form?: FormConfig
  openshift?: OpenShiftOAuthConfig
  token?: string
}

export type HawtioMode = 'cluster' | 'namespace'

export type Hawtio = {
  mode: HawtioMode
  namespace?: string
}

export interface ProtocolService {
  isLoggedIn(): Promise<boolean>
  fetchUser(resolve: ResolveUser): Promise<boolean>
  logout(): Promise<boolean>
}
