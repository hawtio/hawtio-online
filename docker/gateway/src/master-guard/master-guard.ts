import { Request as ExpressRequest, Response as ExpressResponse } from "express-serve-static-core"
import { logger } from '../logger'
import { GatewayOptions } from '../constants'

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

export async function proxyMasterGuard(req: ExpressRequest, res: ExpressResponse, options: GatewayOptions) {
  let masterPatternFound = false
  let exclude = false
  /* websocket uri will have watch param - must be included */
  let path = req.url // request url included query params

  masterPatternFound = masterUrlPatterns.some(function(element) {
    return path.match(element)
  })

  for (const keyword of excludeResources) {
    exclude = path.includes(keyword)
    if (exclude) break
  }

  if (masterPatternFound && ! exclude) {
    path = path.replace(/\/master/, 'masterinternal')
    res.redirect(`${options.websvr}/${path}`)
    return
  }

  const msg = `Error (proxyMasterGuard): Access to ${path} is not permitted.`
  logger.error(msg)
  res.status(502).json({ message: msg })
}
