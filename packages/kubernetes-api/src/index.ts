import { HawtioPlugin, configManager } from '@hawtio/react'
import { oAuthRegister } from '@hawtio/online-oauth'
import { k8Init } from './init'
import { log } from './globals'

export const registerK8Api: HawtioPlugin = async () => {
  // Add Product Info
  configManager.addProductInfo('Hawtio Kubernetes API', 'PACKAGE_VERSION_PLACEHOLDER')

  log.debug('Awaiting registering of OAuth')
  await oAuthRegister()

  log.debug('OAuth registered -  getting active profile')
  k8Init()
}

export * from './globals'
export * from './init'
