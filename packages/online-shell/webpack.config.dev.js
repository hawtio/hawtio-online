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

  const gatewayServerHost = process.env.HAWTIO_GATEWAY_SERVER
  if (!gatewayServerHost) {
    console.error('The HAWTIO_GATEWAY_SERVER environment variable must be set.')
    process.exit(1)
  }

  console.log('Using Gateway Server:', gatewayServerHost)
  console.log('Using Master Kind:', masterKind)
  console.log('Using Cluster Namespace:', namespace)
  console.log('Using Hawtio Cluster Mode:', mode)
  console.log('Using OAuth Client Id:', clientId)

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
          context: ['/auth/logout'],
          target: gatewayServerHost,
          pathRewrite: { '^/auth/logout': '/logout' },
          secure: false,
        },
        {
          context: ['/master'],
          target: gatewayServerHost,
          secure: false,
          ws: true, // Nginx config maps $http_upgrade for WebSockets here
          onProxyRes: (proxyRes, req, res) => {
            if (proxyRes.statusCode === 401) {
              delete proxyRes.headers['www-authenticate']
            }
          },
        },
        {
          context: ['/management'],
          target: gatewayServerHost,
          secure: false,
          ws: true,
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

        devServer.app.get(`${publicPath}/keycloak/enabled`, (_, res) => res.send(String(keycloakEnabled)))
        devServer.app.get(`${publicPath}/proxy/enabled`, (_, res) => res.send(String(proxyEnabled)))

        return middlewares
      },
    },
  })
}
