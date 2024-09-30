import { configManager, Hawtconfig } from '@hawtio/react'
import EventEmitter from 'eventemitter3'
import {
  HawtioMode,
  HAWTIO_MODE_KEY,
  HAWTIO_NAMESPACE_KEY,
  CLUSTER_VERSION_KEY,
  UserProfile,
  getActiveProfile,
} from '@hawtio/online-oauth'
import { WatchTypes } from './model'
import { isError, pathGet } from './utils'
import { clientFactory, log, Client, NamespaceClient } from './client'
import { K8Actions, KubePod, KubePodsByProject, KubeProject, Paging } from './globals'
import { k8Api } from './init'
import { TypeFilter } from './filter'
import { SortOrder } from './sort'

export class KubernetesService extends EventEmitter implements Paging {
  private _loading = 0
  private _initialized = false
  private _error: Error | null = null
  private _oAuthProfile: UserProfile | null = null
  private projects: KubeProject[] = []
  private podsByProject: KubePodsByProject = {}
  private projects_client: Client<KubeProject> | null = null
  private namespace_clients: { [namespace: string]: NamespaceClient } = {}

  private _nsLimit = 3
  private _typeFilter?: TypeFilter
  private _sortOrder?: SortOrder

  async initialize(): Promise<boolean> {
    if (this._initialized) return this._initialized

    try {
      this._oAuthProfile = await getActiveProfile()
      if (!this._oAuthProfile) throw new Error('Cannot initialize k8s API due to no active OAuth profile')

      if (this._oAuthProfile.hasError()) throw this._oAuthProfile.getError()

      const isCluster = this.is(HawtioMode.Cluster)
      if (isCluster) {
        const hawtConfig = await configManager.getHawtconfig()
        this.initClusterConfig(hawtConfig)
      } else {
        this.initNamespaceConfig(this._oAuthProfile)
      }

      this._initialized = true
    } catch (error) {
      log.error('k8s Service cannot complete initialisation due to: ', error)
      if (error instanceof Error) this._error = error
      else this._error = new Error('Unknown error during initialisation')
    }

    this._initialized = true
    return this._initialized
  }

  private initNamespaceClient(namespace: string) {
    const cb = (jolokiaPods: KubePod[], fullPodCount: number, error?: Error) => {
      log.debug(`[KubeService ${namespace}]: callback: fullPodCount: ${fullPodCount}`, 'jolokia pods: ', jolokiaPods)

      this._loading = this._loading > 0 ? this._loading-- : 0

      if (isError(error)) {
        this.podsByProject[namespace] = { fullPodCount: fullPodCount, pods: [], error: error }
        this.emit(K8Actions.CHANGED)
        return
      }

      const projectPods: KubePod[] = []
      for (const jpod of jolokiaPods) {
        const pos = projectPods.findIndex(pod => pod.metadata?.uid === jpod.metadata?.uid)
        if (pos > -1) {
          projectPods.splice(pos, 1)
        }
        projectPods.push(jpod)
      }

      if (projectPods.length === 0) delete this.podsByProject[namespace]
      else {
        this.podsByProject[namespace] = { fullPodCount: fullPodCount, pods: projectPods }
      }

      this.emit(K8Actions.CHANGED)
    }

    this.namespace_clients[namespace] = new NamespaceClient(namespace, cb)
    this.namespace_clients[namespace].connect(this._nsLimit)
  }

  private initNamespaceConfig(profile: UserProfile) {
    log.debug('Initialising Namespace Config')
    this._loading++
    let namespace = profile.metadataValue<string>(HAWTIO_NAMESPACE_KEY)
    if (!namespace) {
      log.warn("No namespace can be found - defaulting to 'default'")
      namespace = 'default'
    }

    this.initNamespaceClient(namespace)
  }

