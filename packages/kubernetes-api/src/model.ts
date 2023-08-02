export class consts {
  get NAMESPACE_STORAGE_KEY(): string { return 'k8sSelectedNamespace' }
}

export const Constants = new consts()

export interface KubernetesState {
  namespaces: Array<string>
  selectedNamespace: string
}

export class KindTypes {
  static get LIST(): string { return 'List' }
  static get ENDPOINTS(): string { return 'Endpoint' }
  static get EVENTS(): string { return 'Event' }
  static get NAMESPACES(): string { return 'Namespace' }
  static get NODES(): string { return 'Node' }
  static get PERSISTENT_VOLUMES(): string { return 'PersistentVolume' }
  static get PERSISTENT_VOLUME_CLAIMS(): string { return 'PersistentVolumeClaim' }
  static get PODS(): string { return 'Pod' }
  static get REPLICATION_CONTROLLERS(): string { return 'ReplicationController' }
  static get REPLICA_SETS(): string { return 'ReplicaSet' }
  static get RESOURCE_QUOTAS(): string { return 'ResourceQuota' }
  static get OAUTH_CLIENTS(): string { return 'OAuthClient' }
  static get SECRETS(): string { return 'Secret' }
  static get SERVICES(): string { return 'Service' }
  static get SERVICE_ACCOUNTS(): string { return 'ServiceAccount' }
  static get CONFIG_MAPS(): string { return 'ConfigMap' }
  static get INGRESSES(): string { return 'Ingress' }
  static get TEMPLATES(): string { return 'Template' }
  static get ROUTES(): string { return 'Route' }
  static get BUILD_CONFIGS(): string { return 'BuildConfig' }
  static get BUILDS(): string { return 'Build' }
  static get DEPLOYMENT_CONFIGS(): string { return 'DeploymentConfig' }
  static get DEPLOYMENTS(): string { return 'Deployment' }
  static get IMAGES(): string { return 'Image' }
  static get IMAGE_STREAMS(): string { return 'ImageStream' }
  static get IMAGE_STREAM_TAGS(): string { return 'ImageStreamTag' }
  static get POLICIES(): string { return 'Policy' }
  static get POLICY_BINDINGS(): string { return 'PolicyBinding' }
  static get PROJECTS(): string { return 'Project' }
  static get ROLE_BINDINGS(): string { return 'RoleBinding' }
  static get ROLES(): string { return 'Role' }
  static get DAEMONSETS(): string { return 'DaemonSet' }
}

export class WatchTypes {
  static get LIST(): string { return 'list' }
  static get ENDPOINTS(): string { return 'endpoints' }
  static get EVENTS(): string { return 'events' }
  static get NAMESPACES(): string { return 'namespaces' }
  static get NODES(): string { return 'nodes' }
  static get PERSISTENT_VOLUMES(): string { return 'persistentvolumes' }
  static get PERSISTENT_VOLUME_CLAIMS(): string { return 'persistentvolumeclaims' }
  static get PODS(): string { return 'pods' }
  static get REPLICATION_CONTROLLERS(): string { return 'replicationcontrollers' }
  static get REPLICA_SETS(): string { return 'replicasets' }
  static get RESOURCE_QUOTAS(): string { return 'resourcequotas' }
  static get OAUTH_CLIENTS(): string { return 'oauthclients' }
  static get SECRETS(): string { return 'secrets' }
  static get SERVICES(): string { return 'services' }
  static get SERVICE_ACCOUNTS(): string { return 'serviceaccounts' }
  static get CONFIG_MAPS(): string { return 'configmaps' }
  static get INGRESSES(): string { return 'ingresses' }
  static get TEMPLATES(): string { return 'templates' }
  static get ROUTES(): string { return 'routes' }
  static get BUILD_CONFIGS(): string { return 'buildconfigs' }
  static get BUILDS(): string { return 'builds' }
  static get DEPLOYMENT_CONFIGS(): string { return 'deploymentconfigs' }
  static get DEPLOYMENTS(): string { return 'deployments' }
  static get IMAGES(): string { return 'images' }
  static get IMAGE_STREAMS(): string { return 'imagestreams' }
  static get IMAGE_STREAM_TAGS(): string { return 'imagestreamtags' }
  static get POLICIES(): string { return 'policies' }
  static get POLICY_BINDINGS(): string { return 'policybindings' }
  static get PROJECTS(): string { return 'projects' }
  static get ROLE_BINDINGS(): string { return 'rolebindings' }
  static get ROLES(): string { return 'roles' }
  static get DAEMONSETS(): string { return 'daemonsets' }
}

export class ExtensionTypes {
  static get extensions(): Array<string> {
    return [
      WatchTypes.DAEMONSETS,
      WatchTypes.DEPLOYMENTS,
      WatchTypes.INGRESSES,
      WatchTypes.REPLICA_SETS,
    ]
  }
}

export class NamespacedTypes {
  static get k8sTypes(): Array<string> {
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

  static get osTypes(): Array<string> {
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
