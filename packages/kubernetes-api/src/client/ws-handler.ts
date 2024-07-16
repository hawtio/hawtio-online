import { KubeSearchMetadata, KubeObject } from '../globals'
import { isFunction, isObject } from '../utils'
import { Collection, ErrorDataCallback, log, ObjectList, WSHandler } from './globals'
import { ObjectListImpl } from './object-list'
import { ObjectPoller } from './object-poller'

/**
 * Manages the polling connection to the backend and passes events to the ObjectListImpl
 */
export class WSHandlerImpl<T extends KubeObject> implements WSHandler<T> {
  private _collection: Collection<T>
  private _list?: ObjectList<T>
  private _metadata?: KubeSearchMetadata

  private poller?: ObjectPoller<T>
  private destroyed = false

  constructor(collection: Collection<T>) {
    this._collection = collection
  }

  set list(_list: ObjectList<T>) {
    this._list = _list
  }

  get list(): ObjectList<T> {
    return this._list || new ObjectListImpl<T>()
  }

  set metadata(_metadata: KubeSearchMetadata) {
    this._metadata = _metadata
  }

  get metadata(): KubeSearchMetadata {
    return this._metadata || { count: 0 }
  }

  get collection() {
    return this._collection
  }

  get error(): ErrorDataCallback | undefined {
    return this._collection.options.error
  }

  get kind() {
    return this._collection.kind
  }

  onMessage(event: MessageEvent | { data: string }) {
    log.debug('Receiving message from polling: ', event)
    if (!this.list) {
      log.debug('Cannot onmessage as no object list')
      return
    }
    const data = JSON.parse(event.data)

    const eventType: keyof ObjectList<T> = data.type.toLowerCase()
    if (eventType !== 'added' && eventType !== 'modified' && eventType !== 'deleted') return

    this.metadata.continue = data.metadata?.continue ?? undefined

    if (isFunction(this.list[eventType])) this.list[eventType](data.object)
    else log.debug(`Property ${data.object} is not a function`)
  }

  onOpen(event: Event) {
    log.debug('Received open event for kind:', this.collection.kind, 'namespace:', this.collection.namespace)
  }

  onClose(event: CloseEvent) {
    log.debug('Received close event for kind:', this.collection.kind, 'namespace:', this.collection.namespace)
    if (this.destroyed) {
      log.debug('polling destroyed for kind:', this.collection.kind, 'namespace:', this.collection.namespace)
      // delete this.socket
      return
    }
  }

  onError(event: Event) {
    log.debug('polling for kind:', this.collection.kind, 'received an error:', event)
  }

  get connected(): boolean {
    return isObject(this.poller) && this.poller.connected
  }

  connect() {
    log.debug('Connecting polling handler')

    if (this.destroyed) {
      return
    }

    // in case a custom URL is going to be used
    if (this.collection.restURL === '') {
      setTimeout(() => {
        this.connect()
      }, 500)
      return
    }

    if (!this.poller) {
      log.info('Using polling for kind:', this.collection.kind)
      this.poller = new ObjectPoller(this.collection.restURL, this)
      this.poller.start()
    }
  }

  destroy() {
    this.destroyed = true
    if (this.poller) {
      log.debug('Destroying poller for kind:', this.collection.kind, 'namespace:', this.collection.namespace)
      this.poller.destroy()
    }
  }
}
