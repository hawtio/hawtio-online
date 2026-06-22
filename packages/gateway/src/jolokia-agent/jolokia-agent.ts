import yaml from 'yaml'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express-serve-static-core'
import fetch, { Response as FetchResponse } from 'node-fetch'
import { jwtDecode } from 'jwt-decode'
import { LRUCache } from 'lru-cache'
import * as fs from 'fs'
import https from 'https'
import { JolokiaRequest as MBeanRequest } from 'jolokia.js'
import { logger } from '../logger'
import { gatewayConfig } from '../gateway-config'
import { isObject, isError, maskIPAddresses, joinPaths, printObject } from '../utils'
import {
  AgentInfo,
  InterceptedResponse,
  SimpleResponse,
  extractHeaders,
  toFetchHeaders,
  isMBeanRequest,
  isMBeanRequestArray,
  isSimpleResponse,
  fromFetchHeaders,
} from './globals'
import * as RBAC from './rbac'

const DEFAULT_ACL_FILE_PATH = `${__dirname}/ACL.yaml`

// Define Caches
const podIpCache = new LRUCache<string, Promise<string>>({
  max: 500,
  ttl: 1000 * 60, // 60 seconds
})

// Cache the boolean 'allowed' status
const rbacCache = new LRUCache<string, Promise<SimpleResponse>>({
  max: 1000,
  ttl: 1000 * 10, // 10 seconds
})

function clearCaches() {
  podIpCache.clear()
  rbacCache.clear()

  isRbacEnabled = undefined
}

// Export caches for testing
export { podIpCache, rbacCache, clearCaches }

class SimpleResponseError extends Error {
  response: SimpleResponse

  constructor(response: SimpleResponse) {
    super(response.body)
    this.name = 'SimpleResponseError'
    this.response = response
  }
}

export function isSimpleResponseError(obj: unknown): obj is SimpleResponseError {
  return (
    (obj as SimpleResponseError).name === 'SimpleResponseError' &&
    isSimpleResponse((obj as SimpleResponseError).response)
  )
}

function isConnectionErrorHtml(text: string): boolean {
  if (!text || text.length === 0) return false
  return text.includes('<div>') && text.includes('A connection error occurred') && text.includes('</div>')
}

function initRBACFile(rbacFilePath: string) {
  let aclFile
  try {
    aclFile = fs.readFileSync(rbacFilePath, 'utf8')
  } catch (err) {
    const e = new Error(`Failed to read the ACL file at ${rbacFilePath}`)
    e.cause = err
    throw e
  }

  try {
    const aclYaml = yaml.parse(aclFile)
    logger.trace('=== Parsed ACL file and initialising RBAC ===')
    logger.trace(aclYaml)
    RBAC.initACL(aclYaml)
  } catch (err) {
    const e = new Error(`Failed to parse the ACL file at ${rbacFilePath}`)
    e.cause = err
    throw e
  }
}

/*
 * Process the RBAC env variable and, if required, initialise the file
 * - RBAC envVar value not defined: RBAC enabled / default RBAC file
 * - RBAC envVar value is 'disabled': RBAC disabled
 * - RBAC envVar value is 'file path': RBAC enabled / custom RBAC file
 */
export function processRBACEnvVar(defaultRbacFilePath: string, rbacEnvVar?: string): boolean {
  if (!rbacEnvVar) {
    logger.info(`=== Enabling RBAC with default rules file`)
    initRBACFile(defaultRbacFilePath)
    return true
  } else if (rbacEnvVar.toLowerCase() === 'disabled') {
    logger.info(`=== RBAC has been disabled`)
    return false
  } else {
    // Custom ACL file has been specified
    logger.info(`=== Custom RBAC rules file defined: ${rbacEnvVar}`)
    initRBACFile(rbacEnvVar)
    return true
  }
}

// Stateful var initialised once to determine enablement of RBAC
let isRbacEnabled: boolean | undefined

