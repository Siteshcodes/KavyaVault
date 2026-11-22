import { defineConfig } from 'vite';

function exportChunks(id) {
  if (id.endsWith('/bundledFonts.js')) return 'export-fonts';
  if (id.includes('/node_modules/')) return 'font-engine';
}

export default defineConfig({
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  worker: { format: 'es', rollupOptions: { output: { manualChunks: exportChunks } } },
  build: {
    rollupOptions: { output: { manualChunks: exportChunks } }
  }
});
