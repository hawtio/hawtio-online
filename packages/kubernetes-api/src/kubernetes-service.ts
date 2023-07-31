import { configManager, Hawtconfig } from '@hawtio/react'
import {
  HawtioMode,
  HAWTIO_MODE_KEY,
  HAWTIO_NAMESPACE_KEY,
  CLUSTER_VERSION_KEY,
  UserProfile,
  getActiveProfile,
} from '@hawtio/online-oauth'
import jsonpath from 'jsonpath'
import { WatchTypes } from "./model"
import { pathGet } from './utils'
import { clientFactory, Collection, log } from "./client"
import { k8Api } from './init'

export interface Client {
  collection: Collection
  watch: (data: any[]) => void
}

export class KubernetesService {

  private readonly jolokiaPortQuery = '$.spec.containers[*].ports[?(@.name=="jolokia")]'

  private _loading = 0
  private _initialized: boolean = false
  private _error: Error|null = null
  private _oAuthProfile: UserProfile | null = null
  private projects: any[] = []
  private pods: any[] = []
  private projects_client: Client | null = null
  private pods_clients: { [key: string]: Client } = {}

  async initialize(): Promise<boolean> {
    if (this._initialized)
      return this._initialized

    try {
      this._oAuthProfile = await getActiveProfile()
      if (! this._oAuthProfile)
        throw new Error('Cannot initialize an active OAuth profile')

      if (this._oAuthProfile.hasError())
        throw this._oAuthProfile.getError()

      const isCluster = this.is(HawtioMode.Cluster)
      if (isCluster) {
        const hawtConfig = await configManager.getHawtconfig()
        this.initClusterConfig(hawtConfig)
      } else {
        this.initNamespaceConfig(this._oAuthProfile)
      }

      this._initialized = true
    } catch (error) {
      log.error('k8 Service cannot complete initialisation due to: ', error)
      if (error instanceof Error)
        this._error = error
      else
        this._error = new Error("Unknown error during initialisation")
    }

    this._initialized = true
    return this._initialized
  }

  private initNamespaceConfig(profile: UserProfile) {
    this._loading++
    let namespace = profile.metadataValue(HAWTIO_NAMESPACE_KEY)
    if (!namespace) {
      log.warn("No namespace can be found - defaulting to 'default'")
      namespace = 'default'
    }
    const pods_client = clientFactory.create({ kind: WatchTypes.PODS }, namespace)
    const pods_watch = pods_client.watch(pods => {
      this._loading--
      this.pods.length = 0
      const jolokiaPods = pods.filter(pod => jsonpath.query(pod, this.jolokiaPortQuery).length > 0)
      this.pods.push(...jolokiaPods)
      // TODO
      console.log("TODO kubernetes-service:initNamespaceConfig")
      // this.emit('changed')
    })

    this.pods_clients[namespace] = { collection: pods_client, watch: pods_watch }
    pods_client.connect()
  }

  private initClusterConfig(hawtConfig: Hawtconfig) {
    const kindToWatch = k8Api.isOpenshift ? WatchTypes.PROJECTS : WatchTypes.NAMESPACES
    const labelSelector = pathGet(hawtConfig, ['online', 'projectSelector']) as string
    const projects_client = clientFactory.create(
      {
        kind: kindToWatch,
        labelSelector: labelSelector,
      }
    )

    this._loading++
    const projects_watch = projects_client.watch(projects => {
      // subscribe to pods update for new projects
      let filtered = projects.filter(project => !this.projects.some(p => p.metadata.uid === project.metadata.uid))
      for (const project of filtered) {
        this._loading++
        const pods_client = clientFactory.create({ kind: WatchTypes.PODS }, project.metadata.name)
        const pods_watch = pods_client.watch(pods => {
          this._loading--
          const others = this.pods.filter(pod => pod.metadata.namespace !== project.metadata.name)
          this.pods.length = 0
          const jolokiaPods = pods.filter(pod => jsonpath.query(pod, this.jolokiaPortQuery).length > 0)
          this.pods.push(...others, ...jolokiaPods)

          // TODO
          console.log("TODO kubernetes-service:initProjects")
          // this.emit('changed')
        })
        this.pods_clients[project.metadata.name] = {
          collection: pods_client,
          watch: pods_watch,
        }
        pods_client.connect()
      }

      // handle delete projects
      filtered = this.projects.filter(project => !projects.some(p => p.metadata.uid === project.metadata.uid))
      for (const project of filtered) {
        const handle = this.pods_clients[project.metadata.name]
        clientFactory.destroy(handle.collection, handle.watch)
        delete this.pods_clients[project.metadata.name]
      }

      this.projects.length = 0
      this.projects.push(...projects)
      this._loading--
    })

    this.projects_client = { collection: projects_client, watch: projects_watch }
    projects_client.connect()
  }

  get initialized(): boolean {
    return this._initialized
  }

  private checkInitOrError() {
    if (! this.initialized)
      throw new Error('k8 Service is not intialized')

    if (this.hasError())
      throw this._error

    if (! this._oAuthProfile)
      throw new Error('Cannot find the oAuth profile')

    if (this._oAuthProfile.hasError())
      throw this._oAuthProfile.getError()
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

  get error(): Error|null {
    return this._error
  }

  is(mode: HawtioMode): boolean {
    return mode === this._oAuthProfile?.metadataValue(HAWTIO_MODE_KEY)
  }

  getPods(): any[] {
    this.checkInitOrError()
    return this.pods
  }

  getProjects(): any[] {
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
      clientFactory.destroy(this.projects_client.collection, this.projects_client.watch)
    }

    Object.values(this.pods_clients)
      .forEach((client) => {
      clientFactory.destroy(client.collection, client.watch)
    })
  }
}
