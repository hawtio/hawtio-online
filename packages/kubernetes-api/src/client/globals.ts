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

export interface CompareResult {
  added: Array<any>;
  modified: Array<any>;
  deleted: Array<any>;
}

export interface ObjectMap {
  [uid: string]: any
}

export interface KOptions extends Record<string, unknown> {
  kind: string
  namespace?: string
  apiVersion?: string
  labelSelector?: string
  object?: any
  success?: (objs: any[]) => void
  error?: (err: any) => void
  urlFunction?: (options: KOptions) => string
}

export interface Collection {
  options: KOptions
  kind: string
  wsURL: string
  restURL: string
  namespace?: string
  connected: boolean
  oAuthToken: string,
  connect(): any
  get(cb: (data: any[]) => void): void
  watch(cb: (data: any[]) => void): (data: any[]) => void
  unwatch(cb: (data: any[]) => void): void
  put(item: any, cb: (data: any) => void, error?: (err: any) => void): void
  delete(item: any, cb: (data: any) => void, error?: (err: any) => void): void
  getKey(): string
  destroy(): void
}

export interface ObjectList {
  kind: string
  initialized: boolean
  objects: KubeObject[]
  initialize(): void
  hasNamedItem(item: any): boolean
  getNamedItem(name: string): any
  added(object: any): boolean
  modified(object: any): boolean
  deleted(object: any): boolean
  triggerChangedEvent(...args: any[]): void
  doOnce(action: WatchActions, cb: (data: any[]) => void): void
  doOn(action: WatchActions, cb: (data: any[]) => void): void
  doOff(action: WatchActions, cb: (data: any[]) => void): void
}

export interface WSHandler {
  connected: boolean
  kind: string
  list: ObjectList
  collection: Collection
  error: ((err: any) => void) | undefined
  connect(): void
  send(data: any): void
  onopen(event: any): void
  onmessage(event: any): void
  onerror(event: any): void
  shouldClose(event: any): boolean
  onclose(event: any): void
  destroy(): void
}

export interface ClientFactory {
  create(options: KOptions, namespace?: string): Collection
  destroy(client: Collection, ...handles: Array<(data: any[]) => void>): void
}
