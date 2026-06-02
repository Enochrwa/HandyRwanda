// File: mobile/metro.config.js
// CommonJS metro config (required because package.json has "type": "commonjs")
const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

let withNativeWind;
try {
  withNativeWind = require('nativewind/metro').withNativeWind;
} catch {
  // fallback for nativewind v4
  withNativeWind = require('nativewind/dist/metro/index.js').withNativeWind;
}

const __dirname = path.dirname(require.resolve('./package.json'));
const config = getDefaultConfig(__dirname);

// Restrict resolution to mobile's own node_modules to avoid hoisting issues
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Resolve path aliases declared in tsconfig.json.
// Metro does NOT read tsconfig paths — they must be registered here.
// "@icons" maps to ./src/icons.ts (tree-shaken Lucide icons barrel).
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  '@icons': path.resolve(__dirname, 'src/icons.ts'),
};

// Allow Metro to resolve .ts and .tsx files via the alias above
config.resolver.sourceExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'cjs', 'mjs'];

// Disable package exports to avoid resolution issues with some packages.
// NOTE: This is intentional — individual lucide CJS icon files are resolved
// via direct paths (dist/cjs/icons/*.js), not via package "exports" field.
config.resolver.unstable_enablePackageExports = false;

// Reduce Metro's file-watching overhead (speeds up initial bundling)
config.watchFolders = [__dirname];

// Increase transformer concurrency for faster bundling
config.maxWorkers = 4;

// NativeWind v4 requires the CSS transformer
module.exports = withNativeWind(config, {
  input: './src/global.css',
  configPath: './tailwind.config.js',
  projectRoot: __dirname,
});
