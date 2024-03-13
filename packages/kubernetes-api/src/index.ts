import { log } from './globals'
import { init } from './init'

const kubernetesApi = async (): Promise<boolean> => {
  log.debug('OAuth registered - getting active profile')
  return await init()
}

export async function isK8sApiRegistered(): Promise<boolean> {
  return await kubernetesApi()
}

export * from './globals'
export { k8Api, k8Service } from './init'
export * from './utils'
