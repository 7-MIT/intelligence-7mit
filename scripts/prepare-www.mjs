// Menyalin aset frontend ke folder www/ untuk dibungkus Capacitor.
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';

const skip = new Set(["src", 'node_modules', 'www', 'android', 'scripts', 'assets', 'resources', 'functions']);
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const name of readdirSync('.')) {
  if (name.startsWith('.') || skip.has(name)) continue;
  if (/^(package(-lock)?\.json|capacitor\.config\.json|wrangler\.jsonc|README\.md|BACA-DULU\.txt)$/.test(name)) continue;
  cpSync(name, `www/${name}`, { recursive: true });
}
console.log('www siap');
