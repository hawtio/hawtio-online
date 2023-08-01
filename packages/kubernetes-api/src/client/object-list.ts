import EventEmitter from 'eventemitter3'
import { Logger } from '@hawtio/react'
import { KubeObject } from '../globals'
import { equals, getName, getNamespace, toKindName } from '../helpers'
import { WatchActions } from '../model'
import { debounce } from '../utils'
import { log, ObjectList } from './globals'

/**
 *  Manages the array of k8s objects for a client instance
 **/
export class ObjectListImpl extends EventEmitter implements ObjectList {

  triggerChangedEvent = debounce(() => {
    this.emit(WatchActions.ANY, this._objects)
  }, 75)

  private _initialized = false
  private _objects: Array<KubeObject> = []

  constructor(private _kind?: string, private namespace?: string) {
    super()
    if (log.enabledFor(Logger.DEBUG)) {
      this.on(WatchActions.ADDED, (object) => {
        log.debug("added", this.kind, ":", object)
      })
      this.on(WatchActions.MODIFIED, (object) => {
        log.debug("modified", this.kind, ":", object)
      })
      this.on(WatchActions.DELETED, (object) => {
        log.debug("deleted", this.kind, ":", object)
      })
      this.on(WatchActions.ANY, (objects) => {
        log.debug(this.kind, "changed:", objects)
      })
      this.on(WatchActions.INIT, (objects) => {
        log.debug(this.kind, "initialized")
      })
    }
    this.on(WatchActions.ANY, (objects) => {
      this.initialize()
    })
  }

  public get kind() {
    return this._kind || '<unknown>'
  }

  public initialize() {
    if (this._initialized) {
      return
    }
    this._initialized = true

    this.emit(WatchActions.INIT, this._objects)
    this.triggerChangedEvent()
  }

  public get initialized() {
    return this._initialized
  }

  public get objects() {
    return this._objects
  }

  public set objects(objs: any[]) {
    this._objects.length = 0
    objs.forEach((obj) => {
      if (!obj.kind) {
        obj.kind = toKindName(this.kind) || undefined
      }
      this._objects.push(obj)
    })
    this.initialize()
    this.triggerChangedEvent()
  }

  public hasNamedItem(item: any): boolean {
    return this._objects.some((obj: KubeObject) => {
      return getName(obj) === getName(item)
    })
  }

  public getNamedItem(name: string): any {
    return this.objects.find((obj: any) => {
      return getName(obj) === name
    })
  }

  // filter out objects from other namespaces that could be returned
  private belongs(object: any): boolean {
    if (this.namespace && getNamespace(object) !== this.namespace) {
      return false
    }
    return true
  }

  doOnce(action: WatchActions, cb: (data: any[]) => void) {
    this.once(action, cb)
  }

  doOn(action: WatchActions, cb: (data: any[]) => void) {
    this.once(action, cb)
  }

  doOff(action: WatchActions, cb: (data: any[]) => void) {
    this.off(action, cb)
  }

  added(object: any): boolean {
    if (!this.belongs(object)) {
      return false
    }
    if (!object.kind) {
      object.kind = toKindName(this.kind)
    }
    if (this._objects.some((obj) => { return equals(obj, object)})) {
      return this.modified(object)
    }
    this._objects.push(object)
    this.emit(WatchActions.ADDED, object)
    this.triggerChangedEvent()
    return true
  }

  public modified(object: any): boolean {
    if (!this.belongs(object)) {
      return false
    }
    if (!object.kind) {
      object.kind = toKindName(this.kind)
    }
    if (!this._objects.some((obj) => { return equals(obj, object) })) {
      return this.added(object)
    }
    this._objects.forEach((obj) => {
      if (equals(obj, object)) {
        this.emit(WatchActions.MODIFIED, object)
        this.triggerChangedEvent()
      }
    })
    return true
  }

  public deleted(object: any): boolean {
    if (!this.belongs(object)) {
      return false
    }

    const idx = this._objects.indexOf(object)
    const deleted = this._objects.splice(idx, 1)
    if (deleted) {
      this.emit(WatchActions.DELETED, deleted)
      this.triggerChangedEvent()
    }
    return deleted.length > 0
  }
}