// Headers that should not be passed onto fetch sub requests
const excludeHeaders = [
  'host',
  'content-type',
  'content-length',
  'content-security-policy',
  'connection',
  'transfer-encoding',
]

function response(agentInfo: AgentInfo, res: SimpleResponse) {
  if (res.status === 401 && agentInfo.response.hasHeader('www-authenticate')) {
    /*
     * If an unauthorized response is received from the jolokia agent
     * then want to avoid browsers like Chrome displaying a popup authentication
     * dialog (initiated by the 401 status & the 'www-authenticate' header) by
     * dropping the 'www-authenticate' header
     */
    agentInfo.response.removeHeader('www-authenticate')
  }

  /*
   * Ensure that the response content-type is json
   */
  agentInfo.response.setHeader('content-type', 'application/json')

  let maskedResponse = res.body
  if (gatewayConfig.isMaskIpAddrEnabled()) {
    logger.trace(`Masking IP address for response body ${res.body}`)
    maskedResponse = maskIPAddresses(res.body)
  }

  agentInfo.response.status(res.status).send(maskedResponse)
}

function reject(status: number, body: Record<string, string>): SimpleResponseError {
  logger.trace('(jolokia-agent) reject ...')

  return new SimpleResponseError(
    new SimpleResponse(
      status,
      JSON.stringify(body),
      new Headers({
        'Content-Type': 'application/json',
      }),
    ),
  )
}

async function rejectResponse(response: FetchResponse): Promise<SimpleResponseError> {
  logger.trace('(jolokia-agent) reject response ...')
  let body: string

  // Create a clone of the response. We will use this for the fallback.
  const responseClone = response.clone()
  try {
    const json = await response.json()
    body = JSON.stringify(json)
    if (body === '{}') body = '' // make body empty as effectively useless as empty json
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    body = await responseClone.text()
    if (isConnectionErrorHtml(body)) {
      // no need to record all the html, just retain the main message
      body = 'A connection error occurred.'
    }
  }

  if (!response.statusText) {
    body = `An error has occurred with no status text. ${body}`
  } else {
    body = `${response.statusText}. ${body}`
  }

  return new SimpleResponseError(new SimpleResponse(response.status, JSON.stringify({ error: body }), new Headers()))
}

function getSubjectFromJwt(agentInfo: AgentInfo): string | undefined {
  logger.trace('(jolokia-agent) getSubjectFromJwt ...')

  const authz = agentInfo.request.header('Authorization')
  if (!authz) {
    logger.error('Authorization header not found in request')
    return ''
  }
  const token = authz.split(' ')[1]
  const payload = jwtDecode(token)
  return payload.sub
}

