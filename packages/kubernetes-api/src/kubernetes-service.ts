import { configManager, Hawtconfig } from '@hawtio/react'
import {
  HawtioMode,
  HAWTIO_MODE_KEY,
  HAWTIO_NAMESPACE_KEY,
  CLUSTER_VERSION_KEY
} from '@hawtio/online-oauth'
import jsonpath from 'jsonpath'
import { clientFactory } from "./client/client-factory"
import { k8Api } from "./globals"
import { WatchTypes } from "./model"
import { pathGet } from './utils'
import { Collection } from './client/globals'

export interface Client {
  collection: Collection
  watch: (data: any[]) => void
}

export class OpenShiftService {

  private readonly jolokiaPortQuery = '$.spec.containers[*].ports[?(@.name=="jolokia")]'

  private _loading = 0
  private projects: any[] = []
  private pods: any[] = []
  private projects_client: Client | null
  private pods_clients: { [key: string]: Client } = {}

  constructor() {
    this.projects_client = null

    configManager.getHawtconfig()
      .then((hawtConfig: Hawtconfig) => {

        if (this.is(HawtioMode.Cluster)) {
          this.initClusterConfig(hawtConfig)
        } else {
          this.initNamespaceConfig()
        }
      })
  }

  private initNamespaceConfig() {
    this._loading++
    const namespace = k8Api.getOAuthProfile().metadataValue(HAWTIO_NAMESPACE_KEY)
    const pods_client = clientFactory.create(WatchTypes.PODS, namespace)
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
    const kindToWatch = k8Api.isOpenshift() ? WatchTypes.PROJECTS : WatchTypes.NAMESPACES
    const labelSelector = pathGet(hawtConfig, ['online', 'projectSelector'])
    const projects_client = clientFactory.create(
      {
        kind: kindToWatch,
        labelSelector: labelSelector,
      }
    )

    this._loading++
    const projects_watch = projects_client.watch(projects => {
      // subscribe to pods update for new projects
      projects.filter(project => !this.projects.some(p => p.metadata.uid === project.metadata.uid))
        .forEach(project => {
          this._loading++
          const pods_client = clientFactory.create(WatchTypes.PODS, project.metadata.name)
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
        })

      // handle delete projects
      this.projects.filter(project => !projects.some(p => p.metadata.uid === project.metadata.uid))
        .forEach(project => {
          const handle = this.pods_clients[project.metadata.name]
          clientFactory.destroy(handle.collection, handle.watch)
          delete this.pods_clients[project.metadata.name]
        })

      this.projects.length = 0
      this.projects.push(...projects)
      this._loading--
    })

    this.projects_client = { collection: projects_client, watch: projects_watch }
    projects_client.connect()
  }

  isLoading(): boolean {
    return this._loading > 0
  }

  getPods(): any[] {
    return this.pods
  }

  getProjects(): any[] {
    return this.projects
  }

  getClusterVersion(): string | undefined {
    return k8Api.getOAuthProfile().metadataValue(CLUSTER_VERSION_KEY)
  }

  is(mode: HawtioMode): boolean {
    return mode === k8Api.getOAuthProfile().metadataValue(HAWTIO_MODE_KEY)
  }

  disconnect(): void {
    if (this.is(HawtioMode.Cluster) && this.projects_client) {
      clientFactory.destroy(this.projects_client.collection, this.projects_client.watch)
    }

    Object.values(this.pods_clients)
      .forEach((client) => {
      clientFactory.destroy(client.collection, client.watch)
    })
  }
}
