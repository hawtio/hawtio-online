import { EventEmitter } from 'eventemitter3'
import { ManagedPod, Management } from './managed-pod'
import { k8Service, KubePod, debounce } from '@hawtio/online-kubernetes-api'
import { MgmtActions, log } from './globals'
import { K8Actions } from '@hawtio/online-kubernetes-api'
import { k8Api } from '@hawtio/online-kubernetes-api'

export class ManagementService extends EventEmitter {

  private _initialized = false
  private _pods: { [key: string]: ManagedPod } = {}
  private pollManagementData = debounce(() => this.mgmtUpdate(), 1000)
  private uidQueue: Set<string> = new Set<string>()

  constructor() {
    super()

    k8Service.on(K8Actions.CHANGED, () => this.initialize())
    setInterval(() => this.pollManagementData(), 10000)
  }

  async initialize(): Promise<boolean> {
    if (! k8Api.initialized) {
      await k8Api.initialize()
    }

    if (! k8Service.initialized) {
      await k8Service.initialize()
    }

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

    // At least first pass of the pods has been completed
    this._initialized = true
    return this._initialized
  }

  private hash(s: string): number {
    return s.split("")
      .reduce(
        function(a, b) {
          a = ((a << 5) - a) + b.charCodeAt(0)
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

  private emitUpdate(uid: string, fireUpdate: boolean) {
    this.uidQueue.delete(uid)

    if (fireUpdate && this.uidQueue.size === 0) {
      this.emit(MgmtActions.UPDATED)
    }
  }

  private async mgmtUpdate() {
    this.preMgmtUpdate()

    for (const uid of Object.keys(this._pods)) {
      const mPod: ManagedPod = this._pods[uid]
      const fingerprint = this.fingerprint(mPod.management)

      mPod.management.status.running = this.podStatus(mPod) === 'Running'

      if (! mPod.management.status.running) {
        /*
         * No point in trying to fire a jolokia request
         * against a non-running pod.
         * Emit an update but only if the status has in fact changed
         */
        this.emitUpdate(uid, fingerprint === this.fingerprint(mPod.management))
        continue
      }

      /*
       * Test the jolokia url to see if it is valid
       */
      try {
        const url = await mPod.probeJolokiaUrl()
        if (!url) {
          this.emitUpdate(uid, fingerprint === this.fingerprint(mPod.management))
        }
      } catch (error) {
        log.error(new Error(`Cannot access jolokia url at ${mPod.jolokiaPath}`, { cause: error }))
        mPod.management.status.error = true
        this.emitUpdate(uid, fingerprint === this.fingerprint(mPod.management))
        continue
      }

      mPod.jolokia.search('org.apache.camel:context=*,type=routes,*', {
        method: 'POST',
        success: (routes: string[]) => {
          mPod.management.status.error = false
          mPod.management.camel.routes_count = routes.length
          this.emitUpdate(uid, fingerprint === this.fingerprint(mPod.management))
        },
        error: error => {
          log.error(error)
          mPod.management.status.error = true
          this.emitUpdate(uid, fingerprint === this.fingerprint(mPod.management))
        },
      })
    }
  }

  get initialized(): boolean {
    return this._initialized
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
      if (!initContainerState)
        continue

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

      if (initContainerState.waiting && initContainerState.waiting.reason && initContainerState.waiting.reason !== 'PodInitializing') {
        reason = 'Init ' + initContainerState.waiting.reason
        initializing = true
      }
    }

    if (!initializing) {
      reason = pod.status?.reason || pod.status?.phase || ''

      const containerStatuses = pod.status?.containerStatuses || []
      for (const containerStatus of containerStatuses) {
        const containerReason = containerStatus.state?.waiting?.reason ||
                                containerStatus.state?.terminated?.reason
        let signal, exitCode

        if (containerReason) {
          reason = containerReason
          break
        }

        signal = containerStatus.state?.terminated?.signal
        if (signal) {
          reason = `Signal: ${signal}`
          break
        }

        exitCode = containerStatus.state?.terminated?.exitCode
        if (exitCode) {
          reason = `Exit Code: ${exitCode}`
          break
        }
      }
    }

    return reason || 'unknown'
  }
}
