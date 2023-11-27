import { oAuthInit } from '@hawtio/online-oauth'
import { k8Init } from './init'
import { log } from './globals'

const registerK8Api = async (): Promise<boolean> => {
  log.debug('Awaiting registering of OAuth')
  oAuthInit()

  log.debug('OAuth registered -  getting active profile')
  return await k8Init()
}

export async function isK8ApiRegistered(): Promise<boolean> {
  return await registerK8Api()
}

export * from './globals'
export { k8Api, k8Service } from './init'
export * from './utils'
