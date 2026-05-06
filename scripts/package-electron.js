import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

console.log('📦 Packaging Electron app...');

// Clean old release to avoid stale files
const releaseDir = join(rootDir, 'release');
if (existsSync(releaseDir)) {
  console.log('🗑  Cleaning old release...');
  rmSync(releaseDir, { recursive: true });
}

execSync(
  'npx electron-packager . "Hammer Omni" ' +
  '--platform=win32 --arch=x64 --out=release --overwrite ' +
  '--ignore="^\\/src$" ' +
  '--ignore="^\\/electron$" ' +
  '--ignore="^\\/scripts$" ' +
  '--ignore="^\\/\\.kiro$" ' +
  '--ignore="^\\/\\.git$" ' +
  '--ignore="^\\/node_modules$" ' +
  '--ignore="^\\/dist$"',
  { cwd: rootDir, stdio: 'inherit' }
);

const appDir = join(rootDir, 'release', 'Hammer Omni-win32-x64', 'resources', 'app');

// Copy dist (Vite build output)
const distSrc = join(rootDir, 'dist');
const distDest = join(appDir, 'dist');
if (existsSync(distDest)) rmSync(distDest, { recursive: true });
console.log('📁 Copying dist...');
copyDir(distSrc, distDest);

// Copy dist-electron (Electron main/preload)
const distElectronSrc = join(rootDir, 'dist-electron');
const distElectronDest = join(appDir, 'dist-electron');
if (existsSync(distElectronDest)) rmSync(distElectronDest, { recursive: true });
console.log('📁 Copying dist-electron...');
copyDir(distElectronSrc, distElectronDest);

console.log('\n✅ Done!');
console.log('📍 Exe: release/Hammer Omni-win32-x64/Hammer Omni.exe');