async function selfLocalSubjectAccessReview(verb: string, agentInfo: AgentInfo): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) selfLocalSubjectAccessReview ....')

  // Cache key must include user's token (from Authorization header).
  // Nginx used: $uri$is_args$args|$http_authorization
  const authToken = agentInfo.request.header('Authorization') || 'anon'
  const cacheKey = `${verb}:${agentInfo.namespace}:${agentInfo.pod}:${authToken}`
  logger.trace(`(jolokia-agent) selfLocalSubjectAccessReview cache key: ${cacheKey}`)

  if (rbacCache.has(cacheKey)) {
    const response = rbacCache.get(cacheKey)!
    logger.trace(`(jolokia-agent) selfLocalSubjectAccessReview Hit for RBAC: ${cacheKey} -> ${response}`)
    return response
  }

  logger.trace(`(jolokia-agent) selfLocalSubjectAccessReview verb: ${verb}`)

  //
  // Protects against cache stampede problem
  //
  // Request 1 arrives, sees a cache miss, creates a fetch Promise,
  // and immediately drops that Promise object into the LRU cache.
  //
  // Requests 2 through 30 arrive a millisecond later. They check the
  // cache and find the exact same Promise object already sitting there.
  // They all .then() or await on the identical Promise.
  //
  // When the underlying network request resolves, it resolves for all
  // 30 requests simultaneously.
  //
  const sarPromise = (async () => {
    let api
    let body
    // OpenShift returns a different response schema to native kubernetes
    if (!gatewayConfig.isOpenShiftCluster()) {
      api = 'authorization.k8s.io'
      body = {
        kind: 'LocalSubjectAccessReview',
        apiVersion: 'authorization.k8s.io/v1',
        metadata: {
          namespace: agentInfo.namespace,
        },
        spec: {
          user: getSubjectFromJwt(agentInfo) || '',
          resourceAttributes: {
            verb: verb,
            resource: 'pods',
            name: agentInfo.pod,
            namespace: agentInfo.namespace,
          },
        },
      }
    } else {
      api = 'authorization.openshift.io'
      body = {
        kind: 'LocalSubjectAccessReview',
        apiVersion: 'authorization.openshift.io/v1',
        namespace: agentInfo.namespace,
        verb: verb,
        resource: 'pods',
        name: agentInfo.pod,
      }
    }

    const json = JSON.stringify(body)
    logger.trace(`(jolokia-agent) Verifying authorization using body ${json}`)

    // /apis/authorization.k8s.io/v1/namespaces/{namespace}/localsubjectaccessreviews
    const authUri = joinPaths(
      gatewayConfig.getClusterAddr(),
      'apis',
      api,
      'v1',
      'namespaces',
      agentInfo.namespace,
      'localsubjectaccessreviews',
    )

    logger.trace(`(jolokia-agent) Verifying authorization at uri ${authUri}`)

    const requestInit: fetch.RequestInit = {
      method: 'POST',
      body: json,
      headers: toFetchHeaders(agentInfo.requestHeaders),
    }

    if (gatewayConfig.getProxySSLOptions()) {
      requestInit.agent = new https.Agent({
        cert: gatewayConfig.getProxySSLOptions()?.certCA,
        rejectUnauthorized: false,
        keepAlive: false,
      })
    }

    const fetchResponse = await fetch(authUri, requestInit)
    if (!fetchResponse.ok) {
      logger.trace(`(jolokia-agent) selfLocalSubjectAccessReview failed (${fetchResponse.status})`)
      throw await rejectResponse(fetchResponse)
    }

    const data = await fetchResponse.json()
    const sar = isObject(data) ? data : JSON.parse(data as string)

    logger.trace(`(jolokia-agent) selfLocalSubjectAccessReview sar: (${printObject(sar)})`)

    // Cache the response
    const allowed = gatewayConfig.isOpenShiftCluster() ? sar.allowed : sar.status.allowed
    return new SimpleResponse(fetchResponse.status, allowed.toString(), fromFetchHeaders(fetchResponse.headers))
  })()

  // Evict the promise from cache immediately if the network request fails
  // so subsequent retries aren't permanently locked into a broken state
  sarPromise.catch(() => rbacCache.delete(cacheKey))

  rbacCache.set(cacheKey, sarPromise)
  return sarPromise
}

