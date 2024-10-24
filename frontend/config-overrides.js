const { override, addWebpackPlugin } = require('customize-cra');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/*
module.exports = override(
  addWebpackPlugin(
    new HtmlWebpackPlugin({
      template: 'public/index.html',
      filename: 'index.html',
      chunks: ['sentimentChecker'],
    })
  ),
  (config) => {
    config.entry = {
      sentimentChecker: './src/index.tsx',
    };
    config.output.filename = '[name].js';
    config.devtool = 'source-map';
    config.stats = 'verbose';
    return config;
  }
);
*/