  private initClusterConfig(hawtConfig: Hawtconfig) {
    log.debug('Initialising Cluster Config')
    const kindToWatch = k8Api.isOpenshift ? WatchTypes.PROJECTS : WatchTypes.NAMESPACES
    const labelSelector = pathGet(hawtConfig, ['online', 'projectSelector']) as string
    const projects_client = clientFactory.create<KubeProject>({
      kind: kindToWatch,
      labelSelector: labelSelector,
    })

    this._loading++
    const projects_watch = projects_client.watch(projects => {
      // subscribe to pods update for new projects
      let filtered = projects.filter(project => !this.projects.some(p => p.metadata?.uid === project.metadata?.uid))
      for (const project of filtered) {
        this._loading++

        const namespace = project.metadata?.name as string
        this.initNamespaceClient(namespace)
      }

      // handle delete projects
      filtered = this.projects.filter(project => !projects.some(p => p.metadata?.uid === project.metadata?.uid))
      for (const project of filtered) {
        this.namespace_clients[project.metadata?.name as string].destroy()
      }

      this.projects.splice(0, this.projects.length) // clear the array
      this.projects.push(...projects)
      this._loading--
    })

    this.projects_client = { watched: projects_client, watch: projects_watch }
    projects_client.connect()
  }

  get initialized(): boolean {
    return this._initialized
  }

  private checkInitOrError() {
    if (!this.initialized) throw new Error('k8s Service is not intialized')

    if (this.hasError()) throw this._error

    if (!this._oAuthProfile) throw new Error('Cannot find the oAuth profile')

    if (this._oAuthProfile.hasError()) throw this._oAuthProfile.getError()
  }

  get loading() {
    return this._loading
  }

  isLoading(): boolean {
    return this._loading > 0
  }

  hasError() {
    return this._error !== null
  }

  get error(): Error | null {
    return this._error
  }

  get namespaceLimit() {
    return this._nsLimit
  }

  set namespaceLimit(limit: number) {
    this._nsLimit = limit

    Object.values(this.namespace_clients).forEach(client => {
      client.destroy()

      // Pause for half a second before re-connecting with the new limit
      setTimeout(() => client.connect(this._nsLimit), 100)
    })
  }

  is(mode: HawtioMode): boolean {
    return mode === this._oAuthProfile?.metadataValue(HAWTIO_MODE_KEY)
  }

  getPods(): KubePodsByProject {
    this.checkInitOrError()
    return this.podsByProject
  }

  getProjects(): KubeProject[] {
    this.checkInitOrError()
    return this.projects
  }

  getClusterVersion(): string | undefined {
    this.checkInitOrError()
    return this._oAuthProfile?.metadataValue(CLUSTER_VERSION_KEY)
  }

  disconnect() {
    this.checkInitOrError()
    if (this.is(HawtioMode.Cluster) && this.projects_client) {
      clientFactory.destroy(this.projects_client.watched, this.projects_client.watch)
    }

    Object.values(this.namespace_clients).forEach(client => {
      client.destroy()
    })
  }

