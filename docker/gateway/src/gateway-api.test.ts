import request from 'supertest'
import express from 'express'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express-serve-static-core'
import { enableRbac, isOptimisedCachedDomains } from './jolokia-agent'
import { expressLogger, logger } from './logger'
import { cloneObject } from './utils'
import { JOLOKIA_PARAMS, JOLOKIA_PATH, JOLOKIA_PORT, JOLOKIA_URI, NAMESPACE, testData } from './gateway-test-inputs'

/*
 * Port used for test web server
 */
const WEB_PORT = 3001

/*
 * Specify the cluster master before importing gateway-api
 */
process.env.HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER = `http://localhost:${WEB_PORT}/master`

// Have to have import statement come after the setting of the node property
// eslint-disable-next-line
import { gatewayServer, runningGatewayServer } from './gateway-api'

/******************************************
 * T E S T   W E B   S E R V E R
 ******************************************/

export const testWebServer = express()

// Log middleware requests
testWebServer.use(expressLogger)
testWebServer.use(express.json())

// startup testWebServer at http://localhost:{WEB_PORT}
export const runningTestWebServer = testWebServer.listen(WEB_PORT, () => {
  logger.info(`INFO: Test web server listening on port ${WEB_PORT}`)
})

/**
 * Handler function for proxy route
 */
function proxyHandler(req: ExpressRequest, res: ExpressResponse) {
  const parts = req.url.match(/^\/proxy\/(http|https):(.+):(\d+)\/(.*)$/)
  if (!parts || parts.length < 5) {
    logger.error('Not enough jolokia URI parts')
    res.status(502).send()
    return
  }

  if (parts[1] !== 'http') {
    logger.error(`Expected http got ${parts[1]}`)
    res.status(502).send()
    return
  }

  if (parts[2] !== testData.pod.resource.status.podIP) {
    logger.error(`Expected ${testData.pod.resource.status.podIP} got ${parts[2]}`)
    res.status(502).send()
    return
  }

  if (parts[3] !== `${JOLOKIA_PORT}`) {
    logger.error(`Expected ${JOLOKIA_PORT} got ${parts[3]}`)
    res.status(502).send()
    return
  }

  if (`/${parts[4]}` !== `${JOLOKIA_PATH}/?${JOLOKIA_PARAMS}`) {
    logger.error(`Expected ${JOLOKIA_PATH}/?${JOLOKIA_PARAMS} got /${parts[4]}`)
    res.status(502).send()
    return
  }

  const reqPayload = JSON.stringify(req.body)

  if (req.method === 'GET') {
    // TODO handle when dealing with jolokia get requests
  } else if (req.method === 'POST') {
    let k: keyof typeof testData.jolokia
    for (k in testData.jolokia) {
      const td = testData.jolokia[k]

      // Test if payload matches the initial test data request
      if (reqPayload === JSON.stringify(td.request)) {
        res.status(200).send(td.response)
        return
      }

      if (Object.hasOwn(td, 'intercepted') && reqPayload === JSON.stringify(td.intercepted.request)) {
        res.status(200).send(td.intercepted.response)
        return
      }
    }

    const msg = `ERROR: Proxy request body not expected: (${JSON.stringify(req.body)})`
    logger.error(msg)
    res.status(502).send(msg)
    return
  }

  // Invalid method called
  const msg = `ERROR: Proxy Handler request method not recognized: ${req.method}`
  logger.error(msg)
  res.status(502).send({ error: msg })
}

testWebServer.get('/master/*', (req, res) => {
  res.set('Content-Type', 'application/json')
  res.status(200).json(JSON.stringify({ message: 'response from master' }))
})

