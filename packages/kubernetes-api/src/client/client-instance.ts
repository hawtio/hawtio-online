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

  public get refCount() {
    return this._refCount
  }

  public addRef() {
    this._refCount = this._refCount + 1
  }

  public removeRef() {
    this._refCount = this._refCount - 1
  }

  public get collection() {
    return this._collection
  }

  public disposable() {
    return this._refCount <= 0
  }

  public destroy() {
    this._collection.destroy()
    // delete this._collection
  }
}
