// First check if we're in electron
console.log('process.versions.electron:', process.versions.electron);
console.log('__dirname:', __dirname);

// Try to require electron
const electron = require('electron');
console.log('electron:', electron);
console.log('typeof electron:', typeof electron);
console.log('electron.app:', electron.app);

process.exit(0);
