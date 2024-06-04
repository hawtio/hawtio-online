/* jshint node: true */
"use strict"

// modules =================================================
import express from 'express'
import helmet from 'helmet'
import methodOverride from 'method-override'
import cors from 'cors'
import { logger, expressLogger } from './logger'
import { proxyMasterGuard } from './master-guard'
import { proxyJolokiaAgent } from './jolokia-agent'

const environment = process.env.NODE_ENV || 'development'
const port = process.env.APP_PORT || 3000
const webPort = process.env.WEB_PORT || 3001

const gatewayOptions = {
  websvr: `http://localhost:${webPort}`
}

export const gatewayServer = express()

logger.info('**************************************')
logger.info(`* Environment:      ${environment}`)
logger.info(`* App Port:         ${port}`)
logger.info(`* Web Server:       ${gatewayOptions.websvr}`)
logger.info(`* Log Level:        ${logger.level}`)
logger.info('**************************************')

// Log middleware requests
gatewayServer.use(expressLogger)

gatewayServer.use(express.json())
gatewayServer.use(express.urlencoded())

if (environment !== 'development') {
  gatewayServer.set('trust proxy', 1) // trust first proxy
}

// Heightens security providing headers
gatewayServer.use(helmet())

// Cross Origin Support
gatewayServer.use(cors())

// override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT
gatewayServer.use(methodOverride('X-HTTP-Method-Override'))

/*
 * Get the redirect_uri query param and redirect
 */
gatewayServer.get('/logout', (req, res) => {
  let redirectUri = req.query.redirect_uri

  if (! redirectUri) {
    res.status(200).end('Acknowledge logout but nothing further to do.')
  }

  redirectUri = decodeURIComponent(redirectUri as string)
  res.status(307).redirect(redirectUri)
})

/*
 * Guard the master endpoint, narrowing its access
 */
gatewayServer.get('/master/*', (req, res) => {
  proxyMasterGuard(req, res, gatewayOptions)
})

/*
 * Manages the connection to the jolokia server in app
 */
gatewayServer.route('/management/*')
  .get((req, res) => {
    proxyJolokiaAgent(req, res, gatewayOptions)
  })
  .post((req, res) => {
    proxyJolokiaAgent(req, res, gatewayOptions)
  })

/*
 * Fallback if anything is fired at this server
 */
gatewayServer.get('*', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.status(502).json({
    message: `Error (gateway-api): Access to ${req.url} is not allowed.`
  })
})

gatewayServer.use(express.json())
gatewayServer.use(express.urlencoded())


// startup app at http://localhost:{PORT}
export const runningGatewayServer = gatewayServer.listen(port, () => {
  logger.info('INFO: Gateway listening on port ' + port)
})
