import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read package.json without `import ... assert { type: 'json' }` so the
// config works on every Node version the CI runners use (20.x sometimes
// throws on the experimental assert syntax even when it parses).
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
);

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
