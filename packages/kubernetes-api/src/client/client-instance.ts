import { Collection } from "./globals"

export interface ClientMap {
  [name: string]: ClientInstance
}

/*
 * Manages references to collection instances to allow them to be shared between views
 */
export class ClientInstance {
  private _refCount = 0
  private _collection: Collection

  constructor(_collection: Collection) {
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
