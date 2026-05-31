import { getDefaultConfig } from 'expo/metro-config';
import { Module } from 'module';
import { withNativeWind } from 'nativewind/metro';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = __dirname;
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'tailwindcss' || request.startsWith('tailwindcss/')) {
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

const monorepoRoot = path.resolve(projectRoot, '..');

const baseConfig = getDefaultConfig(projectRoot);

baseConfig.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

baseConfig.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

baseConfig.resolver.unstable_enablePackageExports = false;

export default withNativeWind(baseConfig, { input: './src/global.css' });
