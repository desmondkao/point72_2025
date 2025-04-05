const path = require("path");

module.exports = function override(config, env) {
  // Add fallback for querystring
  config.resolve.fallback = {
    ...config.resolve.fallback,
    querystring: require.resolve("querystring-es3"),
  };

  // Alias styled-components to ensure only one instance is used
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    "styled-components": path.resolve(__dirname, "node_modules", "styled-components"),
  };

  return config;
};
