import { logger } from '../logger'

/*
 * Access list of uri patterns allowed to proxy to the master cluster
 */
const masterUrlPatterns = [
  // OpenShift Query OAuth Server
  /\/master\/.well-known\/oauth-authorization-server(\/)?$/,
  // OpenShift v1 api
  /\/master\/apis\/apps.openshift.io\/v1(\/)?$/,
  // OpenShift Current User
  /\/master\/apis\/user.openshift.io\/v1\/users\/~$/,
  // OpenShift projects (for cluster-mode)
  /\/master\/apis\/project.openshift.io\/v1\/projects(\?.*)?/,
  // Kubernetes Token Login Validation
  /\/master\/api(\/)?$/,
  // Kubernetes namespaces (for cluster-mode)
  /\/master\/api\/v1\/namespaces(\?.*)?/,
  // Kubernetes Pods in a wildcard namespace to be converted to websocket
  /\/master\/api\/v1\/namespaces\/[0-9a-zA-Z-]+\/pods(\?.*)?/,
  // Query for the uri of the OpenShift web console
  /\/master\/api\/v1\/namespaces\/openshift-config-managed\/configmaps\/console-public(\/)?/
]

const excludeResources = [ 'secrets' ]

export function proxyMasterGuard(url: string): { status: boolean, errorMsg: string } {
  let masterPatternFound = false
  let exclude = false

  logger.trace(`(proxyMasterGuard) ... checking url path: ${url}`)

  masterPatternFound = masterUrlPatterns.some(function(element) {
    return url.match(element)
  })

  for (const keyword of excludeResources) {
    exclude = url.includes(keyword)
    if (exclude) break
  }

  if (masterPatternFound && ! exclude)
    return { status: true, errorMsg: '' }
  else {
    const msg = `Error (proxyMasterGuard): Access to ${url} is not permitted.`
    logger.error(msg)
    return { status: false, errorMsg: msg }
  }
}
