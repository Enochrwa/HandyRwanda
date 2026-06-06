// File: mobile/metro.config.js
// Uses the custom @expo/metro-config fork that supports nodeModulesPaths.
const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

let withNativeWind;
try {
  withNativeWind = require('nativewind/metro').withNativeWind;
} catch {
  withNativeWind = require('nativewind/dist/metro/index.js').withNativeWind;
}

const root = path.resolve(__dirname, '..');
const projectDir = __dirname;

const config = getDefaultConfig(projectDir);

// Allow Metro to resolve packages from the monorepo root node_modules
// and from the app directory, where dependencies are hoisted in this workspace.
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), root, projectDir]));

// Resolve path aliases and shared monorepo-hoisted packages
config.resolver.extraNodeModules = {
  react: path.resolve(root, 'node_modules/react'),
  'react-dom': path.resolve(root, 'node_modules/react-dom'),
  'react-native': path.resolve(root, 'node_modules/react-native'),
  '@icons': path.resolve(projectDir, 'src/icons.ts'),
};

// Ensure Metro only resolves supported source extensions
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts || []), 'mjs', 'cjs']),
);

// Block hoisted top-level deps from leaking into the bundle,
// except for whitelisted shared packages above.
config.resolver.blockList = (config.resolver.blockList || []).filter((entry) => {
  if (typeof entry !== 'string') return true;
  if (
    /(^|\/)node_modules\/react($|\/)/.test(entry) ||
    /(^|\/)node_modules\/react-dom($|\/)/.test(entry) ||
    /(^|\/)node_modules\/react-native($|\/)/.test(entry)
  ) {
    return false;
  }
  if (entry.includes('node_modules/handyrwanda-monorepo')) return true;
  if (entry.includes('mobile/node_modules/backend')) return true;
  if (entry.includes('mobile/node_modules/web')) return true;
  return false;
});

// Increase transformer concurrency for faster bundling
config.maxWorkers = 4;

// NativeWind v4 requires the CSS transformer
module.exports = withNativeWind(config, {
  input: path.join(projectDir, 'src/global.css'),
  configPath: path.join(projectDir, 'tailwind.config.js'),
  projectRoot: projectDir,
});