async function retrievePodIP(agentInfo: AgentInfo) {
  if (gatewayConfig.isExternal()) {
    // Gateway is external so needs to use pod name with proxy endpoint
    return
  }

  const cacheKey = `${agentInfo.namespace}/${agentInfo.pod}`
  logger.trace(`(jolokia-agent) getPodIP cache key: ${cacheKey}`)

  if (podIpCache.has(cacheKey)) {
    logger.trace(`(jolokia-agent) getPodIP hit for PodIP: ${cacheKey}`)
    const resolvedIp = await podIpCache.get(cacheKey)!
    agentInfo.ip = resolvedIp
    return
  }

  logger.trace('(jolokia-agent) getPodIP ....')

  //
  // Protects against cache stampede problem
  //
  // Request 1 arrives, sees a cache miss, creates a fetch Promise,
  // and immediately drops that Promise object into the LRU cache.
  //
  // Requests 2 through 30 arrive a millisecond later. They check the
  // cache and find the exact same Promise object already sitting there.
  // They all .then() or await on the identical Promise.
  //
  // When the underlying network request resolves, it resolves for all
  // 30 requests simultaneously.
  //
  const ipPromise = (async () => {
    // /api/v1/namespaces/$1/pods/$2
    const podIPUri = joinPaths(
      gatewayConfig.getClusterAddr(),
      'api',
      'v1',
      'namespaces',
      agentInfo.namespace,
      'pods',
      agentInfo.pod,
    )

    logger.trace(`(jolokia-agent) Getting pod ip from uri ${podIPUri}`)

    const requestInit: fetch.RequestInit = {
      method: 'GET',
      headers: toFetchHeaders(agentInfo.requestHeaders),
    }

    if (gatewayConfig.getProxySSLOptions()) {
      requestInit.agent = new https.Agent({
        cert: gatewayConfig.getProxySSLOptions()?.certCA,
        rejectUnauthorized: false,
        keepAlive: false,
      })
    }

    const fetchResponse = await fetch(podIPUri, requestInit)
    if (!fetchResponse.ok) {
      throw await rejectResponse(fetchResponse)
    }

    const json = await fetchResponse.json()
    const data = isObject(json) ? json : JSON.parse(json as string)
    agentInfo.ip = data.status.podIP
    return data.status.podIP
  })()

  // Evict the promise from cache immediately if the network request fails
  // so subsequent retries aren't permanently locked into a broken state
  ipPromise.catch(() => podIpCache.delete(cacheKey))

  logger.trace(`(jolokia-agent) Caching Pod IP: ${cacheKey}`)
  podIpCache.set(cacheKey, ipPromise)
}

async function callJolokiaAgent(
  agentInfo: AgentInfo,
  nonInterceptedMBeans?: Record<string, unknown> | Record<string, unknown>[],
): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) callJolokiaAgent ...')

  const method = agentInfo.request.method
  const agentUri = agentInfo.getJolokiaUri()

  logger.trace(`(jolokia-agent) doing a ${method} on ${agentUri}`)

  const headers = toFetchHeaders(agentInfo.requestHeaders)
  logger.trace(`(jolokia-agent) callJolokiaAgent - ${agentUri}`)
  logger.trace(`(jolokia-agent) callJolokiaAgent - sending headers`)
  headers.forEach((value, key) => {
    logger.trace(`(jolokia-agent) callJolokiaAgent - header ${key} : ${value}`)
  })

  const options: fetch.RequestInit = {
    method: method,
    headers: toFetchHeaders(agentInfo.requestHeaders),
  }

  if (method === 'POST') {
    options.body = JSON.stringify(nonInterceptedMBeans)
    logger.trace(`(jolokia-agent) ... with body ${options.body}`)
  }
  if (agentInfo.protocol === 'https' && gatewayConfig.getProxySSLOptions()) {
    logger.trace(`(jolokia-agent) ... using https with SSL`)
    options.agent = new https.Agent({
      key: gatewayConfig.getProxySSLOptions()?.proxyKey,
      cert: gatewayConfig.getProxySSLOptions()?.proxyCert,
      rejectUnauthorized: false,
      keepAlive: false,
    })
  }

  const fetchResponse = await fetch(agentUri, options)
  logger.trace(`(jolokia-agent) callJolokiaAgent response: ${printObject(fetchResponse)}`)

  if (!fetchResponse.ok) {
    logger.trace(`(jolokia-agent) callJolokiaAgent failed (${fetchResponse.status})`)
    throw await rejectResponse(fetchResponse)
  }

  try {
    const data = await fetchResponse.text()
    logger.trace(`(jolokia-agent) callJolokiaAgent response: ${printObject(data)}`)

    return new SimpleResponse(fetchResponse.status, data, fromFetchHeaders(fetchResponse.headers))
  } catch (error) {
    logger.trace(`Error when getting data from response: ${printObject(error)}`)
    throw new Error('Failed to parse data from response', { cause: error })
  }
}

