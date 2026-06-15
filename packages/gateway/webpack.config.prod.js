const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const CompressionPlugin = require('compression-webpack-plugin')

module.exports = {
  mode: 'production',

  devtool: 'source-map',
  entry: 'src/gateway-api.ts',
  target: 'node',

  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: './public',
    pathinfo: true,
    filename: 'gateway-api.js',
    chunkFilename: 'static/js/[name].chunk.js',
    assetModuleFilename: 'static/media/[name].[hash][ext]',
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
      {
        test: /\.ts$/,
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
    ],
  },

  resolve: {
    extensions: ['.js', '.ts'],
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
    plugins: [
      new TsconfigPathsPlugin({
        configFile: path.resolve(__dirname, './tsconfig.json'),
      }),
    ],
    symlinks: false,
    cacheWithContext: false,
  },

  // For suppressing warnings that stop app running
  ignoreWarnings: [
    // For suppressing sourcemap warnings coming from some dependencies
    /Failed to parse source map/,
    /Critical dependency: the request of a dependency is an expression/,
  ],

  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: 'public/ACL.yaml' }],
    }),
    new CompressionPlugin({
      threshold: 8192,
    }),
  ],
}
