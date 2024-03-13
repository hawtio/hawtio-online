import { HawtioPlugin } from '@hawtio/react'
import { kubernetesApi } from './api'
import { log } from './globals'
import { kubernetesService } from './kubernetes-service'

export const onlineKubernetesApi: HawtioPlugin = () => {
  log.debug('Loading Kubernetes API plugin')
  const init = async () => {
    log.debug('Initialising Kubernetes API')
    await kubernetesApi.initialize()

    log.debug('Initialising Kubernetes Service')
    await kubernetesService.initialize()

    log.debug('Loaded Kubernetes API plugin')
  }
  init()
}

export * from './api'
export * from './globals'
export * from './kubernetes-service'
export * from './utils'
