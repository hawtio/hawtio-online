import { HawtioPlugin } from '@hawtio/react'
import { log } from './globals'
import { managementService } from './management-service'

export const onlineManagementApi: HawtioPlugin = () => {
  log.debug('Loading Management API plugin')
  const init = async () => {
    log.debug('Initialising Management Service')
    await managementService.initialize()

    log.debug('Loaded Management API plugin')
  }
  init()
}

export * from './globals'
export * from './managed-pod'
export * from './management-service'
