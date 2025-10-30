const webpack = require('webpack')
const { merge } = require('webpack-merge')
const WebpackDevServer = require('webpack-dev-server')
const DotenvPlugin = require('dotenv-webpack')
const historyApiFallback = require('connect-history-api-fallback')
const path = require('path')
const url = require('url')
const dotenv = require('dotenv')
const express = require('express')
const { common } = require('./webpack.config.common.js')

// this will update the process.env with environment variables in .env file
dotenv.config({ path: path.join(__dirname, '.env') })

module.exports = (env, argv) => {
  const masterKind = process.env.MASTER_KIND || 'kubernetes'
  const clusterAuthType = process.env.CLUSTER_AUTH_TYPE || 'oauth'

  const master_uri = process.env.CLUSTER_MASTER
  if (!master_uri) {
    console.error('The CLUSTER_MASTER environment variable must be set!')
    process.exit(1)
  }

  const namespace = process.env.CLUSTER_NAMESPACE || 'hawtio-dev'
  const mode = process.env.HAWTIO_MODE || 'cluster'
  const clientId = process.env.OAUTH_CLIENT_ID
  if (!clientId) {
    console.error('The OAUTH_CLIENT_ID must be set!')
    process.exit(1)
  }

  //
  // No support for the dev server providing a default router prefix
  // so need to specify here.
  //
  // If this is to be changed then also need to change the same value
  // in the public/hawtconfig.json file
  //
  const publicPath = '/online'

  const clusterAuthFormUri = process.env.CLUSTER_AUTH_FORM || `${publicPath}/login`
  if (clusterAuthFormUri) console.log('Using Cluster Auth Form URL:', clusterAuthFormUri)

  const gatewayServerHost = process.env.HAWTIO_GATEWAY_SERVER || ''
  if (gatewayServerHost.length === 0) {
    console.log('Using webpack dev server for gateway operations')
  } else {
    console.log(`Redirecting gateway operations to ${gatewayServerHost}`)
  }

  console.log('Using Cluster URL:', master_uri)
  console.log('Using Master Kind:', masterKind)
  console.log('Using Cluster Namespace:', namespace)
  console.log('Using Hawtio Cluster Mode:', mode)
  console.log('USing OAuth Client Id:', clientId)

  const kubeBase = master_uri
  const kube = new URL(kubeBase)
  const devPort = process.env.PORT || 2772
  const proxiedMaster = `http://localhost:${devPort}/master`

  return merge(common('development', publicPath, env.PACKAGE_VERSION), {
    devtool: 'eval-source-map',
    stats: 'errors-warnings',

    plugins: [
      new DotenvPlugin({
        safe: true,
        allowEmptyValues: true,
        defaults: true,
        systemvars: true,
        ignoreStub: true,
      }),
    ],

    devServer: {
      compress: true,
      liveReload: true,
      port: devPort,

      /*
       * Proxy to bring the cluster into the app as a redirect.
       * Avoids issues with CORS
       * Note: target must be up and connectable. Otherwise an error is
       *       thrown by the proxy but with an incorrect error message with
       *       the original host address in it rather than the target
       */
      proxy: [
        {
          context: ['/master'],
          target: master_uri,
          pathRewrite: { '^/master': '' },
          secure: false,
          ws: true,
          onProxyRes: (proxyRes, req, res) => {
            if (proxyRes.statusCode === 401) {
              /*
               * When both the 401 status code and the www-authenticate error are encountered
               * Chrome (un)helpfully displays a pop-up login dialog. We want to disable that
               * since it interferes with the probing of the jolokia connections
               */
              console.log('Unauthorized Error detected: removing www-authenticate header')
              delete proxyRes.headers['www-authenticate']
            }
          },
        },
      ],

      static: {
        publicPath: publicPath,
        directory: path.join(__dirname, 'public'),
      },

      historyApiFallback: {
        disableDotRule: true,
        index: publicPath,
      },

      /*
       * Vital for binding the react app to the desired url path
       */
      devMiddleware: {
        publicPath: publicPath,
      },

      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined')
        }

        /*
         * Ensure that dev server properly handles json in request body
         * Important to keep a high limit as the default of 100kb can be
         * exceeded by request bodies resulting in the parser transmitting
         * an empty body.
         */
        devServer.app.use(express.json({ type: '*/json', limit: '50mb', strict: false }))
        devServer.app.use(express.urlencoded({ extended: false }))

        // Redirect / or /${publicPath} to /${publicPath}/
        devServer.app.get('/', (_, res) => res.redirect(`${publicPath}/`))
        devServer.app.get(`/${publicPath}$`, (_, res) => res.redirect(`${publicPath}/`))

        /*
         * Function to construct the config.json file
         * and make it available for authentication
         */
        const osconsole = (_, res) => {
          const oscConfig = {
            master_uri: proxiedMaster,
            master_kind: masterKind,
            hawtio: {
              mode: mode,
            },
          }

          if (clusterAuthType === 'form') {
            oscConfig.form = {
              uri: clusterAuthFormUri,
            }
          }

          /*
           * In cluster mode, the oauth_client_id *must* be the same as
           * the name of an OAuthClient resource added to the cluster, eg.
           *
           * apiVersion: oauth.openshift.io/v1
           * grantMethod: auto
           * kind: OAuthClient
           * metadata:
           *   annotations:
           *     kubectl.kubernetes.io/last-applied-configuration: |
           *       {"apiVersion":"oauth.openshift.io/v1","grantMethod":"auto","kind":"OAuthClient","metadata":{"annotations":{},"name":"hawtio-online-dev"},"redirectURIs":["http://localhost:2772","http://localhost:2772/online","http://localhost:8080"]}
           *   name: hawtio-online-dev
           * redirectURIs:
           * - http://localhost:2772
           * - http://localhost:2772/online
           * - http://localhost:8080
           */
          switch (mode) {
            case 'namespace':
              oscConfig.hawtio.namespace = namespace
              if (!oscConfig.form) {
                oscConfig.openshift = {
                  oauth_metadata_uri: `${proxiedMaster}/.well-known/oauth-authorization-server`,
                  oauth_client_id: clientId,
                  scope: `user:info user:check-access role:edit:${namespace}`,
                  cluster_version: '4.11.0',
                }
              }
              break
            case 'cluster':
              if (!oscConfig.form) {
                oscConfig.openshift = {
                  oauth_metadata_uri: `${proxiedMaster}/.well-known/oauth-authorization-server`,
                  oauth_client_id: clientId,
                  scope: `user:info user:check-access user:full`,
                  cluster_version: '4.11.0',
                }
              }
              break
            default:
              console.error('Invalid value for the Hawtio Online mode, must be one of [cluster, namespace]')
              process.exit(1)
          }

          res.set('Content-Type', 'application/javascript')
          res.send(JSON.stringify(oscConfig))
        }

        /*
         * Create header array for use with the external server requests
         */
        const createHeaders = request => {
          /*
           * Ensure the authorization token is included
           */
          return new Headers({
            Authorization: request.get('Authorization'),
            'Content-Type': 'application/json',
            Accept: 'application/json',
          })
        }

        /*
         * Build the options for a fetch function call
         */
        const buildConfig = (method, headers, body) => {
          const config = {
            method: method,
            headers: headers,
          }

          if ((method === 'POST' || method === 'PUT') && body) {
            config.body = JSON.stringify(body)
          }

          return config
        }

        /*
         * Analyse a response object and return it as
         * json. Failing that return as text
         */
        const handleResponse = async (response, fnName) => {
          if (!response.ok) {
            console.log(`Error (dev-server): ${fnName} response not ok`, await response.text())
            return { status: response.status, body: response.statusText }
          } else {
            var data
            try {
              data = await response.clone().json()
            } catch (error) {
              console.error(`Error (dev-server): ${fnName} error response from master: `, error)
              data = await response.text()
            }

            return { status: response.status, body: data }
          }
        }

        /*
         * See this server is not inside the cluster then we cannot access
         * the target pod by its ip as in
         * http://localhost:2772/proxy/http:10.217.0.139:8778/jolokia.
         * Therefore in this dev server we need to find the pod by its ip
         * and access it by its namespace and name through the cluster api
         */
        const findPodByIp = async (podIp, headers) => {
          // Use a fieldSelector to make the query highly efficient
          const podListUrl = `${master_uri}/api/v1/pods?fieldSelector=status.podIP=${podIp}`

          try {
            const response = await fetch(podListUrl, { headers: headers })
            if (!response.ok) {
              console.error(`API error finding pod by IP ${podIp}:`, response.statusText)
              return null
            }

            const podList = await response.json()
            if (podList.items && podList.items.length > 0) {
              const pod = podList.items[0]
              return {
                name: pod.metadata.name,
                namespace: pod.metadata.namespace,
              }
            }

            // Pod not found
            return null
          } catch (error) {
            console.error('Failed to fetch pod details:', error)
            return null
          }
        }

        /*
         * Redirects from management alias path to either:
         *
         * - externally running instance of the gateway server
         *   (HAWTIO_GATEWAY_SERVER needs to be defined in .env file)
         *
         * - internal stub code that fetches from master directly
         */
        const management = async (req, res, next) => {
          const headers = createHeaders(req)

          /*
           * If a gateway server has been separately executed and defined then defer to it
           */
          if (gatewayServerHost.length > 0) {
            console.log(`Info (dev-server): /master Passing request to external gateway: ${gatewayServerHost}`)
            console.log(JSON.stringify(req.headers))
            const uri = `${gatewayServerHost}${req.path}`

            const config = buildConfig(req.method, headers, req.body)
            response = await fetch(uri, config)
          } else {
            /*
             * Resort to basic default stub gateway server
             */

            const url = /\/management\/namespaces\/(.+)\/pods\/(http|https):([^/]+)\/(.+)/
            const match = req.originalUrl.match(url)
            const redirectPath = `/master/api/v1/namespaces/${match[1]}/pods/${match[2]}:${match[3]}/proxy/${match[4]}`
            if (!match) {
              next()
            }

            /*
             * Redirect will no longer work since fetch is being used by
             * jolokia instead and request contains Content-Length header.
             * So perform a sub-request instead on master to return the
             * correct response
             */
            const origin = `http://localhost:${devPort}`
            const uri = `${origin}${redirectPath}`

            let response
            if (req.method === 'GET') {
              response = await fetch(uri, {
                method: req.method,
                headers: headers,
              })
            } else {
              const body = req.body
              const isEmptyObject = typeof body === 'object' && Object.keys(body).length === 0
              const isEmptyArray = Array.isArray(body) && body.length === 0

              let msg
              if (!body) {
                msg = `Error (dev-server): undefined body found in POST request ${redirectPath}`
                console.warn(msg, body)
              } else if (isEmptyArray) {
                msg = `Error (dev-server): empty body array found in POST request ${redirectPath}`
                console.warn(msg, body)
              } else if (isEmptyObject) {
                msg = `Error (dev-server): empty body object found in POST request ${redirectPath}`
                console.warn(msg, body)
              } else {
                console.log(`Info (dev-server): Body in request ${redirectPath} to be passed to master`, body)
              }

              response = await fetch(uri, {
                method: req.method,
                body: JSON.stringify(body),
                headers: headers,
              })
            }
          }

          /*
           * Process the response from either version of gateway server
           */
          const r = await handleResponse(response, '/management')
          res.status(r.status).send(r.body)
        }

        /*
         * Callback from an external gateway server that determines
         * if the call is authorized based on the Authorization header
         * bearer token.
         */
        const authorization = async (req, res, next) => {
          const headers = createHeaders(req)

          // The regex matches paths starting with /authorization/,
          // captures the next segment, and then captures the rest of the path.
          const regex = /^\/authorization\/([^/]+)\/(.*)/

          // The replacement string uses the captured groups ($1 and $2)
          // to construct the new path format.
          const replacement = '/apis/$1/v1/$2'

          // Use the replace() method to apply the rewrite rule.
          // If the regex doesn't match, replace() returns the original string.
          const uri = `${master_uri}${req.originalUrl.replace(regex, replacement)}`
          console.log(`Info (dev-server): /authorization directly to ${uri}`)
          console.log('                   (express not capable of sub-requesting to itself)')

          const config = buildConfig(req.method, headers, req.body)
          response = await fetch(uri, config)

          /*
           * Process the response from either version of gateway server
           */
          const r = await handleResponse(response, '/authorization')
          res.status(r.status).send(r.body)
        }

        /*
         * Callback from an external gateway server that determines
         * the ip address of the pod being targetted.
         */
        const podIP = async (req, res, next) => {
          const headers = createHeaders(req)

          // The regex matches paths starting with /podIP/,
          // captures the next segment, and then captures the rest of the path.
          const regex = /^\/podIP\/(.+)\/(.+)/

          // The replacement string uses the captured groups ($1 and $2)
          // to construct the new path format.
          const replacement = '/api/v1/namespaces/$1/pods/$2'

          // Use the replace() method to apply the rewrite rule.
          // If the regex doesn't match, replace() returns the original string.
          const uri = `${master_uri}${req.originalUrl.replace(regex, replacement)}`
          console.log(`Info (dev-server): /podIP directly to ${uri}`)
          console.log('                   (express not capable of sub-requesting to itself)')

          const config = buildConfig(req.method, headers, req.body)
          response = await fetch(uri, config)

          /*
           * Process the response from either version of gateway server
           */
          const r = await handleResponse(response, '/podIP')
          res.status(r.status).send(r.body)
        }

        /*
         * Callback from an external gateway server that determines
         * the connection to the target application jolokia port and
         * returns the required final response.
         */
        const proxy = async (req, res, next) => {
          const headers = createHeaders(req)

          const regex = /^\/proxy\/(http|https):(.+):(\d+)\/(.*)$/
          const match = req.originalUrl.match(regex)
          if (!match) {
            return res.status(400).send('Invalid proxy URL format.')
          }

          const [, protocol, podIp, port, podPath] = match

          /*
           * Turn the podIp back into namespace/name to allow external access
           * Production server does not need to do this as it can directly talk
           * via the ip address.
           */
          const podInfo = await findPodByIp(podIp, headers)
          if (!podInfo) {
            return res.status(404).send(`Pod with IP ${podIp} not found.`)
          }

          const uri = `${master_uri}/api/v1/namespaces/${podInfo.namespace}/pods/${protocol}:${podInfo.name}:${port}/proxy/${podPath}`
          console.log(`Info (dev-server): /proxy directly to ${uri}`)
          console.log('                   (express not capable of sub-requesting to itself)')

          const config = buildConfig(req.method, headers, req.body)
          response = await fetch(uri, config)

          /*
           * Process the response from either version of gateway server
           */
          const r = await handleResponse(response, '/proxy')
          res.status(r.status).send(r.body)
        }

        const username = 'developer'
        const login = false
        const proxyEnabled = true

        // Keycloak
        const keycloakEnabled = false
        const keycloakClientConfig = {
          realm: 'hawtio-demo',
          clientId: 'hawtio-client',
          url: 'http://localhost:18080/',
          jaas: false,
          pkceMethod: 'S256',
        }

        /* Fetch the osconsole from the app's own public url path */
        devServer.app.get(`${publicPath}/osconsole/config.json`, osconsole)

        devServer.app.get('/', (req, res) => res.redirect(`${publicPath}`))

        /* management urls are meant to be at the root of the server */
        devServer.app.get('/management/*', management)
        devServer.app.post('/management/*', management)

        devServer.app.get('/authorization/*', authorization)
        devServer.app.post('/authorization/*', authorization)

        devServer.app.get('/podIP/*', podIP)
        devServer.app.post('/podIP/*', podIP)

        devServer.app.get('/proxy/*', proxy)
        devServer.app.post('/proxy/*', proxy)

        devServer.app.get(`${publicPath}/keycloak/enabled`, (_, res) => res.send(String(keycloakEnabled)))
        devServer.app.get(`${publicPath}/proxy/enabled`, (_, res) => res.send(String(proxyEnabled)))

        /*
         * Provide a server-side implementation of /auth/logout page to
         * allow use of the Clear-Site-Data header that will clear
         * all entries from the cache and storage relating to the app
         */
        devServer.app.get(`${publicPath}/auth/logout`, (req, res) => {
          let redirectUri = req.query.redirect_uri

          if (!redirectUri) {
            // If no url then simply acknowledge
            res.sendStatus(200)
          } else {
            var r = url.format(redirectUri)

            // Adds the Clear-Site-Data header
            res.header('Clear-Site-Data', '"*"')
            res.redirect(r)
          }
        })

        return middlewares
      },
    },
  })
}
