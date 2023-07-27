import { k8Api, K8S_EXT_PREFIX } from '../globals'
import { fetchPath, FetchPathCallback, isFunction, joinPaths } from '../utils'
import { log, UNKNOWN_VALUE, Collection, KOptions, ObjectList, WSHandler } from './globals'
import { getName, getNamespace, masterApiUrl, namespaced, prefixForKind, toCollectionName, wsUrl } from '../helpers'
import { WatchActions, WatchTypes } from '../model'
import { ObjectListImpl } from './object-list'
import { WSHandlerImpl } from './ws-handler'
import { getKey } from './support'

/*
 * Implements the external API for working with k8s collections of objects
 */
export class CollectionImpl implements Collection {

  private _namespace: string
  private _path: string
  private _apiVersion: string
  private list: ObjectList
  private handler: WSHandler

  constructor(private _options: KOptions) {
    this._apiVersion = _options.apiVersion || UNKNOWN_VALUE
    this._namespace = _options.namespace || UNKNOWN_VALUE

    const pref = this.getPrefix()

    if (this._namespace) {
      this._path = joinPaths(pref, 'namespaces', this._namespace, this.kind)
    } else {
      this._path = joinPaths(pref, this.kind)
    }
    this.handler = new WSHandlerImpl(this)
    const list = this.list = new ObjectListImpl(_options.kind, _options.namespace)
    this.handler.list = list
    log.debug("creating new collection for", this.kind, "namespace:", this.namespace)
  }

  public get options(): KOptions {
    return this._options
  }

  private get _restUrl() {
    let url

    if (this.options.urlFunction && isFunction(this.options.urlFunction)) {
      let answer = this.options.urlFunction(this.options)
      if (answer === null || !answer) {
        return null
      }
      url = new URL(answer)
    } else {
      url = new URL(joinPaths(masterApiUrl(), this._path))
    }

    if (this.options.labelSelector) {
      url.searchParams.append('labelSelector', this.options.labelSelector)
    }

    return url
  }

  private get _wsUrl() {
    let url

    if (this.options.urlFunction && isFunction(this.options.urlFunction)) {
      let answer = this.options.urlFunction(this.options)
      if (answer === null || !answer) {
        return null
      }
      url = wsUrl(answer)
    } else {
      let urlStr = joinPaths(masterApiUrl(), this._path)
      let location = window.location
      if (location && urlStr.indexOf("://") < 0) {
        let hostname = location.hostname
        if (hostname) {
          let port = location.port
          if (port) {
            hostname += ":" + port
          }
          urlStr = joinPaths(hostname, masterApiUrl(), this._path)
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

  public getKey() {
    return getKey(this.kind, this._namespace)
  }

  public get wsURL() {
    return (this._wsUrl || "").toString()
  }

  public get restURL() {
    return (this._restUrl || "").toString()
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

  public connect() {
    if (!this.handler.connected) {
      this.handler.connect()
    }
  }

  public destroy() {
    this.handler.destroy()
    /*
    delete this.handler
    delete this.list
    */
  }

  // one time fetch of the data...
  public get(cb: (data: any[]) => void) {
    if (!this.list.initialized) {
      // TODO
      console.log("TODO: CollectionImpl:get")
      // this.list.once(WatchActions.INIT, cb)
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

  private restUrlFor(item: any, useName: boolean = true) {
    const name = getName(item)
    if (useName && !name) {
      log.debug("Name missing from item:", item)
      return undefined
    }

    if (! this._restUrl) {
      log.debug("The rest url is missing")
      return undefined
    }

    let url = joinPaths(this._restUrl.toString())
    if (this.options.urlFunction && isFunction(this.options.urlFunction)) {
      // lets trust the url to be correct
    } else {
      if (! item.kind)
        return undefined

      const collectionName = toCollectionName(item.kind)
      if (collectionName && namespaced(collectionName)) {
        const namespace = getNamespace(item) || this._namespace
        let prefix = this.getPrefix()
        const kind = this.kind
        if (!k8Api.isOpenshift() && (kind === "buildconfigs" || kind === "BuildConfig")) {
          prefix = joinPaths("/api/v1/proxy/namespaces", namespace, "/services/jenkinshift:80/", prefix)
          log.debug("Using buildconfigs URL override")
        }
        url = joinPaths(masterApiUrl(), prefix, 'namespaces', namespace, kind)
      }
    }
    if (useName) {
      url = joinPaths(url, name as string)
    }
    return url
  }

  // continually get updates
  public watch(cb: (data: any[]) => void): (data: any[]) => void {
    if (this.list.initialized) {
      setTimeout(() => {
        log.debug(this.kind, "passing existing objects:", this.list.objects)
        cb(this.list.objects)
      }, 10)
    }
    log.debug(this.kind, "adding watch callback:", cb)

    // TODO
    console.log("TODO CollectionImpl:watch")
    // this.list.on(WatchActions.ANY, (data) => {
    //   log.debug(this.kind, "got data:", data)
    //   cb(data)
    // })
    return cb
  }

  public unwatch(cb: (data: any[]) => void) {
    log.debug(this.kind, "removing watch callback:", cb)
    // TODO
    console.log("TODO CollectionImpl:unwatch")
    // this.list.off(WatchActions.ANY, cb)
  }

  public put(item: any, cb: (data: any) => void, error?: (err: any) => void) {
    let method = 'PUT'
    let url = this.restUrlFor(item)
    if (!this.list.hasNamedItem(item)) {
      // creating a new object
      method = 'POST'
      url = this.restUrlFor(item, false)
    } else {
      // updating an existing object
      let resourceVersion = item.metadata.resourceVersion
      if (!resourceVersion) {
        const name = getName(item) || ''
        const current = this.list.getNamedItem(name)
        resourceVersion = current.metadata.resourceVersion
        item.metadata.resourceVersion = resourceVersion
      }
    }
    if (!url) {
      return
    }
    // Custom checks for specific cases
    switch (this.kind) {
      case WatchTypes.SERVICES:
        if (item.spec.clusterIP === '') {
          delete item.spec.clusterIP
        }
        break
      default:

    }
    try {

      const callback: FetchPathCallback<any> = {
        success: (data) => {
          try {
            const response = JSON.parse(data)
            cb(response)
          } catch (err) {
            cb({})
          }
        },
        error: (err: Error) => {
          log.debug("Failed to create or update, error:", err)
          if (err) {
            log.error(err)
          }
        }
      }

      const requestHeaders: HeadersInit = new Headers()
      requestHeaders.set('Content-Type', 'application/json')

      const options: RequestInit = {
        method: method,
        headers: requestHeaders,
        body: JSON.stringify(item)
      }

      fetchPath(url, callback, options)

    } catch (err) {
      log.error(err)
    }
  }

  public delete(item: any, cb: (data: any) => void, error?: (err: any) => void) {
    const url = this.restUrlFor(item)
    if (!url) {
      return
    }
    this.list.deleted(item)
    this.list.triggerChangedEvent()
    try {

      const callback: FetchPathCallback<any> = {
        success: (data) => {
          try {
            const response = JSON.parse(data)
            cb(response)
          } catch (err) {
            cb({})
          }
        },
        error: (err: Error) => {
          log.debug("Failed to delete, error:", err)
          this.list.added(item)
          this.list.triggerChangedEvent()
          if (error) {
            error(err)
          }
        }
      }

      fetchPath(url, callback, { method: 'DELETE' })

    } catch (err) {
      log.error(err)
    }
  }
}
