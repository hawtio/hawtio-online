import { ManagedPod } from '@hawtio/online-management-api'
import { OwnerReference, SortOrder } from '@hawtio/online-kubernetes-api'
import { DiscoverGroup, DiscoverPod, DiscoverType } from './globals'

export type DiscoverProjects = {
  [name: string]: DiscoverProject
}

export class DiscoverProject {
  private discoverGroups: DiscoverGroup[] = []
  private discoverPods: DiscoverPod[] = []
  private _fullPodCount = 0

  constructor(
    private projectName: string,
    fullPodCount: number,
    mgmtPods: ManagedPod[],
    podOrder?: SortOrder,
  ) {
    this.refresh(fullPodCount, mgmtPods, podOrder)
  }

  private podOwner(pod: ManagedPod): OwnerReference | null {
    const metadata = pod.metadata
    if (!metadata || !metadata.ownerReferences) return null

    if (metadata.ownerReferences.length === 0) return null
    return metadata.ownerReferences[0]
  }

  private createDiscoverPod(pod: ManagedPod): DiscoverPod {
    return {
      type: DiscoverType.Pod,
      name: pod.metadata?.name || '<unknown>',
      uid: pod.metadata?.uid || '<unknown>',
      namespace: pod.metadata?.namespace || '<unknown>',
      labels: pod.metadata?.labels || {},
      annotations: pod.metadata?.annotations || {},
      mPod: pod,
    }
  }

  private podsWithOwner(remainingPods: ManagedPod[], ownerRef: OwnerReference): ManagedPod[] {
    if (!remainingPods) return []

    return remainingPods.filter(pod => {
      const oRef = this.podOwner(pod)
      return oRef?.uid === ownerRef.uid
    })
  }

  private toDiscoverGroup(pod: ManagedPod, owner: OwnerReference, replicas: ManagedPod[]): DiscoverGroup {
    const discoverReplicas = [pod, ...replicas].map(replica => this.createDiscoverPod(replica))
    return {
      type: DiscoverType.Group,
      name: owner.name,
      uid: owner.uid,
      namespace: pod.metadata?.namespace || '<unknown>',
      replicas: discoverReplicas || [],
      config: this.recordValue(pod.metadata?.annotations, 'openshift.io/deployment-config.name'),
      version: this.recordValue(pod.metadata?.annotations, 'openshift.io/deployment-config.latest-version'),
      statefulset: this.recordValue(pod.metadata?.labels, 'statefulset.kubernetes.io/pod-name'),
    }
  }

  private recordValue(values: Record<string, string> | undefined, key: string): string | undefined {
    if (!values) return undefined
    return values[key]
  }

  refresh(fullPodCount: number, pods: ManagedPod[], podOrder?: SortOrder) {
    const discoverPods: DiscoverPod[] = []
    const discoverGroups: DiscoverGroup[] = []

    for (let i = 0; i < pods.length; ++i) {
      const pod = pods[i]
      const ownerRef = this.podOwner(pod)

      if (!ownerRef || !ownerRef?.uid) {
        discoverPods.push(this.createDiscoverPod(pod))
        continue
      }

      const groups = discoverGroups.filter(group => group.uid === ownerRef.uid)
      if (groups.length > 0) continue // pod already processed into a display group

      /*
       * Pod has an owner uid but not yet processed
       */

      // find pods with same owner uid as this one
      const remainingPods = i < pods.length - 1 ? pods.slice(i + 1) : []
      const replicas = this.podsWithOwner(remainingPods, ownerRef)

      discoverGroups.push(this.toDiscoverGroup(pod, ownerRef, replicas))
    }

    if (!podOrder) {
      // No sort order
      this.discoverGroups = discoverGroups
      this.discoverPods = discoverPods
    } else {
      // Sort order imposed so sort groups, pods-in-groups and pods
      const sortPodFn = (pod1: DiscoverPod, pod2: DiscoverPod) => {
        const name1 = pod1.mPod.metadata?.name || ''
        const name2 = pod2.mPod.metadata?.name || ''

        let value = name1.localeCompare(name2)
        return podOrder === SortOrder.DESC ? (value *= -1) : value
      }

      this.discoverGroups = discoverGroups.sort((grp1: DiscoverGroup, grp2: DiscoverGroup) => {
        let value = grp1.name.localeCompare(grp2.name)
        return podOrder === SortOrder.DESC ? (value *= -1) : value
      })

      this.discoverGroups.forEach(group => {
        group.replicas = group.replicas.sort(sortPodFn)
      })

      this.discoverPods = discoverPods.sort(sortPodFn)
    }

    this._fullPodCount = fullPodCount

    /**
     * Notify event service of any errors in the groups and pods
     */
    this.discoverGroups.flatMap(discoverGroup =>
      discoverGroup.replicas.map(discoverPod => discoverPod.mPod.errorNotify()),
    )

    this.discoverPods.map(discoverPod => discoverPod.mPod.errorNotify())
  }

  get name(): string {
    return this.projectName
  }

  get fullPodCount(): number {
    return this._fullPodCount
  }

  get pods(): DiscoverPod[] {
    return this.discoverPods
  }

  get groups(): DiscoverGroup[] {
    return this.discoverGroups
  }
}
