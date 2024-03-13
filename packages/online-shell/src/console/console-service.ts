import { kubernetesApi, joinPaths } from '@hawtio/online-kubernetes-api'
import { ConsoleType } from './globals'

enum LinkPath {
  console = '',
  search = 'search/ns',
  namespace = 'k8s/cluster/projects',
  node = 'k8s/cluster/nodes',
  resource = 'k8s/ns',
}

enum OS4 {
  'dc' = 'deploymentconfigs',
  'rc' = 'replicationcontrollers',
  'rs' = 'replicasets',
  'sts' = 'statefulsets',
}

export interface OSLinkConfig {
  type: ConsoleType
  namespace?: string
  selector?: string
  resource?: string
  kind?: string
}

export function osLink(config: OSLinkConfig): URL | null {
  if (!kubernetesApi.consoleUri) return null

  const linkPath = LinkPath[config.type]

  switch (config.type) {
    case ConsoleType.console:
      return new URL(kubernetesApi.consoleUri)
    case ConsoleType.namespace:
      return new URL(joinPaths(kubernetesApi.consoleUri, linkPath, config.namespace || 'default'))
    case ConsoleType.search: {
      const url: URL = new URL(joinPaths(kubernetesApi.consoleUri, linkPath, config.namespace || 'default'))
      url.search = `kind=${config.kind}&q=${encodeURI(config.selector || '')}`
      return url
    }
    case ConsoleType.node:
      return new URL(joinPaths(kubernetesApi.consoleUri, linkPath, config.selector || ''))
    case ConsoleType.resource:
      return new URL(
        joinPaths(
          kubernetesApi.consoleUri,
          linkPath,
          config.namespace || 'default',
          OS4[config.resource as keyof typeof OS4] || config.resource,
          config.selector || '',
        ),
      )
    default:
      return null
  }
}
