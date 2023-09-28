// http://nginx.org/en/docs/njs
// https://github.com/nginx/njs
// https://github.com/xeioex/njs-examples

import jsyaml from 'js-yaml'
import jwt_decode from 'jwt-decode'
import { IJmxDomains, IRequest } from 'jolokia.js'
import * as RBAC from './rbac'
import { ACLCheck, isRequestMethod, MethodType, InterceptedResponse, isObject, isString } from './globals'
import fs from 'fs'

RBAC.initACL(jsyaml.load(fs.readFileSync(process.env['HAWTIO_ONLINE_RBAC_ACL'] || 'ACL.yaml', 'utf8')))

const isRbacEnabled = typeof process.env['HAWTIO_ONLINE_RBAC_ACL'] !== 'undefined'
const useForm = process.env['HAWTIO_ONLINE_AUTH'] === 'form'

/*
 * Change: [response|request]Body -> [response|request]Text
 * The property was made obsolete in 0.5.0 and was removed in 0.8.0.
 * The r.responseBuffer or the r.responseText property should be used instead.
 */

 interface SimpleResponse {
  status: number,
  responseText: string,
  headersOut: Record<string, string | string[] | undefined>
 }

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

  function jsonResponse(res: NginxHTTPRequest | SimpleResponse): Record<string, unknown> {
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

  function response(res: SimpleResponse) {
    req.log('==== response ====')
    req.log(`PGR1 response: res=${JSON.stringify(res)}`)

    if (res.headersOut && Array.isArray(res.headersOut)) {
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
      responseText: message,
      headersOut: {
        'Content-Type': 'application/json',
      }
    })
  }

  function getSubjectFromJwt(): string {
    req.log('==== getSubjectFromJwt ====')
    const authz = req.headersIn['Authorization']
    if (!authz) {
      req.error('Authorization header not found in request')
      return ''
    }
    const token = authz.split(' ')[1]
    const payload = jwt_decode<Record<string, unknown>>(token)
    return payload.sub as string
  }

  async function selfLocalSubjectAccessReview(verb: string): Promise<SimpleResponse> {
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

    const res = await req.subrequest(`/authorization${suffix}/${api}/namespaces/${namespace}/localsubjectaccessreviews`, {
      method: 'POST',
      body: json
    })
    req.log(`Result of sub request: ${JSON.stringify(res)} - object? ${isObject(res)}`)

    return {
      status: res.status,
      responseText: res.responseText || '',
      headersOut: res.headersOut
    }
  }

  async function getPodIP(): Promise<string> {
    req.log('==== getPodIP ====')

    const res = await req.subrequest(`/podIP/${namespace}/${pod}`, { method: 'GET' })

    req.log(`getPodIP(${namespace}/${pod}): res=${JSON.stringify(res)}`)
    if (res.status !== 200) {
      return Promise.reject('Error: failed to get pod ip')
    }

    const response = jsonResponse(res)
    if (response.status && isObject(response.status)) {
      const statusObj = response.status as Record<string, string>
      return statusObj.podIP
    }

    return Promise.reject('Error: failed to attain pod ip in response')
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

  async function callJolokiaAgent(podIP: string, request: string | undefined): Promise<SimpleResponse> {
    req.log('==== callJolokiaAgent ====')
    const encodedPath = encodeURI(path)
    req.log(`callJolokiaAgent: ${req.method} /proxy/${protocol}:${podIP}:${port}/${encodedPath}`)

    if (req.method === 'GET') {
      req.log('GET callJolokiaAgent')
      const res = await req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${encodedPath}`)
      return {
        status: res.status,
        responseText: res.responseText || '',
        headersOut: res.headersOut
      }

    } else {
      req.log('OTHER callJolokiaAgent')

      let method: MethodType = 'GET'
      if (isRequestMethod(req.method))
        method = req.method.toUpperCase() as MethodType

      const options: NginxSubrequestOptions = {
        body: request,
        method: method
      }

      const res = await req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${encodedPath}`, options)
      return {
        status: res.status,
        responseText: res.responseText || '',
        headersOut: res.headersOut
      }
    }
  }

  function isAllowed(res: SimpleResponse): boolean {
    const body = jsonResponse(res)

    if (useForm && isObject(body.status)) {
      return (body.status as Record<string, unknown>).allowed as boolean
    } else {
      return body.allowed as boolean
    }
  }

  async function proxyJolokiaAgentWithoutRbac(): Promise<SimpleResponse> {
    req.log('==== proxyJolokiaAgentWithoutRbac ====')
    // Only requests impersonating a user granted the `update` verb on for the pod
    // hosting the Jolokia endpoint is authorized
    const res = await selfLocalSubjectAccessReview('update')
    req.log(`proxyJolokiaAgentWithoutRbac(update): res=${JSON.stringify(res)}`)
    if (res.status !== 201) {
      return Promise.reject(res)
    }

    if (!isAllowed(res)) {
      return reject(403, JSON.stringify(res))
    }

    const podIP = await getPodIP()
    req.log(`proxyJolokiaAgentWithoutRbac(podIP): podIP=${podIP}`)

    return await callJolokiaAgent(podIP, req.requestText)
  }

  async function proxyJolokiaAgentWithRbac(): Promise<SimpleResponse> {
    req.log('==== proxyJolokiaAgentWithRbac ====')
    let res = await selfLocalSubjectAccessReview('update')
    req.log(`proxyJolokiaAgentWithRbac(update): res=${JSON.stringify(res)}`)
    if (res.status !== 201) {
      return Promise.reject(res)
    }

    req.log(`proxyJolokiaAgentWithRbac(update): parsing response body`)
    req.log(`proxyJolokiaAgentWithRbac(update) response: ${res.responseText}`)

    let role = ''

    if (isAllowed(res)) {
      req.log(`proxyJolokiaAgentWithRbac(update): allowed as admin`)
      // map the `update` verb to the `admin` role
      role = 'admin'
    }

    req.log(`proxyJolokiaAgentWithRbac(update): returning selfLocalSubjectAccessReview('get')`)
    res = await selfLocalSubjectAccessReview('get')
    req.log(`proxyJolokiaAgentWithRbac(get): res=${JSON.stringify(res)}`)
    if (res.status !== 201) {
      return Promise.reject(res)
    }

    if (isAllowed(res) && role.length === 0) {
      // map the `get` verb to the `viewer` role
      // only if not already admin
      role = 'viewer'
    }

    if (role.length === 0)
      return reject(403, JSON.stringify(res))

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
    req.log(`parseRequest: ${req.method || 'GET'} path=${path}`)
    // path is already decoded no need for decodeURIComponent()
    const match = path.split('?')[0].match(/.*jolokia\/(read|write|exec|search|list|version)\/?(.*)/) || []
    const type = match ? match[1] : 'unknown'
    req.log(`Type of jolokia request: ${type}`)

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
        let msg = `Unexpected Jolokia GET request.`
        if (type) {
          msg = `${msg} Type is determined as ${type} and not handled.`
        } else {
          msg = `${msg} Type has not been defined on the path, eg. .../jolokia/read.`
        }

        if (req.requestText && req.requestText.length > 0) {
          msg = `${msg} This GET request is using a request body. Such requests should use the path instead. If the body is preferred then change to a POST request.`
        }
        throw new Error(msg)
    }
  }

  async function handleRequestWithRole(role: string): Promise<SimpleResponse> {
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

      const rbacChecks: ACLCheck[] = request.map(r => RBAC.check(r, role))
      const intercept = request.filter((_, i) => rbacChecks[i].allowed).map(r => RBAC.intercept(r, role, mbeans))
      const requestBody = JSON.stringify(intercept.filter(i => !i.intercepted).map(i => i.request))
      req.log('inside handling request with role - about to callJolokiaAgent')
      const body = await callJolokiaAgent(podIP, requestBody)

      req.log(`Post callJolokiaAgent: ${JSON.stringify(body)}`)

      // Unroll intercepted requests
      let initial: InterceptedResponse[] = []
      let bulk = intercept.reduce((res, rbac) => {
        if (rbac.intercepted && rbac.response) {
          res.push(rbac.response)
        } else {
          // TODO
          req.log("ERROR ERROR ERROR NEED TO FIX")
          // res.push(body.splice(0, 1)[0])
        }
        return res
      }, initial)

      req.log('Unrolled bulk')

      // Unroll denied requests
      initial = []
      bulk = rbacChecks.reduce((res, rbac, i) => {
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
      }, initial)

      req.log('Unrolled denied requests')

      // Re-assembled bulk response
      const response = {
        status: body.status,
        responseText: JSON.stringify(bulk),
        headersOut: body.headersOut as Record<string, string>,
      }

      req.log('Expected response: status => ' + response.status + ' reponseBody => ' + response.responseText)

      // Override the content length that changed while re-assembling the bulk response
      response.headersOut['Content-Length'] = `${response.responseText.length}`
      return response

    } else {
      mbeanListRequired = RBAC.isMBeanListRequired(request)
      const podIP = await getPodIP()

      req.log('Non array called podIP')

      let mbeans = {}
      if (mbeanListRequired)
        mbeans = await listMBeans(podIP)

      req.log('no mbean list required')
      const rbacCheck = RBAC.check(request, role)
      if (!rbacCheck.allowed) {
        return reject(403, rbacCheck.reason)
      }

      const rbacIntercept = RBAC.intercept(request, role, mbeans)
      if (rbacIntercept.intercepted) {
        if (! rbacIntercept.response)
          return reject(502, 'No response from rbac interception')

        return {
          status: rbacIntercept.response?.status,
          responseText: JSON.stringify(rbacIntercept.response),
          headersOut: req.headersOut
        }
      }

      req.log('XXX callJolokiaAgent using :' + req.requestText)
      return await callJolokiaAgent(podIP, req.requestText)
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
        response(error)
        return
      }

      let msg = 'NGINX jolokia gateway error:'
      if (error.message) {
        msg = `${msg}\n\t${error.message}`
      } else if (isObject(error)) {
        msg = `${msg}\n\t${JSON.stringify(error)}`
      } else {
        msg = `${msg}\n\t${error}`
      }
      req.return(502, msg)
    })
}