function parseRequest(agentInfo: AgentInfo): MBeanRequest | MBeanRequest[] {
  logger.trace('(jolokia-agent) parseRequest ... ')

  if (agentInfo.request.method === 'POST') {
    let body
    if (isObject(agentInfo.request.body)) {
      body = agentInfo.request.body
    } else if (typeof agentInfo.request.body === 'string') {
      body = JSON.parse(agentInfo.request.body)
    } else {
      throw new Error(`Unexpected Jolokia POST request body: ${agentInfo.request.body}`)
    }

    if (isMBeanRequest(body)) {
      return body
    }

    if (isMBeanRequestArray(body)) {
      return body
    }

    throw new Error(
      `Unrecognised Jolokia POST request body (neither mbeanRequest nor MBeanRequestArray): ${JSON.stringify(body)}`,
    )
  }

  // GET method
  // path: ...jolokia/<type>/<arg1>/<arg2>/...
  // https://jolokia.org/reference/html/protocol.html#get-request
  // path is already decoded no need for decodeURIComponent()
  const match = agentInfo.path.split('?')[0].match(/.*jolokia\/(read|write|exec|search|list|version)\/?(.*)/)
  const type = match && match.length > 0 ? match[1] : ''
  const argsOrInner = match && match.length > 1 ? match[2] : ''

  // Jolokia-specific escaping rules (!*) are not taken care of right now
  switch (type) {
    case 'read': {
      // /read/<mbean name>/<attribute name>/<inner path>
      const args = argsOrInner.split('/')
      const mbean = args[0]
      const attribute = args[1]
      // inner-path not supported
      return { type, mbean, attribute }
    }
    case 'write': {
      // /write/<mbean name>/<attribute name>/<value>/<inner path>
      const args = argsOrInner.split('/')
      const mbean = args[0]
      const attribute = args[1]
      const value = args[2]
      // inner-path not supported
      return { type, mbean, attribute, value }
    }
    case 'exec': {
      // /exec/<mbean name>/<operation name>/<arg1>/<arg2>/....
      const args = argsOrInner.split('/')
      const mbean = args[0]
      const operation = args[1]
      const opArgs = args.slice(2)
      return { type, mbean, operation, arguments: opArgs }
    }
    case 'search': {
      // /search/<pattern>
      const mbean = argsOrInner
      return { type, mbean }
    }
    case 'list': {
      // /list/<inner path>
      const innerPath = argsOrInner
      return { type, path: innerPath }
    }
    case 'version':
      // /version
      return { type }
    default:
      throw new Error(`Unexpected Jolokia GET request: ${agentInfo.path}`)
  }
}

// This is usually called once upon the front-end loads, still we may want to cache it
async function listMBeans(agentInfo: AgentInfo): Promise<Record<string, unknown>> {
  logger.trace('(jolokia-agent) listMBeans ...')

  const uri = agentInfo.getJolokiaUri()
  logger.trace(`(jolokia-agent) listMBeans with uri ${uri}`)
  const options: fetch.RequestInit = {
    method: 'POST',
    body: JSON.stringify({ type: 'list' }),
    headers: toFetchHeaders(agentInfo.requestHeaders),
  }

  if (agentInfo.protocol === 'https') {
    options.agent = new https.Agent({
      key: gatewayConfig.getProxySSLOptions()?.proxyKey,
      cert: gatewayConfig.getProxySSLOptions()?.proxyCert,
      rejectUnauthorized: false,
      keepAlive: false,
    })
  }

  const fetchResponse = await fetch(uri, options)

  if (!fetchResponse.ok) {
    logger.trace(`(jolokia-agent) listMBeans failed (${fetchResponse.status})`)
    throw await rejectResponse(fetchResponse)
  }

  const jsonString = await fetchResponse.text()
  const data = JSON.parse(jsonString)
  return data.value
}

