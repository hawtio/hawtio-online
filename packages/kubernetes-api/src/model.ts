export class consts {
  get NAMESPACE_STORAGE_KEY(): string { return 'k8sSelectedNamespace' }
}

export const Constants = new consts()

export interface KubernetesState {
  namespaces: Array<string>
  selectedNamespace: string
}

export class KindTypes {
  public static get LIST(): string { return 'List' }
  public static get ENDPOINTS(): string { return 'Endpoint' }
  public static get EVENTS(): string { return 'Event' }
  public static get NAMESPACES(): string { return 'Namespace' }
  public static get NODES(): string { return 'Node' }
  public static get PERSISTENT_VOLUMES(): string { return 'PersistentVolume' }
  public static get PERSISTENT_VOLUME_CLAIMS(): string { return 'PersistentVolumeClaim' }
  public static get PODS(): string { return 'Pod' }
  public static get REPLICATION_CONTROLLERS(): string { return 'ReplicationController' }
  public static get REPLICA_SETS(): string { return 'ReplicaSet' }
  public static get RESOURCE_QUOTAS(): string { return 'ResourceQuota' }
  public static get OAUTH_CLIENTS(): string { return 'OAuthClient' }
  public static get SECRETS(): string { return 'Secret' }
  public static get SERVICES(): string { return 'Service' }
  public static get SERVICE_ACCOUNTS(): string { return 'ServiceAccount' }
  public static get CONFIG_MAPS(): string { return 'ConfigMap' }
  public static get INGRESSES(): string { return 'Ingress' }
  public static get TEMPLATES(): string { return 'Template' }
  public static get ROUTES(): string { return 'Route' }
  public static get BUILD_CONFIGS(): string { return 'BuildConfig' }
  public static get BUILDS(): string { return 'Build' }
  public static get DEPLOYMENT_CONFIGS(): string { return 'DeploymentConfig' }
  public static get DEPLOYMENTS(): string { return 'Deployment' }
  public static get IMAGES(): string { return 'Image' }
  public static get IMAGE_STREAMS(): string { return 'ImageStream' }
  public static get IMAGE_STREAM_TAGS(): string { return 'ImageStreamTag' }
  public static get POLICIES(): string { return 'Policy' }
  public static get POLICY_BINDINGS(): string { return 'PolicyBinding' }
  public static get PROJECTS(): string { return 'Project' }
  public static get ROLE_BINDINGS(): string { return 'RoleBinding' }
  public static get ROLES(): string { return 'Role' }
  public static get DAEMONSETS(): string { return 'DaemonSet' }
}

export class WatchTypes {
  public static get LIST(): string { return 'list' }
  public static get ENDPOINTS(): string { return 'endpoints' }
  public static get EVENTS(): string { return 'events' }
  public static get NAMESPACES(): string { return 'namespaces' }
  public static get NODES(): string { return 'nodes' }
  public static get PERSISTENT_VOLUMES(): string { return 'persistentvolumes' }
  public static get PERSISTENT_VOLUME_CLAIMS(): string { return 'persistentvolumeclaims' }
  public static get PODS(): string { return 'pods' }
  public static get REPLICATION_CONTROLLERS(): string { return 'replicationcontrollers' }
  public static get REPLICA_SETS(): string { return 'replicasets' }
  public static get RESOURCE_QUOTAS(): string { return 'resourcequotas' }
  public static get OAUTH_CLIENTS(): string { return 'oauthclients' }
  public static get SECRETS(): string { return 'secrets' }
  public static get SERVICES(): string { return 'services' }
  public static get SERVICE_ACCOUNTS(): string { return 'serviceaccounts' }
  public static get CONFIG_MAPS(): string { return 'configmaps' }
  public static get INGRESSES(): string { return 'ingresses' }
  public static get TEMPLATES(): string { return 'templates' }
  public static get ROUTES(): string { return 'routes' }
  public static get BUILD_CONFIGS(): string { return 'buildconfigs' }
  public static get BUILDS(): string { return 'builds' }
  public static get DEPLOYMENT_CONFIGS(): string { return 'deploymentconfigs' }
  public static get DEPLOYMENTS(): string { return 'deployments' }
  public static get IMAGES(): string { return 'images' }
  public static get IMAGE_STREAMS(): string { return 'imagestreams' }
  public static get IMAGE_STREAM_TAGS(): string { return 'imagestreamtags' }
  public static get POLICIES(): string { return 'policies' }
  public static get POLICY_BINDINGS(): string { return 'policybindings' }
  public static get PROJECTS(): string { return 'projects' }
  public static get ROLE_BINDINGS(): string { return 'rolebindings' }
  public static get ROLES(): string { return 'roles' }
  public static get DAEMONSETS(): string { return 'daemonsets' }
}

export class ExtensionTypes {
  public static get extensions(): Array<string> {
    return [
      WatchTypes.DAEMONSETS,
      WatchTypes.DEPLOYMENTS,
      WatchTypes.INGRESSES,
      WatchTypes.REPLICA_SETS,
    ]
  }
}

export class NamespacedTypes {
  public static get k8sTypes(): Array<string> {
    return [
      WatchTypes.CONFIG_MAPS,
      WatchTypes.DEPLOYMENTS,
      WatchTypes.ENDPOINTS,
      WatchTypes.EVENTS,
      WatchTypes.NODES,
      WatchTypes.PERSISTENT_VOLUMES,
      WatchTypes.PERSISTENT_VOLUME_CLAIMS,
      WatchTypes.PODS,
      WatchTypes.REPLICA_SETS,
      WatchTypes.REPLICATION_CONTROLLERS,
      WatchTypes.RESOURCE_QUOTAS,
      WatchTypes.SECRETS,
      WatchTypes.SERVICE_ACCOUNTS,
      WatchTypes.SERVICES,
    ]
  }

  public static get osTypes(): Array<string> {
    return [
      WatchTypes.BUILDS,
      WatchTypes.BUILD_CONFIGS,
      WatchTypes.DEPLOYMENT_CONFIGS,
      WatchTypes.IMAGE_STREAMS,
      WatchTypes.IMAGE_STREAM_TAGS,
      WatchTypes.OAUTH_CLIENTS,
      WatchTypes.POLICIES,
      WatchTypes.POLICY_BINDINGS,
      WatchTypes.PROJECTS,
      WatchTypes.ROLES,
      WatchTypes.ROLE_BINDINGS,
      WatchTypes.ROUTES,
      WatchTypes.TEMPLATES,
    ]
  }
}

export enum WatchActions {
  INIT = 'INIT',
  ANY = '*',
  ADDED = 'ADDED',
  MODIFIED = 'MODIFIED',
  DELETED = 'DELETED'
}
