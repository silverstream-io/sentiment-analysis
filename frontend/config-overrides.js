const path = require('path');
const { override } = require('customize-cra');

module.exports = function override(config, env) {
  // Modify output filename to be more predictable
  config.output = {
    ...config.output,
    filename: 'static/js/[name].js',
    chunkFilename: 'static/js/[name].chunk.js'
  };

  // Modify optimization to better handle code splitting
  config.optimization = {
    ...config.optimization,
    splitChunks: {
      chunks: 'all',
      name: (module, chunks, cacheGroupKey) => {
        const moduleFileName = module
          .identifier()
          .split('/')
          .reduceRight(item => item);
        const allChunksNames = chunks.map(item => item.name).join('~');
        return `${cacheGroupKey}-${allChunksNames}`;
      },
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        },
        main: {
          test: /[\\/]src[\\/]/,
          name: 'main',
          chunks: 'all',
          enforce: true
        }
      }
    },
    runtimeChunk: {
      name: 'runtime'
    }
  };

  return config;
};
