console.log('process.versions.electron:', process.versions.electron);
console.log('process.type:', process.type);
try {
  const electron = require('electron');
  console.log('typeof electron:', typeof electron);
  console.log('electron.app:', electron.app);
} catch (e) {
  console.log('Error:', e.message);
}
process.exit(0);
