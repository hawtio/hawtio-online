import { KubeObject } from '../globals'
import { Watched } from './globals'

/*
 * Manages references to collection instances to allow them to be shared between views
 */
export class ClientInstance<T extends KubeObject> {
  private _refCount = 0
  private _watched: Watched<T>

  constructor(watched: Watched<T>) {
    this._watched = watched
  }

  get refCount() {
    return this._refCount
  }

  addRef() {
    this._refCount = this._refCount + 1
  }

  removeRef() {
    this._refCount = this._refCount - 1
  }

  get collection() {
    return this._watched
  }

  disposable() {
    return this._refCount <= 0
  }

  destroy() {
    this._watched.destroy()
    // delete this._watched
  }
}
