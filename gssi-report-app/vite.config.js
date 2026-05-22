import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the built app also loads from a file:// URL,
  // which is how the Electron desktop build serves dist/index.html.
  base: './',
  plugins: [react()],
});
