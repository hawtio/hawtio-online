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

export const CLUSTER_VERSION_KEY = 'cluster-version'
export const DEFAULT_CLUSTER_VERSION = '<unknown>'
