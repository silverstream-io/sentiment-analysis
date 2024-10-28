const path = require('path');
const { override, addWebpackPlugin } = require('customize-cra');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = function override(config, env) {
  // Disable code splitting by setting optimization.splitChunks to false
  config.optimization = {
    ...config.optimization,
    splitChunks: false,
    runtimeChunk: false
  };
  
  return config;
}
