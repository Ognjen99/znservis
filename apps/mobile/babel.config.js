module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./src",
            "@znservis/shared": "../../packages/shared/src",
            "@znservis/i18n": "../../packages/i18n/src"
          }
        }
      ]
    ]
  };
};
