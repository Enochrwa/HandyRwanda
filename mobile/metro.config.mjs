import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Module } = require('module');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mobileNodeModules = path.resolve(__dirname, 'node_modules');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (
    request === 'tailwindcss' ||
    request === 'tailwindcss/package.json' ||
    request.startsWith('tailwindcss/')
  ) {
    return originalResolveFilename.call(
      this,
      request,
      { paths: [mobileNodeModules] },
      isMain,
      options,
    );
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { getDefaultConfig } = await import('@expo/metro-config');
const { withNativeWind } = await import('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
};

config.resolver.unstable_enablePackageExports = false;

// NativeWind v4 requires the CSS transformer to be wired in via withNativeWind.
// Without this, className props are ignored and no styles are applied.
export default withNativeWind(config, {
  input: './src/global.css',
  configPath: './tailwind.config.js',
  projectRoot: __dirname,
});
