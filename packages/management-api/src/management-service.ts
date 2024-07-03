import { EventEmitter } from 'eventemitter3'
import { ManagedPod } from './managed-pod'
import { Connection, Connections, connectService } from '@hawtio/react'
import { k8Service, k8Api, KubePod, K8Actions, Container, ContainerPort, debounce } from '@hawtio/online-kubernetes-api'
import { MgmtActions, log } from './globals'

interface UpdateEmitter {
  uid?: string
  fireUpdate: boolean
}

interface UpdateQueue {
  fireUpdate: boolean
  uids: Set<string>
}

export class ManagementService extends EventEmitter {
  private _initialized = false
  private _pods: { [key: string]: ManagedPod } = {}
  private pollManagementData = debounce(() => this.mgmtUpdate(), 1000)
  private updateQueue: UpdateQueue = {
    fireUpdate: false,
    uids: new Set<string>(),
  }

  constructor() {
    super()

    k8Service.on(K8Actions.CHANGED, () => this.initialize())
    setInterval(() => this.pollManagementData(), 10000)
  }

  async initialize(): Promise<boolean> {
    if (!k8Api.initialized) {
      await k8Api.initialize()
    }

    if (!k8Service.initialized) {
      await k8Service.initialize()
    }

    if (!this.hasError()) {
      const kPods: KubePod[] = k8Service.getPods()

      kPods.forEach(kPod => {
        const uid = kPod.metadata?.uid
        if (!uid) {
          log.error('Cannot access uid from pod')
          return
        }

        const mPod = this._pods[uid]
        if (!mPod) {
          this._pods[uid] = new ManagedPod(kPod)
        } else {
          kPod.management = mPod.pod.management
          mPod.pod = kPod
        }

        for (const uid in this._pods) {
          if (!kPods.some(kPod => kPod.metadata?.uid === uid)) {
            delete this._pods[uid]
          }
        }
      })

      // let's kick a polling cycle
      this.pollManagementData()
    }

    // At least first pass of the pods has been completed
    this._initialized = true
    return this._initialized
  }

  private preMgmtUpdate() {
    /* Reset the update queue */
    this.updateQueue.uids.clear()
    this.updateQueue.fireUpdate = false

    // Add all the uids to the queue
    Object.keys(this._pods).forEach(uid => this.updateQueue.uids.add(uid))
  }

  private emitUpdate(emitter: UpdateEmitter) {
    if (emitter.uid) {
      this.updateQueue.uids.delete(emitter.uid)
    }

    /* If the emitter should fire then update the queue */
    this.updateQueue.fireUpdate = emitter.fireUpdate ? emitter.fireUpdate : this.updateQueue.fireUpdate

    if (this.updateQueue.fireUpdate && this.updateQueue.uids.size === 0) this.emit(MgmtActions.UPDATED)
  }

  private async mgmtUpdate() {
    this.preMgmtUpdate()

    if (Object.keys(this._pods).length === 0) {
      /*
       * If there are no pods, we still want an update to fire
       * to let 3rd parties know that updates are happening but
       * currently there are no pods to report on
       */
      this.emitUpdate({ fireUpdate: true })
      return
    }

    for (const uid of Object.keys(this._pods)) {
      const mPod: ManagedPod = this._pods[uid]

      // Flag that the pod is now under management
      mPod.getManagement().status.managed = true

      // Is the pod actually running at the moment
      mPod.getManagement().status.running = this.podStatus(mPod) === 'Running'
      if (!mPod.getManagement().status.running) {
        /*
         * No point in trying to fire a jolokia request
         * against a non-running pod or a pod that cannot connect via jolokia
         * Emit an update but only if the status has in fact changed
         */
        this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
        continue
      }

      // Reduce the number of times that a pod with managment error is polled
      const mgmtError = mPod.getManagementError()
      if (mgmtError) {
        mPod.incrementErrorPollCount()

        if (mPod.getErrorPolling().count < mPod.getErrorPolling().threshold) {
          // ignore this probing iteration as we have an error and not reach the polling threshold
          this.emitUpdate({ uid, fireUpdate: mPod.hasChanged() })
          continue
        } else {
          // met the threshold so poll on this occasion but raise the threshold
          mPod.incrementErrorPollThreshold()
        }
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

  get initialized(): boolean {
    return this._initialized
  }

  hasError() {
    return k8Api.hasError() || k8Service.hasError()
  }

  get error(): Error | null {
    if (k8Api.hasError()) return k8Api.error

    if (k8Service.hasError()) return k8Service.error

    return null
  }

  get pods(): ManagedPod[] {
    return Object.values(this._pods)
  }

  podStatus(pod: ManagedPod): string {
    // Return results that match
    // https://github.com/openshift/origin/blob/master/vendor/k8s.io/kubernetes/pkg/printers/internalversion/printers.go#L523-L615

    if (!pod || (!pod.getMetadata()?.deletionTimestamp && !pod.getStatus())) {
      return ''
    }

    if (pod.getMetadata()?.deletionTimestamp) {
      return 'Terminating'
    }

    let initializing = false
    let reason

    // Print detailed container reasons if available. Only the first will be
    // displayed if multiple containers have this detail.

    const initContainerStatuses = pod.getStatus()?.initContainerStatuses || []
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
      reason = pod.getStatus()?.reason || pod.getStatus()?.phase || ''

      const containerStatuses = pod.getStatus()?.containerStatuses || []
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

    const containers: Array<Container> = pod.getSpec()?.containers || []
    return containers.filter(container => {
      return this.jolokiaContainerPort(container) !== null
    })
  }

  connectToUrl(pod: ManagedPod, container: Container): URL {
    const jolokiaPort = this.jolokiaContainerPort(container)
    const jolokiaPath = ManagedPod.getJolokiaPath(pod.pod, jolokiaPort) || ''
    const url: URL = new URL(jolokiaPath)
    return url
  }

  private connectionKeyName(pod: ManagedPod, container: Container) {
    return `${pod.getMetadata()?.name}-${container.name}`
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

    connectService.connect(connection)
  }
}
