const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const pino = require('pino')
const pinoHttpLogger = require('pino-http')

const level = process.env.LOG_LEVEL || 'info'

const logger = pino({ level: level })
const expressLogger = pinoHttpLogger({ logger: logger })

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

/*
 * These must be declared after the use of proxy
 * (see https://github.com/villadora/express-http-proxy#middleware-mixing)
 */
app.use(express.json())

app.listen(webPort, () => {
  logger.info(`Listening on port ${webPort}`)
})
