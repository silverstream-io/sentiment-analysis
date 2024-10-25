const path = require('path');
const { override, addWebpackPlugin } = require('customize-cra');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  webpack: function(config, env) {
    // Clear the existing entry point
    config.entry = {};
    
    // Define new entry points
    config.entry = {
      main: path.resolve(__dirname, 'src/indexMain.tsx'),
      topbar: path.resolve(__dirname, 'src/indexTopbar.tsx'),
      background: path.resolve(__dirname, 'src/indexBackground.tsx')
    };

    // Update output configuration
    config.output = {
      ...config.output,
      filename: 'static/js/[name].bundle.js',
      chunkFilename: 'static/js/[name].chunk.js',
    };

    return config;
  },
  devServer: function(configFunction) {
    return function(proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      config.static = {
        ...config.static,
        directory: path.join(__dirname, 'public'),
      };
      return config;
    };
  }
};
