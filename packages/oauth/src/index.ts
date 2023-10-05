import { hawtio, HawtioPlugin, configManager } from '@hawtio/react'
import { log } from './globals'
import { getActiveProfile } from './api'
import { oAuthService } from './oauth-service'
import { FORM_AUTH_PROTOCOL_MODULE, FORM_AUTH_PROTOCOL_MODULE_FORM } from './form/globals'
import { FormAuthLoginForm } from './form'

let initialised = false

const oAuthRegister = async (): Promise<void> => {
  if (initialised) return

  log.info('Initialising the active profile')
  try {
    oAuthService.registerUserHooks()
    await getActiveProfile()
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

  if (hawtio.getPlugins().filter(plugin => plugin.id === FORM_AUTH_PROTOCOL_MODULE).length === 0) {
    hawtio.addPlugin({
      id: FORM_AUTH_PROTOCOL_MODULE,
      title: FORM_AUTH_PROTOCOL_MODULE_FORM,
      path: '/login',
      isLogin: true,
      component: FormAuthLoginForm,
      isActive: async () => {
        await oAuthService.isActive()
        const profile = oAuthService.getUserProfile()
        return profile.getOAuthType() === FORM_AUTH_PROTOCOL_MODULE
      },
    })
  }

  await oAuthRegister()
}

export * from './metadata'
export * from './globals'
export * from './api'
export * from './openshift'
export * from './form'
