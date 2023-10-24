import { OwnerReference } from '@hawtio/online-kubernetes-api'
import { ManagedPod, mgmtService } from '@hawtio/online-management-api'
import { DiscoverGroup, DiscoverPod, DiscoverType, TypeFilter } from './globals'

export function unwrap(error: Error): string {
  if (!error) return 'unknown error'

  if (error.cause instanceof Error) return unwrap(error.cause)

  return error.message
}

function applyFilter(filter: TypeFilter, pod: ManagedPod): boolean {
  if (!pod.metadata) return false

  type KubeObjKey = keyof typeof pod.metadata

  const podProp = pod.metadata[filter.type.toLowerCase() as KubeObjKey] as string

  // Want to filter on this property but value
  // is null so filter fails
  if (!podProp) return false

  return podProp.toLowerCase().includes(filter.value.toLowerCase())
}

function recordValue(values: Record<string, string> | undefined, key: string): string | undefined {
  if (!values) return undefined
  return values[key]
}

function toDiscoverGroup(
  pod: ManagedPod,
  owner: OwnerReference,
  replicas: ManagedPod[],
  expanded: boolean,
): DiscoverGroup {
  const discoverReplicas = [pod, ...replicas].map(replica => createDiscoverPod(replica))

  return {
    type: DiscoverType.Group,
    name: owner.name,
    uid: owner.uid,
    namespace: pod.metadata?.namespace || '<unknown>',
    replicas: discoverReplicas || [],
    expanded: expanded,
    config: recordValue(pod.metadata?.annotations, 'openshift.io/deployment-config.name'),
    version: recordValue(pod.metadata?.annotations, 'openshift.io/deployment-config.latest-version'),
    statefulset: recordValue(pod.metadata?.labels, 'statefulset.kubernetes.io/pod-name'),
  }
}

function createDiscoverPod(pod: ManagedPod): DiscoverPod {
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

function podOwner(pod: ManagedPod): OwnerReference | null {
  if (!pod.metadata || !pod.metadata?.ownerReferences) return null

  if (pod.metadata.ownerReferences.length === 0) return null

  return pod.metadata.ownerReferences[0]
}

function podsWithOwner(remainingPods: ManagedPod[], ownerRef: OwnerReference): ManagedPod[] {
  if (!remainingPods) return []

  return remainingPods.filter(pod => {
    const oRef = podOwner(pod)
    return oRef?.uid === ownerRef.uid
  })
}

function groupPodsByDeployment(
  pods: ManagedPod[],
  exDiscoverGroups: DiscoverGroup[],
): [DiscoverGroup[], DiscoverPod[]] {
  const discoverPods: DiscoverPod[] = []
  const discoverGroups: DiscoverGroup[] = []

  pods.forEach((pod, index) => {
    const ownerRef = podOwner(pod)
    if (!ownerRef || !ownerRef?.uid) {
      discoverPods.push(createDiscoverPod(pod))
      return
    }

    const groups = discoverGroups.filter(group => group.uid === ownerRef.uid)
    if (groups.length > 0) return // pod already processed into a display group

    /*
     * Pod has an owner uid but not yet processed
     */

    // find pods with same owner uid as this one
    const remainingPods = index < pods.length - 1 ? pods.slice(index + 1) : []
    const replicas = podsWithOwner(remainingPods, ownerRef)

    const theExDiscoverGroups = exDiscoverGroups.filter(group => {
      return (
        group.uid === pod.metadata?.uid && group.namespace === pod.metadata.namespace && group.name === ownerRef?.name
      )
    })

    // Determine if group previously expanded
    const expanded = theExDiscoverGroups.length > 0 ? theExDiscoverGroups[0].expanded : true

    discoverGroups.push(toDiscoverGroup(pod, ownerRef, replicas, expanded))
  })

  return [discoverGroups, discoverPods]
}

export function filterAndGroupPods(
  theFilters: TypeFilter[],
  currentGroups: DiscoverGroup[],
): [DiscoverGroup[], DiscoverPod[]] {
  const pods: ManagedPod[] = mgmtService.pods || []

  if (!theFilters || theFilters.length === 0) return groupPodsByDeployment(pods, currentGroups)

  const filtered = pods.filter(pod => {
    let status = true
    for (const filter of theFilters) {
      if (!applyFilter(filter, pod)) {
        // service fails filter so return
        status = false
        break
      }

      // service passes this filter so continue
    }
    return status
  })

  return groupPodsByDeployment(filtered, currentGroups)
}

export function getStatus(pod: DiscoverPod): string {
  return mgmtService.podStatus(pod.mPod)
}

export enum ViewType {
  listView = 'listView',
  cardView = 'cardView',
}
