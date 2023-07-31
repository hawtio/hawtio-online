import { log } from './globals'
import { KubernetesAPI } from './kubernetes-api'
import { KubernetesService } from './kubernetes-service'

export let k8Loaded: boolean = false
export let k8Api: KubernetesAPI
export let k8Service: KubernetesService

export async function k8Init() {
  log.info("Initialising kubernetes api")
  k8Api = new KubernetesAPI()
  await k8Api.initialize() // Will wait until initialized or in error

  if (k8Api.initialized) {
    k8Service = new KubernetesService()
    await k8Service.initialize()
  }

  k8Loaded = true
}
