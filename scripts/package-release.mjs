import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SimpleZip } from '../src/services/books/export/SimpleZip.js';

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const zip = new SimpleZip(), files = [];
const date = new Date(2026, 10, 22, 0, 0, 0);
const add = (name, file) => {
  const bytes = readFileSync(file);
  zip.addFile(name, bytes, { date });
  files.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
};
for (const file of walk('dist').sort()) add('app/' + path.relative('dist', file).replaceAll('\\', '/'), file);
add('serve.mjs', 'scripts/serve-release.mjs');
add('README.md', 'docs/RELEASE.md');
for (const file of ['docs/VERIFICATION.md', 'docs/FONTS.md', 'docs/RECOVERY.md', 'docs/ROADMAP.md']) add(file, file);
zip.addFile('manifest.json', JSON.stringify({ version: '1.0.0-local', status: 'release-candidate', files }, null, 2), { date });
mkdirSync('artifacts/releases', { recursive: true });
const name = 'kavyavault-1.0.0-local.zip', bytes = zip.generate();
writeFileSync(path.join('artifacts/releases', name), bytes);
writeFileSync(path.join('artifacts/releases', name + '.sha256'), createHash('sha256').update(bytes).digest('hex') + '  ' + name + '\n');
console.log(`${name}: ${files.length} files, ${bytes.length} bytes`);
