import { UserProfile } from '@hawtio/online-oauth'
import { Logger } from '@hawtio/react'

export const pluginName = 'KubernetesAPI'
export const log = Logger.get('hawtio-k8s-api')

export let K8S_PREFIX = 'api'
export const OS_PREFIX = 'apis'
export const K8S_EXT_PREFIX = 'apis/extensions'

export const K8S_API_VERSION = 'v1'
export const OS_API_VERSION = 'v1'
export const K8S_EXT_VERSION = 'v1beta1'

class KubernetesAPI {
  private oAuthProfile?: UserProfile
  private isOS = false
  private error: Error|null = null

  getOAuthProfile() {
    return this.oAuthProfile
  }

  setOAuthProfile(oAuthProfile: UserProfile) {
    this.oAuthProfile = oAuthProfile
  }

  getMasterUri(): string {
    return this.oAuthProfile?.getMasterUri() || ''
  }

  isOpenshift(): boolean {
    return this.isOS
  }

  setIsOpenshift(isOpenshift: boolean) {
    this.isOS = isOpenshift
  }

  hasError() {
    return this.error !== null
  }

  getError() {
    return this.error
  }

  setError(error: Error) {
    this.error = error
  }
}

export const k8Api = new KubernetesAPI()
