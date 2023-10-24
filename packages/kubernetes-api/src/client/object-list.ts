import EventEmitter from 'eventemitter3'
import { Logger } from '@hawtio/react'
import { KubeObject } from '../globals'
import { getName, getNamespace, toKindName } from '../helpers'
import { WatchActions } from '../model'
import { debounce } from '../utils'
import { log, ObjectList, ProcessDataCallback } from './globals'

/**
 *  Manages the array of k8s objects for a client instance
 **/
export class ObjectListImpl<T extends KubeObject> extends EventEmitter implements ObjectList<T> {
  triggerChangedEvent = debounce(() => {
    this.emit(WatchActions.ANY, this._objects)
  }, 75)

  private _initialized = false
  private _objects: Array<T> = []

  constructor(
    private _kind?: string,
    private namespace?: string,
  ) {
    super()
    if (log.enabledFor(Logger.DEBUG)) {
      this.on(WatchActions.ADDED, object => {
        log.debug('added', this.kind, ':', object)
      })
      this.on(WatchActions.MODIFIED, object => {
        log.debug('modified', this.kind, ':', object)
      })
      this.on(WatchActions.DELETED, object => {
        log.debug('deleted', this.kind, ':', object)
      })
      this.on(WatchActions.ANY, objects => {
        log.debug(this.kind, 'changed:', objects)
      })
      this.on(WatchActions.INIT, objects => {
        log.debug(this.kind, 'initialized')
      })
    }
    this.on(WatchActions.ANY, objects => {
      this.initialize()
    })
  }

  get kind() {
    return this._kind || '<unknown>'
  }

  initialize() {
    if (this._initialized) {
      return
    }
    this._initialized = true

    this.emit(WatchActions.INIT, this._objects)
    this.triggerChangedEvent()
  }

  get initialized() {
    return this._initialized
  }

  get objects(): T[] {
    return this._objects
  }

  set objects(objs: T[]) {
    this._objects.length = 0
    objs.forEach(obj => {
      if (!obj.kind) {
        obj.kind = toKindName(this.kind) || undefined
      }
      this._objects.push(obj)
    })
    this.initialize()
    this.triggerChangedEvent()
  }

  hasNamedItem(item: T): boolean {
    return this._objects.some((obj: T) => {
      return getName(obj) === getName(item)
    })
  }

  getNamedItem(name: string): T | null {
    return (
      this.objects.find((obj: T) => {
        return getName(obj) === name
      }) || null
    )
  }

  // filter out objects from other namespaces that could be returned
  private belongs(object: T): boolean {
    if (this.namespace && getNamespace(object) !== this.namespace) {
      return false
    }
    return true
  }

  doOnce(action: WatchActions, cb: ProcessDataCallback<T>) {
    this.once(action, cb)
  }

  doOn(action: WatchActions, cb: ProcessDataCallback<T>) {
    this.on(action, cb)
  }

  doOff(action: WatchActions, cb: ProcessDataCallback<T>) {
    this.off(action, cb)
  }

  added(object: T): boolean {
    if (!this.belongs(object)) return false

    if (!object.kind) object.kind = toKindName(this.kind) || undefined

    const objIdx = this.objects.findIndex(obj => obj.metadata?.uid === object.metadata?.uid)
    if (objIdx >= 0) return this.modified(object)

    this._objects.push(object)
    this.emit(WatchActions.ADDED, object)
    this.triggerChangedEvent()
    return true
  }

  modified(object: T): boolean {
    if (!this.belongs(object)) return false

    if (!object.kind) object.kind = toKindName(this.kind) || undefined

    const objIdx = this.objects.findIndex(obj => obj.metadata?.uid === object.metadata?.uid)
    if (objIdx < 0) return this.added(object)

    // Replace the old object with the new one
    this._objects.splice(objIdx, 1, object)

    this.emit(WatchActions.MODIFIED, object)
    this.triggerChangedEvent()
    return true
  }

  deleted(object: T): boolean {
    if (!this.belongs(object)) {
      return false
    }

    const objIdx = this.objects.findIndex(obj => obj.metadata?.uid === object.metadata?.uid)
    if (objIdx < 0) return false

    const deleted = this._objects.splice(objIdx, 1)
    if (deleted) {
      this.emit(WatchActions.DELETED, deleted)
      this.triggerChangedEvent()
    }
    return deleted.length > 0
  }
}
