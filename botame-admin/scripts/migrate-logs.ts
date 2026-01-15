#!/usr/bin/env node

/**
 * Console.log to Logger Migration Script
 * Converts console.log/warn/error to winston logger calls
 */

const fs = require('fs');
const path = require('path');

/**
 * Convert console calls to logger calls in a file
 */
function convertFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  let newContent = content;

  // Check if file already imports logger
  const hasLoggerImport = /import.*logger.*from.*logger/.test(content);
  
  // Add import if needed and conversions will be made
  let needsImport = false;
  
  // console.log -> logger.info
  if (/console\.log\(/.test(content)) {
    newContent = newContent.replace(/console\.log\(/g, 'logger.info(');
    modified = true;
    needsImport = true;
  }

  // console.warn -> logger.warn
  if (/console\.warn\(/.test(content)) {
    newContent = newContent.replace(/console\.warn\(/g, 'logger.warn(');
    modified = true;
    needsImport = true;
  }

  // console.error -> logger.error
  if (/console\.error\(/.test(content)) {
    newContent = newContent.replace(/console\.error\(/g, 'logger.error(');
    modified = true;
    needsImport = true;
  }

  // Add logger import at the top if needed
  if (needsImport && !hasLoggerImport) {
    // Find the first import statement
    const importMatch = newContent.match(/^import .+;/m);
    if (importMatch) {
      const lastImportIndex = newContent.lastIndexOf(importMatch[0]);
      const insertPosition = newContent.indexOf('\n', lastImportIndex) + 1;
      
      const importStatement = "import { logger } from '../logger';\n";
      newContent = newContent.slice(0, insertPosition) + importStatement + newContent.slice(insertPosition);
    } else {
      // No imports yet, add at the beginning
      newContent = "import { logger } from '../logger';\n\n" + newContent;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✅ Converted: ${filePath}`);
    return true;
  }

  return false;
}

/**
 * Recursively find and convert files
 */
function migrateDirectory(dir, pattern = /\.ts$/) {
  let convertedCount = 0;
  
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // Skip node_modules and build directories
      if (!['node_modules', 'dist', 'out', 'release', '.git'].includes(file.name)) {
        convertedCount += migrateDirectory(fullPath, pattern);
      }
    } else if (pattern.test(file.name)) {
      if (convertFile(fullPath)) {
        convertedCount++;
      }
    }
  }
  
  return convertedCount;
}

// Main execution
const electronDir = path.join(__dirname, '..', 'electron');
console.log('🔄 Starting console.log migration...');
console.log(`📁 Directory: ${electronDir}`);

const count = migrateDirectory(electronDir);

console.log(`\n✨ Migration complete! Converted ${count} files.`);
console.log('📝 Please review the changes and test the application.');
