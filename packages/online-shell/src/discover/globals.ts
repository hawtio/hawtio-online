import { ManagedPod } from '@hawtio/online-management-api'
import { Logger } from '@hawtio/react'

export const pluginPath = '/discover'
export const pluginName = 'hawtio-online-discover'
export const log = Logger.get(pluginName)

export enum DiscoverType {
  Group = 0,
  Pod = 1,
}

export interface DiscoverItem {
  type: DiscoverType
  name: string
  namespace: string
  uid: string
}

export interface DiscoverGroup extends DiscoverItem {
  replicas: DiscoverPod[]
  config?: string
  version?: string
  statefulset?: string
}

export interface DiscoverPod extends DiscoverItem {
  owner?: string
  labels: Record<string, string>
  annotations: Record<string, string>
  mPod: ManagedPod
}
