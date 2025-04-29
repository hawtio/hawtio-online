import {
  JolokiaErrorResponse,
  JolokiaSuccessResponse,
  VersionResponseValue as JolokiaVersionResponseValue,
} from 'jolokia.js'
import Jolokia from '@jolokia.js/simple'
import { eventService } from '@hawtio/react'
import jsonpath from 'jsonpath'
import {
  k8Api,
  KubePod,
  ObjectMeta,
  PodStatus,
  joinPaths,
  PodSpec,
  JOLOKIA_PORT_QUERY,
} from '@hawtio/online-kubernetes-api'
import { log } from './globals'
import { ParseResult, jolokiaResponseParse } from './jolokia-response-utils'

export type Management = {
  status: {
    managed: boolean
    running: boolean
    /**
     * Optional error object
     * - reset to undefined on successful connection
     */
    error?: {
      /** Error message */
      message: string
      /** HTTP error code */
      code: number
    }
  }
  camel: {
    routes_count: number
  }
}

export type ErrorPolling = {
  count: number
  threshold: number
}

export class ManagedPod {
  static readonly DEFAULT_JOLOKIA_PORT = 8778

  readonly jolokiaPort: number
  readonly jolokiaPath: string

  private _management: Management = {
    status: {
      managed: false,
      running: false,
    },
    camel: {
      routes_count: 0,
    },
  }

  private _errorPolling: ErrorPolling = {
    count: 0,
    threshold: 1,
  }

  private _fingerprint = 1234

  constructor(public kubePod: KubePod) {
    this.jolokiaPort = this.extractPort(kubePod)
    this.jolokiaPath = ManagedPod.getJolokiaPath(kubePod, this.jolokiaPort) || ''
  }

  static getAnnotation(pod: KubePod, name: string, defaultValue: string): string {
    if (pod.metadata?.annotations && pod.metadata?.annotations[name]) {
      return pod.metadata.annotations[name]
    }
    return defaultValue
  }

  static getJolokiaPath(pod: KubePod, port: number): string | null {
    if (!k8Api.masterUri()) {
      return null
    }

    if (!pod.metadata) {
      log.error('Cannot get jolokia path for pod as it does not contain any metadata properties')
      return null
    }

    const namespace = pod.metadata?.namespace
    const name = pod.metadata?.name
    const protocol = ManagedPod.getAnnotation(pod, 'hawt.io/protocol', 'https')
    const jolokiaPath = ManagedPod.getAnnotation(pod, 'hawt.io/jolokiaPath', '/jolokia/')
    const path = `/management/namespaces/${namespace}/pods/${protocol}:${name}:${port}${jolokiaPath}`
    return joinPaths(window.location.origin, path)
  }

  newJolokiaPath(newPort: number) {
    return ManagedPod.getJolokiaPath(this.kubePod, newPort) || ''
  }

  private extractPort(pod: KubePod): number {
    const ports = jsonpath.query(pod, JOLOKIA_PORT_QUERY)
    if (!ports || ports.length === 0) return ManagedPod.DEFAULT_JOLOKIA_PORT
    return ports[0].containerPort || ManagedPod.DEFAULT_JOLOKIA_PORT
  }

  get kind(): string | undefined {
    return this.kubePod.kind
  }

  get metadata(): ObjectMeta | undefined {
    return this.kubePod.metadata
  }

  get spec(): PodSpec | undefined {
    return this.kubePod.spec
  }

  get status(): PodStatus | undefined {
    return this.kubePod.status
  }

  get management(): Management {
    return this._management
  }

  get mgmtError(): Error | null {
    if (!this._management.status.error) return null

    return new Error(`${this._management.status.error.message} (${this._management.status.error.code})`)
  }

  private setManagementError(code: number, message: string) {
    this._management.status.error = { code, message }
  }

  get errorPolling(): ErrorPolling {
    return this._errorPolling
  }

  resetErrorPolling() {
    this._errorPolling.count = 0
    this._errorPolling.threshold = 1
  }

  incrementErrorPollCount() {
    this._errorPolling.count++
  }

  incrementErrorPollThreshold() {
    this._errorPolling.threshold = this._errorPolling.threshold * 2
  }

  private hash(s: string): number {
    return Array.from(s).reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
  }

  /**
   * Re-calculate the fingerprint and update
   * Returns the new fingerprint
   */
  private calcFingerprint(): number {
    const s = JSON.stringify({ management: this.management, data: this.kubePod })

    /* Save the fingerprint for the next update iteration */
    this._fingerprint = this.hash(s)
    return this._fingerprint
  }

  hasChanged(): boolean {
    return this._fingerprint !== this.calcFingerprint()
  }

  async probeJolokiaUrl(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const path = `${this.jolokiaPath}version`
      fetch(path)
        .then(async (response: Response) => {
          if (!response.ok) {
            log.debug('Using URL:', path, 'assuming it could be an agent but got return code:', response.status)
            this.setManagementError(response.status, response.statusText)
            reject(this.mgmtError)
            return
          }

          try {
            const result: ParseResult<JolokiaSuccessResponse | JolokiaErrorResponse> =
              await jolokiaResponseParse(response)
            if (result.hasError) {
              this.setManagementError(500, result.error)
              reject(this.mgmtError)
              return
            }

            const jsonResponse: JolokiaSuccessResponse = result.parsed as JolokiaSuccessResponse
            if (!Jolokia.isVersionResponse(jsonResponse.value)) {
              this.setManagementError(500, 'Detected jolokia but cannot determine agent or version')
              reject(this.mgmtError)
              return
            }

            const versionResponse = jsonResponse.value as JolokiaVersionResponseValue
            log.debug('Found jolokia agent at:', this.jolokiaPath, 'details:', versionResponse.agent)
            resolve(this.jolokiaPath)
          } catch (e) {
            // Parse error should mean redirect to html
            const msg = `Jolokia Connect Error - ${e ?? response.statusText}`
            this.setManagementError(response.status, msg)
            reject(this.mgmtError)
          }
        })
        .catch(error => {
          this.setManagementError(error.status, error.error)
          reject(this.mgmtError)
        })
    })
  }

  search(successCb: () => void, failCb: (error: Error) => void) {
    const body = {
      type: 'search',
      mbean: 'org.apache.camel:context=*,type=routes,*',
    }

    fetch(`${this.jolokiaPath}?ignoreErrors=true&canonicalNaming=false&mimeType=application/json`, {
      method: 'post',
      body: JSON.stringify(body),
    })
      .then(async (response: Response) => {
        if (!response.ok) {
          return Promise.reject(response)
        }

        const data = await response.json()
        const routes = data.value as string[]

        this._management.status.error = undefined
        this._management.camel.routes_count = routes.length
        successCb()
      })
      .catch(error => {
        this.setManagementError(error.status, error.error)
        failCb(error)
      })
  }

  errorNotify() {
    const name = this.metadata?.name || '<unknown>'
    const mgmtError = this.mgmtError
    if (mgmtError) {
      const msg = `${name}: ${mgmtError.message}`
      eventService.notify({ type: 'danger', message: msg })
    }
  }
}
