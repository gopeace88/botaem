const { defineConfig, loadEnv } = require('electron-vite');
const react = require('@vitejs/plugin-react');
const path = require('path');

// Load all env variables (including CLAUDE_API_KEY without VITE_ prefix)
const env = loadEnv('development', process.cwd(), ['VITE_', 'CLAUDE_']);

module.exports = defineConfig({
  main: {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/main.ts'),
      },
      rollupOptions: {
        external: ['electron', 'playwright', 'better-sqlite3'],
      },
    },
    resolve: {
      alias: {
        '@main': path.resolve(__dirname, 'electron'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'process.env.VITE_BOTAME_URL': JSON.stringify(env.VITE_BOTAME_URL),
    },
  },
  preload: {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [react.default()],
  },
});
