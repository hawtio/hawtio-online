// http://nginx.org/en/docs/njs
// https://github.com/nginx/njs
// https://github.com/xeioex/njs-examples

import jsyaml from 'js-yaml'
import { IJmxDomains, IRequest, IResponse } from 'jolokia.js'
import * as RBAC from './rbac'
import jwt_decode from './jwt-decode'
import { isRequestMethod, MethodType } from './globals'
import fs from 'fs'

RBAC.initACL(jsyaml.load(fs.readFileSync(process.env['HAWTIO_ONLINE_RBAC_ACL'] || 'ACL.yaml', 'utf8')))

const isRbacEnabled = typeof process.env['HAWTIO_ONLINE_RBAC_ACL'] !== 'undefined'
const useForm = process.env['HAWTIO_ONLINE_AUTH'] === 'form'

/*
 * Change: [response|request]Body -> [response|request]Text
 * The property was made obsolete in 0.5.0 and was removed in 0.8.0.
 * The r.responseBuffer or the r.responseText property should be used instead.
 */

export function proxyJolokiaAgent(req: NginxHTTPRequest) {
  req.log('=== PROXY JOLOKIA REQUEST ===')
  req.log('Request URL: ' + req.uri)

  const parts = req.uri.match(/\/management\/namespaces\/(.+)\/pods\/(http|https):(.+):(\d+)\/(.*)/)
  if (!parts) {
    req.return(404)
    return
  }
  const namespace = parts[1]
  const protocol = parts[2]
  const pod = parts[3]
  const port = parts[4]
  const path = parts[5]

  req.log(`NAMESPACE: ${namespace}`)
  req.log(`PROTOCOL: ${protocol}`)
  req.log(`POD: ${pod}`)
  req.log(`PORT: ${port}`)
  req.log(`PATH: ${path}`)

  function jsonResponse(res: NginxHTTPRequest) {
    req.log('==== jsonResponse ====')
    let payload: string = '{}'
    if (res && res.responseText) {
      payload = res.responseText
    }

    req.log('Parsing the payload: ' + payload)
    const resBody = JSON.parse(payload)
    req.log('Successfully parsed body')
    return resBody
  }

  function response(res) {
    req.log('==== response ====')
    req.log(`PGR1 response: status=${res.status}`)

    if (res.headersOut) {
      for (const header in res.headersOut) {
        req.headersOut[header] = res.headersOut[header]
      }
    }

    req.log('The response: ')
    req.return(res.status, res.responseText)
  }

  function reject(status: number, message: string) {
    req.log('==== reject ====')
    return Promise.reject({
      status: status,
      responseBody: message,
      headersOut: {
        'Content-Type': 'application/json',
      }
    })
  }

  function getSubjectFromJwt() {
    req.log('==== getSubjectFromJwt ====')
    const authz = req.headersIn['Authorization']
    if (!authz) {
      req.error('Authorization header not found in request')
      return ''
    }
    const token = authz.split(' ')[1]
    const payload = jwt_decode(token)
    return payload.sub
  }

  async function selfLocalSubjectAccessReview(verb: string): Promise<NginxHTTPRequest> {
    req.log('==== selfLocalSubjectAccessReview ====')
    let api
    let body
    // When form is used, don't rely on OpenShift-specific LocalSubjectAccessReview
    if (useForm) {
      api = 'authorization.k8s.io'
      body = {
        kind: 'LocalSubjectAccessReview',
        apiVersion: 'authorization.k8s.io/v1',
        metadata: {
          namespace: namespace,
        },
        spec: {
          user: getSubjectFromJwt(),
          resourceAttributes: {
            verb: verb,
            resource: 'pods',
            name: pod,
            namespace: namespace,
          }
        }
      }
    } else {
      api = 'authorization.openshift.io'
      body = {
        kind: 'LocalSubjectAccessReview',
        apiVersion: 'authorization.openshift.io/v1',
        namespace: namespace,
        verb: verb,
        resource: 'pods',
        resourceName: pod,
      }
    }
    const json = JSON.stringify(body)
    req.log(`selfLocalSubjectAccessReview(${verb}): ${api} - ${json}`)

    // Work-around same-location sub-requests caching issue
    const suffix = verb === 'get' ? '2' : ''

    req.log(`SubRequest: /authorization${suffix}/${api}/namespaces/${namespace}/localsubjectaccessreviews}`)
    req.log(`Body: ${json}`)

    return await req.subrequest(`/authorization${suffix}/${api}/namespaces/${namespace}/localsubjectaccessreviews`, {
      method: 'POST',
      body: json
    })
  }

  async function getPodIP(): Promise<string> {
    req.log('==== getPodIP ====')

    const res = await req.subrequest(`/podIP/${namespace}/${pod}`, { method: 'GET' })

    req.log(`getPodIP(${namespace}/${pod}): status=${res.status}`)
    if (res.status !== 200) {
      return Promise.reject('Error: failed to get pod ip')
    }

    return jsonResponse(res).status.podIP
  }

  // This is usually called once upon the front-end loads, still we may want to cache it
  async function listMBeans(podIP: string): Promise<IJmxDomains> {
    req.log('==== listMBeans ====')
    const res = await req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${path}`, { method: 'POST', body: JSON.stringify({ type: 'list' }) })
    if (res.status !== 200) {
      return Promise.reject('Error: failed to get list of mbeans')
    }
    return jsonResponse(res).value as IJmxDomains
  }

  async function callJolokiaAgent(podIP: string, request: string | undefined): Promise<NginxHTTPRequest> {
    req.log('==== callJolokiaAgent ====')
    const encodedPath = encodeURI(path)
    req.log(`callJolokiaAgent: ${req.method} /proxy/${protocol}:${podIP}:${port}/${encodedPath}`)

    if (req.method === 'GET') {
      req.log('GET callJolokiaAgent')
      return await req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${encodedPath}`)

    } else {
      req.log('OTHER callJolokiaAgent')

      let method: MethodType = 'GET'
      if (isRequestMethod(req.method))
        method = req.method.toUpperCase() as MethodType

      const options: NginxSubrequestOptions = {
        body: request,
        method: method
      }

      return await req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${encodedPath}`, options)
    }
  }

  async function proxyJolokiaAgentWithoutRbac() {
    req.log('==== proxyJolokiaAgentWithoutRbac ====')
    // Only requests impersonating a user granted the `update` verb on for the pod
    // hosting the Jolokia endpoint is authorized
    const res = await selfLocalSubjectAccessReview('update')
    req.log(`proxyJolokiaAgentWithoutRbac(update): status=${res.status}`)
    if (res.status !== 201) {
      return Promise.reject(res)
    }

    const sar = jsonResponse(res)
    const allowed = useForm ? sar.status.allowed : sar.allowed
    if (!allowed) {
      return reject(403, JSON.stringify(sar))
    }

    const podIP = await getPodIP()
    req.log(`proxyJolokiaAgentWithoutRbac(podIP): podIP=${podIP}`)

    return await callJolokiaAgent(podIP, req.requestText)
  }

  async function proxyJolokiaAgentWithRbac() {
    req.log('==== proxyJolokiaAgentWithRbac ====')
    let res = await selfLocalSubjectAccessReview('update')
    req.log(`proxyJolokiaAgentWithRbac(update): status=${res.status}`)
    if (res.status !== 201) {
      return Promise.reject(res)
    }

    req.log(`proxyJolokiaAgentWithRbac(update): parsing response body`)
    req.log(`proxyJolokiaAgentWithRbac(update) response: ${res.responseText}`)

    let role = ''
    let sar = jsonResponse(res)
    let allowed = useForm ? sar.status.allowed : sar.allowed
    if (allowed) {
      req.log(`proxyJolokiaAgentWithRbac(update): allowed as admin`)
      // map the `update` verb to the `admin` role
      role = 'admin'
    }

    req.log(`proxyJolokiaAgentWithRbac(update): returning selfLocalSubjectAccessReview('get')`)
    res = await selfLocalSubjectAccessReview('get')
    req.log(`proxyJolokiaAgentWithRbac(get): status=${res.status}`)
    if (res.status !== 201) {
      return Promise.reject(res)
    }
    sar = jsonResponse(res)
    allowed = useForm ? sar.status.allowed : sar.allowed
    if (allowed && role.length === 0) {
      // map the `get` verb to the `viewer` role
      // only if not already admin
      role = 'viewer'
    }

    if (role.length === 0)
      return reject(403, JSON.stringify(sar))

    req.log('Handling Request With Role')
    const handler = await handleRequestWithRole(role)
    req.log('Completed handling request with role')
    return handler
  }

  function parseRequest(): IRequest | IRequest[] {
    req.log('==== parseRequest ====')
    if (req.method === 'POST') {
      return JSON.parse(req.requestText || '')
    }

    // GET method
    // path: ...jolokia/<type>/<arg1>/<arg2>/...
    // https://jolokia.org/reference/html/protocol.html#get-request
    req.log(`parseRequest: ${req.method} path=${path}`)
    // path is already decoded no need for decodeURIComponent()
    const match = path.split('?')[0].match(/.*jolokia\/(read|write|exec|search|list|version)\/?(.*)/) || []
    const type = match ? match[1] : 'unknown'

    let args: string[] = []

    // Jolokia-specific escaping rules (!*) are not taken care of right now
    switch (type) {
      case 'read':
        // /read/<mbean name>/<attribute name>/<inner path>
        args = match[2]?.split('/')
        return {
          type: type,
          mbean: args && args.length > 0 ? args[0] : '',
          attribute: args && args.length > 1 ? args[1] : undefined
          // inner-path not supported
        }
      case 'write':
        // /write/<mbean name>/<attribute name>/<value>/<inner path>
        args = match[2]?.split('/')
        return {
          type: type,
          mbean: args && args.length > 0 ? args[0] : '',
          attribute: args && args.length > 1 ? args[1] : '',
          value: args && args.length > 2 ? args[2] : '',
          // inner-path not supported
        }
      case 'exec':
        // /exec/<mbean name>/<operation name>/<arg1>/<arg2>/....
        args = match[2]?.split('/')
        return {
          type: type,
          mbean: args && args.length > 0 ? args[0] : '',
          operation: args && args.length > 1 ? args[1] : '',
          arguments: args && args.length > 3 ? args.slice(2) : undefined
        }
      case 'search':
        // /search/<pattern>
        return {
          type: type,
          mbean: match[2]
        }
      case 'list':
        // /list/<inner path>
        return {
          type: type,
          path: match[2]
        }
      case 'version':
        // /version
        return { type: type }
      default:
        throw `Unexpected Jolokia GET request: ${path}`
    }
  }

  async function handleRequestWithRole(role: string): Promise<NginxHTTPRequest> {
    req.log('==== handleRequestWithRole ====')
    const request = parseRequest()
    if (req.method === 'GET') {
      req.log(`handleRequestWithRole: ${req.method} request=${JSON.stringify(request)}`)
    }
    let mbeanListRequired: boolean
    if (Array.isArray(request)) {
      mbeanListRequired = request.find(r => RBAC.isMBeanListRequired(r)) ? true : false
      const podIP = await getPodIP()

      let mbeans = {}
      if (mbeanListRequired)
        mbeans = await listMBeans(podIP)

      const rbac: IRequest[] = request.map(r => RBAC.check(r, role))
      const intercept = request.filter((_, i) => rbac[i].allowed).map(r => RBAC.intercept(r, role, mbeans))
      const requestBody = JSON.stringify(intercept.filter(i => !i.intercepted).map(i => i.request))
      req.log('inside handling request with role - about to callJolokiaAgent')
      const jolokia = await callJolokiaAgent(podIP, requestBody)

      req.log('Post callJolokiaAgent')
      const body = jsonResponse(jolokia)

      req.log('Post callJolokiaAgent: ')
      req.log(body)

      // Unroll intercepted requests
      let bulk = intercept.reduce((res, rbac, i) => {
        if (rbac.intercepted) {
          res.push(rbac.response)
        } else {
          res.push(body.splice(0, 1)[0])
        }
        return res
      }, [])

      req.log('Unrolled bulk')

      // Unroll denied requests
      bulk = rbac.reduce((res, rbac, i) => {
        if (rbac.allowed) {
          res.push(bulk.splice(0, 1)[0])
        } else {
          res.push({
            request: request[i],
            status: 403,
            reason: rbac.reason,
          })
        }
        return res
      }, [])

      req.log('Unrolled denied requests')

      // Re-assembled bulk response
      const response = {
        status: jolokia.status,
        responseBody: JSON.stringify(bulk),
        headersOut: jolokia.headersOut,
      }

      req.log('Expected response: ' + response.status)
      req.log(response)

      // Override the content length that changed while re-assembling the bulk response
      response.headersOut['Content-Length'] = response.responseBody.length
      return response

    } else {
      mbeanListRequired = RBAC.isMBeanListRequired(request)
      const podIP = await getPodIP()

      req.log('Non array called podIP')

      let mbeans = {}
      if (mbeanListRequired)
        mbeans = await listMBeans(podIP)

      req.log('no mbean list required')
      const rbac = RBAC.check(request, role)
      if (!rbac.allowed) {
        return reject(403, rbac.reason)
      }
      rbac = RBAC.intercept(request, role, mbeans)
      if (rbac.intercepted) {
        return { status: rbac.response.status, responseBody: JSON.stringify(rbac.response) }
      }

      req.log('XXX callJolokiaAgent using :' + req.requestBody)
      return await callJolokiaAgent(podIP, req.requestBody)
    }
  }

  return (isRbacEnabled ? proxyJolokiaAgentWithRbac() : proxyJolokiaAgentWithoutRbac())
    .then(res => {
      req.log('=== ALL GOOD. RETURNING TO MOTHER SHIP ===')
      return response(res)
    })
    .catch(error => {
      req.log('CATCH AT FOOT OF MAIN NGINX FUNCTION')
      if (error.status) {
        req.log('Catch error at foot of main nginx function: ' + error.status)
        req.log(error)
        response(error)
      } else {
        req.log(error)
        req.return(502, `nginx jolokia gateway error: ${error.message}`)
      }
    })
}
