import { configManager } from '@hawtio/react'
import { oAuthRegister } from '@hawtio/online-oauth'
import { k8Init } from './init'
import { log } from './globals'

let configAdded = false

const registerK8Api = async (): Promise<boolean> => {
  if (! configAdded) {
    // Add Product Info
    configManager.addProductInfo('Hawtio Kubernetes API', 'PACKAGE_VERSION_PLACEHOLDER')
    configAdded = true
  }

  log.debug('Awaiting registering of OAuth')
  await oAuthRegister()

  log.debug('OAuth registered -  getting active profile')
  return await k8Init()
}

export async function isK8ApiRegistered(): Promise<boolean> {
  return await registerK8Api()
}

export * from './globals'
export {k8Api, k8Service} from './init'
export * from './utils'
