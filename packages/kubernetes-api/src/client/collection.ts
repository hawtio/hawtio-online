import { ServiceSpec } from 'kubernetes-types/core/v1'
import { K8S_EXT_PREFIX, KubeObject } from '../globals'
import {  } from '../kubernetes-service'
import { fetchPath, FetchPathCallback, isFunction, joinPaths } from '../utils'
import { getClusterIP, getName, getNamespace, namespaced, prefixForKind, toCollectionName, wsUrl } from '../helpers'
import { WatchActions, WatchTypes } from '../model'
import { k8Api } from '../init'
import { log, UNKNOWN_VALUE, Collection, KOptions, ObjectList, WSHandler, ProcessDataCallback, ErrorDataCallback } from './globals'
import { ObjectListImpl } from './object-list'
import { WSHandlerImpl } from './ws-handler'
import { getKey } from './support'

/*
 * Implements the external API for working with k8s collections of objects
 */
export class CollectionImpl<T extends KubeObject> implements Collection<T> {
  private _namespace?: string
  private _path: string
  private _apiVersion: string
  private list: ObjectList<T>
  private handler: WSHandler<T>
  private _isOpenshift: boolean
  private _oAuthToken: string

  constructor(private _options: KOptions) {
    this._isOpenshift = k8Api.isOpenshift
    this._oAuthToken = k8Api.oAuthProfile.getToken()
    this._apiVersion = _options.apiVersion || UNKNOWN_VALUE
    this._namespace = _options.namespace

    const pref = this.getPrefix()

    if (this._namespace) {
      this._path = joinPaths(pref, 'namespaces', this._namespace, this.kind)
    } else {
      this._path = joinPaths(pref, this.kind)
    }
    log.debug("Creating new collection for kind: '", this.kind, "' path: '", this._path, "'")

    this.handler = new WSHandlerImpl(this)
    const list = (this.list = new ObjectListImpl(_options.kind, _options.namespace))
    this.handler.list = list
  }

  get oAuthToken(): string {
    return this._oAuthToken
  }

  get options(): KOptions {
    return this._options
  }

  private get _restUrl() {
    let url

    if (this.options.urlFunction && isFunction(this.options.urlFunction)) {
      const answer = this.options.urlFunction(this.options)
      if (answer === null || !answer) {
        return null
      }
      url = new URL(answer)
    } else {
      url = new URL(joinPaths(k8Api.masterUri(), this._path))
    }

    if (this.options.labelSelector) {
      url.searchParams.append('labelSelector', this.options.labelSelector)
    }

    return url
  }

  private get _wsUrl() {
    let url

    if (this.options.urlFunction && isFunction(this.options.urlFunction)) {
      const answer = this.options.urlFunction(this.options)
      if (answer === null || !answer) {
        return null
      }
      url = wsUrl(answer)
    } else {
      let urlStr = joinPaths(k8Api.masterUri(), this._path)
      const location = window.location
      if (location && urlStr.indexOf('://') < 0) {
        let hostname = location.hostname
        if (hostname) {
          const port = location.port
          if (port) {
            hostname += ':' + port
          }
          urlStr = joinPaths(hostname, k8Api.masterUri(), this._path)
        }
      }
      url = wsUrl(urlStr)
    }

    url.searchParams.append('watch', 'true')

    if (this.options.labelSelector) {
      url.searchParams.append('labelSelector', this.options.labelSelector)
    }
    return url
  }

  getKey() {
    return getKey(this.kind, this._namespace)
  }

  get wsURL() {
    return (this._wsUrl || '').toString()
  }

  get restURL() {
    return (this._restUrl || '').toString()
  }

  get namespace() {
    return this._namespace
  }

  get kind() {
    return this._options.kind
  }

  get connected(): boolean {
    return this.handler.connected
  }

  connect() {
    if (!this.handler.connected) {
      this.handler.connect()
    }
  }

  destroy() {
    this.handler.destroy()
    /*
    delete this.handler
    delete this.list
    */
  }

  // one time fetch of the data...
  get(cb: ProcessDataCallback<T>) {
    if (!this.list.initialized) {
      this.list.doOnce(WatchActions.INIT, cb)
    } else {
      setTimeout(() => {
        cb(this.list.objects)
      }, 10)
    }
  }

  private getPrefix() {
    // TODO: support retrieving endpoint URL based on API group
    let pref = prefixForKind(this.kind)
    if (!pref) {
      if (this._apiVersion && this._apiVersion.startsWith('extensions')) {
        pref = joinPaths(K8S_EXT_PREFIX, this._apiVersion)
      } else {
        throw new Error('Unknown kind: ' + this.kind)
      }
    }
    return pref
  }

