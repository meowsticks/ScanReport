import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' assert { type: 'json' };

export default defineConfig({
  // Relative asset paths so the built app also loads from a file:// URL,
  // which is how the Electron desktop build serves dist/index.html.
  base: './',
  plugins: [react()],
  define: {
    // App version baked in at build time. Mirrors what Electron exposes via
    // app.getVersion(), so the web build can show the same number / detect
    // version changes for the "what's new" popup.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
