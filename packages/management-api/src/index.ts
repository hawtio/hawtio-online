import { configManager } from '@hawtio/react'
import { ManagementService } from './management-service'
import { log } from './globals'
import { isK8ApiRegistered } from '@hawtio/online-kubernetes-api'

export const mgmtService = new ManagementService()

let configAdded = false

const registerManagementApi = async (): Promise<boolean> => {
  if (!configAdded) {
    // Add Product Info
    configManager.addProductInfo('Hawtio Management API', 'PACKAGE_VERSION_PLACEHOLDER')
    configAdded = true
  }

  await isK8ApiRegistered()

  log.debug('Awaiting registering of ManagementService')
  return await mgmtService.initialize()
}

export async function isMgmtApiRegistered(): Promise<boolean> {
  return await registerManagementApi()
}

export { MgmtActions, log } from './globals'
export { ManagedPod } from './managed-pod'