  private restUrlFor(item: T, useName = true) {
    const name = getName(item)
    if (useName && !name) {
      log.debug('Name missing from item:', item)
      return undefined
    }

    if (!this._restUrl) {
      log.debug('The rest url is missing')
      return undefined
    }

    let url = joinPaths(this._restUrl.toString())
    if (this.options.urlFunction && isFunction(this.options.urlFunction)) {
      // lets trust the url to be correct
    } else {
      if (!item.kind) return undefined

      const collectionName = toCollectionName(item.kind)
      if (collectionName && namespaced(collectionName)) {
        const namespace = getNamespace(item) || this._namespace || UNKNOWN_VALUE
        let prefix = this.getPrefix()
        const kind = this.kind
        if (!this._isOpenshift && (kind === 'buildconfigs' || kind === 'BuildConfig')) {
          prefix = joinPaths('/api/v1/proxy/namespaces', namespace, '/services/jenkinshift:80/', prefix)
          log.debug('Using buildconfigs URL override')
        }
        url = joinPaths(k8Api.masterUri(), prefix, 'namespaces', namespace, kind)
      }
    }
    if (useName) {
      url = joinPaths(url, name as string)
    }
    return url
  }

  // continually get updates
  watch(cb: ProcessDataCallback<T>): ProcessDataCallback<T> {
    if (this.list.initialized) {
      setTimeout(() => {
        log.debug(this.kind, 'passing existing objects:', this.list.objects)
        cb(this.list.objects)
      }, 10)
    }
    log.debug(this.kind, 'adding watch callback:', cb)

    this.list.doOn(WatchActions.ANY, (data:T[]) => {
      log.debug(this.kind, 'got data:', data)
      cb(data)
    })
    return cb
  }

  unwatch(cb: ProcessDataCallback<T>) {
    log.debug(this.kind, 'removing watch callback:', cb)
    this.list.doOff(WatchActions.ANY, cb)
  }

  put(item: T, cb: ProcessDataCallback<T>, error?: ErrorDataCallback) {
    let method = 'PUT'
    let url = this.restUrlFor(item)
    if (!this.list.hasNamedItem(item)) {
      // creating a new object
      method = 'POST'
      url = this.restUrlFor(item, false)
    } else {
      // updating an existing object
      let resourceVersion = item.metadata?.resourceVersion
      if (!resourceVersion) {
        const name = getName(item) || ''
        const current = this.list.getNamedItem(name)
        resourceVersion = current?.metadata?.resourceVersion
        if (item.metadata?.resourceVersion) {
          // TODO
          // Necessary since resourceVersion has the readonly modified
          // @ts-ignore
          item.metadata.resourceVersion = resourceVersion
        }
      }
    }
    if (!url) {
      return
    }
    // Custom checks for specific cases
    switch (this.kind) {
      case WatchTypes.SERVICES:
        if (getClusterIP(item) === '') {
          const podSpec = item.spec as ServiceSpec
          delete podSpec.clusterIP
        }
        break
      default:
    }
    try {
      const callback: FetchPathCallback<void> = {
        success: data => {
          try {
            const response = JSON.parse(data)
            cb(response)
          } catch (err) {
            log.error(err)
            if (error && err instanceof Error) {
              error(err as Error)
            }
          }
        },
        error: (err: Error) => {
          log.debug('Failed to create or update, error:', err)
          if (err) {
            log.error(err)
          }
        },
      }

      const requestHeaders: HeadersInit = new Headers()
      requestHeaders.set('Content-Type', 'application/json')

      const options: RequestInit = {
        method: method,
        headers: requestHeaders,
        body: JSON.stringify(item),
      }

      fetchPath(url, callback, options)
    } catch (err) {
      log.error(err)
    }
  }

  delete(item: T, cb: ProcessDataCallback<T>, error?: ErrorDataCallback) {
    const url = this.restUrlFor(item)
    if (!url) {
      return
    }
    this.list.deleted(item)
    this.list.triggerChangedEvent()
    try {
      const callback: FetchPathCallback<void> = {
        success: data => {
          try {
            const response = JSON.parse(data)
            cb(response)
          } catch (err) {
            console.error(err)
            if (error && err instanceof Error) {
              error(err as Error)
            }
          }
        },
        error: (err: Error) => {
          log.debug('Failed to delete, error:', err)
          this.list.added(item)
          this.list.triggerChangedEvent()
          if (error) {
            error(err)
          }
        },
      }

      fetchPath(url, callback, { method: 'DELETE' })
    } catch (err) {
      log.error(err)
    }
  }
}
