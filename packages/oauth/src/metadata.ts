
/*
 * Openshift / kubernetes Metadata
 */
export const HAWTIO_MODE_KEY = 'hawtio-mode'
export const HAWTIO_NAMESPACE_KEY = 'hawtio-namespace'
export const CLUSTER_VERSION_KEY = 'cluster-version'

export const DEFAULT_HAWTIO_MODE = 'cluster'
export const DEFAULT_HAWTIO_NAMESPACE = 'default'
export const DEFAULT_CLUSTER_VERSION = '<unknown>'

export interface Hawtio {
  mode: string
  namespace?: string
}
