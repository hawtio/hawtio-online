import { KubePod, KubePodsOrError, hasProperty, isError } from '@hawtio/online-kubernetes-api'
import { MPodsByUid, log } from './globals'
import { ManagedPod } from './managed-pod'

export class ManagedProject {
  private _error?: Error
  private podsByUid: MPodsByUid = {}
  private _fullPodCount = 0

  constructor(private _name: string) {}

  get name(): string {
    return this._name
  }

  get fullPodCount(): number {
    return this._fullPodCount
  }

  set fullPodCount(fullPodCount: number) {
    this._fullPodCount = fullPodCount
  }

  get error(): Error | undefined {
    return this._error
  }

  set error(kubePodsOrError: KubePodsOrError) {
    if (isError(kubePodsOrError.error)) this._error = kubePodsOrError.error
    else delete this._error
  }

  get pods(): MPodsByUid {
    return this.podsByUid
  }

  set pods(kPods: KubePod[]) {
    if (kPods.length === 0) {
      this.podsByUid = {}
      return
    }

    // Add or update kube pods
    const kPodUids: string[] = []
    kPods.forEach(kPod => {
      const uid = kPod.metadata?.uid
      if (!uid) {
        log.error('Cannot access uid from pod')
        return
      }

      kPodUids.push(uid)

      if (!hasProperty(this.podsByUid, uid)) {
        this.podsByUid[uid] = new ManagedPod(kPod)
      } else {
        kPod.management = this.podsByUid[uid].management
        this.podsByUid[uid].kubePod = kPod
      }
    })

    // Delete any kube pods that no longer exist
    Object.keys(this.podsByUid)
      .filter(uid => !kPodUids.includes(uid))
      .forEach(uid => delete this.podsByUid[uid])
  }
}
