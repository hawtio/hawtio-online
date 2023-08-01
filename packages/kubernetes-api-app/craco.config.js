const { ModuleFederationPlugin } = require('webpack').container
const { dependencies } = require('./package.json')
const CracoEsbuildPlugin = require('craco-esbuild')
const path = require('path')
const Dotenv = require('dotenv-webpack')

module.exports = () => {
  return {
    plugins: [
      {
        plugin: CracoEsbuildPlugin
      }
    ],
    webpack: {
      plugins: {
        add: [
          new Dotenv({
            safe: true,
            allowEmptyValues: true,
            defaults: true,
            systemvars: true,
            ignoreStub: true
          }),
          new ModuleFederationPlugin({
            name: 'app',
            filename: 'remoteEntry.js',
            exposes: {
            },
            shared: {
              ...dependencies,
              react: {
                singleton: true,
                requiredVersion: dependencies['react'],
              },
              'react-dom': {
                singleton: true,
                requiredVersion: dependencies['react-dom'],
              },
              'react-router-dom': {
                singleton: true,
                requiredVersion: dependencies['react-router-dom'],
              },
              '@hawtio/react': {
                singleton: true,
                requiredVersion: dependencies['@hawtio/react'],
              },
              '@hawtio/online-kubernetes-api': {
                singleton: true,
                // Hardcoding needed because it cannot handle yarn 'workspace:*' version
                requiredVersion: '^0.0.0',
              },
            },
          }),
        ],
      },
      configure: webpackConfig => {
        // Required for Module Federation
        webpackConfig.output.publicPath = 'auto'

        // For suppressing sourcemap warnings coming from some dependencies
        webpackConfig.ignoreWarnings = [/Failed to parse source map/]

        // MiniCssExtractPlugin - Ignore order as otherwise conflicting order warning is raised
        const miniCssExtractPlugin = webpackConfig.plugins.find(p => p.constructor.name === 'MiniCssExtractPlugin')
        if (miniCssExtractPlugin) {
          miniCssExtractPlugin.options.ignoreOrder = true
        }

        const resolve = webpackConfig['resolve']
        const extensions = resolve['extensions'] || []
        const alias = resolve['alias'] || {}

        const plugins = resolve['plugins'] || []

        webpackConfig['resolve'] = {
          modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, '../../node_modules'),
          ],
          extensions: extensions,
          alias: alias,
          plugins: plugins,
          fallback: {
            path: require.resolve('path-browserify'),
            os: require.resolve('os-browserify'),
          },
        }

        // ***** Debugging *****
        /*
        const fs = require('fs')
        const util = require('node:util')
        const out = `output = ${util.inspect(webpackConfig.output)}\n\nplugins = ${util.inspect(webpackConfig.plugins)}\n\nresolve = ${util.inspect(webpackConfig.resolve)}`
        fs.writeFile('__webpackConfig__.txt', out, err => err && console.error(err))
        */
        // ***** Debugging *****

        return webpackConfig
      },
    },
    jest: {
      configure: {
        // Automatically clear mock calls and instances between every test
        clearMocks: true,

        coveragePathIgnorePatterns: [
          '<rootDir>/node_modules/'
        ],

        moduleDirectories: ['<rootDir>/node_modules/'],

        moduleNameMapper: {
          'react-markdown': '<rootDir>/node_modules/react-markdown/react-markdown.min.js',
        },

        // The path to a module that runs some code to configure or set up the testing framework before each test
        setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

        testPathIgnorePatterns: [
          '<rootDir>/node_modules/'
        ],

        transformIgnorePatterns: ['node_modules/(?!@patternfly/react-icons/dist/esm/icons)/'],

        coveragePathIgnorePatterns: ['node_modules/', 'src/examples/', 'src/index.tsx', 'src/reportWebVitals.ts'],
      },
    },
    devServer: (devServerConfig, { env, paths, proxy, allowedHost }) => {

      const master_uri = process.env.CLUSTER_MASTER
      if (! master_uri) {
        console.error('The CLUSTER_MASTER environment variable must be set!')
        process.exit(1)
      }

      const namespace = process.env.CLUSTER_NAMESPACE || 'hawtio-dev'
      const mode = process.env.HAWTIO_MODE || 'cluster'
      console.log('Using Cluster URL:', master_uri)
      console.log('Using Cluster Namespace:', namespace)
      console.log('Using Hawtio Cluster Mode:', mode)

      devServerConfig.compress = true
      devServerConfig.liveReload = true
      devServerConfig.port = process.env.PORT || 2772

      /*
       * Proxy to bring the cluster into the app as a redirect.
       * Avoids issues with CORS
       * Note: target must be up and connectable. Otherwise an error is
       *       thrown by the proxy but with an incorrect error message with
       *       the original host address in it rather than the target
       */
      devServerConfig.proxy = {
        '/master': {
          target: master_uri,
          pathRewrite: { '^/master': '' },
          secure: false,
          ws: true
        },
      }

      const proxiedMaster = `http://localhost:${devServerConfig.port}/master`

      devServerConfig.static = {
        directory: path.join(__dirname, 'public'),
      }

      devServerConfig.onBeforeSetupMiddleware = (devServer) => {

        /*
         * Function to construct the config.json file
         * and make it available for authentication
         */
        const osconsole = (_, res) => {
          const oscConfig = {
            master_uri: proxiedMaster,
            hawtio: {
              mode: mode
            },
          }

          switch (mode) {
            case 'namespace':
              oscConfig.hawtio.namespace = namespace
              oscConfig.openshift = {
                oauth_metadata_uri: `${proxiedMaster}/.well-known/oauth-authorization-server`,
                oauth_client_id: `system:serviceaccount:${namespace}:hawtio-online-dev`,
                scope: `user:info user:check-access user:full`,
              }
              break
            case 'cluster':
              oscConfig.openshift = {
                oauth_metadata_uri: `${proxiedMaster}/.well-known/oauth-authorization-server`,
                oauth_client_id: `hawtio-online-dev`,
                scope: `user:info user:check-access user:full`,
              }
              break
            default:
              console.error('Invalid value for the Hawtio Online mode, must be one of [cluster, namespace]');
              process.exit(1);
          }

          res.set('Content-Type', 'application/javascript')
          res.send(JSON.stringify(oscConfig))
        }

        devServer.app.get('/osconsole/config.json', osconsole)
        devServer.app.get('/online/osconsole/config.json', osconsole)
        devServer.app.get('/integration/osconsole/config.json', osconsole)

        const username = 'developer'
        const login = false
        const proxyEnabled = false
        const keycloakEnabled = false

        devServer.app.get('/hawtio/user', (_, res) => res.send(`"${username}"`))
        devServer.app.post('/hawtio/auth/login', (_, res) => res.send(String(login)))
        devServer.app.get('/hawtio/auth/logout', (_, res) => res.redirect('/hawtio/login'))
        devServer.app.get('/hawtio/proxy/enabled', (_, res) => res.send(String(proxyEnabled)))
        devServer.app.get('/hawtio/keycloak/enabled', (_, res) => res.send(String(keycloakEnabled)))
      }


      return devServerConfig
    },
  }
}
