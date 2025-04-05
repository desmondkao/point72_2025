module.exports = function override(config, env) {
  // Add fallback for querystring
  config.resolve.fallback = {
    ...config.resolve.fallback,
    querystring: require.resolve("querystring-es3"),
  };

  return config;
};
