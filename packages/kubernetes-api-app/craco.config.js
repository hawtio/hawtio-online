const { ModuleFederationPlugin } = require('webpack').container
const { dependencies } = require('./package.json')
const CracoEsbuildPlugin = require('craco-esbuild')
const uri = require('urijs')
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
      const kubeBase = process.env.KUBERNETES_MASTER || 'https://localhost:8443'
      const kube = uri(kubeBase)
      console.log("Connecting to Kubernetes on: " + kube)

      devServerConfig.compress = true
      devServerConfig.liveReload = true
      devServerConfig.port = 2772
      devServerConfig.proxy = {
        '/kubernetes': {
          target: kube.protocol() + '://' + kube.hostname() + ':' + kube.port + '/'
        },
        '/jolokia': {
          target: kube.protocol() + '://' + kube.hostname() + ':' + kube.port + '/hawtio/jolokia'
        }
      }
      devServerConfig.static = {
        directory: path.join(__dirname, 'public'),
      }

      devServerConfig.onBeforeSetupMiddleware = (devServer) => {
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
