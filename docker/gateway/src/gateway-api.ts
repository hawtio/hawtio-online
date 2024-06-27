/* jshint node: true */
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import helmet from 'helmet'
import methodOverride from 'method-override'
import cors from 'cors'
import * as fs from 'fs'
import * as https from 'https'
import { Server } from 'http'
import { logger, expressLogger } from './logger'
import { proxyMasterGuard } from './master-guard'
import { proxyJolokiaAgent } from './jolokia-agent'
import { GatewayOptions } from './globals'

const environment = process.env.NODE_ENV || 'development'
const port = process.env.HAWTIO_ONLINE_GATEWAY_APP_PORT || 3000
const webServer = process.env.HAWTIO_ONLINE_GATEWAY_WEB_SERVER || 'http://localhost:3001'
const clusterMaster = process.env.HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER || 'https://kubernetes.default'
const sslKey = process.env.HAWTIO_ONLINE_GATEWAY_SSL_KEY || ''
const sslCertificate = process.env.HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE || ''
const sslCertificateCA = process.env.HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA || ''
let useHttps = false

if (sslCertificate.length > 0) {
  if (! fs.existsSync(sslKey)) {
    logger.error(`The ssl key assigned at "${sslKey}" does not exist`)
    process.exit(1)
  }

  if (! fs.existsSync(sslCertificate)) {
    logger.error(`The ssl certificate assigned at "${sslCertificate}" does not exist`)
    process.exit(1)
  }

  if (sslCertificateCA.length > 0 && ! fs.existsSync(sslCertificateCA)) {
    logger.error(`The ssl certificate authority assigned at "${sslCertificateCA}" does not exist`)
    process.exit(1)
  }

  useHttps = true
}

const gatewayOptions: GatewayOptions = {
  websvr: webServer,
  clusterMaster: clusterMaster
}

export const gatewayServer = express()

logger.info('**************************************')
logger.info(`* Environment:      ${environment}`)
logger.info(`* App Port:         ${port}`)
logger.info(`* Web Server:       ${gatewayOptions.websvr}`)
logger.info(`* Log Level:        ${logger.level}`)
logger.info(`* SSL Enabled:      ${sslCertificate !== ''}`)
logger.info(`* RBAC:             ${process.env['HAWTIO_ONLINE_RBAC_ACL'] || 'default'}`)
logger.info('**************************************')

// Log middleware requests
gatewayServer.use(expressLogger)

if (environment !== 'development') {
  gatewayServer.set('trust proxy', 1) // trust first proxy
}

// Heightens security providing headers
gatewayServer.use(helmet())

// Cross Origin Support
gatewayServer.use(cors())

// override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT
gatewayServer.use(methodOverride('X-HTTP-Method-Override'))

/**
 * Provide a status route for the server. Used for
 * establishing a heartbeat when installed on the cluster
 */
gatewayServer.get('/status', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({port: port, webServer: gatewayOptions.websvr})
})

/**
 * Logout endpoint that decodes the redirect_uri
 * parameter and redirects accordingly.
 */
gatewayServer.get('/logout', (req, res) => {
  let redirectUri = req.query.redirect_uri

  if (! redirectUri) {
    res.status(200).end('Acknowledge logout but nothing further to do.')
  }

  redirectUri = decodeURIComponent(redirectUri as string)
  res.status(307).redirect(redirectUri)
})

/**
 * Guard the master endpoint, narrowing its access, before
 * re-routing the request to the cluster server
 *
 * NOTE:
 * This endpoint goes directly to the kubernetes cluster
 * due to the need to support websockets. Going back to
 * the web server breaks the connection and websockets
 * fail to startup.
 */
gatewayServer.use('/master', createProxyMiddleware({
  target: `${gatewayOptions.clusterMaster}`,
  logger: logger,
  changeOrigin: false,
  ws: true,
  secure: false,
  pathFilter: (path, req) => {
    const result = proxyMasterGuard('/master' + path)
    return result.status
  },
  pathRewrite: (path, req) => {
    return path.replace('/master', '')
  }
}))

/**
 * Manages the connection to the jolokia server in app
 */
gatewayServer.route('/management/*')
  .get((req, res) => {
    proxyJolokiaAgent(req, res, gatewayOptions)
  })
  .post((express.json({type: '*/json', strict: false})), (req, res) => {
    proxyJolokiaAgent(req, res, gatewayOptions)
  })

/**
 * Default rule for anything else sent to the server
 */
gatewayServer.route('*')
  .all((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(502).json({
      message: `Error (gateway-api): Access to ${req.url} is not permitted.`
    })
  })

/*
 * Must use a wildcard for json Content-Type since jolokia
 * has request payloads with a Content-Type header value of
 * 'text/json' whereas express, by default, only uses
 * 'application/json'.
 *
 * Needs to be added last to avoid being overwritten by the proxy middleware
 */
gatewayServer.use(express.json({type: '*/json', strict: false}))

/*
 * Exports the running server for use in unit testing
 */
export let runningGatewayServer: Server
if (useHttps) {
  const gatewayHttpsServer = https.createServer({
    key: fs.readFileSync(sslKey),
    cert: fs.readFileSync(sslCertificate),
    ca: fs.readFileSync(sslCertificateCA),
  }, gatewayServer)

  runningGatewayServer = gatewayHttpsServer.listen(port, () => {
    logger.info(`HTTPS Server running on port ${port}`)
  })

} else {
  runningGatewayServer = gatewayServer.listen(port, () => {
    logger.info(`INFO: Gateway listening on port ${port}`)
  })
}
