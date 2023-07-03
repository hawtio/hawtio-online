import { HawtioPlugin, configManager } from '@hawtio/react'
import { kubernetesAPIInit } from './kubernetes-api-init'

export const kubernetesAPI: HawtioPlugin = () => {

  // Add Product Info
  configManager.addProductInfo('Hawtio Kubernetes API', 'PACKAGE_VERSION_PLACEHOLDER')

  kubernetesAPIInit()
}

export * from './kubernetes-api-globals'
