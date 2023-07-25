import { HawtioPlugin, configManager } from '@hawtio/react'
import { getActiveProfile, oAuthRegister } from '@hawtio/online-oauth'
import { k8Init } from './init'
import { log } from './globals'

let initialised = false

export const registerK8Api: HawtioPlugin = async () => {

  // Add Product Info
  configManager.addProductInfo('Hawtio Kubernetes API', 'PACKAGE_VERSION_PLACEHOLDER')

  log.debug("Awaiting registering of OAuth")
  await oAuthRegister()

  log.debug("OAuth registered -  getting active profile")
  const userProfile = await getActiveProfile()
  if (userProfile) {
    k8Init(userProfile)
    initialised = true
  }
}

export function k8ApiInitialised(): boolean {
  return initialised
}

export * from './globals'
