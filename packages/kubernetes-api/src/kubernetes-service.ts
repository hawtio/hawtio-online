import {
  CLUSTER_VERSION_KEY,
  HawtioMode,
  METADATA_KEY_HAWTIO_MODE,
  METADATA_KEY_HAWTIO_NAMESPACE,
  UserProfile,
  oAuthService,
} from '@hawtio/online-oauth'
import { Hawtconfig, configManager } from '@hawtio/react'
import EventEmitter from 'eventemitter3'
import jsonpath from 'jsonpath'
import { Collection, ProcessDataCallback, clientFactory, log } from './client'
import { K8Actions, KubeObject, KubePod, KubeProject } from './globals'
import { WatchTypes } from './model'
import { pathGet } from './utils'

export interface Client<T extends KubeObject> {
  collection: Collection<T>
  watch: ProcessDataCallback<T>
}

export class KubernetesService extends EventEmitter {
  private readonly _jolokiaPortQuery = '$.spec.containers[*].ports[?(@.name=="jolokia")]'

  private oAuthProfile?: Promise<UserProfile>
  private _loading = 0
  private error?: Error
  private projects: KubeProject[] = []
  private pods: KubePod[] = []
  private projects_client: Client<KubeProject> | null = null
  private pods_clients: { [key: string]: Client<KubePod> } = {}

  async initialize() {
    try {
      this.oAuthProfile = oAuthService.getUserProfile()
      const profile = await this.oAuthProfile
      if (profile.hasError()) throw profile.getError()

      const mode = profile.metadataValue<HawtioMode>(METADATA_KEY_HAWTIO_MODE)
      switch (mode) {
        case 'cluster': {
          const hawtConfig = await configManager.getHawtconfig()
          this.initClusterConfig(profile, hawtConfig)
          break
        }
        case 'namespace':
          this.initNamespaceConfig(profile)
          break
      }
    } catch (error) {
      log.error('Kubernetes Service cannot complete initialisation due to:', error)
      const e = error instanceof Error ? error : new Error('Unknown error during initialisation')
      this.error = e
    }
  }

  private initNamespaceConfig(profile: UserProfile) {
    log.debug('Initialising Namespace Config')
    this._loading++
    let namespace = profile.metadataValue<string>(METADATA_KEY_HAWTIO_NAMESPACE)
    if (!namespace) {
      log.warn("No namespace can be found - defaulting to 'default'")
      namespace = 'default'
    }
    const pods_client = clientFactory.create<KubePod>(profile, { kind: WatchTypes.PODS, namespace: namespace })
    const pods_watch = pods_client.watch(pods => {
      this._loading--
      this.pods.splice(0, this.pods.length) // clear the array
      const jolokiaPods = pods.filter(pod => jsonpath.query(pod, this.jolokiaPortQuery).length > 0)
      this.pods.push(...jolokiaPods)
      this.emit(K8Actions.CHANGED)
    })

    this.pods_clients[namespace] = { collection: pods_client, watch: pods_watch }
    pods_client.connect()
  }

  private initClusterConfig(profile: UserProfile, hawtConfig: Hawtconfig) {
    log.debug('Initialising Cluster Config')
    const kindToWatch = profile.isOpenShift() ? WatchTypes.PROJECTS : WatchTypes.NAMESPACES
    const labelSelector = pathGet(hawtConfig, ['online', 'projectSelector']) as string
    const projects_client = clientFactory.create<KubeProject>(profile, {
      kind: kindToWatch,
      labelSelector: labelSelector,
    })

    this._loading++
    const projects_watch = projects_client.watch(projects => {
      // subscribe to pods update for new projects
      let filtered = projects.filter(project => !this.projects.some(p => p.metadata?.uid === project.metadata?.uid))
      for (const project of filtered) {
        this._loading++
        const pods_client = clientFactory.create<KubePod>(profile, {
          kind: WatchTypes.PODS,
          namespace: project.metadata?.name,
        })
        const pods_watch = pods_client.watch(pods => {
          this._loading--
          const others = this.pods.filter(pod => pod.metadata?.namespace !== project.metadata?.name)

          // clear pods
          this.pods.splice(0, this.pods.length)

          // add others back to pods
          this.pods.push(...others)

          const jolokiaPods = pods.filter(pod => jsonpath.query(pod, this.jolokiaPortQuery).length > 0)

          for (const jpod of jolokiaPods) {
            const pos = this.pods.findIndex(pod => pod.metadata?.uid === jpod.metadata?.uid)
            if (pos > -1) {
              // replace the pod - not sure we need to ...?
              this.pods.splice(pos, 1)
            }

            this.pods.push(jpod)
          }

          this.emit(K8Actions.CHANGED)
        })
        this.pods_clients[project.metadata?.name as string] = {
          collection: pods_client,
          watch: pods_watch,
        }
        pods_client.connect()
      }

      // handle delete projects
      filtered = this.projects.filter(project => !projects.some(p => p.metadata?.uid === project.metadata?.uid))
      for (const project of filtered) {
        const handle = this.pods_clients[project.metadata?.name as string]
        clientFactory.destroy(handle.collection, handle.watch)
        delete this.pods_clients[project.metadata?.name as string]
      }

      this.projects.splice(0, this.projects.length) // clear the array
      this.projects.push(...projects)
      this._loading--
    })

    this.projects_client = { collection: projects_client, watch: projects_watch }
    projects_client.connect()
  }

  private async assertInitAndNoErrors() {
    if (this.hasError()) throw this.error

    if (!this.oAuthProfile) throw new Error('Kubernetes Service is not initialized')

    const profile = await this.oAuthProfile
    if (profile.hasError()) throw profile.getError()
  }

  get loading() {
    return this._loading
  }

  isLoading(): boolean {
    return this._loading > 0
  }

  hasError(): boolean {
    return this.error !== undefined
  }

  getError(): Error | undefined {
    return this.error
  }

  get jolokiaPortQuery() {
    return this._jolokiaPortQuery
  }

  async is(mode: HawtioMode): Promise<boolean> {
    if (!this.oAuthProfile) throw new Error('Kubernetes Service is not initialized')
    const profile = await this.oAuthProfile
    return mode === profile.metadataValue(METADATA_KEY_HAWTIO_MODE)
  }

  async getPods(): Promise<KubePod[]> {
    await this.assertInitAndNoErrors()
    return this.pods
  }

  async getProjects(): Promise<KubeProject[]> {
    await this.assertInitAndNoErrors()
    return this.projects
  }

  async getClusterVersion(): Promise<string | undefined> {
    await this.assertInitAndNoErrors()
    const profile = await this.oAuthProfile
    return profile?.metadataValue(CLUSTER_VERSION_KEY)
  }

  async disconnect() {
    await this.assertInitAndNoErrors()
    if ((await this.is('cluster')) && this.projects_client) {
      clientFactory.destroy(this.projects_client.collection, this.projects_client.watch)
    }

    Object.values(this.pods_clients).forEach(client => {
      clientFactory.destroy(client.collection, client.watch)
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
    let reason = ''

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
}

export const kubernetesService = new KubernetesService()
