import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { siteRoot } from './config.mjs';
import { baseCodepoints, sourceCmapPath, sourceMetaPath, regularWoff2, boldWoff2, usedCodepoints } from './line-seed.mjs';

const release = 'v20260828';
const zipName = `seed-${release}.zip`;
const zipUrl = `https://github.com/line/seed/releases/download/${release}/${zipName}`;
const zipSha256 = '58dee0e2b140c3b3d4769b34059fa7150aee7d3c8326358bd87c0879ef98a5b7';
const faces = {
  Regular: {
    zipPath: `seed-${release}/LINESeedJP/fonts/ttf/LINESeedJP-Regular.ttf`,
    sha256: '5bd423688e032442b377e14687a629e7b2429998c10b9b06936537e7263493a5',
    bytes: 3663744,
  },
  Bold: {
    zipPath: `seed-${release}/LINESeedJP/fonts/ttf/LINESeedJP-Bold.ttf`,
    sha256: '53490f437af892d2ae7cf3bdc5ebef9db33ded119d2a53a6d447ac451d61fbd7',
    bytes: 3776608,
  },
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    const out = [];
    child.stdout.on('data', chunk => out.push(chunk));
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${cmd} exited ${code}`)));
  });
}

async function cachedZip(dir) {
  const file = path.join(dir, zipName);
  try {
    const bytes = await readFile(file);
    if (sha256(bytes) === zipSha256) return bytes;
  } catch { /* download */ }
  const response = await fetch(zipUrl);
  if (!response.ok) throw new Error(`failed to download ${zipUrl}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== zipSha256) throw new Error(`checksum mismatch for ${zipUrl}`);
  await writeFile(file, bytes);
  return bytes;
}

const zipBytes = await cachedZip(await mkdir(path.join(siteRoot, '.generated/line-seed'), { recursive: true }).then(() => path.join(siteRoot, '.generated/line-seed')));
const cache = path.join(siteRoot, '.generated/line-seed');
await writeFile(path.join(cache, zipName), zipBytes);

const extracted = {};
for (const [weight, face] of Object.entries(faces)) {
  const bytes = await run('python3', ['-c', `
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extract(sys.argv[2], sys.argv[3])
`, path.join(cache, zipName), face.zipPath, cache]);
  void bytes;
  const ttf = path.join(cache, face.zipPath);
  const font = await readFile(ttf);
  if (font.length !== face.bytes || sha256(font) !== face.sha256) throw new Error(`unexpected ${weight} font bytes`);
  extracted[weight] = ttf;
}

const cmapDump = (await run('python3', ['-c', `
from fontTools.ttLib import TTFont
import sys
fonts = [set(TTFont(p).getBestCmap()) for p in sys.argv[1:]]
if fonts[0] != fonts[1]:
    raise SystemExit("Regular and Bold Unicode cmaps differ")
print("\\n".join(f"{cp:04X}" for cp in sorted(fonts[0])))
`, extracted.Regular, extracted.Bold])).toString();
const source = new Set(cmapDump.trim().split('\n').map(line => Number.parseInt(line, 16)));
const cmapText = `# Unicode cmap shared by LINE Seed JP Regular and Bold\n# ${release} ${zipUrl}\n${cmapDump.trim()}\n`;
await writeFile(sourceCmapPath, cmapText);

const used = await usedCodepoints();
const target = new Set();
for (const cp of used) if (source.has(cp)) target.add(cp);
for (const cp of baseCodepoints()) if (source.has(cp)) target.add(cp);
const unicodes = path.join(cache, 'unicodes.txt');
await writeFile(unicodes, [...target].sort((a, b) => a - b).map(cp => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`).join('\n') + '\n');
const notInUpstream = [...used].filter(cp => !source.has(cp)).sort((a, b) => a - b).map(cp => String.fromCodePoint(cp));

for (const [weight, ttf] of Object.entries(extracted)) {
  const out = weight === 'Regular' ? regularWoff2 : boldWoff2;
  await run('python3', ['-m', 'fontTools.subset', ttf,
    `--unicodes-file=${unicodes}`, '--flavor=woff2', `--output-file=${out}`,
    '--layout-features=*', '--recommended-glyphs', '--notdef-glyph', '--notdef-outline',
    '--legacy-cmap', '--symbol-cmap', '--name-IDs=*', '--name-legacy', '--name-languages=*',
    '--no-ignore-missing-unicodes', '--drop-tables+=DSIG']);
  console.log(`${weight} ${ (await readFile(out)).length } bytes`);
}

const meta = {
  release,
  url: zipUrl,
  zipSha256,
  ttf: Object.fromEntries(Object.entries(faces).map(([weight, face]) => [path.basename(face.zipPath), { bytes: face.bytes, sha256: face.sha256 }])),
  cmapCount: source.size,
  cmapSha256: sha256(cmapText),
  notInUpstream,
  subset: 'Characters used by articles (including drafts), the notes and guides rendered with this font, and site UI, plus ASCII, kana, and related punctuation that the upstream font contains.',
};
await writeFile(sourceMetaPath, `${JSON.stringify(meta, null, 2)}\n`);
await access(regularWoff2);
console.log(`upstream gaps: ${notInUpstream.join(' ') || '(none)'}`);
