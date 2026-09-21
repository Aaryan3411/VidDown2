import fs from 'fs';
import path from 'path';

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
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

// 1. Copy compiled assets to root assets/ (for GitHub Pages: Deploy from branch -> main -> / root)
copyRecursive('dist/assets', 'assets');

// 2. Ensure favicon is in root
if (fs.existsSync('dist/favicon.svg')) {
  fs.copyFileSync('dist/favicon.svg', 'favicon.svg');
}

// 3. Create .nojekyll in root to prevent GitHub Pages Jekyll processing
fs.writeFileSync('.nojekyll', '');

console.log('GitHub Pages root static assets synchronized successfully into /assets');
