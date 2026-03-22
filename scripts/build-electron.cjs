const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ELECTRON_DIR = path.join(ROOT, 'electron-browser');
const ELECTRON_DIST = path.join(ELECTRON_DIR, 'dist');
const OUTPUT_DIR = path.join(ROOT, 'exe');

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

function run(cmd, cwd, env) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: cwd || ROOT, env: { ...process.env, ...env } });
}

const isLinux = process.argv.includes('--linux');
const totalSteps = isLinux ? 4 : 5;

console.log(`=== Step 1/${totalSteps}: Building web assets (vite build) ===`);
run('npx vite build', ROOT, { ELECTRON_BUILD: '1' });

console.log(`\n=== Step 2/${totalSteps}: Copying dist → electron-browser/dist ===`);
if (fs.existsSync(ELECTRON_DIST)) {
  fs.rmSync(ELECTRON_DIST, { recursive: true });
}
copyRecursive(DIST, ELECTRON_DIST);
console.log('Done.');

console.log(`\n=== Step 3/${totalSteps}: Installing electron-browser dependencies ===`);
run('npm install', ELECTRON_DIR);

if (isLinux) {
  console.log(`\n=== Step 4/${totalSteps}: Packaging Linux app ===`);
  run('npx electron-builder --linux', ELECTRON_DIR);
  console.log('\n=== BUILD COMPLETE ===');
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('Look for the AppImage in the exe/ folder.');
} else {
  console.log(`\n=== Step 4/${totalSteps}: Packaging Windows app (unpacked) ===`);
  run('npx electron-builder --win --x64', ELECTRON_DIR);

  console.log(`\n=== Step 5/${totalSteps}: Compiling Inno Setup installer ===`);
  const issPath = path.join(ELECTRON_DIR, 'build', 'installer.iss');
  const winUnpacked = path.join(OUTPUT_DIR, 'win-unpacked');
  if (!fs.existsSync(winUnpacked)) {
    console.error('ERROR: win-unpacked directory not found at ' + winUnpacked);
    process.exit(1);
  }

  const innoCompiler = require(path.join(ELECTRON_DIR, 'node_modules', 'innosetup-compiler'));
  innoCompiler(issPath, { gui: false, verbose: true }, function (err) {
    if (err) {
      console.error('Inno Setup compilation failed:', err.message);
      process.exit(1);
    }
    console.log('\n=== BUILD COMPLETE ===');
    console.log(`Output: ${OUTPUT_DIR}`);
    console.log('Installer: exe/Lamby-Setup.exe');
  });
}
