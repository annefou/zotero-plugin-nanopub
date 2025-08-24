const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const replace = require('replace-in-file');

async function build() {
  // Clean build directory
  const buildDir = path.join(__dirname, '..', 'build');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy addon files
  const addonDir = path.join(__dirname, '..', 'addon');
  const buildAddonDir = path.join(buildDir, 'addon');
  copyRecursive(addonDir, buildAddonDir);

  // Build TypeScript
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'build/addon/content/scripts/index.js',
    platform: 'browser',
    target: 'firefox102',
    format: 'iife',
    globalName: 'ZoteroNanopub',
    external: ['zotero-plugin-toolkit'],
  });

  // Replace variables in manifest
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  await replace({
    files: 'build/addon/manifest.json',
    from: [/__addonName__/g, /__version__/g, /__addonID__/g, /__description__/g, /__author__/g, /__homepage__/g],
    to: [pkg.config.addonName, pkg.version, pkg.config.addonID, pkg.description, pkg.author, pkg.homepage],
  });

  // Create XPI
  const archiver = require('archiver');
  const output = fs.createWriteStream(path.join(buildDir, 'nanopub.xpi'));
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);
  archive.directory(buildAddonDir, false);
  await archive.finalize();

  console.log('Build complete: build/nanopub.xpi');
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Also need archiver for creating XPI
if (!fs.existsSync('node_modules/archiver')) {
  console.log('Installing archiver...');
  require('child_process').execSync('npm install --save-dev archiver');
}

build().catch(console.error);
