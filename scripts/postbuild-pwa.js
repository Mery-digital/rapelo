const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const publicDir = path.resolve(__dirname, '..', 'public');
const indexPath = path.join(distDir, 'index.html');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Ensure all files from public/ are present in dist/
copyDirRecursive(publicDir, distDir);

// 2. Inject PWA manifest, icons, meta tags, and Service Worker registration into dist/index.html
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace('<html lang="en">', '<html lang="fr">');

  const pwaHeadTags = `
    <meta name="application-name" content="RAPELO" />
    <meta name="description" content="Application professionnelle de gestion d'atelier électronique et réparation (téléphones, PC, TV, consoles) avec suivi client par WhatsApp et SMS." />
    <meta name="theme-color" content="#0F172A" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="RAPELO" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .catch(function (err) {
              console.warn('SW registration failed:', err);
            });
        });
      }
    </script>
  `;

  if (!html.includes('rel="manifest"')) {
    html = html.replace('</head>', `${pwaHeadTags}\n</head>`);
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Successfully injected PWA tags and Service Worker into dist/index.html');
} else {
  console.warn('dist/index.html not found');
}
