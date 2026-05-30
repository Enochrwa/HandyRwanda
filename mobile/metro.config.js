import { getDefaultConfig } from 'expo/metro-config';
import { withNativeWind } from 'nativewind/metro';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure forked processes (NativeWind Tailwind CLI) resolve Tailwind v3, not v4 from the monorepo root.
import('./tailwind-resolver-hook.mjs').then(({ applyHook }) => {
  applyHook().catch(console.error);
});

const hookPath = path.resolve(__dirname, 'tailwind-resolver-hook.mjs');
if (!process.env.NODE_OPTIONS?.includes('tailwind-resolver-hook')) {
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--import ${hookPath}`]
    .filter(Boolean)
    .join(' ');
}

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Single React instance — root hoists web's 19.2.x otherwise, breaking RN's renderer (19.1.0).
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

// Hoisted packages expose broken "exports" entries in npm workspaces.
config.resolver.unstable_enablePackageExports = false;

export default withNativeWind(config, { input: './src/global.css' });
