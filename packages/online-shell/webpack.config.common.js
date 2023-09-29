const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const InterpolateHtmlPlugin = require('interpolate-html-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const path = require('path')
const { dependencies } = require('./package.json')

const common = (mode) => {

  console.log(`Compilation Mode: ${mode}`)

  const publicPath = mode === 'production' ? '/online' : ''

  return {
    mode: mode,
    module: {
      rules:[
        {
          test: /\.css$/,
          use: [ 'style-loader', 'css-loader' ]
        },
        {
          test: /\.js$/,
          enforce: "pre",
          use: ["source-map-loader"],
        },
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                noEmit: false, // this option will solve the issue
              },
            }
          },
          exclude: /node_modules|\.d\.ts$/, // this line as well
        },
        {
          test: /\.(js)x?$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
        {
          test: /\.svg$/,
          use: 'file-loader'
        }
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        // MiniCssExtractPlugin - Ignore order as otherwise conflicting order warning is raised
        ignoreOrder: true
      }),
      new webpack.container.ModuleFederationPlugin({
        name: 'app',
        filename: 'remoteEntry.js',
        exposes: {},
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
        publicPath: publicPath
      }),
      new webpack.DefinePlugin({
       'process.env': JSON.stringify(process.env)
      })
    ],
    output : {
      path: path.resolve(__dirname, 'build'),

      // Set base path to /
      publicPath: '/',

      pathinfo: true,
      filename: 'static/js/bundle.js',
      chunkFilename: 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash][ext]'
    },
    ignoreWarnings: [
      // For suppressing sourcemap warnings coming from some dependencies
      /Failed to parse source map/
    ],
    resolve: {
      modules: [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, '../../node_modules')],
      extensions: ['.js', '.ts', '.tsx', '.jsx'],
      alias: {
        'react-native': 'react-native-web',
        src: path.resolve(__dirname, 'src')
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
      }
    }
  }
}

module.exports = { common }
