import { EventEmitter } from 'eventemitter3'
import { ManagedPod } from './managed-pod'
import { Connection, ConnectionTestResult, Connections, connectService, eventService } from '@hawtio/react'
import {
  k8Service,
  k8Api,
  K8Actions,
  Container,
  ContainerPort,
  debounce,
  KubePodsByProject,
  Paging,
  SortOrder,
  TypeFilter,
} from '@hawtio/online-kubernetes-api'
import { ManagedProjects, MgmtActions, log } from './globals'
import { ManagedProject } from './managed-project'

interface UpdateEmitter {
  uid?: string
  fireUpdate: boolean
}

interface UpdateQueue {
  fireUpdate: boolean
  uids: Set<string>
}

export class ManagementService extends EventEmitter implements Paging {
  private _initialized = false
  private _managedProjects: ManagedProjects = {}
  private pollManagementData = debounce(() => this.mgmtUpdate(), 1000)
  private updateQueue: UpdateQueue = {
    fireUpdate: false,
    uids: new Set<string>(),
  }
  private _orderingAndFiltering = false

  private _jolokiaPolling = 15000
  private _pollingHandle?: NodeJS.Timeout

  constructor() {
    super()

    k8Service.on(K8Actions.CHANGED, () => this.initialize())
    this.schedulePolling()
  }

  async initialize(): Promise<boolean> {
    if (!k8Api.initialized) {
      await k8Api.initialize()
    }

    if (!k8Service.initialized) {
      await k8Service.initialize()
    }

    if (!this.hasError()) {
      const kPodsByProject: KubePodsByProject = k8Service.getPods()

      /*
       * Delete any projects no longer contained in the k8 service
       */
      Object.keys(this._managedProjects)
        .filter(ns => !Object.keys(kPodsByProject).includes(ns))
        .forEach(ns => {
          /* Flag this project to be removed in the update */
          this._managedProjects[ns].pods = []
          this._managedProjects[ns].fullPodCount = 0
        })

      /*
       * Update the remaining projects
       */
      Object.entries(kPodsByProject).forEach(([project, kPodsOrError]) => {
        /*
         * Either project has never been seen before so initialise
         * or there are no (longer any) jolokia pods in the project
         */
        if (!this._managedProjects[project]) {
          this._managedProjects[project] = new ManagedProject(project)
        }

        const mgmtProject = this._managedProjects[project]

        // Project may have an error
        mgmtProject.error = kPodsOrError
        mgmtProject.pods = kPodsOrError.pods
        mgmtProject.fullPodCount = kPodsOrError.fullPodCount
      })

      // let's kick a polling cycle
      this.pollManagementData()
    }

    // At least first pass of the pods has been completed
    this._initialized = true
    return this._initialized
  }

  private schedulePolling() {
    if (this._pollingHandle) clearInterval(this._pollingHandle)

    this._pollingHandle = setInterval(() => this.pollManagementData(), this._jolokiaPolling)
  }

  private preMgmtUpdate() {
    /* Reset the update queue */
    this.updateQueue.uids.clear()
    this.updateQueue.fireUpdate = this._orderingAndFiltering

    // Add all the uids to the queue
    Object.values(this._managedProjects)
      .map(managedProject => managedProject.pods)
      .map(podsByUid => Object.keys(podsByUid).forEach(uid => this.updateQueue.uids.add(uid)))
  }

  private emitUpdate(emitter: UpdateEmitter) {
    if (emitter.uid) {
      this.updateQueue.uids.delete(emitter.uid)
    }

    /*
     * If not already set to fire then check whether
     * the emitter should fire then update the queue
     */
    if (!this.updateQueue.fireUpdate)
      this.updateQueue.fireUpdate = emitter.fireUpdate ? emitter.fireUpdate : this.updateQueue.fireUpdate

    if (this.updateQueue.fireUpdate && this.updateQueue.uids.size === 0) {
      this._orderingAndFiltering = false // reset ready for next time
      this.emit(MgmtActions.UPDATED)
    }
  }

  private async mgmtUpdate() {
    this.preMgmtUpdate()

    if (Object.keys(this._managedProjects).length === 0) {
      /*
       * If there are no pods, we still want an update to fire
       * to let 3rd parties know that updates are happening but
       * currently there are no pods to report on
       */
      this.emitUpdate({ fireUpdate: true })
      return
    }

    for (const managedProject of Object.values(this._managedProjects)) {
      const mPodsByUid = managedProject.pods

      if (Object.entries(mPodsByUid).length === 0) {
        delete this._managedProjects[managedProject.name]
        this.emitUpdate({ fireUpdate: true })
        continue
      }

      for (const [uid, mPod] of Object.entries(mPodsByUid)) {
        // Flag that the pod is now under management
        mPod.management.status.managed = true

        // Is the pod actually running at the moment
        mPod.management.status.running = this.podStatus(mPod) === 'Running'
        if (!mPod.management.status.running) {
          /*
           * No point in trying to fire a jolokia request
           * against a non-running pod or a pod that cannot connect via jolokia
           * Emit an update but only if the status has in fact changed
           */
          this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
          continue
        }

        // Reduce the number of times that a pod with managment error is polled
        if (mPod.mgmtError) {
          mPod.incrementErrorPollCount()

          if (mPod.errorPolling.count < mPod.errorPolling.threshold) {
            // ignore this probing iteration as we have an error and not reach the polling threshold
            this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
            continue
          }

          // met the threshold so poll on this occasion but raise the threshold
          mPod.incrementErrorPollThreshold()
        }

        /*
         * Test the jolokia url to see if it is valid
         */
        try {
          const url = await mPod.probeJolokiaUrl()
          if (!url) {
            this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
          }
        } catch (error) {
          log.error(new Error(`Cannot access jolokia url at ${mPod.jolokiaPath}`, { cause: error }))
          this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
          continue
        }

        mPod.search(
          () => {
            this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
          },
          (error: Error) => {
            log.error(new Error(`Cannot access jolokia url at ${mPod.jolokiaPath}`, { cause: error }))
            this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
          },
        )
      }
    }
  }

