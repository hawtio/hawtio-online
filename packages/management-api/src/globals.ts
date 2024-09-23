import { Logger } from '@hawtio/react'
import { ManagedPod } from './managed-pod'
import { ManagedProject } from './managed-project'

export const pluginName = 'hawtio-online-management-api'
export const log = Logger.get(pluginName)

/*
 * States emitted by the Management Service
 */
export enum MgmtActions {
  UPDATED = 'UPDATED',
}

export type MPodsByUid = { [uid: string]: ManagedPod }

export type ManagedProjects = { [key: string]: ManagedProject }
