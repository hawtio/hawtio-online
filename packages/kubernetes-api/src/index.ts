import { HawtioPlugin, configManager } from '@hawtio/react'
import { kubernetesAPIInit } from './init'

export const registerKubernetesAPI: HawtioPlugin = () => {

  // Add Product Info
  configManager.addProductInfo('Hawtio Kubernetes API', 'PACKAGE_VERSION_PLACEHOLDER')

  kubernetesAPIInit()
}

export * from './globals'
