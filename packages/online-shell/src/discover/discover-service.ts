import { k8Api, joinPaths, KubePod, OwnerReference, PodStatus, PodCondition } from "@hawtio/online-kubernetes-api"

export interface TypeFilter {
  type: string
  value: string
}

export enum DisplayType {
  Group = 0,
  Pod = 1
}

export interface DisplayItem {
  type: DisplayType
  name: string
  namespace: string
  uid: string
}

export interface DisplayGroup extends DisplayItem {
  replicas: DisplayPod[]
  expanded: boolean
  config?: string
  version?: string
  statefulset?: string
}

export interface DisplayPod extends DisplayItem {
  owner?: string
  labels: Record<string, string>
  annotations: Record<string, string>
  target: KubePod
}

export function unwrap(error: Error): string {
  if (!error) return 'unknown error'

  if (error.cause instanceof Error) return unwrap(error.cause)

  return error.message
}

function applyFilter(filter: TypeFilter, pod: KubePod): boolean {
  if (! pod.metadata) return false

  type KubeObjKey = keyof typeof pod.metadata

  const podProp = pod.metadata[filter.type.toLowerCase() as KubeObjKey] as string

  // Want to filter on this property but value
  // is null so filter fails
  if (!podProp) return false

  return podProp.toLowerCase().includes(filter.value.toLowerCase())
}


function recordValue(values: Record<string, string>|undefined, key: string): string | undefined {
  if (!values) return undefined
  return values[key]
}

function toDisplayGroup(pod: KubePod, owner: OwnerReference, replicas: KubePod[], expanded: boolean): DisplayGroup {
  const displayReplicas = [pod, ...replicas].map(replica => toDisplayPod(replica))

  return {
    type: DisplayType.Group,
    name: owner.name,
    uid: owner.uid,
    namespace: pod.metadata?.namespace || '<unknown>',
    replicas: displayReplicas || [],
    expanded: expanded,
    config: recordValue(pod.metadata?.annotations, 'openshift.io/deployment-config.name'),
    version: recordValue(pod.metadata?.annotations, 'openshift.io/deployment-config.latest-version'),
    statefulset: recordValue(pod.metadata?.labels, 'statefulset.kubernetes.io/pod-name'),
  }
}

function toDisplayPod(pod: KubePod): DisplayPod {
  return {
    type: DisplayType.Pod,
    name: pod.metadata?.name || '<unknown>',
    uid: pod.metadata?.uid || '<unknown>',
    namespace: pod.metadata?.namespace || '<unknown>',
    labels: pod.metadata?.labels || {},
    annotations: pod.metadata?.annotations || {},
    target: pod
  }
}

function podOwner(pod: KubePod): OwnerReference|null {
  if (!pod.metadata || !pod.metadata?.ownerReferences)
  return null

  if (pod.metadata.ownerReferences.length === 0)
  return null

  return pod.metadata.ownerReferences[0]
}

function podsWithOwner(remainingPods: KubePod[], ownerRef: OwnerReference): KubePod[] {
  if (! remainingPods) return []

  return remainingPods.filter(pod => {
    const oRef = podOwner(pod)
    return oRef?.uid === ownerRef.uid
  })
}

function groupPodsByDeployment(pods: KubePod[], exDisplayGroups: DisplayGroup[]): [DisplayGroup[], DisplayPod[]] {
  const displayPods: DisplayPod[] = []
  const displayGroups: DisplayGroup[] = []

  pods.forEach((pod, index) => {
    const ownerRef = podOwner(pod)

    if (! ownerRef || ! ownerRef?.uid) {
      displayPods.push(toDisplayPod(pod))
      return
    }

    const groups = displayGroups.filter(group => {
      group.uid === ownerRef.uid
    })

    if (groups.length > 0)
      return // pod already processed into a display group

    /*
     * Pod has an owner uid but not yet processed
     */

    // find pods with same owner uid as this one
    const remainingPods = (index < (pods.length - 1)) ? pods.slice((index + 1)) : []
    const replicas = podsWithOwner(remainingPods, ownerRef)

    const theExDisplayGroups = exDisplayGroups.filter(group => {
      group.uid === pod.metadata?.uid &&
      group.namespace === pod.metadata.namespace &&
      group.name === ownerRef?.name
    })

    // Determine if group previously expanded
    const expanded = (theExDisplayGroups.length > 0) ? theExDisplayGroups[0].expanded : true

    displayGroups.push(toDisplayGroup(pod, ownerRef, replicas, expanded))
  })

  return [displayGroups, displayPods]
}

