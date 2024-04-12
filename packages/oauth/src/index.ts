import { hawtio, HawtioPlugin } from '@hawtio/react'
import { getActiveProfile } from './api'
import { FormAuthLoginForm } from './form'
import { FORM_AUTH_PROTOCOL_MODULE } from './form/globals'
import { log } from './globals'
import { oAuthService } from './oauth-service'

let initialised = false

export const oAuthInit = async () => {
  if (initialised) return

  log.info('Initialising the active profile')
  try {
    await getActiveProfile()
    log.info('All OAuth plugins have been executed.')
    initialised = true
  } catch (error) {
    log.error('Failed to initialise the oauth plugin:', error)
  }
}

export function oAuthInitialised(): boolean {
  return initialised
}

export const onlineOAuth: HawtioPlugin = () => {
  oAuthService.registerUserHooks()
  // Register the plugin for replacing the login form in the form auth mode
  hawtio.addPlugin({
    id: 'online-oauth',
    title: 'Online OAuth',
    // For login plugin, path shouldn't have any effect
    path: '/online-oauth',
    isLogin: true,
    component: FormAuthLoginForm,
    isActive: async () => {
      if (!(await oAuthService.isActive())) return false
      const profile = oAuthService.getUserProfile()
      return profile.getOAuthType() === FORM_AUTH_PROTOCOL_MODULE
    },
  })

  oAuthInit()
}

export * from './api'
export * from './form'
export * from './globals'
export * from './metadata'
export * from './openshift'
