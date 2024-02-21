const webpack = require('webpack')
const { merge } = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')
const { common } = require('./webpack.config.common.js')

module.exports = () => {
  //
  // Prefix path will be determined by the installed web server platform
  //
  const publicPath = '/'

  return merge(common('production', publicPath), {
    devtool: 'source-map',

    plugins: [
      new CopyWebpackPlugin({
        patterns: [{ from: 'public/manifest.json' }, { from: 'public/hawtio-logo.svg' }],
      }),
    ],
  })
}
