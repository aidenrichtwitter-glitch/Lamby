const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ELECTRON_DIR = path.join(ROOT, 'electron-browser');
const ELECTRON_DIST = path.join(ELECTRON_DIR, 'dist');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function run(cmd, cwd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: cwd || ROOT });
}

console.log('=== Step 1/4: Building web assets (vite build) ===');
run('npx vite build');

console.log('\n=== Step 2/4: Copying dist → electron-browser/dist ===');
if (fs.existsSync(ELECTRON_DIST)) {
  fs.rmSync(ELECTRON_DIST, { recursive: true });
}
copyRecursive(DIST, ELECTRON_DIST);
console.log('Done.');

console.log('\n=== Step 3/4: Installing electron-browser dependencies ===');
run('npm install', ELECTRON_DIR);

const isLinux = process.argv.includes('--linux');
const platform = isLinux ? '--linux' : '--win --x64';
console.log(`\n=== Step 4/4: Packaging ${isLinux ? 'Linux' : 'Windows'} app ===`);
run(`npx --yes electron-builder@latest ${platform}`, ELECTRON_DIR);

console.log('\n=== BUILD COMPLETE ===');
const outputDir = path.join(ELECTRON_DIR, 'dist-electron');
console.log(`Output: ${outputDir}`);
console.log(isLinux ? 'Look for the AppImage/deb in the folder above.' : 'Look for the .exe installer in the folder above.');
