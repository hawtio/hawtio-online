import { hawtio, HawtioPlugin } from '@hawtio/react'
import { FormAuthLoginForm } from './form'
import { oAuthService } from './oauth-service'

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
      const profile = await oAuthService.getUserProfile()
      return profile.getAuthType() === 'form'
    },
  })
}

export * from './api'
export * from './form'
export * from './globals'
export * from './oauth-service'
export * from './openshift'
