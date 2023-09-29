import { HawtioPlugin, configManager } from '@hawtio/react'
import { log } from './globals'
import { getActiveProfile } from './api'
import { osOAuthService } from './osoauth'

let initialised = false

export const oAuthRegister = async (): Promise<void> => {
  if (initialised) return

  log.info('Initialising the active profile')
  try {
    await getActiveProfile()
    osOAuthService.registerUserHooks()
    log.info('All OAuth plugins have been executed.')
    initialised = true
  } catch (error) {
    log.error('Failed to initialise the oauth plugin: ', error)
  }
}

export function oAuthInitialised(): boolean {
  return initialised
}

export const oAuthInit: HawtioPlugin = async () => {
  // Add Product Info
  configManager.addProductInfo('Hawtio OAuth', 'PACKAGE_VERSION_PLACEHOLDER')

  await oAuthRegister()
}

export * from './metadata'
export * from './globals'
export * from './api'
