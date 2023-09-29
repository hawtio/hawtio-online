import { KubeObject, KubeObjectList } from '../globals'
import { fetchPath, SimpleResponse } from '../utils'
import { log, WSHandler } from './globals'
import { compare } from './support'

/*
 * Manages polling the server for objects that don't support websocket connections
 */
export class ObjectPoller<T extends KubeObject> {
  private _lastFetch: KubeObject[]
  private _connected = false
  private _interval = 5000
  private retries = 0
  private tCancel?: NodeJS.Timeout

  constructor(
    private restURL: string,
    private handler: WSHandler<T>,
  ) {
    this._lastFetch = this.handler.list.objects
  }

  get connected() {
    return this._connected
  }

  private doGet() {
    if (!this._connected) {
      return
    }

    fetchPath(this.restURL, {
      success: data => {
        if (!this._connected) {
          return
        }

        const kObjList: KubeObjectList<T> = JSON.parse(data)

        log.debug(this.handler.kind, 'fetched data:', data)
        const items = kObjList && kObjList.items ? kObjList.items : []
        const result = compare(this._lastFetch, items)
        this._lastFetch = items

        for (const [action, items] of Object.entries(result)) {
          items.forEach((item: KubeObject) => {
            const event = {
              data: JSON.stringify({
                type: action.toUpperCase(),
                object: item,
              }),
            }
            this.handler.onmessage(event)
          })
        }

        this.handler.list.initialize()
        //log.debug("Result:", result)
        if (this._connected) {
          this.tCancel = setTimeout(() => {
            log.debug(this.handler.kind, 'polling')
            this.doGet()
          }, this._interval)
        }
      },
      error: (err: Error, response?: SimpleResponse) => {
        if (!this._connected) {
          return
        }

        if (response?.status === 403) {
          log.info(this.handler.kind, '- Failed to poll objects, user is not authorized')
          return
        }
        if (this.retries >= 3) {
          log.debug(this.handler.kind, '- Out of retries, stopping polling, error:', err)
          this.stop()
          if (this.handler.error) {
            this.handler.error(err)
          }
        } else {
          this.retries = this.retries + 1
          log.debug(this.handler.kind, '- Error polling, retry #', this.retries + 1, 'error:', err)
          this.tCancel = setTimeout(() => {
            this.doGet()
          }, this._interval)
        }
      },
    })
  }

  start() {
    if (this._connected) {
      return
    }
    this._connected = true
    this.tCancel = setTimeout(() => {
      this.doGet()
    }, 1)
  }

  stop() {
    this._connected = false
    log.debug(this.handler.kind, '- disconnecting')
    if (this.tCancel) {
      log.debug(this.handler.kind, '- cancelling polling')
      clearTimeout(this.tCancel)
      this.tCancel = undefined
    }
  }

  destroy() {
    this.stop()
    log.debug(this.handler.kind, '- destroyed')
  }
}
