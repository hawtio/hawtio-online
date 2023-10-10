const webpack = require('webpack')
const { merge } = require('webpack-merge')
const WebpackDevServer = require('webpack-dev-server')
const DotenvPlugin = require('dotenv-webpack')
const historyApiFallback = require('connect-history-api-fallback')
const path = require('path')
const dotenv = require('dotenv')
const { common } = require('./webpack.config.common.js')

// this will update the process.env with environment variables in .env file
dotenv.config( { path: path.join(__dirname, '.env') } )

module.exports = () => {

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
    console.error("The OAUTH_CLIENT_ID must be set!")
    process.exit(1)
  }

  const clusterAuthFormUri = process.env.CLUSTER_AUTH_FORM || '/login'
  if (clusterAuthFormUri)
    console.log('Using Cluster Auth Form URL:', clusterAuthFormUri)

  console.log('Using Cluster URL:', master_uri)
  console.log('Using Cluster Namespace:', namespace)
  console.log('Using Hawtio Cluster Mode:', mode)
  console.log('USing OAuth Client Id:', clientId)

  const kubeBase = master_uri
  const kube = new URL(kubeBase)
  const devPort = process.env.PORT || 2772
  const proxiedMaster = `http://localhost:${devPort}/master`

  return merge(common('development'), {
    devtool: 'eval-source-map',
    stats: 'errors-warnings',

    plugins: [
      new DotenvPlugin({
        safe: true,
        allowEmptyValues: true,
        defaults: true,
        systemvars: true,
        ignoreStub: true,
      })
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
      proxy: {
        '/master': {
          target: master_uri,
          pathRewrite: { '^/master': '' },
          secure: false,
          ws: true,
        },
      },

      static: {
        directory: path.join(__dirname, 'public'),
      },

      setupMiddlewares: (middlewares, devServer) => {
        /*
         * Function to construct the config.json file
         * and make it available for authentication
         */
        const osconsole = (_, res) => {
          const oscConfig = {
            master_uri: proxiedMaster,
            hawtio: {
              mode: mode,
            },
          }

          if (clusterAuthType === 'form') {
            oscConfig.form = {
              uri: clusterAuthFormUri
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

        /* Redirects from management alias path to full master path */
        const management = (req, res, next) => {
          const url = /\/management\/namespaces\/(.+)\/pods\/(http|https):([^/]+)\/(.+)/
          const match = req.originalUrl.match(url)
          const redirectPath = `/master/api/v1/namespaces/${match[1]}/pods/${match[2]}:${match[3]}/proxy/${match[4]}`
          if (match) {
            // 307 - post redirect
            res.redirect(307, redirectPath)
          } else {
            next()
          }
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

        devServer.app.get('/osconsole/config.json', osconsole)
        devServer.app.get('/management/*', management)
        devServer.app.post('/management/*', management)

        devServer.app.get('/keycloak/enabled', (_, res) => res.send(String(keycloakEnabled)))
        devServer.app.get('/proxy/enabled', (_, res) => res.send(String(proxyEnabled)))

        // Hawtio backend API mock
        devServer.app.get('/hawtio/user', (_, res) => res.send(`"${username}"`))
        devServer.app.get('/hawtio/plugin', (_, res) => res.send(JSON.stringify(plugin)))
        devServer.app.get('/hawtio/keycloak/client-config', (_, res) => res.send(JSON.stringify(keycloakClientConfig)))
        devServer.app.get('/hawtio/keycloak/validate-subject-matches', (_, res) => res.send('true'))
        devServer.app.get('/hawtio/auth/logout', (_, res) => res.redirect('/hawtio/login'))
        devServer.app.post('/hawtio/auth/login', (_, res) => res.send(String(login)))

        //
        // Use historyApiFallback to plug-in to the react router
        // for accessing /login from the app. Having it here allows
        // the paths above to remain external to the app
        //
        const history = historyApiFallback()
        devServer.app.get('/', history)
        devServer.app.get('/login', history)

        return middlewares
      }
    }
  })
}
