import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Preserve the license material delivered by every locked runtime dependency.
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const notices = ['KavyaVault third-party runtime dependency notices\nFont licenses are distributed separately in fonts/OFL*.txt.\n'];
for (const [directory, entry] of Object.entries(lock.packages).sort()) {
  if (!directory || entry.dev || entry.optional) continue;
  const meta = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  notices.push(`\n=== ${meta.name} ${meta.version} ===\nDeclared license: ${meta.license}\nAuthor: ${JSON.stringify(meta.author || meta.contributors || '')}\nRepository: ${JSON.stringify(meta.repository || '')}\n`);
  const files = readdirSync(directory).filter(name => /^(licen[cs]e|notice|copyright)/i.test(name));
  for (const file of files) notices.push(`\n${file}\n${readFileSync(path.join(directory, file), 'utf8')}`);
  if (!files.length) {
    const readme = readdirSync(directory).find(name => /^readme\.md$/i.test(name));
    if (readme) {
      const contents = readFileSync(path.join(directory, readme), 'utf8');
      notices.push(contents.slice(contents.toLowerCase().lastIndexOf('## license')));
    }
  }
}
// The Brotli decoder retains Google's original Apache notice in its sources.
const brotli = readFileSync('node_modules/brotli/dec/decode.js', 'utf8');
notices.push('\nBrotli decoder source notice:\n' + brotli.slice(0, brotli.indexOf('*/') + 2));
notices.push('\nApache-2.0 license text is included above with @swc/helpers.\nMIT permission text (for dependencies declaring MIT above):\n' + readFileSync('node_modules/restructure/LICENSE', 'utf8').replace(/^Copyright[^\n]*\n/m, 'Copyright remains with the respective upstream authors identified above.\n'));
writeFileSync('public/THIRD-PARTY-NOTICES.txt', notices.join('\n'));
console.log('Bundled locked runtime dependency notices.');
