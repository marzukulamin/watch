import { defineConfig } from 'vite';
export default defineConfig({
  optimizeDeps: { entries: ['index.html'] },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/examples/')) return 'intro-support';
          if (id.includes('/three/')) return 'scene';
          if (id.includes('/animejs/')) return 'motion';
        },
      },
    },
  },
});
