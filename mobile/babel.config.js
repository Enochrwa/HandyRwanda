// File: mobile/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      // Resolve TypeScript path aliases at Babel/bundler level.
      // This covers both Metro and Jest (which doesn't read metro.config.js).
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            // "@icons" -> "./src/icons.ts" (tree-shaken Lucide icons barrel)
            '@icons': './src/icons',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // react-native-reanimated MUST be listed last
      'react-native-reanimated/plugin',
    ],
  };
};
