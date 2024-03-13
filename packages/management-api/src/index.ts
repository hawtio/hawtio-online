import { isK8sApiRegistered } from '@hawtio/online-kubernetes-api'
import { log } from './globals'
import { ManagementService } from './management-service'

export const mgmtService = new ManagementService()

const managementApi = async (): Promise<boolean> => {
  await isK8sApiRegistered()

  log.debug('Awaiting registering of ManagementService')
  return await mgmtService.initialize()
}

export async function isMgmtApiRegistered(): Promise<boolean> {
  return await managementApi()
}

export { MgmtActions } from './globals'
export { ManagedPod } from './managed-pod'
