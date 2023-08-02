import { Logger } from '@hawtio/react'

export const pluginName = 'KubernetesAPI'
export const log = Logger.get('hawtio-k8s-api')

export const K8S_PREFIX = 'api'
export const OS_PREFIX = 'apis'
export const K8S_EXT_PREFIX = 'apis/extensions'

export const K8S_API_VERSION = 'v1'
export const OS_API_VERSION = 'v1'
export const K8S_EXT_VERSION = 'v1beta1'

export interface KubeMetadata {
  name?: string,
  namespace?: string,
  uid?: string,
  resourceVersion?: string,
  creationTimestamp?: string,
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface KubeStatus {
  phase: string
}

export interface KubeObject extends Record<string, unknown> {
  kind?: string,
  apiVersion?: string,
  metadata: KubeMetadata
  spec?: Record<string, string>
  status?: KubeStatus
}

export interface KubeObjectList extends KubeObject {
  items: KubeObject[]
}

/*
 * States emitted by the Kubernetes Service
 */
export enum K8Actions {
  CHANGED = 'CHANGED'
}