  get initialized(): boolean {
    return this._initialized
  }

  get jolokiaPollingInterval() {
    return this._jolokiaPolling
  }

  set jolokiaPollingInterval(jolokiaPolling: number) {
    this._jolokiaPolling = jolokiaPolling
    this.schedulePolling()
  }

  hasError() {
    return k8Api.hasError() || k8Service.hasError()
  }

  get error(): Error | null {
    if (k8Api.hasError()) return k8Api.error

    if (k8Service.hasError()) return k8Service.error

    return null
  }

  get projects(): ManagedProjects {
    return this._managedProjects
  }

  podStatus(pod: ManagedPod): string {
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

  jolokiaContainerPort(container: Container): number {
    const ports: Array<ContainerPort> = container.ports || []
    const containerPort = ports.find(port => port.name === 'jolokia')
    return containerPort?.containerPort ?? ManagedPod.DEFAULT_JOLOKIA_PORT
  }

  jolokiaContainers(pod: ManagedPod): Array<Container> {
    if (!pod) return []

    const containers: Array<Container> = pod.spec?.containers || []
    return containers.filter(container => {
      return this.jolokiaContainerPort(container) !== null
    })
  }

  connectToUrl(pod: ManagedPod, container: Container): URL {
    const jolokiaPort = this.jolokiaContainerPort(container)
    const jolokiaPath = pod.newJolokiaPath(jolokiaPort)
    const url: URL = new URL(jolokiaPath)
    return url
  }

  private connectionKeyName(pod: ManagedPod, container: Container) {
    return `${pod.metadata?.namespace}-${pod.metadata?.name}-${container.name}`
  }

  refreshConnections(pod: ManagedPod): string[] {
    const containers: Array<Container> = this.jolokiaContainers(pod)
    const connections: Connections = connectService.loadConnections()

    const connNames: string[] = []
    for (const container of containers) {
      const url: URL = this.connectToUrl(pod, container)
      const protocol = url.protocol.replace(':', '') as 'http' | 'https'
      const connection: Connection = {
        id: this.connectionKeyName(pod, container),
        name: this.connectionKeyName(pod, container),
        jolokiaUrl: url.toString(),

        // Not necessary but included to satisfy rules of Connection object
        scheme: protocol,
        host: url.hostname,
        port: Number(url.port),
        path: url.pathname,
      }

      const connName = this.connectionKeyName(pod, container)
      connections[connName] = connection
      connNames.push(connName)
    }

    connectService.saveConnections(connections)

    // returns the names of the given pod's connections
    return connNames
  }

  connect(connectName: string) {
    const connections: Connections = connectService.loadConnections()

    const connection: Connection = connections[connectName]
    if (!connection) {
      log.error(`There is no connection configured with name ${connectName}`)
      return
    }

    connectService
      .testConnection(connection)
      .then((result: ConnectionTestResult) => {
        if (result.status !== 'reachable') {
          const msg = `There was a problem connecting to the jolokia service ${connectName}`
          log.error(msg)
          eventService.notify({ type: 'danger', message: msg })
          return
        }

        if (result.message.includes('auth failed')) {
          const msg = `A problem occurred with authentication while trying to connect to the jolokia service ${connectName}`
          log.error(msg)
          eventService.notify({ type: 'danger', message: msg })
          return
        }

        connectService.connect(connection)
      })
      .catch(error => {
        const msg = `A problem occurred while trying to connect to the jolokia service ${connectName}`
        log.error(msg)
        log.error(error)
        eventService.notify({ type: 'danger', message: msg })
        return
      })
  }

  /********************
   * Filtering & Sort support
   ********************/
  filter(typeFilter: TypeFilter) {
    this._orderingAndFiltering = true
    k8Service.filter(typeFilter)
  }

  sort(sortOrder: SortOrder) {
    this._orderingAndFiltering = true
    k8Service.sort(sortOrder)
  }

  /********************
   * Paging interface
   ********************/
  hasPrevious(project?: string): boolean {
    return k8Service.hasPrevious(project)
  }

  hasNext(project?: string): boolean {
    return k8Service.hasNext(project)
  }

  first(project?: string) {
    k8Service.first(project)
  }

  previous(project?: string) {
    k8Service.previous(project)
  }

  next(project?: string) {
    k8Service.next(project)
  }

  last(project?: string) {
    k8Service.last(project)
  }

  page(pageIdx: number, project?: string) {
    k8Service.page(pageIdx, project)
  }
}
