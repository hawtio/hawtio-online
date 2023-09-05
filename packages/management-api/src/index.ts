import { configManager } from '@hawtio/react'
import { ManagementService } from './management-service'
import { log } from './globals'
import { isK8ApiRegistered } from '@hawtio/online-kubernetes-api'

export const mgmtService = new ManagementService()

const registerManagementApi = async (): Promise<boolean> => {
  // Add Product Info
  configManager.addProductInfo('Hawtio Management API', 'PACKAGE_VERSION_PLACEHOLDER')

  await isK8ApiRegistered()

  log.debug('Awaiting registering of ManagementService')
  return await mgmtService.initialize()
}

export async function isMgmtApiRegistered(): Promise<boolean> {
  return await registerManagementApi()
}

export { MgmtActions } from './globals'
export { ManagedPod } from './managed-pod'
