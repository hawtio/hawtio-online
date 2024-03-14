import {
  Container,
  ContainerPort,
  KubernetesActions,
  debounce,
  kubernetesApi,
  kubernetesService,
} from '@hawtio/online-kubernetes-api'
import { Connection, Connections, connectService } from '@hawtio/react'
import { EventEmitter } from 'eventemitter3'
import { ManagementActions, log } from './globals'
import { ManagedPod, Management } from './managed-pod'

export type UpdateEmitter = {
  uid?: string
  fireUpdate: boolean
}

export class ManagementService extends EventEmitter {
  private _pods: Record<string, ManagedPod> = {}
  private uidQueue: Set<string> = new Set()

  constructor() {
    super()

    kubernetesService.on(KubernetesActions.CHANGED, () => this.initialize())
    // TODO: Use Jolokia polling preference
    setInterval(() => this.pollManagementData(), 10000)
  }

  async initialize() {
    if (this.hasError()) {
      log.error('Cannot initialize Management Service due to:', this.error)
      return
    }

    const kPods = await kubernetesService.getPods()
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

      Object.keys(this._pods).forEach(uid => {
        if (!kPods.some(kPod => kPod.metadata?.uid === uid)) {
          delete this._pods[uid]
        }
      })
    })

    // let's kick a polling cycle
    this.pollManagementData()
  }

  private pollManagementData() {
    debounce(() => this.mgmtUpdate(), 1000)
  }

  private hash(s: string): number {
    return s.split('').reduce(function (a, b) {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
  }

  private fingerprint(management: Management): number {
    const s = JSON.stringify(management)
    return this.hash(s)
  }

  private preMgmtUpdate() {
    // New decorate function starting with empty queue
    this.uidQueue.clear()
    // Add all the uids to the queue
    Object.keys(this._pods).forEach(uid => this.uidQueue.add(uid))
  }

  private emitUpdate(emitter: UpdateEmitter) {
    if (emitter.uid) {
      this.uidQueue.delete(emitter.uid)
    }

    if (emitter.fireUpdate && this.uidQueue.size === 0) {
      this.emit(ManagementActions.UPDATED)
    }
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
      const fingerprint = this.fingerprint(mPod.management)

      // Flag that the pod is now under management
      mPod.management.status.managed = true

      mPod.management.status.running = this.podStatus(mPod) === 'Running'

      if (!mPod.management.status.running) {
        /*
         * No point in trying to fire a jolokia request
         * against a non-running pod.
         * Emit an update but only if the status has in fact changed
         */
        this.emitUpdate({ uid, fireUpdate: fingerprint === this.fingerprint(mPod.management) })
        continue
      }

      /*
       * Test the jolokia url to see if it is valid
       */
      try {
        const url = await mPod.probeJolokiaUrl()
        if (!url) {
          this.emitUpdate({ uid, fireUpdate: fingerprint === this.fingerprint(mPod.management) })
        }
      } catch (error) {
        log.error(new Error(`Cannot access jolokia url at ${mPod.jolokiaPath}`, { cause: error }))
        mPod.management.status.error = true
        this.emitUpdate({ uid, fireUpdate: fingerprint === this.fingerprint(mPod.management) })
        continue
      }

      mPod.jolokia.search('org.apache.camel:context=*,type=routes,*', {
        method: 'post',
        success: (routes: string[]) => {
          mPod.management.status.error = false
          mPod.management.camel.routes_count = routes.length
          this.emitUpdate({ uid, fireUpdate: fingerprint === this.fingerprint(mPod.management) })
        },
        error: error => {
          log.error(error)
          mPod.management.status.error = true
          this.emitUpdate({ uid, fireUpdate: fingerprint === this.fingerprint(mPod.management) })
        },
      })
    }
  }

  hasError() {
    return kubernetesApi.hasError() || kubernetesService.hasError()
  }

  get error(): Error | null {
    if (kubernetesApi.hasError()) return kubernetesApi.getError() ?? null

    if (kubernetesService.hasError()) return kubernetesService.getError() ?? null

    return null
  }

  get pods(): ManagedPod[] {
    return Object.values(this._pods)
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
    const ports: Array<ContainerPort> = container.ports ?? []
    const containerPort = ports.find(port => port.name === 'jolokia')
    return containerPort?.containerPort ?? ManagedPod.DEFAULT_JOLOKIA_PORT
  }

  jolokiaContainers(pod: ManagedPod): Container[] {
    if (!pod) return []

    const containers: Container[] = pod.spec?.containers ?? []
    return containers.filter(container => {
      return this.jolokiaContainerPort(container) !== null
    })
  }

  connectToUrl(pod: ManagedPod, container: Container): URL {
    const jolokiaPort = this.jolokiaContainerPort(container)
    const jolokiaPath = ManagedPod.getJolokiaPath(pod.pod, jolokiaPort) ?? ''
    const url: URL = new URL(jolokiaPath)
    return url
  }

  private connectionKeyName(pod: ManagedPod, container: Container) {
    return `${pod.metadata?.name}-${container.name}`
  }

  refreshConnections(pod: ManagedPod): string[] {
    const containers: Container[] = this.jolokiaContainers(pod)
    const connections: Connections = connectService.loadConnections()

    const connNames: string[] = []
    for (const container of containers) {
      const url: URL = this.connectToUrl(pod, container)
      const protocol = url.protocol.replace(':', '') as 'http' | 'https'
      const connection: Connection = {
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
    const connections = connectService.loadConnections()

    const connection = connections[connectName]
    if (!connection) {
      log.error('There is no connection configured with name', connectName)
      return
    }

    connectService.connect(connection)
  }
}

export const managementService = new ManagementService()
