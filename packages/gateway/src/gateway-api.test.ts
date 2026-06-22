/* eslint-disable import/first */

/*
 * Tell testing node environment to allow self-signed certificates
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

/*
 * Uncomment this to enable tracing of
 * functions while running tests
 */
process.env.LOG_LEVEL = 'trace'

import request from 'supertest'
import * as fs from 'fs'
import path from 'path'
import {
  CLUSTER_HOST,
  CLUSTER_HTTPS_PORT,
  CLUSTER_HTTP_PORT,
  CLUSTER_HTTP_BASE_ADDRESS,
  CLUSTER_HTTPS_BASE_ADDRESS,
  runningHttpClusterServer,
  runningHttpsClusterServer,
  jolokiaUri,
  testData,
} from './testing'
import { gatewayConfig, SSLOptions } from './gateway-config'
import { isOptimisedCachedDomains, clearCaches } from './jolokia-agent'
import { cloneObject } from './utils'

process.env['HAWTIO_ONLINE_GATEWAY_APP_PORT'] = '11443'
process.env['HAWTIO_ONLINE_GATEWAY_SSL_KEY'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'private',
  'server.unit.test.key',
)
process.env['HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'certs',
  'server.unit.test.crt',
)
process.env['HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'CA',
  'unit.test-ca.crt',
)

// Have to have import statement come after the setting of the node property
import { gatewayServer, runningGatewayServer, runningGatewayServerPort } from './gateway-api'
import { Server } from 'http'

/*
 * Provide SSL Options as gateway is SSL only
 */
const proxySSLOptions: SSLOptions = {
  certCA: fs.readFileSync(path.resolve(__dirname, '..', 'test-tls', 'CA', 'unit.test-ca.crt')),
  proxyKey: fs.readFileSync(path.resolve(__dirname, '..', 'test-tls', 'private', 'proxy.unit.test.key')),
  proxyCert: fs.readFileSync(path.resolve(__dirname, '..', 'test-tls', 'certs', 'proxy.unit.test.crt')),
}

const clusterUseCases = [
  {
    name: 'Secure Cluster (With SSL - OpenShift)',
    cluster: {
      isOpenshift: true,
      protocol: 'https',
      port: CLUSTER_HTTPS_PORT,
      address: CLUSTER_HTTPS_BASE_ADDRESS,
    },
    proxySSLOptions: proxySSLOptions,
  },
  {
    name: 'Non-Secure Cluster (Without SSL - Vanilla Kubernetes)',
    cluster: {
      isOpenshift: false,
      protocol: 'http',
      port: CLUSTER_HTTP_PORT,
      address: CLUSTER_HTTP_BASE_ADDRESS,
    },
    proxySSLOptions: undefined,
  },
]

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

// Defined by jest env vars in .jestEnvVars.js
const defaultACLFile = `${process.env.HAWTIO_ONLINE_RBAC_ACL}`

/***********************************
 *            T E S T S
 ***********************************/
clusterUseCases.forEach(usecase => {
  describe(`Scenario: ${usecase.name}`, () => {
    beforeAll(() => {
      gatewayConfig.setClusterAddr(usecase.cluster.address)
      gatewayConfig.setProxySSLOptions(usecase.proxySSLOptions)
    })

    beforeEach(() => {
      /*
       * Override jolokia URI components so that the final
       * jolokia request is circled back to the cluster test server
       */
      testData.pod.resource.status.podIP = CLUSTER_HOST
      testData.metadata.jolokia.port = usecase.cluster.port

      // Clear the caches
      clearCaches()
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
        const redirect = `http://localhost:${runningGatewayServerPort}/status`
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
        if (rbac) {
          gatewayConfig.setRbacAcl(defaultACLFile)
        } else {
          gatewayConfig.setRbacAcl('disabled')
        }

        // Clear the caches
        clearCaches()
      })

      it(`${testAuth}: Bare path`, async () => {
        const path = '/management/'
        return appPost(path, testData.jolokia.search.request).expect(404)
      })

      it(`${testAuth}: Authorization forbidden`, async () => {
        testData.authorization.forbidden = true
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
        return appPost(path, testData.jolokia.search.request).expect(403)
      })

      it(`${testAuth}: Authorization not allowed`, async () => {
        testData.authorization.adminAllowed = false
        testData.authorization.viewerAllowed = false
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
        return appPost(path, testData.jolokia.search.request)
          .expect(403)
          .then(res => {
            expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
          })
      })

      it(`${testAuth}: Authorization Post search`, async () => {
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
        return appPost(path, testData.jolokia.search.request)
          .expect(200)
          .then(res => {
            expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.search.response))
          })
      })

      it(`${testAuth}: Authorization Post registerList`, async () => {
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
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
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
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
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
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
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
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
        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
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

        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
        return appPost(path, testData.jolokia.operationWithArgumentsAndViewerRole.request)
          .expect(expectedStatus)
          .then(res => {
            if (rbac)
              expect(res.text).toStrictEqual(
                JSON.stringify(testData.jolokia.operationWithArgumentsAndViewerRole.response),
              )
            else expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
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

        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
        return appPost(path, testData.jolokia.bulkRequestWithViewerRole.request)
          .expect(expectedStatus)
          .then(res => {
            if (rbac)
              expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.bulkRequestWithViewerRole.response))
            else expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
          })
      })

      it(`${testAuth}: Authorization Post requestOperationWithArgumentsAndNoRole`, async () => {
        // No role allowed
        testData.authorization.adminAllowed = false
        testData.authorization.viewerAllowed = false

        const expectedStatus = 403

        const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri(usecase.cluster.protocol)}`
        return appPost(path, testData.jolokia.requestOperationWithArgumentsAndNoRole.request)
          .expect(expectedStatus)
          .then(res => {
            expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
          })
      })
    })
  })
})

// Shutdown all the server on teardown
afterAll(async () => {
  const closeServer = (server: Server) => {
    return new Promise<void>(resolve => {
      server.close(() => resolve())
    })
  }

  // Await the shutdown of all three servers concurrently
  await Promise.all([
    closeServer(runningGatewayServer),
    closeServer(runningHttpClusterServer),
    closeServer(runningHttpsClusterServer),
  ])
})
