import { Logger } from '@hawtio/react'
import { KubernetesConfig, OpenShiftOAuthConfig } from './kubernetes-api-model'

export const pluginName = 'KubernetesAPI'
export const log = Logger.get('hawtio-k8s-api')

export let K8S_PREFIX = 'api'
export const OS_PREFIX = 'apis'
export const K8S_EXT_PREFIX = 'apis/extensions'

export const K8S_API_VERSION = 'v1'
export const OS_API_VERSION = 'v1'
export const K8S_EXT_VERSION = 'v1beta1'

class KubernetesAPI {
  private kubeConfig: KubernetesConfig|null = null
  private masterUrl = ""
  private openShift = false

  getKubeConfig(): KubernetesConfig {
    return this.kubeConfig as KubernetesConfig
  }

  setKubeConfig(kubeConfig: KubernetesConfig) {
    this.kubeConfig = kubeConfig
  }

  getOSOAuthConfig(): OpenShiftOAuthConfig | null {
    return (this.kubeConfig && this.kubeConfig.openshift) ? this.kubeConfig.openshift : null
  }

  getMasterUrl(): string {
    return this.masterUrl
  }

  setMasterUrl(masterUrl: string) {
    this.masterUrl = masterUrl
  }

  isOpenShift(): boolean {
    return this.openShift
  }

  setOpenshift(openshift: boolean) {
    this.openShift = openshift
  }
}

export const kubernetesAPI = new KubernetesAPI()
