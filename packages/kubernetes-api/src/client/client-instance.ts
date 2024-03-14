import { KubeObject } from '../globals'
import { Collection } from './globals'

/*
 * Manages references to collection instances to allow them to be shared between views
 */
export class ClientInstance<T extends KubeObject> {
  private _refCount = 0
  private _collection: Collection<T>

  constructor(_collection: Collection<T>) {
    this._collection = _collection
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
    return this._collection
  }

  disposable() {
    return this._refCount <= 0
  }

  destroy() {
    this._collection.destroy()
    // delete this._collection
  }
}
