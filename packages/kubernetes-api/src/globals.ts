import { Logger } from '@hawtio/react'
import { NamespaceSpec, NamespaceStatus, Pod } from 'kubernetes-types/core/v1'
import { ObjectMeta } from 'kubernetes-types/meta/v1'

export const pluginName = 'hawtio-online-k8s-api'
export const log = Logger.get(pluginName)

export const K8S_PREFIX = 'api'
export const OS_PREFIX = 'apis'
export const K8S_EXT_PREFIX = 'apis/extensions'

export const K8S_API_VERSION = 'v1'
export const OS_API_VERSION = 'v1'
export const K8S_EXT_VERSION = 'v1beta1'

export interface KubeOwnerRef {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller: boolean
  blockOwnerDeletion: boolean
}

export interface KubeObject extends Record<string, unknown> {
  kind?: string
  metadata?: ObjectMeta
  spec?: unknown
}

export interface KubeObjectList<T extends KubeObject> extends KubeObject {
  items: T[]
}

export type KubePod = Pod & KubeObject

export type KubeProject = KubeObject & {
  apiVersion: 'project.openshift.io/v1'
  spec?: NamespaceSpec
  status?: NamespaceStatus
}

/**
 * States emitted by the Kubernetes Service
 */
export enum KubernetesActions {
  CHANGED = 'CHANGED',
}

export type {
  NamespaceSpec,
  NamespaceStatus,
  Pod,
  PodCondition,
  PodSpec,
  PodStatus,
  Container,
  ContainerPort,
  ContainerStatus,
} from 'kubernetes-types/core/v1'
export type { ObjectMeta, OwnerReference } from 'kubernetes-types/meta/v1'