export function filterAndGroupPods(pods: KubePod[], theFilters: TypeFilter[], currentGroups: DisplayGroup[]): [DisplayGroup[], DisplayPod[]] {
  if (!theFilters || theFilters.length === 0)
    return groupPodsByDeployment(pods, currentGroups)

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

export function isPodReady(pod: DisplayPod): boolean {
  if (! pod.target) return false

  const status = pod.target.status as PodStatus
  const conditions = status.conditions as Array<PodCondition>
  return conditions && conditions.some(c => c.type === 'Ready' && c.status === 'True')
}

enum OS4 {
  'dc' = 'deploymentconfigs',
  'rc' = 'replicationcontrollers',
  'rs' = 'replicasets',
  'sts' = "statefulsets"
}

export interface OSLinkConfig {
  namespace: string,
  resources: string,
  name: string
}

export function osLink(config: OSLinkConfig): URL | null {
  if (! k8Api.consoleUri)
      return null

  return new URL(joinPaths(k8Api.consoleUri, 'k8s/ns', config.namespace, (OS4[config.resources as keyof typeof OS4] || config.resources), config.name))
}

export enum ViewType {
  listView = 'listView',
  cardView = 'cardView',
}

export function podDirective(viewType: ViewType, templateUrl: string) {
  // return function podDirective($window: ng.IWindowService, openShiftConsole: ConsoleService) {
  //   'ngInject'
  //   return {
  //     restrict: 'EA',
  //     templateUrl: templateUrl,
  //     scope: {
  //       pod: '=',
  //     },
  //     link: function ($scope: ng.IScope | any) {
  //       if (openShiftConsole.enabled) {
  //         openShiftConsole.url.then(url => $scope.openshiftConsoleUrl = url)
  //       }
  //       $scope.getStatusClasses = (pod, status) => getPodClasses(pod, { status, viewType })
  //       $scope.open = (url) => {
  //         $window.open(url)
  //         return true
  //       }
  //     },
  //   }
  // }
}

export function expansionDirective() {
  // return new ListRowExpandDirective()
}

export function matchHeightDirective($timeout: any) {
  // 'ngInject'
  // return new MatchHeightDirective($timeout)
}

export function httpSrcDirective($http: any) {
  // 'ngInject'
  // return new HttpSrcDirective($http)
}

export function jolokiaContainersFilter() {
  // return containers => (containers || []).filter(container => container.ports.some(port => port.name === 'jolokia'))
}

export function jolokiaPortFilter() {
  // return container => container.ports.find(port => port.name === 'jolokia')
}

export function connectUrlFilter() {
  // return (pod: Pod, port = 8778) => {
  //   const jolokiaPath = getManagementJolokiaPath(pod, port)
  //   return new URI().path('/integration/')
  //     .query({
  //       jolokiaUrl: new URI().query('').path(jolokiaPath),
  //       title: pod.metadata.name,
  //       returnTo: new URI().toString(),
  //     })
  // }
}

export function podDetailsUrlFilter() {
  // 'ngInject'
  // let os4 = false
  // openShiftService.getClusterVersion().then((clusterVersion => {
  //   os4 = isOpenShift4(clusterVersion)
  // }))
  // return (pod: Pod, openShiftConsoleUrl: string) => {
  //   if (os4) {
  //     return UrlHelpers.join(openShiftConsoleUrl, 'k8s/ns', pod.metadata.namespace, 'pods', pod.metadata.name)
  //   } else {
  //     return UrlHelpers.join(openShiftConsoleUrl, 'project', pod.metadata.namespace, 'browse/pods', pod.metadata.name)
  //   }
  // }
}
