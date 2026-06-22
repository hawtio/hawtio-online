import express from 'express'
import { Response as ExpressResponse } from 'express-serve-static-core'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import path from 'path'
import { expressLogger, logger } from '../logger'
import { testData } from './gateway-test-inputs'

/*
/******************************************
 * T E S T   C L U S T E R   S E R V E R
 ******************************************/

export const CLUSTER_HOST = 'localhost'
export const CLUSTER_HTTP_PORT = 10080
export const CLUSTER_HTTPS_PORT = 10443
export const CLUSTER_HTTP_BASE_ADDRESS = `http://${CLUSTER_HOST}:${CLUSTER_HTTP_PORT}`
export const CLUSTER_HTTPS_BASE_ADDRESS = `https://${CLUSTER_HOST}:${CLUSTER_HTTPS_PORT}`

const clusterServer = express()
clusterServer.use(expressLogger)
clusterServer.use(express.json())

function masterTestResponse(res: ExpressResponse) {
  res.status(200).json(JSON.stringify({ message: 'response from master' }))
}

/*
 * Route for getting the pod IP
 * Returns the Cluster hostname so the jolokia route can be tested
 */
clusterServer.route('/api/v1/namespaces/*/pods/*').get((req, res) => {
  res.status(201).json(JSON.stringify(testData.pod.resource))
})

/*
 * Route for getting subject access reviews
 */
clusterServer.route('/apis/authorization*').post((req, res) => {
  if (testData.authorization.forbidden) {
    res.status(403).send()
    return
  }

  if (!req.body) {
    const msg = `ERROR: No authorization body provided`
    logger.error(msg)
    res.status(502).send({ error: msg })
    return
  }

  // verb is in different places for openshift and kubernetes kinds
  const verb = req.body.verb || req.body.spec?.resourceAttributes?.verb
  if (!verb) {
    const msg = `ERROR: No authorization verb provided in authorization body`
    logger.error(msg)
    res.status(502).send({ error: msg })
    return
  }

  // Determine the platform based on the incoming API Version payload
  const apiVersion = req.body.apiVersion || ''
  let cluster = 'kubernetes'
  if (apiVersion.includes('openshift.io')) {
    cluster = 'openshift'
  }
  const clusterKey = cluster as 'openshift' | 'kubernetes'

  switch (verb) {
    case 'get':
      if (testData.authorization.viewerAllowed)
        res.status(200).json(JSON.stringify(testData.authorization[clusterKey].allowedResponse))
      else res.status(200).json(JSON.stringify(testData.authorization[clusterKey].notAllowedResponse))

      return
    case 'update':
      if (testData.authorization.adminAllowed)
        res.status(200).json(JSON.stringify(testData.authorization[clusterKey].allowedResponse))
      else res.status(200).json(JSON.stringify(testData.authorization[clusterKey].notAllowedResponse))

      return
  }

  const msg = 'ERROR: Failure part reached in authorization response'
  logger.error(msg)
  res.status(502).send({ error: msg })
})

/*
 * Direct the jolokia path back to this cluster
 * In reality, it would point to the real ip address of the pod
 * Will handle both jolokia urls where proxy/podname or pod ip is used.
 */
clusterServer.route(`*${testData.metadata.jolokia.path}*`).all((req, res) => {
  const reqPayload = JSON.stringify(req.body)

  if (req.method === 'GET') {
    // TODO handle when dealing with jolokia get requests
    res.status(502).send('Test not implemented')
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
})

/*
 * Route for getting testing api endpoints in masterguard tests
 */
clusterServer.route('/api/*').get((req, res) => {
  masterTestResponse(res)
})

/*
 * Route for getting testing apis endpoints in masterguard tests
 */
clusterServer.route('/apis/*').get((req, res) => {
  masterTestResponse(res)
})

/*
 * Route for getting testing oauth endpoint in masterguard tests
 */
clusterServer.route('/.well-known/*').get((req, res) => {
  masterTestResponse(res)
})

/*
 * Non-Secure Server Infrastructure Configuration
 */
const clusterHttpServer = http.createServer(clusterServer)

/*
 * Cluster will always be HTTPS
 * so add the keys and certificates
 */
const clusterHttpsServer = https.createServer(
  {
    ca: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'CA', 'unit.test-ca.crt')),
    key: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'private', 'server.unit.test.key')),
    cert: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'certs', 'server.unit.test.crt')),
    requestCert: true,
    rejectUnauthorized: false,
  },
  clusterServer,
)

/*
 * Start the cluster server listening ready for the tests
 */
export const runningHttpClusterServer = clusterHttpServer.listen(CLUSTER_HTTP_PORT, () => {
  logger.info(`INFO: Test cluster server listening on port ${CLUSTER_HTTP_PORT}`)
})

/*
 * Start the cluster server listening ready for the tests
 */
export const runningHttpsClusterServer = clusterHttpsServer.listen(CLUSTER_HTTPS_PORT, () => {
  logger.info(`INFO: Test cluster server listening on port ${CLUSTER_HTTPS_PORT}`)
})
