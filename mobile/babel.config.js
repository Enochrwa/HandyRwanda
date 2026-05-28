module.exports = function (_api) {
  _api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: ['babel-preset-expo'],
    plugins: isTest ? [] : ['nativewind/babel'],
  };
};
