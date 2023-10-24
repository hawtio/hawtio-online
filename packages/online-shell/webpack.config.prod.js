const webpack = require('webpack')
const { merge } = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')
const { common } = require('./webpack.config.common.js')

module.exports = () => {
  return merge(common('production'), {
    devtool: 'source-map',

    plugins: [
      new CopyWebpackPlugin({
        patterns: [{ from: 'public/manifest.json' }, { from: 'public/hawtio-logo.svg' }],
      }),
    ],
  })
}
