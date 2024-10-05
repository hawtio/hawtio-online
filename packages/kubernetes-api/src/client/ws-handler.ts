import { KubeObject } from '../globals'
import { SimpleResponse, fetchPath, hasProperty, isFunction, isString } from '../utils'
import { Watched, ErrorDataCallback, log, ObjectList, pollingOnly, WSHandler } from './globals'
import { ObjectListImpl } from './object-list'
import { ObjectPoller } from './object-poller'

/**
 * Manages the polling connection to the backend and passes events to the ObjectListImpl
 */
export class WSHandlerImpl<T extends KubeObject> implements WSHandler<T> {
  private _watched: Watched<T>
  private _list?: ObjectList<T>

  private retries = 0
  private connectTime = 0
  private socket?: WebSocket
  private poller?: ObjectPoller<T>
  private destroyed = false

  constructor(collection: Watched<T>) {
    this._watched = collection
  }

  set list(_list: ObjectList<T>) {
    this._list = _list
  }

  get list(): ObjectList<T> {
    return this._list || new ObjectListImpl<T>()
  }

  get watched(): Watched<T> {
    return this._watched
  }

  get error(): ErrorDataCallback | undefined {
    return this._watched.options.error
  }

  get kind() {
    return this._watched.kind
  }

  private createWebSocket(url: string): WebSocket {
    /*
     * Pass the bearer token via WebSocket sub-protocol
     * An extra sub-protocol is required along with the authentication one, that gets removed
     * See https://github.com/kubernetes/kubernetes/commit/714f97d7baf4975ad3aa47735a868a81a984d1f0
     * (Update 2023: this commit is from 2017 but still holds good)
     */
    const token = this.watched.oAuthToken
    const bearerProtocol = `base64url.bearer.authorization.k8s.io.${btoa(token).replace(/=/g, '')}`

    /*
     * The binary protocol is required for correct authentication.
     * Otherwise, connection fails with a 400 or 401 authentication error
     */
    const protocols = ['base64.binary.k8s.io', bearerProtocol]

    return new WebSocket(url, protocols)
  }

  private setHandlers(self: WSHandler<T>, ws: WebSocket) {
    log.debug("Adding WebSocket event handler for 'open'")
    ws.addEventListener('open', (event: Event) => self.onOpen(event))

    log.debug("Adding WebSocket event handler for 'message'")
    ws.addEventListener('message', (event: MessageEvent) => {
      if (!event.origin || event.origin.length === 0) {
        log.warn('Ignoring WebSocket message as origin is not defined')
        return
      }

      try {
        const originUrl = new URL(event.origin)
        if (!window.location || window.location.hostname !== originUrl.hostname) {
          log.warn('The origin of the WebSocket message is not recognized')
          return
        }
      } catch (error) {
        log.warn('The origin of the WebSocket message is invalid', error)
        return
      }

      self.onMessage(event)
    })

    log.debug("Adding WebSocket event handler for 'close'")
    ws.addEventListener('close', (event: CloseEvent) => self.onClose(event))

    log.debug("Adding WebSocket event handler for 'error'")
    ws.addEventListener('error', (event: Event) => self.onError(event))
  }

  send(data: string | KubeObject) {
    if (!isString(data)) {
      data = JSON.stringify(data)
    }

    if (this.socket) this.socket.send(data)
  }

  shouldClose(event: Event): boolean { // eslint-disable-line
    if (this.destroyed && this.socket && this.socket.readyState === WebSocket.OPEN) {
      log.debug(
        'Connection destroyed but still receiving messages, closing websocket, kind:',
        this.watched.kind,
        'namespace:',
        this.watched.namespace,
      )
      try {
        log.debug('Closing websocket for kind:', this.watched.kind)
        this.socket.close()
      } catch (err) { // eslint-disable-line
        // nothing to do, assume it's already closed
      }
      return true
    }
    return false
  }

  onMessage(event: MessageEvent | { data: string }) {
    log.debug('Receiving message from web socket: ', event)
    if (event instanceof MessageEvent && this.shouldClose(event)) {
      log.debug('Should be closed!')
      return
    }
    if (!this.list) {
      log.debug('Cannot onmessage as no object list')
      return
    }
    const data = JSON.parse(event.data)

    const eventType: keyof ObjectList<T> = data.type.toLowerCase()
    if (eventType !== 'added' && eventType !== 'modified' && eventType !== 'deleted') return

    if (isFunction(this.list[eventType])) this.list[eventType](data.object)
    else log.debug(`Property ${data.object} is not a function`)
  }

