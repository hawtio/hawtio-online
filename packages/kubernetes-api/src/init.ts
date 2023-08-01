import { log } from './globals'
import { KubernetesAPI } from './kubernetes-api'
import { KubernetesService } from './kubernetes-service'

export const k8Api = new KubernetesAPI()
export const k8Service = new KubernetesService()

export const k8Init = async (): Promise<boolean> => {
  if (k8Api.initialized && k8Service.initialized)
    return true

  log.debug("Initialising kubernetes api")
  let inited = await k8Api.initialize() // Will wait until initialized or in error
  if (!inited)
    return false

  log.debug("Initialising kubernetes service")
  inited = await k8Service.initialize()
  if (!inited)
    return false

  log.debug("Completed initialising kubernetes-api")
  return true
}
