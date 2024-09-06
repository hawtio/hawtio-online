import { ManagedPod } from '@hawtio/online-management-api'
import { DiscoverGroup, DiscoverPod, DiscoverType } from './globals'
import { OwnerReference } from '@hawtio/online-kubernetes-api'

export type DiscoverProjects = {
  [name: string]: DiscoverProject
}

type SortOrderType = 1 | -1

export class DiscoverProject {
  private discoverGroups: DiscoverGroup[] = []
  private discoverPods: DiscoverPod[] = []

  constructor(
    private projectName: string,
    mgmtPods: ManagedPod[],
  ) {
    this.refresh(mgmtPods)
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

  refresh(pods: ManagedPod[]) {
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

    this.discoverGroups = discoverGroups
    this.discoverPods = discoverPods

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

  get pods(): DiscoverPod[] {
    return this.discoverPods
  }

  get groups(): DiscoverGroup[] {
    return this.discoverGroups
  }

  sort(sortOrder: SortOrderType) {
    this.discoverGroups.sort((a: DiscoverGroup, b: DiscoverGroup) => {
      return a.name.localeCompare(b.name) * sortOrder
    })

    this.discoverPods.sort((a: DiscoverPod, b: DiscoverPod) => {
      return a.name.localeCompare(b.name) * sortOrder
    })
  }
}
