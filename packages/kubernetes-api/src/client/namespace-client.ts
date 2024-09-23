import jsonpath from 'jsonpath'
import { JOLOKIA_PORT_QUERY, KubeObject, KubePod, Paging, log } from '../globals'
import { TypeFilter } from '../filter'
import { WatchTypes } from '../model'
import { isObject } from '../utils'
import { SortOrder } from '../sort'
import { Watched, KOptions, ProcessDataCallback } from './globals'
import { clientFactory } from './client-factory'

export type NamespaceClientCallback = (jolokiaPods: KubePod[], fullPodCount: number, error?: Error) => void

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
  private _filteredList: string[] = []
  private _notifyChange = false

  private _podWatchers: PodWatchers = {}
  private _nsWatcher?: Client<KubePod>
  private _refreshing = 0
  private _limit = 3
  private _sortOrder?: SortOrder
  private _typeFilter?: TypeFilter

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

    this._callback(this.getJolokiaPods(), this._podList.size, cbError)
  }

  private isFiltered(): boolean {
    if (!this._typeFilter) return false

    return !this._typeFilter.filterNS(this._namespace)
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
    log.debug(`[NamespaceClient ${this._namespace}]: creating pod watchers`)

    if (this._podList.size === 0 || this._current >= this._podList.size) {
      log.debug(`[NamespaceClient ${this._namespace}]: no pods in namespace`)
      this._callback(this.getJolokiaPods(), 0)
      return
    }

    const sortFn = (a: string, b: string) => {
      const order = this._sortOrder === SortOrder.DESC ? -1 : 1
      return a.localeCompare(b) * order
    }

    /*
     * Sort the pods according to the supplied sort order
     * then selects the block of pods determined by current and limit
     */
    log.debug(`[NamespaceClient ${this._namespace}]: sort order: `, this._sortOrder, ' filter: ', this._typeFilter)

    let pagedPods: string[]
    if (this.isFiltered()) {
      // Filtered out by namespace
      this._filteredList = []
      pagedPods = []
    } else {
      /*
       * Filter out pods based on pod name and then sort
       */
      log.debug(`[NamespaceClient ${this._namespace}]: has pods`, this._podList)

      this._filteredList = Array.from(this._podList)
        .filter(podName => (!this._typeFilter ? true : this._typeFilter.filterPod(podName)))
        .sort(sortFn)

      log.debug(`[NamespaceClient ${this._namespace}]: pods after filtering`, this._podList)

      if (this._current >= this._filteredList.length) {
        // if current is bigger than filtered podNames list then
        // reset it back to 0
        this._current = 0
      }

      // Set the paged pods list base on current and limit
      pagedPods = this._filteredList.slice(this._current, this._current + this._limit)
    }

    log.debug(`[NamespaceClient ${this._namespace}]: pods to be watched`, pagedPods)

    /*
     * Remove watchers for pods not in the slice of the filtered/sorted list
     */
    Object.entries(this._podWatchers)
      .filter(([name, _]) => !pagedPods.includes(name))
      .forEach(([name, podWatcher]) => {
        log.debug(`[NamespaceClient ${this._namespace}]: deleting pod watcher [${name}]`)

        clientFactory.destroy(podWatcher.client.watched, podWatcher.client.watch)
        delete this._podWatchers[name]
        this._notifyChange = true
      })

    log.debug(`[NamespaceClient ${this._namespace}]: pod watchers already initialised`, this._podWatchers)

    /*
     * Create any new pod watchers
     */
    this._refreshing = pagedPods.length
    pagedPods.forEach(name => {
      // Already watching this pod
      if (isObject(this._podWatchers[name])) {
        this._refreshing--
        return
      }

      // Set up new watcher for this pod
      const _podClient = clientFactory.create<KubePod>(this.initPodOptions(WatchTypes.PODS, name))
      const _podWatcher = _podClient.watch(podList => {
        if (this._refreshing > 0) this._refreshing--

        if (podList.length > 0) {
          if (this._podWatchers[name]) {
            // podList should only contain 1 pod (due to name)
            this._podWatchers[name].jolokiaPod = podList[0]
          } else {
            log.warn(
              `[NamespaceClient ${this._namespace}]: pod watcher with name ${name} no longer exists yet still watching`,
            )
          }
        }

        if (this._refreshing <= 0) {
          // Limit callback to final watch returning
          this._callback(this.getJolokiaPods(), this._filteredList.length)
        }
      })

      log.debug(`[NamespaceClient ${this._namespace}]: connecting new pod client`)

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

    if (pagedPods.length === 0 || this._notifyChange) {
      log.debug(
        `[NamespaceClient ${this._namespace}]: notifying since page is either empty or watcher configuration has changed`,
      )
      this._notifyChange = false
      this._callback(this.getJolokiaPods(), this._filteredList.length)
    }
  }

  get namespace(): string {
    return this._namespace
  }

  isConnected(): boolean {
    return isObject(this._nsWatcher) && this._nsWatcher.watched.connected
  }

  connect(limit: number) {
    if (this.isConnected()) return

    this._limit = limit > 1 ? limit : 1
    this._current = 0

    if (this.isFiltered()) {
      /*
       * Do not watch since this namespace has been filtered out
       * Return no pods and zero total
       */
      this._callback([], 0)
      return
    }

    const _nsClient = clientFactory.create<KubePod>(this.initPodOptions(WatchTypes.PODS))
    const _nsWatch = _nsClient.watch(pods => {
      /*
       * Filter out any non-jolokia pods or
       * any pods that do not conform to any pod filters
       * immediately and add the applicable pods to the pod name list
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
    this._podList.clear()
  }

  filter(typeFilter: TypeFilter) {
    this._typeFilter = typeFilter
    this._notifyChange = true

    /*
     * If already connected then recreate the pod watchers
     * according to the new type filter
     */
    if (this.isConnected()) {
      this.createPodWatchers()
    } else if (!this.isFiltered()) {
      this.connect(this._limit)
    }

    /*
     * Not connected and does not conform to the
     * namespace part of the type filter
     */
  }

  sort(sortOrder: SortOrder) {
    this._sortOrder = sortOrder
    this._notifyChange = true

    /*
     * If already connected then recreate the pod watchers
     * according to the new sort order
     */
    if (this.isConnected()) this.createPodWatchers()
  }

  first() {
    if (this._current === 0) return

    // Ensure current never goes below 0
    this._current = 0

    /*
     * If already connected then recreate the pod watchers
     * according to the new position of _current
     */
    if (this.isConnected()) this.createPodWatchers()
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

  last() {
    let remainder = this._podList.size % this._limit
    remainder = remainder === 0 ? this._limit : remainder

    this._current = this._podList.size - remainder

    /*
     * If already connected then recreate the pod watchers
     * according to the new position of _current
     */
    if (this.isConnected()) this.createPodWatchers()
  }

  /**
   * pageIdx: parameter representing a page index of the form (podList.size / limit)
   */
  page(pageIdx: number) {
    this._current = this._limit * (pageIdx - 1)
    if (this._current > this._podList.size) {
      // Navigate to last page if bigger than podList size
      this.last()
      return
    } else if (this._current < 0) {
      // Navigate to first page if index is somehow -ve
      this.first()
      return
    }

    /*
     * If already connected then recreate the pod watchers
     * according to the new position of _current
     */
    if (this.isConnected()) this.createPodWatchers()
  }
}
