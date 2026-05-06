import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

function fixHtml() {
  return {
    name: 'fix-html',
    closeBundle() {
      const html = readFileSync('dist/index.html', 'utf-8');
      const fixed = html.replace(/crossorigin /g, ' ');
      writeFileSync('dist/index.html', fixed);
    }
  };
}

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  base: './',
  build: {
    target: 'esnext',
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  resolve: {
    alias: {
      'three/addons': resolve('./node_modules/three/examples/jsm'),
      'manifold-3d': resolve('./node_modules/manifold-3d/manifold.js'),
    },
  },
  optimizeDeps: {
    include: ['three'],
    exclude: ['manifold-3d'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  assetsInclude: ['**/*.wasm'],
  plugins: [fixHtml()],
});
