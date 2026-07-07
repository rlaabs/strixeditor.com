// sync.mjs — keep the site's version metadata in one place.
//
// The Strix app versions used to be duplicated across index.html (JSON-LD
// softwareVersion, twice), sitemap.xml (<lastmod>), and changelog.html, and
// they drifted (JSON-LD said 1.2.0 / 1.0 while the apps were 1.3.0 / 1.1).
// This script makes version.json the single source of truth and rewrites the
// mechanical spots from it. Run after bumping version.json:
//
//   node sync.mjs
//
// It updates:  index.html JSON-LD softwareVersion (Mac + iPad), sitemap.xml
//              <lastmod>.
// It validates: changelog.html has a top entry matching each app version
//              (warns loudly if not — changelog prose is authored by hand).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const ver = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));

let changed = 0;
let warnings = 0;
const warn = (m) => { warnings++; console.warn(`  ⚠ ${m}`); };

// Replace the first "softwareVersion" that appears after a given app-name
// anchor inside the JSON-LD blocks — targets the right app without disturbing
// the other block.
function setSoftwareVersion(html, appName, version) {
  const anchor = `"name": "${appName}"`;
  const at = html.indexOf(anchor);
  if (at === -1) { warn(`JSON-LD block for "${appName}" not found`); return html; }
  const swRe = /"softwareVersion":\s*"[^"]*"/;
  const tail = html.slice(at);
  if (!swRe.test(tail)) { warn(`softwareVersion not found after "${appName}"`); return html; }
  return html.slice(0, at) + tail.replace(swRe, `"softwareVersion": "${version}"`);
}

// --- index.html : JSON-LD softwareVersion (Mac + iPad) ------------------------
{
  const p = join(root, 'index.html');
  const before = readFileSync(p, 'utf8');
  let html = before;
  html = setSoftwareVersion(html, 'Strix SQLite for Mac', ver.mac);
  html = setSoftwareVersion(html, 'Strix SQLite for iPad', ver.ipad);
  if (html !== before) { writeFileSync(p, html); changed++; console.log(`  ✓ index.html JSON-LD → mac ${ver.mac}, ipad ${ver.ipad}`); }
  else console.log('  = index.html JSON-LD already current');
}

// --- sitemap.xml : <lastmod> --------------------------------------------------
{
  const p = join(root, 'sitemap.xml');
  const before = readFileSync(p, 'utf8');
  const after = before.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${ver.date}</lastmod>`);
  if (after !== before) { writeFileSync(p, after); changed++; console.log(`  ✓ sitemap.xml <lastmod> → ${ver.date}`); }
  else console.log('  = sitemap.xml already current');
}

// --- changelog.html : validate (do not generate) ------------------------------
// The changelog is hand-authored narrative; we only assert it has an entry for
// each current version so version.json and the visible notes can't silently
// disagree.
{
  const html = readFileSync(join(root, 'changelog.html'), 'utf8');
  for (const [label, v] of [['Mac', ver.mac], ['iPad', ver.ipad]]) {
    if (!html.includes(`class="version-number">${v}<`)) {
      warn(`changelog.html has no ${label} entry for version ${v} — add one before deploying.`);
    } else {
      console.log(`  ✓ changelog.html has ${label} ${v} entry`);
    }
  }
}

console.log(`\nsync: ${changed} file(s) updated, ${warnings} warning(s).`);
process.exit(warnings ? 1 : 0);
