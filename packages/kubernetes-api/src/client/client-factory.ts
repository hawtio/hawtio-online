import { UserProfile } from '@hawtio/online-oauth'
import { KubeObject } from '../globals'
import { ClientInstance } from './client-instance'
import { CollectionImpl } from './collection'
import { log, Collection, KOptions, ClientFactory, ProcessDataCallback } from './globals'
import { getKey } from './support'

/*
 * Factory implementation
 */
export class ClientFactoryImpl implements ClientFactory {
  private _clients: Record<string, unknown> = {}

  create<T extends KubeObject>(profile: UserProfile, options: KOptions): Collection<T> {
    const key = getKey(options.kind, options.namespace)
    if (this._clients[key]) {
      const client = this._clients[key] as ClientInstance<T>
      client.addRef()
      log.debug('Returning existing client for key:', key, 'refcount is:', client.refCount)
      return client.collection
    } else {
      const client = new ClientInstance<T>(new CollectionImpl(profile, options))
      client.addRef()
      log.debug("Creating new client for key: '", key, "' refcount is: ", client.refCount)
      this._clients[key] = client
      return client.collection
    }
  }

  destroy<T extends KubeObject>(client: Collection<T>, ...handles: Array<ProcessDataCallback<T>>) {
    handles.forEach(handle => {
      client.unwatch(handle)
    })
    const key = client.getKey()
    if (this._clients[key]) {
      const c = this._clients[key] as ClientInstance<T>
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
