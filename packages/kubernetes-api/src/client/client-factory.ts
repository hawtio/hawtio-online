import { isObject } from '../utils'
import { ClientInstance, ClientMap } from './client-instance'
import { CollectionImpl } from './collection'
import { log, Collection, KOptions, ClientFactory } from './globals'
import { getKey } from './support'

/*
 * Factory implementation that's available as an angular service
 */
export class ClientFactoryImpl implements ClientFactory {
  private _clients = <ClientMap>{}

  public create(options: KOptions|string, namespace?: any): Collection {
    let _options
    let kind: string

    if (isObject(options)) {
      _options = options
      kind = options.kind
      namespace = options.namespace || namespace
    } else {
      _options = {
        kind: options,
        namespace: namespace
      }
      kind = _options.kind
    }

    const key = getKey(kind as string, namespace)
    if (this._clients[key]) {
      const client = this._clients[key]
      client.addRef()
      log.debug("Returning existing client for key:", key, "refcount is:", client.refCount)
      return client.collection
    } else {
      const client = new ClientInstance(new CollectionImpl(_options))
      client.addRef()
      log.debug("Creating new client for key:", key, "refcount is:", client.refCount)
      this._clients[key] = client
      return client.collection
    }
  }

  public destroy(client: Collection, ...handles: Array<(data: any[]) => void>) {
    handles.forEach((handle) => {
      client.unwatch(handle)
    })
    const key = client.getKey()
    if (this._clients[key]) {
      const c = this._clients[key]
      c.removeRef()
      log.debug("Removed reference to client with key:", key, "refcount is:", c.refCount)
      if (c.disposable()) {
        delete this._clients[key]
        c.destroy()
        log.debug("Destroyed client for key:", key)
      }
    }
  }
}

export const clientFactory: ClientFactory = new ClientFactoryImpl()
