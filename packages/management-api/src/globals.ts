import { Logger } from '@hawtio/react'

export const pluginName = 'hawtio-management-api'
export const log = Logger.get(pluginName)

/*
 * States emitted by the Management Service
 */
export enum MgmtActions {
  UPDATED = 'UPDATED',
}
