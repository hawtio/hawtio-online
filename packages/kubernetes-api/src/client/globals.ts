import { Logger } from '@hawtio/react'
import { ErrorDataCallback, ProcessDataCallback } from '../kubernetes-service'
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

export interface Collection {
  options: KOptions
  kind: string
  wsURL: string
  restURL: string
  namespace?: string
  connected: boolean
  oAuthToken: string
  connect(): void
  get(cb: ProcessDataCallback): void
  watch(cb: ProcessDataCallback): ProcessDataCallback
  unwatch(cb: ProcessDataCallback): void
  put(item: KubeObject, cb: ProcessDataCallback, error?: ErrorDataCallback): void
  delete(item: KubeObject, cb: ProcessDataCallback, error?: ErrorDataCallback): void
  getKey(): string
  destroy(): void
}

export interface ObjectList {
  kind: string
  initialized: boolean
  objects: KubeObject[]
  initialize(): void
  hasNamedItem(item: KubeObject): boolean
  getNamedItem(name: string): KubeObject | null
  added(object: KubeObject): boolean
  modified(object: KubeObject): boolean
  deleted(object: KubeObject): boolean
  triggerChangedEvent(): void
  doOnce(action: WatchActions, cb: ProcessDataCallback): void
  doOn(action: WatchActions, cb: ProcessDataCallback): void
  doOff(action: WatchActions, cb: ProcessDataCallback): void
}

export interface WSHandler {
  connected: boolean
  kind: string
  list: ObjectList
  collection: Collection
  error: ErrorDataCallback | undefined
  connect(): void
  send(data: string | KubeObject): void
  onopen(event: Event): void
  onmessage(event: MessageEvent): void
  onerror(event: Event): void
  shouldClose(event: Event): boolean
  onclose(event: CloseEvent): void
  destroy(): void
}

export interface ClientFactory {
  create(options: KOptions, namespace?: string): Collection
  destroy(client: Collection, ...handles: Array<ProcessDataCallback>): void
}