testWebServer.post('/authorization*/*', (req, res) => {
  if (testData.authorization.forbidden) {
    res.status(403).send()
    return
  }

  if (!req.body || !req.body.verb) {
    const msg = `ERROR: No authorization body or no verb provided in authorization body`
    logger.error(msg)
    res.status(502).send({ error: msg })
    return
  }

  switch (req.body.verb) {
    case 'get':
      if (testData.authorization.viewerAllowed)
        res.status(200).json(JSON.stringify(testData.authorization.allowedResponse))
      else res.status(200).json(JSON.stringify(testData.authorization.notAllowedResponse))

      return
    case 'update':
      if (testData.authorization.adminAllowed)
        res.status(200).json(JSON.stringify(testData.authorization.allowedResponse))
      else res.status(200).json(JSON.stringify(testData.authorization.notAllowedResponse))

      return
  }

  const msg = 'ERROR: Failure part reached in authorization response'
  logger.error(msg)
  res.status(502).send({ error: msg })
})

testWebServer.get('/podIP/*', (req, res) => res.status(201).json(JSON.stringify(testData.pod.resource)))

testWebServer
  .route('/proxy*')
  .get((req, res) => {
    proxyHandler(req, res)
  })
  .post((req, res) => {
    proxyHandler(req, res)
  })

/***********************************
 *            T E S T S
 ***********************************/

afterAll(done => {
  let total = 0

  runningGatewayServer.addListener('close', function () {
    if (total < 1) ++total
    else done()
  })
  runningGatewayServer.close()

  runningTestWebServer.addListener('close', function () {
    if (total < 1) ++total
    else done()
  })
  runningTestWebServer.close()
})

beforeEach(() => {
  // Reset TestOptions
  testData.authorization.forbidden = false
  testData.authorization.adminAllowed = true
  testData.authorization.viewerAllowed = true
  enableRbac(true)
})

describe('/logout', () => {
  it('logout with no redirect', async () => {
    return request(gatewayServer)
      .get('/logout')
      .expect(200)
      .then(res => {
        const msg = `Acknowledge logout but nothing further to do.`
        expect(res.text).toBe(msg)
      })
  })

  it('logout with redirect', async () => {
    const redirect = `http://localhost:${WEB_PORT}/online`
    return request(gatewayServer)
      .get(`/logout?redirect_uri=${encodeURIComponent(redirect)}`)
      .expect(302)
      .then(res => {
        const redirected = res.get('location')
        expect(redirected).toBe(redirect)
      })
  })
})

describe('/master', () => {
  it('deny unapproved endpoints', async () => {
    const path = '/master/notapplicable'
    return request(gatewayServer)
      .get(path)
      .expect(502)
      .then(res => {
        const msg = `Error (gateway-api): Access to ${path} is not permitted.`
        expect(res.body.message).toBe(msg)
      })
  })

  const endpointPaths = [
    { path: '/master/.well-known/oauth-authorization-server' },
    { path: '/master/apis/apps.openshift.io/v1' },
    { path: '/master/apis/user.openshift.io/v1/users/~' },
    { path: '/master/apis/project.openshift.io/v1/projects/hawtio-dev' },
    { path: '/master/api/' },
    { path: '/master/api/v1/namespaces/hawtio-dev' },
    { path: '/master/api/v1/namespaces/hawtio-dev/pods?watch' },
    { path: '/master/api/v1/namespaces/openshift-config-managed/configmaps/console-public' },
  ]

  it.each(endpointPaths)('redirect to test master $path', async ({ path }) => {
    return request(gatewayServer)
      .get(path)
      .expect(200)
      .then(res => {
        const msg = `response from master`

        const json = JSON.parse(res.body)
        expect(json.message).toBe(msg)
      })
  })
})

function appPost(uri: string, body: Record<string, unknown> | Record<string, unknown>[]) {
  return request(gatewayServer)
    .post(uri)
    .send(JSON.stringify(body))
    .set('location-rule', 'MANAGEMENT')
    .set('X-Frame-Options', 'SAMEORIGIN')
    .set('Content-Type', 'application/json')
    .set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    .set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ")
}

