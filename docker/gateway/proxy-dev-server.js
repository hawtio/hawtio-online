const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const pino = require('pino')
const expressPinoLogger = require('express-pino-logger')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
const expressLogger = expressPinoLogger(logger)

const app = express()
app.use(expressLogger)

const environment = process.env.NODE_ENV || 'development'
const webPort = process.env.HAWTIO_ONLINE_GATEWAY_DEV_WEB_PORT || 2772
const appPort = process.env.HAWTIO_ONLINE_GATEWAY_APP_PORT || 3000
const masterUri = process.env.HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER
const masterToken = process.env.HAWTIO_ONLINE_GATEWAY_CLUSTER_TOKEN

/* Service used to expose the jolokia port of the test app */
const testService = process.env.TEST_JOLOKIA_SERVICE || 'test-jolokia'
const testServicePort = process.env.TEST_JOLOKIA_PORT || 10001

/* The path to the jolokia service on the target test app */
let jolokiaPath = process.env.TEST_JOLOKIA_PATH || 'actuator/jolokia/?ignoreErrors=true&canonicalNaming=false'

/* Namespace determined by the /management uri entered in browser */
let namespace = 'hawtio'

/* This application service URI */
const appServerUri = `http://localhost:${appPort}`

if (!masterUri) {
  console.error('The HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER environment variable must be set!')
  process.exit(1)
}

/* Defers to the app server */
app.use(
  '/auth/logout',
  createProxyMiddleware({
    target: appServerUri,
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    pathRewrite: (path, req) => {
      // Convert path to logout endpoint
      return '/logout'
    },
    headers: {
      'Content-Type': 'application/json',
      'location-rule': 'LOGOUT',
    },
  }),
)

/*
 * Defers to the app server to determine if the
 * uri is one of the permitted selection.
 *
 * 1. If permitted then it will redirect to /masterinternal
 * 2. If not permitted then it will return a 401 or 502
 */
app.use(
  '/master',
  createProxyMiddleware({
    target: appServerUri,
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    headers: {
      'Content-Type': 'application/json',
      'location-rule': 'MASTER',
    },
  }),
)

/* Defers to the app server */
app.use(
  '/management',
  createProxyMiddleware({
    target: appServerUri,
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    pathRewrite: (path, req) => {
      return '/management' + path
    },
    headers: {
      'Content-Type': 'application/json',
      'location-rule': 'MANAGEMENT',
      'X-Frame-Options': 'SAMEORIGIN',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ",
      Authorization: `Bearer ${masterToken}`,
    },
  }),
)

/* App server returns back to proxy to the master cluster */
app.use(
  '/authorization',
  createProxyMiddleware({
    target: masterUri,
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    pathRewrite: (path, req) => {
      let uri = '/authorization' + path
      return uri.replace(/\/authorization\/([^/]+)\/(.*)/, '/apis/$1/v1/$2')
    },
    headers: {
      'Content-Type': 'application/json',
      'location-rule': 'AUTHORIZATION',
      'X-Frame-Options': 'SAMEORIGIN',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ",
      Authorization: `Bearer ${masterToken}`,
    },
  }),
)

app.use(
  '/authorization2',
  createProxyMiddleware({
    target: masterUri,
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    pathRewrite: (path, req) => {
      let uri = '/authorization2' + path
      return uri.replace(/\/authorization2\/([^/]+)\/(.*)/, '/apis/$1/v1/$2')
    },
    headers: {
      'Content-Type': 'application/json',
      'location-rule': 'AUTHORIZATION',
      'X-Frame-Options': 'SAMEORIGIN',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ",
      Authorization: `Bearer ${masterToken}`,
    },
  }),
)

app.use(
  '/podIP',
  createProxyMiddleware({
    target: masterUri,
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    pathRewrite: (path, req) => {
      let uri = '/podIP' + path
      const match = uri.match(/\/podIP\/(.+)\/(.+)/)

      // Save the namespace for use in the proxy endpoint
      namespace = match[1]

      return uri.replace(/\/podIP\/(.+)\/(.+)/, '/api/v1/namespaces/$1/pods/$2')
    },
    headers: {
      'Content-Type': 'application/json',
      'location-rule': 'POD-IP',
      'X-Frame-Options': 'SAMEORIGIN',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ",
      Authorization: `Bearer ${masterToken}`,
    },
  }),
)

/**
 * The endpoint for directly accessing the jolokia service.
 *
 * The redirect uri is different since this dev-server is running
 * externally to the cluster AND requires the jolokia port on
 * the target app to be exposed as a service
 */
app.use(
  '/proxy',
  createProxyMiddleware({
    target: masterUri,
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    pathRewrite: (path, req) => {
      const uri = `/api/v1/namespaces/${namespace}/services/${testService}:${testServicePort}/proxy/${jolokiaPath}`
      logger.info(`New proxy uri ${uri}`)
      return uri
    },
    headers: {
      'Content-Type': 'application/json',
      'location-rule': 'POD-IP',
      'X-Frame-Options': 'SAMEORIGIN',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ",
      Authorization: `Bearer ${masterToken}`,
    },
  }),
)

/*
 * These must be declared after the use of proxy
 * (see https://github.com/villadora/express-http-proxy#middleware-mixing)
 */
app.use(express.json())

app.listen(webPort, () => {
  logger.info(`Listening on port ${webPort}`)
})
