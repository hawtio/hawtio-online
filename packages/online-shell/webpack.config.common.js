const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const InterpolateHtmlPlugin = require('interpolate-html-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const path = require('path')
const pkg = require('./package.json')
const { dependencies } = pkg

/**
 * Try to load the ROOT package.json to check for resolutions
 * Ensures that the shell handles cases where the shell may be
 * running in a standalone repo or copied out of the mono repo
 */
let rootPkg = {}
try {
  rootPkg = require(path.resolve(__dirname, '..', '..', 'package.json'))
  console.log('Root package.json loaded successfully.')
} catch (e) {
  console.log('No parent package.json found. Assuming standalone repository structure.')
}

/**
 * Get the version of a dependency from the package.json file(s)
 * using a cascading strategy:
 * 1. Check for Root package.json 'resolutions'
 * 2. Check for Local package.json 'resolutions'
 * 3. Check for Local package.json 'dependencies' (fallback)
 *
 * @param {string} dependencyName The name of the dependency to check (e.g., '@hawtio/react').
 * @returns {string} The resolved version string.
 */
const getDependencyVersion = dependencyName => {
  // Check ROOT resolutions
  if (rootPkg.resolutions && rootPkg.resolutions[dependencyName]) {
    const resolvedVersion = rootPkg.resolutions[dependencyName]
    console.log(`Using ROOT resolved version for ${dependencyName}: ${resolvedVersion}`)
    return resolvedVersion
  }

  // Check LOCAL resolutions
  if (pkg.resolutions && typeof pkg.resolutions === 'object') {
    // Check if the specific dependency is defined in resolutions
    if (pkg.resolutions[dependencyName]) {
      console.log(`Using resolved version for ${dependencyName}: ${pkg.resolutions[dependencyName]}`)
      return pkg.resolutions[dependencyName]
    }
  }

  // Fallback to standard dependencies
  const version = pkg.dependencies[dependencyName]
  if (version) {
    console.log(`Using standard dependency version for ${dependencyName}: ${version}`)
    return version
  }

  throw new Error(`Could not find version for dependency: ${dependencyName}`)
}

const common = (mode, publicPath, packageVersion) => {
  console.log(`Compilation Mode: ${mode}`)
  console.log(`Public Path: ${publicPath}`)
  console.log(`Package Version: ${packageVersion}`)

  // Resolve the version for @hawtio/react using the dependency function
  const hawtioReactVersion = getDependencyVersion('@hawtio/react')

  return {
    mode: mode,
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.js$/,
          enforce: 'pre',
          use: ['source-map-loader'],
        },
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                noEmit: false, // this option will solve the issue
              },
            },
          },
          exclude: /node_modules|\.d\.ts$/, // this line as well
        },
        {
          test: /\.(js)x?$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          use: 'file-loader',
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        // MiniCssExtractPlugin - Ignore order as otherwise conflicting order warning is raised
        ignoreOrder: true,
      }),
      new webpack.container.ModuleFederationPlugin({
        name: 'hawtio-online',
        filename: 'remoteEntry.js',
        exposes: {},
        shared: {
          ...dependencies,
          react: {
            singleton: true,
            requiredVersion: dependencies['react'],
            eager: true,
          },
          'react-dom': {
            singleton: true,
            requiredVersion: dependencies['react-dom'],
            eager: true,
          },
          'react-router-dom': {
            singleton: true,
            requiredVersion: dependencies['react-router-dom'],
            eager: true,
          },
          '@hawtio/react': {
            singleton: true,
            requiredVersion: hawtioReactVersion,
          },
          '@hawtio/online-oauth': {
            singleton: true,
            // Hardcoding needed because it cannot handle yarn 'workspace:*' version
            requiredVersion: '^0.0.0',
          },
          '@hawtio/online-kubernetes-api': {
            singleton: true,
            // Hardcoding needed because it cannot handle yarn 'workspace:*' version
            requiredVersion: '^0.0.0',
          },
          '@hawtio/online-management-api': {
            singleton: true,
            // Hardcoding needed because it cannot handle yarn 'workspace:*' version
            requiredVersion: '^0.0.0',
          },
        },
      }),
      new HtmlWebpackPlugin({
        inject: true,
        template: path.resolve(__dirname, 'public', 'index.html'),
        favicon: path.resolve(__dirname, 'public', 'favicon.ico'),
        publicPath: publicPath,
      }),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(process.env),
        HAWTIO_ONLINE_PACKAGE_VERSION: JSON.stringify(packageVersion),
      }),
    ],
    output: {
      path: path.resolve(__dirname, 'build'),

      // Set base path to desired publicPath
      publicPath: publicPath,
      pathinfo: true,
      filename: 'static/js/bundle.js',
      chunkFilename: 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash][ext]',
    },

    // For suppressing warnings that stop app running
    ignoreWarnings: [
      // For suppressing sourcemap warnings coming from some dependencies
      /Failed to parse source map/,
      /Critical dependency: the request of a dependency is an expression/,
    ],

    resolve: {
      // This tells Webpack to look for the "require" and "import" conditions
      // in the "exports" map of a package.json.
      conditionNames: ['require', 'import', 'browser'],

      // While often default in modern Webpack, it's good to be explicit
      // that you want to respect the "exports" field.
      exportsFields: ['exports'],

      extensions: ['.js', '.ts', '.tsx', '.jsx'],
      alias: {
        'react-native': 'react-native-web',
        src: path.resolve(__dirname, 'src'),
      },
      plugins: [
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, './tsconfig.json'),
        }),
      ],
      symlinks: false,
      cacheWithContext: false,
      fallback: {
        os: require.resolve('os-browserify'),
        path: require.resolve('path-browserify'),
        process: require.resolve('process/browser'),
        url: require.resolve('url/'),
      },
    },
  }
}

module.exports = { common }
