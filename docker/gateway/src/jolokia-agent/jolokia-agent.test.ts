import path from 'path'
import request from 'supertest'
import express from 'express'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express-serve-static-core'
import { JOLOKIA_PARAMS, JOLOKIA_PATH, JOLOKIA_PORT, JOLOKIA_URI, NAMESPACE, testData } from '../gateway-test-inputs'

/*
 * Uncomment this to enable tracing of
 * functions while running tests
 */
// process.env.LOG_LEVEL = 'trace'

import { expressLogger, logger } from '../logger'
import { processRBACEnvVar, proxyJolokiaAgent } from './jolokia-agent'
import { isOptimisedCachedDomains } from './globals'
import { cloneObject } from '../utils'

const app = express()

// Log middleware requests
app.use(expressLogger)
app.use(express.json())
app.use(express.urlencoded())

/******************************************
 * T E S T   A P P  /  W E B   S E R V E R
 ******************************************/

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

app.post('/authorization*/*', (req, res) => {
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

app.get('/podIP/*', (req, res) => res.status(201).json(JSON.stringify(testData.pod.resource)))

app
  .route('/proxy*')
  .get((req, res) => {
    proxyHandler(req, res)
  })
  .post((req, res) => {
    proxyHandler(req, res)
  })

/**********************
 * Test Server Routes
 **********************/

/**
 * Handler function for management route
 */
function managementHandler(req: ExpressRequest, res: ExpressResponse) {
  const host = `http://${req.header('host') || ''}`

  /*
   * Provide this test server as the redirect target
   */
  const gatewayOptions = {
    websvr: host,
    clusterMaster: host,
  }

  proxyJolokiaAgent(req, res, gatewayOptions)
}

app
  .route('/management/*')
  .get((req, res) => {
    managementHandler(req, res)
  })
  .post((req, res) => {
    managementHandler(req, res)
  })

/***********************************
 *            T E S T S
 ***********************************/
// Defined by jest env vars in .jestEnvVars.js
const defaultACLFile = `${process.env.HAWTIO_ONLINE_RBAC_ACL}`

describe('processRBACEnvVar', () => {
  it('RBAC Enabled - Default File', () => {
    expect(() => {
      const rbacEnabled = processRBACEnvVar(defaultACLFile)
      expect(rbacEnabled).toBe(true)
    }).not.toThrow()
  })

  it('RBAC Disabled', () => {
    expect(() => {
      const rbacEnabled = processRBACEnvVar(defaultACLFile, 'disabled')
      expect(rbacEnabled).toBe(false)
    }).not.toThrow()
  })

  it('RBAC Enabled - Custom File Not Found', () => {
    expect(() => {
      processRBACEnvVar(defaultACLFile, 'notFoundFilePath')
    }).toThrow('Failed to read the ACL file at notFoundFilePath')
  })

  it('RBAC Enabled - Custom File Invalid', () => {
    const invalidYamlACLPath = `${path.dirname(__filename)}/test.invalid.ACL.yaml`
    expect(() => {
      processRBACEnvVar(defaultACLFile, invalidYamlACLPath)
    }).toThrow(`Failed to parse the ACL file at ${invalidYamlACLPath}`)
  })

  it('RBAC Enabled - Custom File Valid', () => {
    const validYamlACLPath = `${path.dirname(__filename)}/test.ACL.yaml`
    expect(() => {
      const rbacEnabled = processRBACEnvVar(defaultACLFile, validYamlACLPath)
      expect(rbacEnabled).toBe(true)
    }).not.toThrow()
  })
})

function appPost(uri: string, body: Record<string, unknown> | Record<string, unknown>[]) {
  return request(app)
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
])('$title', ({ title, rbac }) => {
  const testAuth = rbac ? 'RBAC Enabled' : 'RBAC Disabled'

  beforeEach(() => {
    // Reset TestOptions
    testData.authorization.forbidden = false
    testData.authorization.adminAllowed = true
    testData.authorization.viewerAllowed = true
    if (rbac) processRBACEnvVar(defaultACLFile)
    else processRBACEnvVar(defaultACLFile, 'disabled')
  })

  it(`${testAuth}: Bare path`, async () => {
    const path = '/management/'
    return appPost(path, testData.jolokia.search.request).expect(404)
  })

  it(`${testAuth}: Authorization forbidden`, async () => {
    testData.authorization.forbidden = true
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.search.request).expect(403)
  })

  it(`${testAuth}: Authorization not allowed`, async () => {
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
    const path = `/management/namespaces/${NAMESPACE}/pods/${JOLOKIA_URI}`
    return appPost(path, testData.jolokia.search.request)
      .expect(200)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.search.response))
      })
  })

  it(`${testAuth}: Authorization Post registerList`, async () => {
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
