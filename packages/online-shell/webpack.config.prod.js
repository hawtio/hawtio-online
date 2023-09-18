const webpack = require('webpack')
const { merge } = require('webpack-merge')
const path = require('path')
const { common } = require('./webpack.config.common.js')

module.exports = () => {
  return merge(common('production'), {
    devtool: 'source-map'
  })
}
