import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const outDir = join(rootDir, 'dist', 'Hammer Omni-win32-x64');
const appDir = join(outDir, 'resources', 'app');

console.log('Building Vite...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

console.log('Packaging Electron...');
execSync('npx electron-packager . "Hammer Omni" --platform=win32 --arch=x64 --out=dist --overwrite --ignore="^/node_modules$" --prune=true', { 
  cwd: rootDir, 
  stdio: 'inherit' 
});

console.log('Copying dist to resources...');
const distSrc = join(rootDir, 'dist');
const distDest = join(appDir, 'dist');

if (existsSync(distDest)) {
  rmSync(distDest, { recursive: true });
}

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

copyDir(distSrc, distDest);

console.log('Done! Exe location: ' + join(outDir, 'Hammer Omni.exe'));