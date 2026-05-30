import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mobileNodeModules = path.resolve(__dirname, 'node_modules');

export async function applyHook() {
  try {
    const { Module } = await import('module');
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
  } catch (err) {
    console.error('Failed to apply tailwind resolver hook:', err);
  }
}
