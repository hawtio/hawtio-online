import { WatchTypes, NamespacedTypes, ExtensionTypes, KindTypes } from './model'
import { K8S_PREFIX, K8S_API_VERSION, K8S_EXT_PREFIX, K8S_EXT_VERSION, OS_PREFIX, OS_API_VERSION, k8Api } from './globals'
import { joinPaths } from './utils/urls'
import { isObject, pathGetString, pathGetObject } from './utils/objects'

export function masterApiUrl(): string {
  return k8Api.getMasterUri()
}

export function namespaced(kind: string): boolean {
  switch (kind) {
    case WatchTypes.POLICIES:
    case WatchTypes.OAUTH_CLIENTS:
    case WatchTypes.NAMESPACES:
    case WatchTypes.NODES:
    case WatchTypes.PERSISTENT_VOLUMES:
    case WatchTypes.PROJECTS:
      return false
    default:
      return true
  }
}

export function kubernetesApiPrefix(): string {
  return joinPaths(K8S_PREFIX, K8S_API_VERSION)
}

  export function kubernetesApiExtensionPrefix(): string {
    return joinPaths(K8S_EXT_PREFIX, K8S_EXT_VERSION)
  }

  export function openshiftApiPrefix(kind: string) {
    return joinPaths(OS_PREFIX, apiGroupForKind(kind), OS_API_VERSION)
  }

  function apiForKind(kind: string): string {
    if (kind === WatchTypes.NAMESPACES) {
      return K8S_PREFIX
    }
    if (ExtensionTypes.extensions.some((t) => t === kind)) {
      return K8S_EXT_PREFIX
    }
    if (NamespacedTypes.k8sTypes.some((t) => t === kind)) {
      return K8S_PREFIX
    }
    if (NamespacedTypes.osTypes.some((t) => t === kind)) {
      return OS_PREFIX
    }
    if (kind === WatchTypes.IMAGES) {
      return OS_PREFIX
    }
    return ''
  }

  function apiGroupForKind(kind: string): string {
    switch (kind) {
      case WatchTypes.OAUTH_CLIENTS:
        return 'oauth.openshift.io'
      case WatchTypes.BUILDS,
        WatchTypes.BUILD_CONFIGS:
        return 'build.openshift.io'
      case WatchTypes.DEPLOYMENT_CONFIGS:
        return 'apps.openshift.io'
      case WatchTypes.IMAGES,
        WatchTypes.IMAGE_STREAMS,
        WatchTypes.IMAGE_STREAM_TAGS:
        return 'image.openshift.io'
      case WatchTypes.PROJECTS:
        return 'project.openshift.io'
      case WatchTypes.ROLES,
        WatchTypes.ROLE_BINDINGS:
        return 'authorization.openshift.io'
      case WatchTypes.ROUTES:
        return 'route.openshift.io'
      case WatchTypes.TEMPLATES:
        return 'template.openshift.io'
      default:
        return ''
    }
  }

  export function prefixForKind(kind: string): string|null {
    const api = apiForKind(kind)
    switch (api) {
      case K8S_EXT_PREFIX:
        return kubernetesApiExtensionPrefix()
      case K8S_PREFIX:
        return kubernetesApiPrefix()
      case OS_PREFIX:
        return openshiftApiPrefix(kind)
      default:
        return null
    }
  }

  /*
   * Extracts the k8s/openshift error response if present
   */
  export function getErrorObject(jqXHR: JQueryXHR): string {
    let answer = jqXHR.responseText
    try {
      answer = JSON.parse(answer)
    } catch (err) {
      // nothing to do...
    }
    return answer
  }

  /*
   * Returns either secure/insecure websocket protocol based on the master URI protocol
   */
  export function wsScheme(url: string): string {
    const protocol = new URL(url).protocol || 'http'
    if (protocol.startsWith('https')) {
      return 'wss'
    } else {
      return 'ws'
    }
  }

  /*
   * Returns the single 'kind' of an object from the collection kind
   */
  export function toKindName(kind: Record<string, unknown> | string): string | null {
    if (isObject(kind)) {
      return getKind(kind)
    }
    switch (kind) {
      case WatchTypes.LIST: return KindTypes.LIST
      case WatchTypes.ENDPOINTS: return KindTypes.ENDPOINTS
      case WatchTypes.EVENTS: return KindTypes.EVENTS
      case WatchTypes.NAMESPACES: return KindTypes.NAMESPACES
      case WatchTypes.NODES: return KindTypes.NODES
      case WatchTypes.PERSISTENT_VOLUMES: return KindTypes.PERSISTENT_VOLUMES
      case WatchTypes.PERSISTENT_VOLUME_CLAIMS: return KindTypes.PERSISTENT_VOLUME_CLAIMS
      case WatchTypes.PODS: return KindTypes.PODS
      case WatchTypes.REPLICATION_CONTROLLERS: return KindTypes.REPLICATION_CONTROLLERS
      case WatchTypes.REPLICA_SETS: return KindTypes.REPLICA_SETS
      case WatchTypes.RESOURCE_QUOTAS: return KindTypes.RESOURCE_QUOTAS
      case WatchTypes.OAUTH_CLIENTS: return KindTypes.OAUTH_CLIENTS
      case WatchTypes.SECRETS: return KindTypes.SECRETS
      case WatchTypes.SERVICES: return KindTypes.SERVICES
      case WatchTypes.SERVICE_ACCOUNTS: return KindTypes.SERVICE_ACCOUNTS
      case WatchTypes.CONFIG_MAPS: return KindTypes.CONFIG_MAPS
      case WatchTypes.INGRESSES: return KindTypes.INGRESSES
      case WatchTypes.TEMPLATES: return KindTypes.TEMPLATES
      case WatchTypes.ROUTES: return KindTypes.ROUTES
      case WatchTypes.BUILD_CONFIGS: return KindTypes.BUILD_CONFIGS
      case WatchTypes.BUILDS: return KindTypes.BUILDS
      case WatchTypes.DEPLOYMENT_CONFIGS: return KindTypes.DEPLOYMENT_CONFIGS
      case WatchTypes.DEPLOYMENTS: return KindTypes.DEPLOYMENTS
      case WatchTypes.IMAGES: return KindTypes.IMAGES
      case WatchTypes.IMAGE_STREAMS: return KindTypes.IMAGE_STREAMS
      case WatchTypes.IMAGE_STREAM_TAGS: return KindTypes.IMAGE_STREAM_TAGS
      case WatchTypes.POLICIES: return KindTypes.POLICIES
      case WatchTypes.POLICY_BINDINGS: return KindTypes.POLICY_BINDINGS
      case WatchTypes.PROJECTS: return KindTypes.PROJECTS
      case WatchTypes.ROLE_BINDINGS: return KindTypes.ROLE_BINDINGS
      case WatchTypes.ROLES: return KindTypes.ROLES
      case WatchTypes.DAEMONSETS: return KindTypes.DAEMONSETS
      default: return kind
    }
  }

  /*
   * Returns the collection kind of an object from the singular kind
   */
  export function toCollectionName(kind: Record<string, unknown> | string): string | null {
    if (isObject(kind)) {
      const k = getKind(kind)
      if (!k) return null

      kind = k
    }

    switch (kind) {
      case KindTypes.LIST: return WatchTypes.LIST
      case KindTypes.ENDPOINTS: return WatchTypes.ENDPOINTS
      case KindTypes.EVENTS: return WatchTypes.EVENTS
      case KindTypes.NAMESPACES: return WatchTypes.NAMESPACES
      case KindTypes.NODES: return WatchTypes.NODES
      case KindTypes.PERSISTENT_VOLUMES: return WatchTypes.PERSISTENT_VOLUMES
      case KindTypes.PERSISTENT_VOLUME_CLAIMS: return WatchTypes.PERSISTENT_VOLUME_CLAIMS
      case KindTypes.PODS: return WatchTypes.PODS
      case KindTypes.REPLICATION_CONTROLLERS: return WatchTypes.REPLICATION_CONTROLLERS
      case KindTypes.REPLICA_SETS: return WatchTypes.REPLICA_SETS
      case KindTypes.RESOURCE_QUOTAS: return WatchTypes.RESOURCE_QUOTAS
      case KindTypes.OAUTH_CLIENTS: return WatchTypes.OAUTH_CLIENTS
      case KindTypes.SECRETS: return WatchTypes.SECRETS
      case KindTypes.SERVICES: return WatchTypes.SERVICES
      case KindTypes.SERVICE_ACCOUNTS: return WatchTypes.SERVICE_ACCOUNTS
      case KindTypes.CONFIG_MAPS: return WatchTypes.CONFIG_MAPS
      case KindTypes.INGRESSES: return WatchTypes.INGRESSES
      case KindTypes.TEMPLATES: return WatchTypes.TEMPLATES
      case KindTypes.ROUTES: return WatchTypes.ROUTES
      case KindTypes.BUILD_CONFIGS: return WatchTypes.BUILD_CONFIGS
      case KindTypes.BUILDS: return WatchTypes.BUILDS
      case KindTypes.DEPLOYMENT_CONFIGS: return WatchTypes.DEPLOYMENT_CONFIGS
      case KindTypes.DEPLOYMENTS: return WatchTypes.DEPLOYMENTS
      case KindTypes.IMAGES: return WatchTypes.IMAGES
      case KindTypes.IMAGE_STREAMS: return WatchTypes.IMAGE_STREAMS
      case KindTypes.IMAGE_STREAM_TAGS: return WatchTypes.IMAGE_STREAM_TAGS
      case KindTypes.POLICIES: return WatchTypes.POLICIES
      case KindTypes.POLICY_BINDINGS: return WatchTypes.POLICY_BINDINGS
      case KindTypes.PROJECTS: return WatchTypes.PROJECTS
      case KindTypes.ROLE_BINDINGS: return WatchTypes.ROLE_BINDINGS
      case KindTypes.ROLES: return WatchTypes.ROLES
      case KindTypes.DAEMONSETS: return WatchTypes.DAEMONSETS
      default: return kind
    }
  }

  /*
   * Returns the websocket URL for the supplied URL
   */
  export function wsUrl(url: string): URL {
    const protocol = wsScheme(url)
    const newUrl = new URL(url)
    newUrl.protocol = protocol
    return newUrl
  }

  /*
   * Compare two k8s objects based on their UID
   */
  export function equals(left: any, right: any): boolean {
    const leftUID = getUID(left)
    const rightUID = getUID(right)
    if (!leftUID && !rightUID) {
      return JSON.stringify(left) === JSON.stringify(right)
    }
    return leftUID === rightUID
  }

  /**
   *
   * Kubernetes object helpers
   *
   **/

  // /**
  //  * Create a list of kubernetes objects suitable for posting a bunch of objects
  //  */
  // export function createList(...objects: any[]) {
  //   const answer = {
  //     apiVersion: K8S_API_VERSION,
  //     kind: toKindName(WatchTypes.LIST),
  //     objects: []
  //   }
  //   objects.forEach((object) => {
  //     if (isArray(object)) {
  //       object.forEach((o) => {
  //         answer.objects.push(o)
  //       })
  //     } else {
  //       answer.objects.push(object)
  //     }
  //   })
  //   return answer
  // }

  /**
   * Create an object suitable for delete/del
   */
  export function createShallowObject(name: string, kind: string, namespace?: string) {
    return {
      apiVersion: K8S_API_VERSION,
      kind: toKindName(kind),
      metadata: {
        name: name,
        namespace: namespace
      }
    }
  }

  /**
   * Returns a fully scoped name with the namespace/kind, suitable to use as a key in maps
   **/
  export function fullName(entity: Record<string, unknown>): string {
    const namespace = getNamespace(entity)
    const kind = getKind(entity) || ''
    const name = getName(entity) || ''
    return joinPaths((namespace ? namespace : ""), kind, name)
  }

  export function getUID(entity: Record<string, unknown>): string | null {
    return pathGetString(entity, ['metadata', 'uid'])
  }

  export function getNamespace(entity: Record<string, unknown>): string | null {
    // some objects aren't namespaced, so this can return null
    return pathGetString(entity, ["metadata", "namespace"])
  }

  export function getApiVersion(entity: Record<string, unknown>): string | null {
    return pathGetString(entity, ['apiVersion'])
  }

  export function getLabels(entity: Record<string, unknown>): Record<string, unknown> | null {
    return pathGetObject(entity, ["metadata", "labels"])
  }

  export function getName(entity: Record<string, unknown> | null): string | null {
    if (!entity) return null

    return pathGetString(entity, ["metadata", "name"]) ||
      pathGetString(entity, "name") || pathGetString(entity, "id")
  }

  export function getKind(entity: Record<string, unknown>): string | null {
    return pathGetString(entity, ["metadata", "kind"]) || pathGetString(entity, "kind")
  }

  export function getSelector(entity: Record<string, unknown>): string | null {
    return pathGetString(entity, ["spec", "selector"])
  }

  export function getHost(pod: Record<string, unknown>): string | null {
    return pathGetString(pod, ["spec", "host"]) ||
      pathGetString(pod, ["spec", "nodeName"]) ||
      pathGetString(pod, ["status", "hostIP"])
  }

  export function getStatus(pod: Record<string, unknown>): string | null {
    return pathGetString(pod, ["status", "phase"])
  }

  export function getPorts(service: Record<string, unknown>): string | null {
    return pathGetString(service, ["spec", "ports"])
  }

  export function getCreationTimestamp(entity: Record<string, unknown>): string | null {
    return pathGetString(entity, ["metadata", "creationTimestamp"])
  }

  /**
   * Returns true if the current status of the pod is running
   */
  export function isRunning(podCurrentState: any): boolean {
    const status = (podCurrentState || {}).phase
    if (status) {
      const lower = status.toLowerCase()
      return lower.startsWith("run")
    } else {
      return false
    }
  }

  export function podStatus(pod: Record<string, unknown>): string | null {
    return getStatus(pod)
  }