describe.each([
  { title: 'proxyJolokiaAgentWithoutRbac', rbac: false },
  { title: 'proxyJolokiaAgentWithRbac', rbac: true },
  // eslint-disable-next-line
])('$title', ({ title, rbac }) => {
  const testAuth = rbac ? 'RBAC Enabled' : 'RBAC Disabled'

  it(`${testAuth}: Bare path`, async () => {
    enableRbac(rbac)
    const path = '/management/'
    return appPost(path, testData.jolokia.search.request).expect(404)
  })

  it(`${testAuth}: Authorization forbidden`, async () => {
    enableRbac(rbac)
    testData.authorization.forbidden = true
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.search.request).expect(403)
  })

  it(`${testAuth}: Authorization not allowed`, async () => {
    enableRbac(rbac)
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = false
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.search.request)
      .expect(403)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.notAllowedResponse))
      })
  })

  it(`${testAuth}: Authorization Post search`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.search.request)
      .expect(200)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.search.response))
      })
  })

  it(`${testAuth}: Authorization Post registerList`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.registerList.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = testData.jolokia.registerList.response

        expect(received.request).toStrictEqual(expected.request)

        if (rbac) {
          expect(isOptimisedCachedDomains(received.value)).toBe(true)
          const expDomains = Object.getOwnPropertyNames(expected.value.domains)
          const recDomains = Object.getOwnPropertyNames(received.value.domains)
          expect(expDomains.length).toEqual(recDomains.length)
        } else {
          // No RBAC then there is no interception or optimisation
          expect(expected.value.domains).toEqual(expected.value.domains)
        }
      })
  })

  it(`${testAuth}: Authorization Post canInvokeMap`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.canInvokeMap.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.canInvokeMap.response)

        // Neutralise the timestamps as they are always going to be different
        received.timestamp = 0
        expected.timestamp = 0

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post canInvokeSingleAttribute`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.canInvokeSingleAttribute.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.canInvokeSingleAttribute.response)

        // Neutralise the timestamps as they are always going to be different
        received.timestamp = 0
        expected.timestamp = 0

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post canInvokeSingleOperation`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.canInvokeSingleOperation.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.canInvokeSingleOperation.response)

        // Neutralise the timestamps as they are always going to be different
        received.timestamp = 0
        expected.timestamp = 0

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post bulkRequestWithInterception`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.bulkRequestWithInterception.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.bulkRequestWithInterception.response)

        // Neutralise the timestamps as they are always going to be different
        received.forEach((r: Record<string, unknown>) => (r.timestamp = 0))
        expected.forEach((r: Record<string, unknown>) => (r.timestamp = 0))

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post operationWithArgumentsAndViewerRoleOnly`, async () => {
    // RBAC enabled depending on test suite
    enableRbac(rbac)

    // Only viewer role allowed
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = true

    //
    // WithRBAC: the 'viewer' role is not allowed for this operation
    // WithoutRBAC: the 'viewer' role is not high enough for ANY request
    //
    const expectedStatus = 403

    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.operationWithArgumentsAndViewerRole.request)
      .expect(expectedStatus)
      .then(res => {
        if (rbac)
          expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.operationWithArgumentsAndViewerRole.response))
        else expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.notAllowedResponse))
      })
  })

  it(`${testAuth}: Authorization Post bulkRequestWithViewerRole`, async () => {
    enableRbac(rbac)

    // Only viewer role allowed
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = true

    //
    // WithoutRBAC: the 'viewer' role is not high enough for ANY request
    //
    const expectedStatus = rbac ? 200 : 403

    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.bulkRequestWithViewerRole.request)
      .expect(expectedStatus)
      .then(res => {
        if (rbac) expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.bulkRequestWithViewerRole.response))
        else expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.notAllowedResponse))
      })
  })

  it(`${testAuth}: Authorization Post requestOperationWithArgumentsAndNoRole`, async () => {
    // RBAC enabled depending on test suite
    enableRbac(rbac)

    // No role allowed
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = false

    const expectedStatus = 403

    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.requestOperationWithArgumentsAndNoRole.request)
      .expect(expectedStatus)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.notAllowedResponse))
      })
  })
})
