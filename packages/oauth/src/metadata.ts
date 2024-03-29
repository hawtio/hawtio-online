/*
 * Openshift / kubernetes Metadata
 */

export enum HawtioMode {
  Cluster = 'cluster',
  Namespace = 'namespace',
}

export const HAWTIO_MODE_KEY = 'hawtio-mode'
export const DEFAULT_HAWTIO_MODE = HawtioMode.Cluster

export const HAWTIO_NAMESPACE_KEY = 'hawtio-namespace'
export const DEFAULT_HAWTIO_NAMESPACE = 'default'

export const CLUSTER_CONSOLE_KEY = 'cluster-console'
