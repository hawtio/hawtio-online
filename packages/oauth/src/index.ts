import { hawtio, HawtioPlugin } from '@hawtio/react'
import { getActiveProfile } from './api'
import { FormAuthLoginForm } from './form'
import { FORM_AUTH_PROTOCOL_MODULE } from './form/globals'
import { log } from './globals'
import { oAuthService } from './oauth-service'

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
  if (hawtio.getPlugins().filter(plugin => plugin.id === 'online-oauth').length === 0) {
    hawtio.addPlugin({
      id: 'online-oauth',
      title: 'Online OAuth',
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

export * from './api'
export * from './form'
export * from './globals'
export * from './metadata'
export * from './openshift'