async function handleRequestWithRole(role: string, agentInfo: AgentInfo): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) handleRequestWithRole ...')

  const mbeanRequest = parseRequest(agentInfo)
  if (!gatewayConfig.isExternal()) {
    await retrievePodIP(agentInfo)
  }

  let mbeanListRequired: boolean
  if (Array.isArray(mbeanRequest)) {
    mbeanListRequired = mbeanRequest.some(r => RBAC.isMBeanListRequired(r))

    let mbeans = {}
    if (mbeanListRequired) mbeans = await listMBeans(agentInfo)

    // Check each requested mbean that it is allowed by RBAC given the role
    const rbac = mbeanRequest.map(r => RBAC.check(r, role))

    // If allowed determine if the mbean should be intercepted and overwritten
    const intercept = mbeanRequest.filter((_, i) => rbac[i].allowed).map(r => RBAC.intercept(r, role, mbeans))

    // Filter out intercepted mbeans from the request
    const nonInterceptedMBeans = intercept.filter(i => !i.intercepted).map(i => i.request)

    // Submit the non-intercepted mbeans to the jolokia service
    const jolokiaResponse = await callJolokiaAgent(agentInfo, nonInterceptedMBeans)
    const jolokiaResult = JSON.parse(jolokiaResponse.body)

    // Unroll intercepted requests
    const initial: InterceptedResponse[] = []
    let bulk = intercept.reduce((res, rbac) => {
      if (rbac.intercepted && rbac.response) {
        res.push(rbac.response)
      } else {
        res.push(jolokiaResult.splice(0, 1)[0])
      }
      return res
    }, initial)

    // Unroll denied requests
    bulk = rbac.reduce((res, rbac, i) => {
      if (rbac.allowed) {
        res.push(bulk.splice(0, 1)[0])
      } else {
        res.push({
          request: mbeanRequest[i],
          status: 403,
          reason: rbac.reason,
        })
      }
      return res
    }, initial)

    // Re-assembled bulk response
    const headers = new Headers(jolokiaResponse.headers)
    const response = new SimpleResponse(jolokiaResponse.status, JSON.stringify(bulk), headers)

    // Override the content length that changed while re-assembling the bulk response
    // Headers on this response is immutable so update agentinfo.response
    // response.headers.set('Content-Length', `${response.body.length}`)
    return response
  } else {
    mbeanListRequired = RBAC.isMBeanListRequired(mbeanRequest)

    let mbeans = {}
    if (mbeanListRequired) {
      mbeans = await listMBeans(agentInfo)
    }

    const rbac = RBAC.check(mbeanRequest, role)
    if (!rbac.allowed) {
      throw reject(403, { reason: rbac.reason })
    }

    const intercepted = RBAC.intercept(mbeanRequest, role, mbeans)
    if (intercepted.intercepted) {
      return new SimpleResponse(intercepted.response?.status || 502, JSON.stringify(intercepted.response))
    }

    return callJolokiaAgent(agentInfo, agentInfo.request.body)
  }
}

function checkSarResponse(sarResponse: SimpleResponse) {
  if (!isSimpleResponse(sarResponse) || sarResponse.status < 200 || sarResponse.status >= 300) {
    // If the SAR service itself returned a 500 or 400, reject it.
    throw reject(sarResponse.status, { reason: `SAR Check Failed: ${sarResponse.body}` })
  }
}

