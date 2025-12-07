const react = require('@vitejs/plugin-react');
const path = require('path');

module.exports = {
  root: '.',
  plugins: [react.default()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
};
