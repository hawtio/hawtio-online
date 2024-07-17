const express = require('express')
const proxy = require('express-http-proxy')
const pino = require('pino')
const expressPinoLogger = require('express-pino-logger')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
const expressLogger = expressPinoLogger(logger)

const app = express()
app.use(expressLogger)

const environment = process.env.NODE_ENV || 'development'
const webPort = process.env.WEB_PORT || 2772
const appPort = process.env.APP_PORT || 3000
const masterUri = process.env.CLUSTER_MASTER
const masterToken = process.env.CLUSTER_TOKEN

/* Service used to expose the jolokia port of the test app */
const testService = process.env.TEST_JOLOKIA_SERVICE || 'test-jolokia'
const testServicePort = process.env.TEST_JOLOKIA_PORT || 10001

/* The path to the jolokia service on the target test app */
let jolokiaPath = process.env.TEST_JOLOKIA_PATH || 'actuator/jolokia/?ignoreErrors=true&canonicalNaming=false'

/* Namespace determined by the /management uri entered in browser */
let namespace = 'hawtio-dev'

/* This application service URI */
const appServerUri = `http://localhost:${appPort}`

if (!masterUri) {
  console.error('The CLUSTER_MASTER environment variable must be set!')
  process.exit(1)
}

/* Defers to the app server */
app.use('/auth/logout', proxy(appServerUri, {
  proxyReqPathResolver: (srcReq) => {
    // Convert path to logout endpoint
    return '/logout'
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['location-rule'] = 'LOGOUT'
    return proxyReqOpts
  }
}))

/*
 * Defers to the app server to determine if the
 * uri is one of the permitted selection.
 *
 * 1. If permitted then it will redirect to /masterinternal
 * 2. If not permitted then it will return a 401 or 502
 */
app.use('/master', proxy(appServerUri, {
  proxyReqPathResolver: (srcReq) => {
    // Need to preserve the /master
    let uri = srcReq.url
    uri = '/master' + uri
    logger.info(`New master uri ${uri}`)
    return uri
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['location-rule'] = 'MASTER'

    // Must have this header or express body is {}
    proxyReqOpts.headers['Content-Type', 'application/json']
    return proxyReqOpts
  }
}))

/* App server returns back to proxy to the master cluster */
app.use('/masterinternal', proxy(masterUri, {
  proxyReqPathResolver: (srcReq) => {
    // Need to preserve the /master
    logger.info(`masterinternal uri ${srcReq.url}`)
    return srcReq.url
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['location-rule'] = 'MASTER-INTERNAL'
    proxyReqOpts.headers['X-Frame-Options'] = 'SAMEORIGIN'
    proxyReqOpts.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    proxyReqOpts.headers['Content-Security-Policy'] =  "default-src 'self'; frame-ancestors 'self'; form-action 'self'; "
    proxyReqOpts.headers['Authorization'] = `Bearer ${masterToken}`
    return proxyReqOpts
  }
}))

/* Defers to the app server */
app.use('/management', proxy(appServerUri, {
  proxyReqPathResolver: (srcReq) => {
    logger.info(`management proxy: ${appServerUri}`)

    // Need to preserve the /management
    let uri = srcReq.url
    uri = '/management' + uri
    logger.info(`New management uri ${uri}`)
    return uri
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['location-rule'] = 'MANAGEMENT'
    proxyReqOpts.headers['X-Frame-Options'] = 'SAMEORIGIN'
    proxyReqOpts.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    proxyReqOpts.headers['Content-Security-Policy'] =  "default-src 'self'; frame-ancestors 'self'; form-action 'self'; "
    proxyReqOpts.headers['Authorization'] = `Bearer ${masterToken}`

    // Must have this header or express body is {}
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    return proxyReqOpts
  }
}))

/* App server returns back to proxy to the master cluster */
app.use('/authorization', proxy(masterUri, {
  proxyReqPathResolver: (srcReq) => {
    // Preserve the /authorization
    let uri = '/authorization' + srcReq.url
    uri = uri.replace(/\/authorization\/([^\/]+)\/(.*)/, '/apis/$1/v1/$2')
    logger.info(`New authorization uri ${uri}`)
    return uri
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['location-rule'] = 'AUTHORIZATION'
    proxyReqOpts.headers['X-Frame-Options'] = 'SAMEORIGIN'
    proxyReqOpts.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    proxyReqOpts.headers['Content-Security-Policy'] =  "default-src 'self'; frame-ancestors 'self'; form-action 'self'; "
    proxyReqOpts.headers['Authorization'] = `Bearer ${masterToken}`
    return proxyReqOpts
  }
}))

/* App server returns back to proxy to the master cluster */
app.use('/authorization2', proxy(masterUri, {
  proxyReqPathResolver: (srcReq) => {
    // Preserve the /authorization2
    let uri = '/authorization2' + srcReq.url
    uri = uri.replace(/\/authorization\/([^\/]+)\/(.*)/, '/apis/$1/v1/$2')
    logger.info(`New authorization uri ${uri}`)
    return uri
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['location-rule'] = 'AUTHORIZATION2'
    proxyReqOpts.headers['X-Frame-Options'] = 'SAMEORIGIN'
    proxyReqOpts.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    proxyReqOpts.headers['Content-Security-Policy'] =  "default-src 'self'; frame-ancestors 'self'; form-action 'self'; "
    proxyReqOpts.headers['Authorization'] = `Bearer ${masterToken}`
    return proxyReqOpts
  }
}))

app.use('/podIP', proxy(masterUri, {
  proxyReqPathResolver: (srcReq) => {
    // Preserve the /podIP
    let uri = '/podIP' + srcReq.url

    const match = uri.match(/\/podIP\/(.+)\/(.+)/)

    // Save the namespace for use in the proxy endpoint
    namespace = match[1]

    uri = uri.replace(/\/podIP\/(.+)\/(.+)/, '/api/v1/namespaces/$1/pods/$2')
    logger.info(`New podIP uri ${uri}`)
    return uri
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['location-rule'] = 'POD-IP'
    proxyReqOpts.headers['X-Frame-Options'] = 'SAMEORIGIN'
    proxyReqOpts.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    proxyReqOpts.headers['Content-Security-Policy'] =  "default-src 'self'; frame-ancestors 'self'; form-action 'self'; "
    proxyReqOpts.headers['Authorization'] = `Bearer ${masterToken}`
    return proxyReqOpts
  }
}))

/**
 * The endpoint for directly accessing the jolokia service.
 *
 * The redirect uri is different since this dev-server is running
 * externally to the cluster AND requires the jolokia port on
 * the target app to be exposed as a service
 */
app.use('/proxy', proxy(masterUri, {
  proxyReqPathResolver: (srcReq) => {
    // Preserve the /proxy
    let uri = '/proxy' + srcReq.url
    uri = `/api/v1/namespaces/${namespace}/services/${testService}:${testServicePort}/proxy/${jolokiaPath}`
    logger.info(`New proxy uri ${uri}`)
    return uri
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['Authorization'] = `Bearer ${masterToken}`

    for (const header in proxyReqOpts.headers) {
      logger.info(`proxyReqOptDecorator - Key: ${header}, Value: ${proxyReqOpts.headers[header]}`)
    }
    return proxyReqOpts
  }
}))

/*
 * These must be declared after the use of proxy
 * (see https://github.com/villadora/express-http-proxy#middleware-mixing)
 */
app.use(express.json())
app.use(express.urlencoded())

app.listen(webPort, () => {
  logger.info(`Listening on port ${webPort}`)
})