async function proxyJolokiaAgentWithRbac(agentInfo: AgentInfo): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) proxyJolokiaAgentWithRbac ...')

  let sarResponse = await selfLocalSubjectAccessReview('update', agentInfo)
  checkSarResponse(sarResponse)

  let role
  if (sarResponse.body === 'true') {
    // map the `update` verb to the `admin` role
    role = 'admin'
  } else {
    sarResponse = await selfLocalSubjectAccessReview('get', agentInfo)
    checkSarResponse(sarResponse)

    if (sarResponse.body === 'true') {
      // map the `get` verb to the `viewer` role
      role = 'viewer'
    } else {
      throw reject(403, { message: `Subject Access Review Result: { allowed: ${sarResponse.body} }` })
    }
  }

  return handleRequestWithRole(role, agentInfo)
}

async function proxyJolokiaAgentWithoutRbac(agentInfo: AgentInfo): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) proxyJolokiaAgentWithoutRbac ....')

  // Only requests impersonating a user granted the `update` verb on for the pod
  // hosting the Jolokia endpoint is authorized
  const sarResponse = await selfLocalSubjectAccessReview('update', agentInfo)
  checkSarResponse(sarResponse)

  if (sarResponse.body !== 'true') {
    throw reject(403, { message: `Subject Access Review Result: { allowed: ${sarResponse.body} }` })
  }

  if (!gatewayConfig.isExternal()) {
    await retrievePodIP(agentInfo)
  }
  const jolokiaResult = await callJolokiaAgent(agentInfo, agentInfo.request.body)
  return jolokiaResult
}

export function proxyJolokiaAgent(req: ExpressRequest, res: ExpressResponse) {
  logger.trace('(jolokia-agent) proxyJolokiaAgent ...')

  // Only read the file and initialize if it has never been done before
  if (isRbacEnabled === undefined) {
    logger.info('=== Initializing Agent RBAC rules upon first request ===')
    isRbacEnabled = processRBACEnvVar(DEFAULT_ACL_FILE_PATH, gatewayConfig.getRbacAcl())
  }

  logger.trace(`(jolokia-agent) acting on ${req.originalUrl}`)

  const parts = req.url.match(/\/management\/namespaces\/(.+)\/pods\/(http|https):(.+):(\d+)\/(.*)/)
  if (!parts) {
    const error = reject(404, { reason: 'URL not recognized' })
    response(
      new AgentInfo({
        request: req,
        requestHeaders: extractHeaders(req, excludeHeaders),
        response: res,
        namespace: '',
        protocol: '',
        pod: '',
        port: '',
        path: '',
      }),
      error.response,
    )
    return
  }

  const agentInfo = new AgentInfo({
    request: req,
    requestHeaders: extractHeaders(req, excludeHeaders),
    response: res,
    namespace: parts[1],
    protocol: parts[2],
    pod: parts[3],
    port: parts[4],
    path: parts[5],
  })

  return (isRbacEnabled ? proxyJolokiaAgentWithRbac(agentInfo) : proxyJolokiaAgentWithoutRbac(agentInfo))
    .then(res => response(agentInfo, res))
    .catch(error => {
      let simpleResponse

      if (isSimpleResponseError(error)) {
        simpleResponse = error.response
      } else if (isSimpleResponse(error)) {
        simpleResponse = error
      } else if (isError(error)) {
        const errorPayload = {
          error: error.message,
        }
        simpleResponse = new SimpleResponse(502, JSON.stringify(errorPayload))
      } else {
        let errorMessage = 'An unexpected and unknown error occurred.'
        try {
          // Try to serialize the unknown error for better logging
          errorMessage = `Unknown error: ${JSON.stringify(error)}`
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          // Fallback if serialization fails (e.g., circular references)
          errorMessage = `Unknown error: ${String(error)}`
        }

        simpleResponse = new SimpleResponse(
          500, // Internal Server Error
          JSON.stringify({ error: errorMessage }),
        )
      }

      logger.error(`Error response encountered: ${JSON.stringify(simpleResponse)}`)
      response(agentInfo, simpleResponse)
    })
}