  podStatus(pod: KubePod): string {
    // Return results that match
    // https://github.com/openshift/origin/blob/master/vendor/k8s.io/kubernetes/pkg/printers/internalversion/printers.go#L523-L615

    if (!pod || (!pod.metadata?.deletionTimestamp && !pod.status)) {
      return ''
    }

    if (pod.metadata?.deletionTimestamp) {
      return 'Terminating'
    }

    let initializing = false
    let reason

    // Print detailed container reasons if available. Only the first will be
    // displayed if multiple containers have this detail.

    const initContainerStatuses = pod.status?.initContainerStatuses || []
    for (const initContainerStatus of initContainerStatuses) {
      const initContainerState = initContainerStatus['state']
      if (!initContainerState) continue

      if (initContainerState.terminated && initContainerState.terminated.exitCode === 0) {
        // initialization is complete
        break
      }

      if (initContainerState.terminated) {
        // initialization is failed
        if (!initContainerState.terminated.reason) {
          if (initContainerState.terminated.signal) {
            reason = 'Init Signal: ' + initContainerState.terminated.signal
          } else {
            reason = 'Init Exit Code: ' + initContainerState.terminated.exitCode
          }
        } else {
          reason = 'Init ' + initContainerState.terminated.reason
        }
        initializing = true
        break
      }

      if (
        initContainerState.waiting &&
        initContainerState.waiting.reason &&
        initContainerState.waiting.reason !== 'PodInitializing'
      ) {
        reason = 'Init ' + initContainerState.waiting.reason
        initializing = true
      }
    }

    if (!initializing) {
      reason = pod.status?.reason || pod.status?.phase || ''

      const containerStatuses = pod.status?.containerStatuses || []
      for (const containerStatus of containerStatuses) {
        const containerReason = containerStatus.state?.waiting?.reason || containerStatus.state?.terminated?.reason

        if (containerReason) {
          reason = containerReason
          break
        }

        const signal = containerStatus.state?.terminated?.signal
        if (signal) {
          reason = `Signal: ${signal}`
          break
        }

        const exitCode = containerStatus.state?.terminated?.exitCode
        if (exitCode) {
          reason = `Exit Code: ${exitCode}`
          break
        }
      }
    }

    return reason || 'unknown'
  }

  /*****************************
   * Filtering and Sort support
   *****************************/
  sort(order: SortOrder) {
    this._sortOrder = order

    Object.values(this.namespace_clients).forEach(client => {
      client.sort(order)
    })
  }

  filter(typeFilter: TypeFilter) {
    this._typeFilter = new TypeFilter(typeFilter.nsValues, typeFilter.nameValues)

    Object.values(this.namespace_clients).forEach(client => {
      client.filter(typeFilter)
    })
  }

  /********************
   * Paging interface
   ********************/
  first(namespace?: string) {
    if (!namespace) return

    const nsClient = this.namespace_clients[namespace]
    if (!nsClient) return

    if (!nsClient.isConnected) {
      log.warn(`k8s Service cannot page on disconnected namespace ${namespace}`)
      return
    }

    this.namespace_clients[namespace].first()
  }

  hasPrevious(namespace?: string): boolean {
    if (!namespace) return false

    const nsClient = this.namespace_clients[namespace]
    if (!nsClient) return false

    if (!nsClient.isConnected) return false

    return this.namespace_clients[namespace].hasPrevious()
  }

  previous(namespace?: string) {
    if (!namespace) return

    const nsClient = this.namespace_clients[namespace]
    if (!nsClient) return

    if (!nsClient.isConnected) {
      log.warn(`k8s Service cannot page on disconnected namespace ${namespace}`)
      return
    }

    this.namespace_clients[namespace].previous()
  }

  hasNext(namespace?: string): boolean {
    if (!namespace) return false

    const nsClient = this.namespace_clients[namespace]
    if (!nsClient) return false

    if (!nsClient.isConnected) return false

    return this.namespace_clients[namespace].hasNext()
  }

  next(namespace?: string) {
    if (!namespace) return

    const nsClient = this.namespace_clients[namespace]
    if (!nsClient) return

    if (!nsClient.isConnected) {
      log.warn(`k8s Service cannot page on disconnected namespace ${namespace}`)
      return
    }

    this.namespace_clients[namespace].next()
  }

  last(namespace?: string) {
    if (!namespace) return

    const nsClient = this.namespace_clients[namespace]
    if (!nsClient) return

    if (!nsClient.isConnected) {
      log.warn(`k8s Service cannot page on disconnected namespace ${namespace}`)
      return
    }

    this.namespace_clients[namespace].last()
  }

  page(pageIdx: number, namespace?: string) {
    if (!namespace) return

    const nsClient = this.namespace_clients[namespace]
    if (!nsClient) return

    if (!nsClient.isConnected) {
      log.warn(`k8s Service cannot page on disconnected namespace ${namespace}`)
      return
    }

    this.namespace_clients[namespace].page(pageIdx)
  }
}
