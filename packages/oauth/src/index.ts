import { HawtioPlugin, configManager } from '@hawtio/react'
import { oAuthOSInit } from "./osoauth/init"
import { log } from "./globals"
import { getActiveProfile } from "./api"

export let initialised = false

export const registerOAuth: HawtioPlugin = () => {

  // Add Product Info
  configManager.addProductInfo('Hawtio OAuth', 'PACKAGE_VERSION_PLACEHOLDER')

  log.info("Initialising openshift oauth")
  oAuthOSInit()
    .then(() => {
      log.info("Initialising the active profile")
      getActiveProfile()

      log.info("All OAuth plugins have been executed.")
      initialised = true
    })
}

export * from './globals'
export * from './api'
