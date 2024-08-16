import jsonpath from 'jsonpath'
import { JOLOKIA_PORT_QUERY, KubeObject, KubePod, Paging } from '../globals'
import { WatchTypes } from '../model'
import { isObject } from '../utils'
import { Watched, KOptions, ProcessDataCallback } from './globals'
import { clientFactory } from './client-factory'

export type NamespaceClientCallback = (jolokiaPods: KubePod[], error?: Error) => void

export interface Client<T extends KubeObject> {
  watched: Watched<T>
  watch: ProcessDataCallback<T>
}

interface PodWatcher {
  client: Client<KubePod>
  jolokiaPod: KubePod | undefined
}

interface PodWatchers {
  [key: string]: PodWatcher
}

export class NamespaceClient implements Paging {
  private _current = 0
  private _podList: Set<string> = new Set<string>()
  private _podWatchers: PodWatchers = {}
  private _nsWatcher?: Client<KubePod>
  private _refreshing = 0
  private _limit = 3

  constructor(
    private _namespace: string,
    private _callback: NamespaceClientCallback,
  ) {}

  private handleError(error: Error, name?: string) {
    let cbError = error
    if (name) {
      cbError = new Error(`Failed to connect to pod ${name}`)
      cbError.cause = error
    }

    this._callback(this.getJolokiaPods(), cbError)
  }

  private initPodOptions(kind: string, name?: string): KOptions {
    const podOptions: KOptions = {
      kind: kind,
      name: name,
      namespace: this._namespace,
      error: (err: Error) => {
        this.handleError(err, name)
      },
    }

    return podOptions
  }

  private createPodWatchers() {
    if (this._podList.size === 0 || this._current >= this._podList.size) return

    const podNames = Array.from(this._podList)
      .sort()
      .slice(this._current, this._current + this._limit)

    // Remove watchers for pods not in the slice of the sorted list
    Object.entries(this._podWatchers)
      .filter(([name, _]) => {
        return !podNames.includes(name)
      })
      .forEach(([name, podWatcher]) => {
        clientFactory.destroy(podWatcher.client.watched, podWatcher.client.watch)
        delete this._podWatchers[name]
      })

    this._refreshing = podNames.length
    podNames.forEach(name => {
      // Already watching this pod
      if (isObject(this._podWatchers[name])) {
        this._refreshing--
        return
      }

      // Set up new watcher for this pod
      const _podClient = clientFactory.create<KubePod>(this.initPodOptions(WatchTypes.PODS, name))
      const _podWatcher = _podClient.watch(podList => {
        if (this._refreshing > 0) this._refreshing--

        if (podList.length === 0) return

        // podList should only contain 1 pod (due to name)
        this._podWatchers[name].jolokiaPod = podList[0]

        if (this._refreshing === 0) {
          // Limit callback to final watch returning
          this._callback(this.getJolokiaPods())
        }
      })

      /*
       * Pod is part of the current page so connect its pod watcher
       */
      _podClient.connect()

      this._podWatchers[name] = {
        client: {
          watch: _podWatcher,
          watched: _podClient,
        },
        jolokiaPod: undefined,
      }
    })
  }

  isConnected(): boolean {
    return isObject(this._nsWatcher) && this._nsWatcher.watched.connected
  }

  connect(limit: number) {
    if (this.isConnected()) return

    this._limit = limit > 1 ? limit : 1
    this._current = 0

    const _nsClient = clientFactory.create<KubePod>(this.initPodOptions(WatchTypes.PODS))
    const _nsWatch = _nsClient.watch(pods => {
      /*
       * Filter out any non-jolokia pods immediately and add
       * the applicable pods to the pod name list
       */
      const podNames: string[] = []
      pods
        .filter(pod => jsonpath.query(pod, JOLOKIA_PORT_QUERY).length > 0)
        .forEach(pod => {
          const name = pod.metadata?.name || undefined
          if (!name) return

          podNames.push(name)
        })

      // Initialise the sorted set list of pod names
      this._podList = new Set(podNames.sort())

      // Create the first set of pod watchers
      this.createPodWatchers()
    })

    /*
     * Track any changes to the namespace
     * Deleted pods will be removed from the pod list and pod watchers disposed of
     * Added pods will be inserted into the pod list and pod watchers will be created
     * when the page they appear in is required
     */
    _nsClient.connect()

    this._nsWatcher = {
      watch: _nsWatch,
      watched: _nsClient,
    }
  }

  /*
   * Collection of jolokia pods returned is an aggregate of the
   * pods currently been watched by the pod watchers
   */
  getJolokiaPods() {
    const pods: KubePod[] = []
    for (const pw of Object.values(this._podWatchers)) {
      if (!pw.jolokiaPod) continue

      pods.push(pw.jolokiaPod)
    }

    return pods
  }

  destroy() {
    if (isObject(this._nsWatcher)) {
      clientFactory.destroy(this._nsWatcher.watched, this._nsWatcher.watch)
      delete this._nsWatcher
    }

    for (const pr of Object.values(this._podWatchers)) {
      const pods_client = pr.client
      clientFactory.destroy(pods_client.watched, pods_client.watch)
      delete pr.jolokiaPod
    }
    this._podWatchers = {}
  }

  hasPrevious(): boolean {
    return this._current > 0
  }

  previous() {
    if (this._current === 0) return

    // Ensure current never goes below 0
    this._current = Math.max(this._current - this._limit, 0)

    /*
     * If already connected then recreate the pod watchers
     * according to the new position of _current
     */
    if (this.isConnected()) this.createPodWatchers()
  }

  hasNext(): boolean {
    const nextPage = this._current + this._limit
    return nextPage < this._podList.size
  }

  next() {
    const nextPage = this._current + this._limit
    if (nextPage >= this._podList.size) return

    this._current = nextPage

    /*
     * If already connected then recreate the pod watchers
     * according to the new position of _current
     */
    if (this.isConnected()) this.createPodWatchers()
  }
}
