const { override, addWebpackPlugin } = require('customize-cra');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = override(
  addWebpackPlugin(
    new HtmlWebpackPlugin({
      template: 'public/index.html',
      filename: 'background.html',
      chunks: ['background'],
    })
  ),
  (config) => {
    config.entry = {
      sentimentChecker: './src/index.tsx',
      background: './src/backgroundIndex.tsx',
      topbar: './src/topbarIndex.tsx',
    };
    config.output.filename = '[name].js';
    return config;
  }
);

