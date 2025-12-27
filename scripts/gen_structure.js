#!/usr/bin/env node
/**
 * Project Structure Generator
 * 
 * Generates a tree-style output of the project folder structure.
 * Cross-platform, no external dependencies required.
 * 
 * Usage: node scripts/gen_structure.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_FILE = 'docs/PROJECT_STRUCTURE.md';
const ROOT_DIR = process.cwd();

// Directories and files to exclude
const EXCLUDE_DIRS = new Set([
  '.git',
  '.dart_tool',
  'build',
  '.idea',
  '.vscode',
  'node_modules',
  'Pods',
  '.gradle',
  '.symlinks',
  '__pycache__',
  '.cache',
  'coverage',
  '.pub-cache',
  'ephemeral',
]);

// File patterns to exclude
const EXCLUDE_PATTERNS = [
  /\.lock$/,           // Lock files
  /\.g\.dart$/,        // Generated Dart files
  /\.freezed\.dart$/,  // Freezed generated files
  /\.DS_Store$/,       // macOS metadata
  /Thumbs\.db$/,       // Windows metadata
  /\.iml$/,            // IntelliJ module files
];

// Specific files to exclude
const EXCLUDE_FILES = new Set([
  '.flutter-plugins',
  '.flutter-plugins-dependencies',
  '.packages',
  '.metadata',
  'GeneratedPluginRegistrant.swift',
  'GeneratedPluginRegistrant.java',
  'GeneratedPluginRegistrant.h',
  'GeneratedPluginRegistrant.m',
  'generated_plugin_registrant.dart',
  'generated_plugin_registrant.cc',
  'generated_plugins.cmake',
]);

/**
 * Check if a file/directory should be excluded
 */
function shouldExclude(name, isDir) {
  if (isDir && EXCLUDE_DIRS.has(name)) return true;
  if (EXCLUDE_FILES.has(name)) return true;
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(name)) return true;
  }
  return false;
}

/**
 * Recursively build tree structure
 */
function buildTree(dir, prefix = '', isLast = true) {
  const lines = [];
  
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return lines;
  }
  
  // Filter and sort entries (directories first, then files)
  const filtered = entries
    .filter(entry => !shouldExclude(entry.name, entry.isDirectory()))
    .sort((a, b) => {
      // Directories first
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  
  filtered.forEach((entry, index) => {
    const isLastEntry = index === filtered.length - 1;
    const connector = isLastEntry ? '└── ' : '├── ';
    const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
    
    lines.push(`${prefix}${connector}${name}`);
    
    if (entry.isDirectory()) {
      const newPrefix = prefix + (isLastEntry ? '    ' : '│   ');
      const subTree = buildTree(path.join(dir, entry.name), newPrefix, isLastEntry);
      lines.push(...subTree);
    }
  });
  
  return lines;
}

/**
 * Generate the markdown content
 */
function generateMarkdown() {
  const timestamp = new Date().toISOString();
  const projectName = path.basename(ROOT_DIR);
  
  const treeLines = buildTree(ROOT_DIR);
  const tree = `${projectName}/\n${treeLines.join('\n')}`;
  
  return `# Project Structure

> Auto-generated file. Do not edit manually.
> 
> **Generated:** ${timestamp}
> 
> **Command:** \`node scripts/gen_structure.js\` or \`./scripts/gen_structure.sh\`

## Directory Tree

\`\`\`
${tree}
\`\`\`

## Notes

- This file is automatically updated via a pre-commit hook
- Excluded: \`.git/\`, \`.dart_tool/\`, \`build/\`, \`Pods/\`, \`.gradle/\`, \`node_modules/\`, lock files, generated files
- To regenerate manually: \`./scripts/gen_structure.sh\`
`;
}

/**
 * Main execution
 */
function main() {
  // Ensure docs directory exists
  const docsDir = path.join(ROOT_DIR, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  const content = generateMarkdown();
  const outputPath = path.join(ROOT_DIR, OUTPUT_FILE);
  
  // Check if content changed (for idempotency)
  if (fs.existsSync(outputPath)) {
    const existing = fs.readFileSync(outputPath, 'utf8');
    // Compare without timestamp line
    const normalizeForComparison = (str) => 
      str.replace(/\*\*Generated:\*\* .+/, '').trim();
    
    if (normalizeForComparison(existing) === normalizeForComparison(content)) {
      console.log('📁 Project structure unchanged.');
      return false; // No changes
    }
  }
  
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`✅ Generated ${OUTPUT_FILE}`);
  return true; // Changes made
}

// Run and exit with appropriate code
const changed = main();
process.exit(changed ? 0 : 0); // Always success, just indicates if changed
