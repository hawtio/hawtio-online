import yaml from 'yaml'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express-serve-static-core'
import { jwtDecode } from 'jwt-decode'
import * as fs from 'fs'
import { JolokiaRequest as MBeanRequest } from 'jolokia.js'
import { logger } from '../logger'
import { GatewayOptions } from '../globals'
import { isObject, isError } from '../utils'
import {
  AgentInfo,
  InterceptedResponse,
  SimpleResponse,
  extractHeaders,
  getFetchHeaders,
  isMBeanRequest,
  isMBeanRequestArray,
  isResponse,
  isSimpleResponse,
} from './globals'
import * as RBAC from './rbac'

const aclFile = fs.readFileSync(process.env['HAWTIO_ONLINE_RBAC_ACL'] || `${__dirname}/ACL.yaml`, 'utf8')
const aclYaml = yaml.parse(aclFile)
RBAC.initACL(aclYaml)

let isRbacEnabled = typeof process.env['HAWTIO_ONLINE_RBAC_ACL'] !== 'undefined'
const useForm = process.env['HAWTIO_ONLINE_AUTH'] === 'form'

logger.info(`=== RBAC Enabled: ${isRbacEnabled}`)
logger.info(`=== Use Form Authentication: ${useForm}`)

/**
 * Used only for testing to allow for rbac to be turned on/off
 */
export function enableRbac(enabled: boolean) {
  isRbacEnabled = enabled
}

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

  agentInfo.response.status(res.status).send(res.body)
}

function reject(status: number, body: Record<string, string>): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) reject ...')

  return Promise.reject({
    status: status,
    body: body,
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  })
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

async function selfLocalSubjectAccessReview(verb: string, agentInfo: AgentInfo): Promise<Response> {
  logger.trace('(jolokia-agent) selfLocalSubjectAccessReview ....')

  let api
  let body
  // When form is used, don't rely on OpenShift-specific LocalSubjectAccessReview
  if (useForm) {
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

  // Work-around same-location sub-requests caching issue
  const suffix = verb === 'get' ? '2' : ''

  const authUri = `${agentInfo.options.websvr}/authorization${suffix}/${api}/namespaces/${agentInfo.namespace}/localsubjectaccessreviews`

  logger.trace(`(jolokia-agent) Verifying authorization at uri ${authUri}`)

  const response = await fetch(authUri, {
    method: 'POST',
    body: json,
    headers: getFetchHeaders(agentInfo.requestHeaders),
  })

  return response
}

async function getPodIP(agentInfo: AgentInfo): Promise<string> {
  logger.trace('(jolokia-agent) getPodIP ....')

  const podIPUri = `${agentInfo.options.websvr}/podIP/${agentInfo.namespace}/${agentInfo.pod}`

  logger.trace(`(jolokia-agent) Getting pod ip from uri ${podIPUri}`)

  const res = await fetch(podIPUri, {
    method: 'GET',
    headers: getFetchHeaders(agentInfo.requestHeaders),
  })
  if (!res.ok) {
    return Promise.reject(res)
  }

  const json = await res.json()
  const data = isObject(json) ? json : JSON.parse(json as string)
  return data.status.podIP
}

async function callJolokiaAgent(
  podIP: string,
  agentInfo: AgentInfo,
  nonInterceptedMBeans?: Record<string, unknown> | Record<string, unknown>[],
): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) callJolokiaAgent ...')

  const encodedPath = encodeURI(agentInfo.path)
  const method = agentInfo.request.method
  const agentUri = `${agentInfo.options.websvr}/proxy/${agentInfo.protocol}:${podIP}:${agentInfo.port}/${encodedPath}`

  let response: Response
  if (method === 'GET') {
    response = await fetch(agentUri, {
      headers: getFetchHeaders(agentInfo.requestHeaders),
    })
  } else {
    response = await fetch(agentUri, {
      method: method,
      body: JSON.stringify(nonInterceptedMBeans),
      headers: getFetchHeaders(agentInfo.requestHeaders),
    })
  }

  if (!response.ok) {
    return Promise.reject(response)
  }

  const data = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: data,
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
async function listMBeans(podIP: string, agentInfo: AgentInfo): Promise<Record<string, unknown>> {
  logger.trace('(jolokia-agent) listMBeans ...')

  const uri = `${agentInfo.options.websvr}/proxy/${agentInfo.protocol}:${podIP}:${agentInfo.port}/${agentInfo.path}`

  const response = await fetch(uri, {
    method: 'POST',
    body: JSON.stringify({ type: 'list' }),
    headers: getFetchHeaders(agentInfo.requestHeaders),
  })

  if (!response.ok) {
    return Promise.reject(response)
  }

  const jsonString = await response.text()
  const data = JSON.parse(jsonString)
  return data.value
}

