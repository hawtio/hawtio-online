import { UserProfile } from '@hawtio/online-oauth'
import { Logger } from '@hawtio/react'
import { KubeObject } from '../globals'
import { WatchActions, WatchTypes } from '../model'

export const log = Logger.get('hawtio-k8s-objects')

// Allow clients to add other types to force polling under whatever circumstances
export const pollingOnly = [WatchTypes.IMAGE_STREAM_TAGS]

export const UNKNOWN_VALUE = '<unknown>'
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
  namespace?: string
  apiVersion?: string
  labelSelector?: string
  object?: KubeObject | KOptions
  success?: (objs: KubeObject[]) => void
  error?: ErrorDataCallback
  urlFunction?: (options: KOptions) => string
}

export type ProcessDataCallback<T extends KubeObject> = (data: T[]) => void

export type ErrorDataCallback = (err: Error) => void

export interface Collection<T extends KubeObject> {
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
  collection: Collection<T>
  error: ErrorDataCallback | undefined
  connect(): void
  send(data: string | KubeObject): void
  onOpen(event: Event): void
  onMessage(event: MessageEvent): void
  onError(event: Event): void
  shouldClose(event: Event): boolean
  onClose(event: CloseEvent): void
  destroy(): void
}

export interface ClientFactory {
  create<T extends KubeObject>(profile: UserProfile, options: KOptions, namespace?: string): Collection<T>
  destroy<T extends KubeObject>(client: Collection<T>, ...handles: Array<ProcessDataCallback<T>>): void
}
