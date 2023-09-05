import Jolokia, { IJolokia, IListOptions, IOptions, ISearchOptions, ISimpleOptions, IVersion, IVersionOptions } from 'jolokia.js'
import $ from 'jquery'
import { log } from './globals'
import jsonpath from 'jsonpath'
import { func, is, object } from 'superstruct'
import { KubePod, k8Service, ObjectMeta, PodStatus, joinPaths } from '@hawtio/online-kubernetes-api'
import { k8Api } from '@hawtio/online-kubernetes-api'

const DEFAULT_JOLOKIA_OPTIONS: IOptions = {
  method: 'POST',
  mimeType: 'application/json',
  canonicalNaming: false,
  canonicalProperties: false,
  ignoreErrors: true,
} as const

const DEFAULT_JOLOKIA_PORT = 8778

/**
 * Dummy Jolokia implementation that does nothing.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
class DummyJolokia implements IJolokia {
  isDummy = true
  private running = false

  request(...args: unknown[]) {
    return null
  }

  getAttribute(mbean: string, attribute: string, path?: string | ISimpleOptions, opts?: ISimpleOptions) {
    opts?.success?.({})
    return null
  }
  setAttribute(
    mbean: string,
    attribute: string,
    value: unknown,
    path?: string | ISimpleOptions,
    opts?: ISimpleOptions,
  ) {
    opts?.success?.({})
  }

  execute(mbean: string, operation: string, ...args: unknown[]) {
    args?.forEach(arg => is(arg, object({ success: func() })) && arg.success?.(null))
    return null
  }
  search(mBeanPattern: string, opts?: ISearchOptions) {
    opts?.success?.([])
    return null
  }
  list(path: string, opts?: IListOptions) {
    opts?.success?.({})
    return null
  }
  version(opts?: IVersionOptions) {
    opts?.success?.({} as IVersion)
    return {} as IVersion
  }

  register(params: unknown, ...request: unknown[]) {
    return 0
  }
  unregister(handle: number) {
    /* no-op */
  }
  jobs() {
    return []
  }
  start(period: number) {
    this.running = true
  }
  stop() {
    this.running = false
  }
  isRunning() {
    return this.running
  }
}

export type Management = {
  status: {
    running: boolean,
    error: boolean
  },
  camel: {
    routes_count: number
  }
}

export class ManagedPod {
  readonly jolokiaPort: number
  readonly jolokiaPath: string
  readonly jolokia: IJolokia

  private _management: Management = {
    status: {
      running: false,
      error: false
    },
    camel: {
      routes_count: 0
    }
  }

  constructor(public pod: KubePod) {
    this.jolokiaPort = this.extractPort(pod)
    this.jolokiaPath = this.createPath(pod, this.jolokiaPort) || ''
    this.jolokia = this.createJolokia() || new DummyJolokia()
  }

  private getAnnotation(pod: KubePod, name: string, defaultValue: string): string {
    if (pod.metadata?.annotations && pod.metadata?.annotations[name]) {
      return pod.metadata.annotations[name]
    }
    return defaultValue
  }

  private createPath(pod: KubePod, port: number): string | null {
    if (! k8Api.masterUri()) {
      return null
    }

    if (!pod.metadata) {
      log.error("Cannot get jolokia path for pod as it does not contain any metadata properties")
      return null
    }

    const namespace = pod.metadata?.namespace
    const name = pod.metadata?.name
    const protocol = this.getAnnotation(pod, 'hawt.io/protocol', 'https')
    const jolokiaPath = this.getAnnotation(pod, 'hawt.io/jolokiaPath', '/proxy/jolokia/')
    const path = `/api/v1/namespaces/${namespace}/pods/${protocol}:${name}:${port}${jolokiaPath}`
    return joinPaths(k8Api.masterUri(), path)
  }

  private extractPort(pod: KubePod): number {
    const ports = jsonpath.query(pod, k8Service.jolokiaPortQuery)
    if (!ports || ports.length === 0) return DEFAULT_JOLOKIA_PORT
    return ports[0].containerPort || DEFAULT_JOLOKIA_PORT
  }

  private createJolokia() {
    if (! this.jolokiaPath || this.jolokiaPath.length === 0) {
      log.error(`Failed to find jolokia path for pod ${this.pod.metadata?.uid}`)
      return
    }

    const options = { ...DEFAULT_JOLOKIA_OPTIONS }
    options.url = this.jolokiaPath

    return new Jolokia(options)
  }

  get metadata(): ObjectMeta | undefined {
    return this.pod.metadata
  }

  get status(): PodStatus | undefined {
    return this.pod.status
  }

  get management(): Management {
    return this._management
  }

  async probeJolokiaUrl(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      $.ajax({url: this.jolokiaPath, method: 'GET'})
        .done((data: string, textStatus: string, xhr: JQueryXHR) => {
          if (xhr.status !== 200) {
            console.log("Status is not 200: " + xhr.status)
            reject()
            return
          }

          try {
            const resp = JSON.parse(data)
            if ('error' in resp) {
              throw new Error(resp.error)
            }

            if ('value' in resp && 'agent' in resp.value) {
              log.debug('Found jolokia agent at:', this.jolokiaPath, 'version:', resp.value.agent)
              resolve(this.jolokiaPath)
              return
            } else {
              throw new Error('Detected jolokia but cannot determine agent or version')
            }

          } catch (e) {
            // Parse error should mean redirect to html
            reject(e)
            return
          }
        })
        .fail((xhr: JQueryXHR) => {
          reject(`${xhr.status} ${xhr.statusText}`)
        })
    })
  }
}
