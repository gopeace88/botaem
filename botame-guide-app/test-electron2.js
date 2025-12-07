console.log('=== Debug ===');
console.log('process.versions.electron:', process.versions.electron);
console.log('process.type:', process.type);

// Check what's in the electron module
const electron = require('electron');
console.log('typeof electron:', typeof electron);
console.log('Object.keys(electron):', Object.keys(electron));
console.log('electron.app:', electron.app);
console.log('electron.BrowserWindow:', electron.BrowserWindow);

// Check if it's a string (path)
if (typeof electron === 'string') {
  console.log('electron is a string (path):', electron);
}

process.exit(0);
