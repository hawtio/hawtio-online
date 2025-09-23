import { oAuthInit } from '@hawtio/online-oauth'
import { log } from './globals'
import { k8Init } from './init'

const registerK8Api = async (): Promise<boolean> => {
  log.debug('Awaiting registering of OAuth')
  await oAuthInit()

  log.debug('OAuth registered - getting active profile')
  return await k8Init()
}

export async function isK8ApiRegistered(): Promise<boolean> {
  return await registerK8Api()
}

export { K8Actions, JOLOKIA_PORT_QUERY, log } from './globals'

export type {
  Paging,
  KubeObject,
  KubeObjectList,
  KubePod,
  KubeProject,
  KubePodsOrError,
  KubePodsByProject,
  NamespaceSpec,
  NamespaceStatus,
  Pod,
  PodCondition,
  PodSpec,
  PodStatus,
  Container,
  ContainerPort,
  ContainerStatus,
  ObjectMeta,
  OwnerReference,
} from './globals'

export * from './filter'
export * from './sort'
export { k8Api, k8Service } from './init'
export * from './utils'
