import { Logger } from '@hawtio/react'
import { KubeSearchMetadata, KubeObject } from '../globals'
import { WatchActions, WatchTypes } from '../model'
import { SimpleResponse } from '../utils'

export const log = Logger.get('hawtio-online-k8s-objects')

// Allow clients to add other types to force polling under whatever circumstances
export const pollingOnly = [WatchTypes.IMAGE_STREAM_TAGS]
export const POLLING_INTERVAL = 60000

export const UNKNOWN_VALUE = '<unknown>'
export const UNKNOWN_NAME_VALUE = 'unknown'
export const NO_KIND = 'No kind in supplied options'
export const NO_OBJECT = 'No object in supplied options'
export const NO_OBJECTS = 'No objects in list object'

export interface CompareResult<T> {
  added: T[]
  modified: T[]
  deleted: T[]
}

export interface KOptions extends Record<string, unknown> {
  kind: string
  name?: string
  namespace?: string
  apiVersion?: string
  labelSelector?: string
  object?: KubeObject | KOptions
  success?: (objs: KubeObject[]) => void
  error?: ErrorDataCallback
  urlFunction?: (options: KOptions) => string
  nsLimit?: number
}

export type ProcessDataCallback<T extends KubeObject> = (data: T[], metadata?: KubeSearchMetadata) => void

export type ErrorDataCallback = (err: Error, response?: SimpleResponse) => void

export interface Watched<T extends KubeObject> {
  options: KOptions
  kind: string
  wsURL: string
  restURL: string
  namespace?: string
  connected: boolean
  oAuthToken: string
  connect(): void
  get(cb: ProcessDataCallback<T>): void
  watch(cb: ProcessDataCallback<T>): ProcessDataCallback<T>
  unwatch(cb: ProcessDataCallback<T>): void
  put(item: T, cb: ProcessDataCallback<T>, error?: ErrorDataCallback): void
  delete(item: T, cb: ProcessDataCallback<T>, error?: ErrorDataCallback): void
  getKey(): string
  destroy(): void
}

export interface ObjectList<T extends KubeObject> {
  kind: string
  initialized: boolean
  objects: T[]
  initialize(): void
  hasNamedItem(item: T): boolean
  getNamedItem(name: string): T | null
  added(object: T): boolean
  modified(object: T): boolean
  deleted(object: T): boolean
  triggerChangedEvent(): void
  doOnce(action: WatchActions, cb: ProcessDataCallback<T>): void
  doOn(action: WatchActions, cb: ProcessDataCallback<T>): void
  doOff(action: WatchActions, cb: ProcessDataCallback<T>): void
}

export interface WSHandler<T extends KubeObject> {
  connected: boolean
  kind: string
  list: ObjectList<T>
  watched: Watched<T>
  error: ErrorDataCallback | undefined
  connect(): void
  onOpen(event: Event): void
  onMessage(event: MessageEvent | { data: string }): void
  onError(event: Event): void
  onClose(event: CloseEvent): void
  destroy(): void
}

export interface ClientFactory {
  create<T extends KubeObject>(options: KOptions, namespace?: string): Watched<T>
  destroy<T extends KubeObject>(client: Watched<T>, ...handles: Array<ProcessDataCallback<T>>): void
}
