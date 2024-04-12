import { OwnerReference } from '@hawtio/online-kubernetes-api'
import { ManagedPod, mgmtService } from '@hawtio/online-management-api'
import { DiscoverGroup, DiscoverPod, DiscoverType, TypeFilter } from './globals'

export enum ViewType {
  listView = 'listView',
  cardView = 'cardView',
}

class DiscoverService {
  private discoverGroups: DiscoverGroup[] = []
  private discoverPods: DiscoverPod[] = []

  private recordValue(values: Record<string, string> | undefined, key: string): string | undefined {
    if (!values) return undefined
    return values[key]
  }

  private toDiscoverGroup(
    pod: ManagedPod,
    owner: OwnerReference,
    replicas: ManagedPod[],
    expanded: boolean,
  ): DiscoverGroup {
    const discoverReplicas = [pod, ...replicas].map(replica => this.createDiscoverPod(replica))
    return {
      type: DiscoverType.Group,
      name: owner.name,
      uid: owner.uid,
      namespace: pod.getMetadata()?.namespace || '<unknown>',
      replicas: discoverReplicas || [],
      expanded: expanded,
      config: this.recordValue(pod.getMetadata()?.annotations, 'openshift.io/deployment-config.name'),
      version: this.recordValue(pod.getMetadata()?.annotations, 'openshift.io/deployment-config.latest-version'),
      statefulset: this.recordValue(pod.getMetadata()?.labels, 'statefulset.kubernetes.io/pod-name'),
    }
  }

  private createDiscoverPod(pod: ManagedPod): DiscoverPod {
    return {
      type: DiscoverType.Pod,
      name: pod.getMetadata()?.name || '<unknown>',
      uid: pod.getMetadata()?.uid || '<unknown>',
      namespace: pod.getMetadata()?.namespace || '<unknown>',
      labels: pod.getMetadata()?.labels || {},
      annotations: pod.getMetadata()?.annotations || {},
      mPod: pod,
    }
  }

  private podOwner(pod: ManagedPod): OwnerReference | null {
    const metadata = pod.getMetadata()
    if (!metadata || !metadata.ownerReferences) return null

    if (metadata.ownerReferences.length === 0) return null

    return metadata.ownerReferences[0]
  }

  private podsWithOwner(remainingPods: ManagedPod[], ownerRef: OwnerReference): ManagedPod[] {
    if (!remainingPods) return []

    return remainingPods.filter(pod => {
      const oRef = this.podOwner(pod)
      return oRef?.uid === ownerRef.uid
    })
  }

  private groupPodsByDeployment(pods: ManagedPod[]) {
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

      const oldDiscoverGroups = this.discoverGroups.filter(group => {
        return (
          group.uid === pod.getMetadata()?.uid &&
          group.namespace === pod.getMetadata()?.namespace &&
          group.name === ownerRef?.name
        )
      })

      // Determine if group previously expanded
      const expanded = oldDiscoverGroups.length > 0 ? oldDiscoverGroups[0].expanded : true

      discoverGroups.push(this.toDiscoverGroup(pod, ownerRef, replicas, expanded))
    }

    this.discoverGroups = discoverGroups
    this.discoverPods = discoverPods
  }

  private applyFilter(filter: TypeFilter, pod: ManagedPod): boolean {
    if (!pod.getMetadata()) return false

    const metadata = pod.getMetadata()
    if (!metadata) return false

    type KubeObjKey = keyof typeof metadata

    const podProp = metadata[filter.type.toLowerCase() as KubeObjKey] as string

    // Want to filter on this property but value
    // is null so filter fails
    if (!podProp) return false

    return podProp.toLowerCase().includes(filter.value.toLowerCase())
  }

  filterAndGroupPods(theFilters: TypeFilter[]): [discoverGroups: DiscoverGroup[], discoverPods: DiscoverPod[]] {
    const pods: ManagedPod[] = mgmtService.pods || []

    let filtered = pods
    if (theFilters && theFilters.length > 0) {
      filtered = pods.filter(pod => {
        let status = true
        for (const filter of theFilters) {
          if (!this.applyFilter(filter, pod)) {
            // service fails filter so return
            status = false
            break
          }

          // service passes this filter so continue
        }
        return status
      })
    }

    this.groupPodsByDeployment(filtered)

    /**
     * Notify event service of any errors in the groups and pods
     */
    this.discoverGroups.flatMap(discoverGroup =>
      discoverGroup.replicas.map(discoverPod => discoverPod.mPod.errorNotify()),
    )

    this.discoverPods.map(discoverPod => discoverPod.mPod.errorNotify())

    return [this.discoverGroups, this.discoverPods]
  }

  getStatus(pod: DiscoverPod): string {
    return mgmtService.podStatus(pod.mPod)
  }

  unwrap(error: Error): string {
    if (!error) return 'unknown error'
    if (error.cause instanceof Error) return this.unwrap(error.cause)
    return error.message
  }
}

export const discoverService = new DiscoverService()
