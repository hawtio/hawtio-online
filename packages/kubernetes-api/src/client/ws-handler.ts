import { KubeObjectList } from '../globals'
import { fetchPath, isFunction, isString, SimpleResponse } from '../utils'
import { Collection, log, ObjectList, pollingOnly, WSHandler } from "./globals"
import { ObjectListImpl } from "./object-list"
import { ObjectPoller } from "./object-poller"

/**
 * Manages the websocket connection to the backend and passes events to the ObjectListImpl
 */
export class WSHandlerImpl implements WSHandler {
  private _collection: Collection
  private _list?: ObjectList

  private retries: number = 0
  private connectTime: number = 0
  private socket?: WebSocket
  private poller?: ObjectPoller
  private destroyed = false

  constructor(collection: Collection) {
    this._collection = collection
  }

  set list(_list: ObjectList) {
    this._list = _list
  }

  get list(): ObjectList {
    return this._list || new ObjectListImpl()
  }

  get collection() {
    return this._collection
  }

  get error(): ((err: any) => void) | undefined {
    return this._collection.options.error
  }

  get kind() {
    return this._collection.kind
  }

  private createWebSocket(url: string): WebSocket {

    /*
     * Pass the bearer token via WebSocket sub-protocol
     * An extra sub-protocol is required along with the authentication one, that gets removed
     * See https://github.com/kubernetes/kubernetes/commit/714f97d7baf4975ad3aa47735a868a81a984d1f0
     * (Update 2023: this commit is from 2017 but still holds good)
     */
    const token = this.collection.oAuthToken
    const bearerProtocol = `base64url.bearer.authorization.k8s.io.${btoa(token).replace(/=/g, '')}`

    /*
     * The binary protocol is required for correct authentication.
     * Otherwise, connection fails with a 400 or 401 authentication error
     */
    const protocols = ["base64.binary.k8s.io", bearerProtocol]

    return new WebSocket(url, protocols)
  }

  private setHandlers(self: WSHandler, ws: WebSocket) {
    Object.entries(self)
      .forEach(([key, value]) => {
        if (key.startsWith('on')) {
          const evt = key.replace('on', '')
          log.debug("Adding event handler for '" + evt + "' using '" + key + "'")
          ws.addEventListener(evt, (event: any) => {
            log.debug("received websocket event:", event)

            let method: keyof WSHandler
            method = key as any
            const property = self[method]
            if (isFunction(property))
              property(event)
            else
              log.debug(`Property ${key} is not a function`)
          })
        }
      })
  }

  send(data: any) {
    if (!isString(data)) {
      data = JSON.stringify(data)
    }

    if (this.socket)
      this.socket.send(data)
  }

  shouldClose(event: any): boolean {
    if (this.destroyed && this.socket && this.socket.readyState === WebSocket.OPEN) {
      log.debug("Connection destroyed but still receiving messages, closing websocket, kind:", this.collection.kind, "namespace:", this.collection.namespace)
      try {
        log.debug("Closing websocket for kind:", this.collection.kind)
        this.socket.close()
      } catch (err) {
        // nothing to do, assume it's already closed
      }
      return true
    }
    return false
  }

  onmessage(event: any) {
    log.debug("Receiving message from web socket: ", event)
    if (this.shouldClose(event)) {
      log.debug("Should be closed!")
      return
    }
    if (! this.list) {
      log.debug("Cannot onmessage as no object list")
      return
    }
    const data = JSON.parse(event.data)

    let eventType: keyof ObjectList
    eventType = data.type.toLowerCase()
    if (eventType !== 'added' && eventType !== 'modified' && eventType !== 'deleted')
      return

    const property = this.list[eventType]
    if (isFunction(property))
      property(data.object)
    else
      log.debug(`Property ${data.object} is not a function`)
  }

  onopen(event: any) {
    log.debug("Received open event for kind:", this.collection.kind, "namespace:", this.collection.namespace)
    if (this.shouldClose(event)) {
      return
    }
    this.retries = 0
    this.connectTime = new Date().getTime()
  }

  onclose(event: any) {
    log.debug("Received close event for kind:", this.collection.kind, "namespace:", this.collection.namespace)
    if (this.destroyed) {
      log.debug("websocket destroyed for kind:", this.collection.kind, "namespace:", this.collection.namespace)
      delete this.socket
      return
    }
    if (this.retries < 3 && this.connectTime && (new Date().getTime() - this.connectTime) > 5000) {
      const self = this
      setTimeout(() => {
        log.debug("Retrying after connection closed:", event)
        this.retries = this.retries + 1
        log.debug("watch ", this.collection.kind, "disconnected, retry #", this.retries)
        const ws = this.createWebSocket(this.collection.wsURL)
        this.setHandlers(self, ws)
      }, 5000)
    } else {
      log.debug("websocket for ", this.collection.kind, "closed, event:", event)
      if (!event.wasClean) {
        log.debug("Switching to polling mode")
        delete this.socket
        this.poller = new ObjectPoller(this.collection.restURL, this)
        this.poller.start()
      }
    }
  }

  onerror(event: any) {
    log.debug("websocket for kind:", this.collection.kind, "received an error:", event)
    if (this.shouldClose(event)) {
      return
    }
  }

  get connected(): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN)
      return true

    if (this.poller && this.poller.connected)
      return true

    return false
  }

  connect() {
    log.debug("Connecting web socket handler")

    if (this.destroyed) {
      return
    }

    // in case a custom URL is going to be used
    if (this.collection.restURL === '' && this.collection.wsURL === '') {
      setTimeout(() => {
        this.connect()
      }, 500)
      return
    }
    if (!this.socket && !this.poller) {
      if (pollingOnly.some((kind) => kind === this.collection.kind)) {
        log.info("Using polling for kind:", this.collection.kind)
        this.poller = new ObjectPoller(this.collection.restURL, this)
        this.poller.start()
      } else {
        const doConnect = () => {
          const wsURL = this.collection.wsURL
          if (wsURL) {
            log.debug("Connecting websocket for kind:", this.collection.kind)
            this.socket = this.createWebSocket(wsURL)
            this.setHandlers(this, this.socket)
          } else {
            log.info("No wsURL for kind: " + this.collection.kind)
          }
        }

        log.debug("Fetching intial collection of object from web socket: " + this.collection.restURL)
        fetchPath(this.collection.restURL, {
          success: (data: string) => {
            const objectList: KubeObjectList = JSON.parse(data)
            this.list.objects = objectList.items || []

            setTimeout(() => {
              doConnect() }, 10
            )
          },
          error: (err: Error, response?: SimpleResponse) => {
            if (response?.status === 403) {
              log.info("Failed to fetch data while connecting to backend for type:", this.collection.kind, ", user is not authorized")
              this.list.objects = []
            } else {
              log.info("Failed to fetch data while connecting to backend for type:", this.collection.kind, "error:", err)
              setTimeout(() => {
                doConnect()
              }, 10)
            }
          }
        })

      }
    }
  }

  destroy() {
    this.destroyed = true
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        log.debug("Closing websocket for kind:", this.collection.kind, "namespace:", this.collection.namespace)
        this.socket.close()
        log.debug("Close called on websocket for kind:", this.collection.kind, "namespace:", this.collection.namespace)
      } catch (err) {
        // nothing to do, assume it's already closed
      }
    }
    if (this.poller) {
      log.debug("Destroying poller for kind:", this.collection.kind, "namespace:", this.collection.namespace)
      this.poller.destroy()
    }
  }
}