async function handleRequestWithRole(role: string, agentInfo: AgentInfo): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) handleRequestWithRole ...')

  const mbeanRequest = parseRequest(agentInfo)

  let mbeanListRequired: boolean
  if (Array.isArray(mbeanRequest)) {
    mbeanListRequired = mbeanRequest.some(r => RBAC.isMBeanListRequired(r))

    const podIP = await getPodIP(agentInfo)

    let mbeans = {}
    if (mbeanListRequired) mbeans = await listMBeans(podIP, agentInfo)

    // Check each requested mbean that it is allowed by RBAC given the role
    const rbac = mbeanRequest.map(r => RBAC.check(r, role))

    // If allowed determine if the mbean should be intercepted and overwritten
    const intercept = mbeanRequest.filter((_, i) => rbac[i].allowed).map(r => RBAC.intercept(r, role, mbeans))

    // Filter out intercepted mbeans from the request
    const nonInterceptedMBeans = intercept.filter(i => !i.intercepted).map(i => i.request)

    // Submit the non-intercepted mbeans to the jolokia service
    const jolokiaResponse = await callJolokiaAgent(podIP, agentInfo, nonInterceptedMBeans)
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
    const response = {
      status: jolokiaResponse.status,
      body: JSON.stringify(bulk),
      headers: headers,
    }

    // Override the content length that changed while re-assembling the bulk response
    // Headers on this response is immutable so update agentinfo.response
    // response.headers.set('Content-Length', `${response.body.length}`)
    return response
  } else {
    mbeanListRequired = RBAC.isMBeanListRequired(mbeanRequest)

    const podIP = await getPodIP(agentInfo)

    let mbeans = {}
    if (mbeanListRequired) {
      mbeans = await listMBeans(podIP, agentInfo)
    }

    const rbac = RBAC.check(mbeanRequest, role)
    if (!rbac.allowed) {
      return reject(403, { reason: rbac.reason })
    }

    const intercepted = RBAC.intercept(mbeanRequest, role, mbeans)
    if (intercepted.intercepted) {
      return {
        status: intercepted.response?.status || 502,
        body: JSON.stringify(intercepted.response),
        headers: new Headers(),
      }
    }

    return callJolokiaAgent(podIP, agentInfo, agentInfo.request.body)
  }
}

async function proxyJolokiaAgentWithRbac(agentInfo: AgentInfo): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) proxyJolokiaAgentWithRbac ...')

  let response = await selfLocalSubjectAccessReview('update', agentInfo)
  if (!response.ok) {
    return Promise.reject({
      status: response.status,
      body: response.body,
    })
  }

  let role
  let data = await response.json()
  let sar = isObject(data) ? data : JSON.parse(data as string)
  let allowed = useForm ? sar.status.allowed : sar.allowed

  if (allowed) {
    // map the `update` verb to the `admin` role
    role = 'admin'
  } else {
    response = await selfLocalSubjectAccessReview('get', agentInfo)
    if (!response.ok) {
      return Promise.reject(response)
    }

    data = await response.json()
    sar = isObject(data) ? data : JSON.parse(data as string)
    allowed = useForm ? sar.status.allowed : sar.allowed

    if (allowed) {
      // map the `get` verb to the `viewer` role
      role = 'viewer'
    } else {
      return reject(403, sar)
    }
  }

  return handleRequestWithRole(role, agentInfo)
}

async function proxyJolokiaAgentWithoutRbac(agentInfo: AgentInfo): Promise<SimpleResponse> {
  logger.trace('(jolokia-agent) proxyJolokiaAgentWithoutRbac ....')

  // Only requests impersonating a user granted the `update` verb on for the pod
  // hosting the Jolokia endpoint is authorized
  const response = await selfLocalSubjectAccessReview('update', agentInfo)
  if (!response.ok) {
    return reject(response.status, { reason: `Authorization was rejected: ${response.statusText}` })
  }

  logger.trace('(jolokia-agent) Passed selfLocalSubjectAccessReview')
  const data = await response.json()
  const sar = isObject(data) ? data : JSON.parse(data as string)
  const allowed = useForm ? sar.status.allowed : sar.allowed
  if (!allowed) {
    return reject(403, sar)
  }

  const podIP = await getPodIP(agentInfo)
  const jolokiaResult = await callJolokiaAgent(podIP, agentInfo, agentInfo.request.body)
  return jolokiaResult
}

export function proxyJolokiaAgent(req: ExpressRequest, res: ExpressResponse, options: GatewayOptions) {
  logger.trace('(jolokia-agent) proxyJolokiaAgent ...')
  logger.trace(`(jolokia-agent) acting on ${req.originalUrl}`)

  const parts = req.url.match(/\/management\/namespaces\/(.+)\/pods\/(http|https):(.+):(\d+)\/(.*)/)
  if (!parts) {
    return reject(404, { reason: 'URL not recognized' }).catch(error => {
      response(
        {
          request: req,
          requestHeaders: extractHeaders(req, excludeHeaders),
          response: res,
          options: options,
          namespace: '',
          protocol: '',
          pod: '',
          port: '',
          path: '',
        },
        error,
      )
    })
  }

  const agentInfo = {
    request: req,
    requestHeaders: extractHeaders(req, excludeHeaders),
    response: res,
    options: options,
    namespace: parts[1],
    protocol: parts[2],
    pod: parts[3],
    port: parts[4],
    path: parts[5],
  }

  return (isRbacEnabled ? proxyJolokiaAgentWithRbac(agentInfo) : proxyJolokiaAgentWithoutRbac(agentInfo))
    .then(res => response(agentInfo, res))
    .catch(error => {
      let simpleResponse
      if (isSimpleResponse(error)) {
        simpleResponse = error
      } else if (isResponse(error)) {
        simpleResponse = {
          status: error.status,
          body: !error.body ? error.statusText : error.body,
          headers: new Headers(),
        }
      } else if (isError(error)) {
        let body
        if (isObject(error.message)) body = JSON.stringify(error.message)
        else body = `{error: "${error.message}"}`

        simpleResponse = {
          status: 502,
          body: body,
          headers: new Headers(),
        }
      } else {
        simpleResponse = {
          status: !error.status ? 502 : error.status,
          body: !error.body ? error.statusText : error.body,
          headers: new Headers(),
        }
      }

      logger.error(`Error response encountered: ${JSON.stringify(simpleResponse)}`)
      response(agentInfo, simpleResponse)
    })
}
