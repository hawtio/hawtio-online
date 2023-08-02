import { ProcessDataCallback } from '../kubernetes-service'
import { ClientInstance, ClientMap } from './client-instance'
import { CollectionImpl } from './collection'
import { log, Collection, KOptions, ClientFactory } from './globals'
import { getKey } from './support'

/*
 * Factory implementation that's available as an angular service
 */
export class ClientFactoryImpl implements ClientFactory {
  private _clients = {} as ClientMap

  create(options: KOptions, namespace?: string): Collection {
    namespace = options.namespace || namespace

    const key = getKey(options.kind, namespace)
    if (this._clients[key]) {
      const client = this._clients[key]
      client.addRef()
      log.debug('Returning existing client for key:', key, 'refcount is:', client.refCount)
      return client.collection
    } else {
      const client = new ClientInstance(new CollectionImpl(options))
      client.addRef()
      log.debug("Creating new client for key: '", key, "' refcount is: ", client.refCount)
      this._clients[key] = client
      return client.collection
    }
  }

  destroy(client: Collection, ...handles: Array<ProcessDataCallback>) {
    handles.forEach(handle => {
      client.unwatch(handle)
    })
    const key = client.getKey()
    if (this._clients[key]) {
      const c = this._clients[key]
      c.removeRef()
      log.debug('Removed reference to client with key:', key, 'refcount is:', c.refCount)
      if (c.disposable()) {
        delete this._clients[key]
        c.destroy()
        log.debug('Destroyed client for key:', key)
      }
    }
  }
}

export const clientFactory: ClientFactory = new ClientFactoryImpl()
