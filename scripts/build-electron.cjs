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

function run(cmd, cwd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: cwd || ROOT });
}

const isLinux = process.argv.includes('--linux');
const totalSteps = isLinux ? 4 : 5;

console.log(`=== Step 1/${totalSteps}: Building web assets (vite build) ===`);
run('npx vite build');

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

  console.log(`\n=== Step 5/${totalSteps}: Creating Inno Setup installer ===`);
  const issPath = path.join(ELECTRON_DIR, 'build', 'installer.iss');
  const winUnpacked = path.join(OUTPUT_DIR, 'win-unpacked');
  if (!fs.existsSync(winUnpacked)) {
    console.error('ERROR: win-unpacked directory not found at ' + winUnpacked);
    console.error('electron-builder --dir must produce exe/win-unpacked/ before Inno Setup can run.');
    process.exit(1);
  }

  try {
    run(`iscc "${issPath}"`, ELECTRON_DIR);
  } catch (e) {
    console.log('\n--- Inno Setup (iscc) not found on PATH ---');
    console.log('To create the installer, install Inno Setup 6 from:');
    console.log('  https://jrsoftware.org/isdl.php');
    console.log('Then either:');
    console.log('  1. Add ISCC.exe to your PATH, or');
    console.log('  2. Run manually: iscc electron-browser\\build\\installer.iss');
    console.log('\nThe unpacked app is ready at: exe\\win-unpacked\\');
    console.log('You can run Lamby.exe directly from there without installing.\n');
  }

  console.log('\n=== BUILD COMPLETE ===');
  console.log(`Output: ${OUTPUT_DIR}`);
  const setupExe = path.join(OUTPUT_DIR, 'Lamby-Setup.exe');
  if (fs.existsSync(setupExe)) {
    console.log('Installer: exe/Lamby-Setup.exe');
  } else {
    console.log('Unpacked app: exe/win-unpacked/Lamby.exe');
    console.log('(Run iscc to create the installer — see instructions above)');
  }
}
