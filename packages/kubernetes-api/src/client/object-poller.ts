import { KubeObject, KubeObjectList } from '../globals'
import { fetchPath, SimpleResponse } from '../utils'
import { log, WSHandler, POLLING_INTERVAL } from './globals'
import { compare } from './support'

/*
 * Manages polling the server for objects that don't support websocket connections
 */
export class ObjectPoller<T extends KubeObject> {
  private _lastFetch: KubeObject[]
  private _connected = false
  private _interval = POLLING_INTERVAL
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
        const items = kObjList && kObjList.items ? kObjList.items : []
        const result = compare(this._lastFetch, items)
        this._lastFetch = items

        for (const [action, items] of Object.entries(result)) {
          items.forEach((item: KubeObject) => {
            const event = {
              data: JSON.stringify({
                type: action.toUpperCase(),
                metadata: {
                  continue: kObjList.metadata.continue
                },
                object: item,
              }),
            }
            this.handler.onMessage(event)
          })
        }

        this.handler.list.initialize()
        if (this._connected) {
          this.tCancel = setTimeout(() => {
            log.debug(this.handler.kind, 'polling', this.restURL)
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
        if (response?.status === 410 || this.retries >= 3) {
          const msgDetail = response?.status === 410 ? '410 Response' : 'Out of retries'
          log.debug(this.handler.kind, `- ${msgDetail}, stopping polling, error:`, err)

          this.stop()
          if (this.handler.error) {
            this.handler.error(err, response)
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
      log.debug(this.handler.kind, '- cancelling polling', this.restURL)
      clearTimeout(this.tCancel)
      this.tCancel = undefined
    }
  }

  destroy() {
    this.stop()
    log.debug(this.handler.kind, '- destroyed')
  }
}
