import { log } from './globals'
import { ManagementService } from './management-service'

export const mgmtService = new ManagementService()

const managementApi = async (): Promise<boolean> => {
  log.debug('x Awaiting registering of ManagementService')
  return await mgmtService.initialize()
}

export async function isMgmtApiRegistered(): Promise<boolean> {
  return await managementApi()
}

export { MgmtActions } from './globals'
export { ManagedPod } from './managed-pod'