  onOpen(event: Event) {
    log.debug('Received open event for kind:', this.watched.kind, 'namespace:', this.watched.namespace)
    if (this.shouldClose(event)) {
      return
    }
    this.retries = 0
    this.connectTime = new Date().getTime()
  }

  onClose(event: CloseEvent) {
    log.debug('Received close event for kind:', this.watched.kind, 'namespace:', this.watched.namespace)
    if (this.destroyed) {
      log.debug('websocket destroyed for kind:', this.watched.kind, 'namespace:', this.watched.namespace)
      delete this.socket
      return
    }
    if (this.retries < 3 && this.connectTime && new Date().getTime() - this.connectTime > 5000) {
      setTimeout(() => {
        log.debug('Retrying after connection closed:', event)
        this.retries = this.retries + 1
        log.debug('watch ', this.watched.kind, 'disconnected, retry #', this.retries)
        const ws = this.createWebSocket(this.watched.wsURL)
        this.setHandlers(this, ws)
      }, 5000)
    } else {
      log.debug('websocket for ', this.watched.kind, 'closed, event:', event)
      if (!event.wasClean) {
        log.debug('Switching to polling mode')
        delete this.socket
        this.poller = new ObjectPoller<T>(this.watched.restURL, this)
        this.poller.start()
      }
    }
  }

  onError(event: Event) {
    log.debug('websocket for kind:', this.watched.kind, 'received an error:', event)
    if (this.shouldClose(event)) {
      return
    }
  }

  get connected(): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return true

    if (this.poller && this.poller.connected) return true

    return false
  }

  connect() {
    log.debug('Connecting polling handler')

    if (this.destroyed) {
      return
    }

    // in case a custom URL is going to be used
    if (this.watched.restURL === '' && this.watched.wsURL === '') {
      setTimeout(() => {
        this.connect()
      }, 500)
      return
    }

    if (!this.socket && !this.poller) {
      if (pollingOnly.some(kind => kind === this.watched.kind)) {
        log.info('Using polling for kind:', this.watched.kind)
        this.poller = new ObjectPoller(this.watched.restURL, this)
        this.poller.start()
      } else {
        const doConnect = () => {
          const wsURL = this.watched.wsURL
          if (wsURL) {
            log.debug('Connecting websocket for kind:', this.watched.kind)
            this.socket = this.createWebSocket(wsURL)
            this.setHandlers(this, this.socket)
          } else {
            log.info('No wsURL for kind: ', this.watched.kind)
          }
        }

        log.debug('Fetching initial collection of object from web socket: ', this.watched.restURL)

        fetchPath(this.watched.restURL, {
          success: (data: string) => {
            const objectOrList = JSON.parse(data)
            if (hasProperty(objectOrList, 'items')) {
              this.list.objects = objectOrList.items || []
            } else {
              this.list.objects = [objectOrList]
            }

            setTimeout(() => {
              doConnect()
            }, 10)
          },
          error: (err: Error, response?: SimpleResponse) => {
            if (response?.status === 403) {
              log.info(
                'Failed to fetch data while connecting to backend for type:',
                this.watched.kind,
                ', user is not authorized',
              )
              this.list.objects = []

              if (this.error) this.error(err, response)
            } else {
              log.info('Failed to fetch data while connecting to backend for type:', this.watched.kind, 'error:', err)

              if (this.error) this.error(err, response)

              setTimeout(() => {
                doConnect()
              }, 10)
            }
          },
        })
      }
    }
  }

  destroy() {
    this.destroyed = true
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        log.debug('Closing websocket for kind:', this.watched.kind, 'namespace:', this.watched.namespace)
        this.socket.close()
        log.debug('Close called on websocket for kind:', this.watched.kind, 'namespace:', this.watched.namespace)
      } catch (err) { // eslint-disable-line
        // nothing to do, assume it's already closed
      }
    }
    if (this.poller) {
      log.debug('Destroying poller for kind:', this.watched.kind, 'namespace:', this.watched.namespace)
      this.poller.destroy()
    }
  }
}
