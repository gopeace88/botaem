import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({
      exclude: [],
      include: ['playwright', 'chromium-bidi', 'playwright-core'],
    })],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
        },
        external: ['playwright', 'playwright-core', 'chromium-bidi'],
      },
    },
    resolve: {
      alias: {
        '@electron': resolve(__dirname, 'electron'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'electron/preload.ts'),
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
    plugins: [react()],
  },
});
