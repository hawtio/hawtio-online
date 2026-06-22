/* jshint node: true */
import express from 'express'
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware'
import helmet from 'helmet'
import methodOverride from 'method-override'
import cors from 'cors'
import * as fs from 'fs'
import * as https from 'https'
import { Server } from 'http'
import { logger, expressLogger } from './logger'
import { proxyMasterGuard } from './master-guard'
import { maskIPAddresses } from './utils'
import { gatewayConfig } from './gateway-config'
import { proxyJolokiaAgent } from './jolokia-agent'

function checkEnvVar(envVar: string, item: string) {
  if (!envVar || envVar.length === 0) {
    logger.error(`An ${item} is required but has not been specified`)
    process.exit(1)
  }

  if (!fs.existsSync(envVar)) {
    logger.error(`The ${item} assigned at "${envVar}" does not exist`)
    process.exit(1)
  }
}

const environment = process.env.NODE_ENV || 'development'

/*
 * - Specified by default in env file
 * - Can be overriden by env var in deployment resource
 */
const port = process.env.HAWTIO_ONLINE_GATEWAY_APP_PORT || 3000

/*
 * Determined by the type of cluster gateway is running on
 * If external then needs to be specified in the .env file
 * Should be automatically determined when installed on cluster
 * by the gateway.sh entrypoint script.
 */
const isOpenShift = process.env.HAWTIO_ONLINE_GATEWAY_CLUSTER_IS_OPENSHIFT ?? 'false'
gatewayConfig.setIsOpenShiftCluster(isOpenShift.toLowerCase() === 'true')

/*
 * Whether form authentication, as opposed to oauth is used
 */
gatewayConfig.setFormAuthentication(process.env.HAWTIO_ONLINE_AUTH === 'form')

/*
 * Is masking of IP Addresses required
 */
const maskIpAddr = process.env.HAWTIO_ONLINE_MASK_IP_ADDRESSES ?? 'false'
gatewayConfig.setMaskIpAddrEnabled(maskIpAddr.toLowerCase() === 'true')

/*
 * Determine whether to apply RBAC using either a custom
 * or default file
 */
const rbacAcl = process.env.HAWTIO_ONLINE_RBAC_ACL ?? ''
if (rbacAcl.length > 0) {
  gatewayConfig.setRbacAcl(process.env.HAWTIO_ONLINE_RBAC_ACL)
}

/*
 * Determine whether the RBAC registry is enabled
 */
gatewayConfig.setRbacRegistryEnabled(process.env.HAWTIO_ONLINE_DISABLE_RBAC_REGISTRY !== 'true')

/*
 * In development when gateway is a local server rather than inside
 * the cluster address, it is important to access the jolokia pods
 * via the cluster API proxy and not their ip addresses so we need to
 * know whether external or not.
 */
const isExternal = process.env.HAWTIO_ONLINE_GATEWAY_IS_EXTERNAL || 'false'
gatewayConfig.setExternal(isExternal.toLowerCase() === 'true')

/*
 * In development when gateway is a local server rather than inside
 * the cluster address needs to be overwritten since the default will
 * not be available outside of the cluster.
 */
const clusterAddress = process.env.HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER || ''
if (clusterAddress.length > 0) {
  gatewayConfig.setClusterAddr(clusterAddress)
}

/*
 * All specified in deployment resource
 */
const sslKey = process.env.HAWTIO_ONLINE_GATEWAY_SSL_KEY || ''
const sslCertificate = process.env.HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE || ''
const sslCertificateCA = process.env.HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA || ''
let useHttps = false

if (sslCertificate.length > 0) {
  checkEnvVar(sslKey, 'SSL Certifcate Key')
  checkEnvVar(sslCertificate, 'SSL Certifcate')
  checkEnvVar(sslCertificateCA, 'SSL Certifcate Authority')
  useHttps = true
}

const sslProxyKey = process.env.HAWTIO_ONLINE_GATEWAY_SSL_PROXY_KEY || ''
const sslProxyCertificate = process.env.HAWTIO_ONLINE_GATEWAY_SSL_PROXY_CERTIFICATE || ''

if (sslProxyCertificate.length > 0) {
  checkEnvVar(sslProxyKey, 'SSL Proxy Certifcate Key')
  checkEnvVar(sslProxyCertificate, 'SSL Proxy Certifcate')
  checkEnvVar(sslCertificateCA, 'SSL Certifcate Authority')

  gatewayConfig.setProxySSLOptions({
    certCA: fs.readFileSync(sslCertificateCA),
    proxyKey: fs.readFileSync(sslProxyKey),
    proxyCert: fs.readFileSync(sslProxyCertificate),
  })
}

