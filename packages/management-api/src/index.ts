import { ManagementService } from './management-service'
import { log } from './globals'
import { isK8ApiRegistered } from '@hawtio/online-kubernetes-api'

export const mgmtService = new ManagementService()

const registerManagementApi = async (): Promise<boolean> => {
  await isK8ApiRegistered()

  log.debug('Awaiting registering of ManagementService')
  return await mgmtService.initialize()
}

export async function isMgmtApiRegistered(): Promise<boolean> {
  return await registerManagementApi()
}

export { MgmtActions, log } from './globals'
export { ManagedPod } from './managed-pod'
