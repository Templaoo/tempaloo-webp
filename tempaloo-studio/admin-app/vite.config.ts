import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Builds a single-bundle admin app. Output names are stable (admin.js,
// admin.css) so PHP can enqueue them with a static handle. The plugin's
// Menu.php expects ../build/admin.{js,css} — anything else and the
// React mount silently no-ops.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../build'),
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.tsx'),
      output: {
        entryFileNames: 'admin.js',
        chunkFileNames: 'admin-[name].js',
        assetFileNames: (info) => (info.name?.endsWith('.css') ? 'admin.css' : 'admin-[name][extname]'),
      },
    },
  },
  server: {
    port: 5180,
    open: '/index.html',
  },
});