export const gatewayServer = express()

logger.info('********************************************************')
logger.info(`* Environment:          ${environment}`)
logger.info(`* App Port:             ${port}`)
logger.info(`* Is External:          ${gatewayConfig.isExternal()}`)
logger.info(`* Log Level:            ${logger.level}`)
logger.info(`* SSL Enabled:          ${sslCertificate !== ''}`)
logger.info(`* Proxy SSL Enabled:    ${gatewayConfig.getProxySSLOptions() !== undefined}`)
logger.info(`* Is OpenShift:         ${gatewayConfig.isOpenShiftCluster()}`)
logger.info(`* Cluster Address:      ${gatewayConfig.getClusterAddr()}`)
logger.info(`* RBAC:                 ${gatewayConfig.getRbacAcl() ?? 'default'}`)
logger.info(`* RBAC Registry:        ${gatewayConfig.isRbacRegistryEnabled()}`)
logger.info(`* Mask IP Addresses:    ${gatewayConfig.isMaskIpAddrEnabled()}`)
logger.info(`* Use Form Auth:        ${gatewayConfig.isFormAuthentication()}`)
logger.info('*********************************************************')

// Log middleware requests
gatewayServer.use(expressLogger)

/*
 * Heightens security providing headers
 *
 * - Sets X-Frame-Options: "SAMEORIGIN"
 */
gatewayServer.use(
  helmet({
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    contentSecurityPolicy: {
      directives: {
        'default-src': '"self"',
        'frame-ancestors': '"self"',
        'form-action': '"self"',
      },
    },
  }),
)

// Cross Origin Support
gatewayServer.use(
  cors({
    credentials: true,
  }),
)

// override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT
gatewayServer.use(methodOverride('X-HTTP-Method-Override'))

/**
 * Provide a status route for the server. Used for
 * establishing a heartbeat when installed on the cluster
 */
gatewayServer.route('/status').get((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({ port: port, loglevel: logger.level })
})

/**
 * Logout endpoint that decodes the redirect_uri
 * parameter and redirects accordingly.
 */
gatewayServer.get('/logout', (req, res) => {
  let redirectUri = req.query.redirect_uri

  if (!redirectUri) {
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
gatewayServer.use(
  '/master',
  createProxyMiddleware({
    // Provides a fallback or base target string
    target: `${gatewayConfig.getClusterAddr()}`,
    router: () => {
      // Evaluated dynamically at the moment of invocation!
      return gatewayConfig.getClusterAddr()
    },
    logger: logger,
    changeOrigin: false,
    ws: true,
    secure: false,
    /**
     * IMPORTANT: avoid res.end being called automatically
     **/
    selfHandleResponse: true,

    pathFilter: (path, _) => {
      const result = proxyMasterGuard('/master' + path)
      return result.status
    },

    pathRewrite: (path, _) => {
      return path.replace('/master', '')
    },

    /**
     * Intercept response
     **/
    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        const jsonStr = responseBuffer.toString('utf8')
        return maskIPAddresses(jsonStr)
      }),
    },
  }),
)

/**
 * Manages the connection to the jolokia server in app
 */
gatewayServer
  .route('/management/*')
  .get((req, res) => {
    proxyJolokiaAgent(req, res)
  })
  .post(express.json({ type: '*/json', limit: '50mb', strict: false }), (req, res) => {
    proxyJolokiaAgent(req, res)
  })

/**
 * Default rule for anything else sent to the server
 */
gatewayServer.route('*').all((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.status(502).json({
    message: `Error (gateway-api): Access to ${req.url} is not permitted.`,
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
gatewayServer.use(express.json({ type: '*/json', limit: '50mb', strict: false }))
gatewayServer.use(express.urlencoded({ extended: false }))

/*
 * Exports the running server for use in unit testing
 */
export let runningGatewayServer: Server
export const runningGatewayServerPort = port
if (useHttps) {
  const gatewayHttpsServer = https.createServer(
    {
      key: fs.readFileSync(sslKey),
      cert: fs.readFileSync(sslCertificate),
      ca: fs.readFileSync(sslCertificateCA),
      requestCert: true,
      rejectUnauthorized: false,
    },
    gatewayServer,
  )
  runningGatewayServer = gatewayHttpsServer.listen(port, () => {
    logger.info(`HTTPS Server running on port ${port}`)
  })
} else {
  runningGatewayServer = gatewayServer.listen(port, () => {
    logger.info(`INFO: Gateway listening on port ${port}`)
  })
}
