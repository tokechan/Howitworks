import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { projectRoot, siteRoot } from './config.mjs';

export const sourceCmapPath = path.join(siteRoot, 'src/fonts/LINESeedJP.cmap.txt');
export const sourceMetaPath = path.join(siteRoot, 'src/fonts/LINESeedJP-source.json');
export const regularWoff2 = path.join(siteRoot, 'src/fonts/LINESeedJP-Regular.woff2');
export const boldWoff2 = path.join(siteRoot, 'src/fonts/LINESeedJP-Bold.woff2');

const knownTags = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

// ASCII, CJK punctuation, kana, and halfwidth/fullwidth forms. Kanji stay limited
// to characters the manuscripts and UI actually use; the check fails when a new
// one appears, instead of shipping the full ~1.5 MB face.
const baseRanges = [[0x20, 0x7e], [0x3000, 0x303f], [0x3040, 0x30ff], [0xff00, 0xffef]];

export function baseCodepoints() {
  const set = new Set();
  for (const [start, end] of baseRanges) {
    for (let cp = start; cp <= end; cp++) set.add(cp);
  }
  return set;
}

async function walk(dir, accept, out) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.generated') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file, accept, out);
    else if (accept(file)) out.push(file);
  }
}

export async function textSources() {
  const files = [];
  await walk(path.join(projectRoot, 'articles'), file => file.endsWith('.md'), files);
  for (const rel of [
    'notes/brotli-http-auto-decode-2026-10-27.md',
    'notes/brotli-node-linkage-2026-10-27.md',
    'notes/brotli-cve-2026-111497.md',
    'simulators/brotli/README.md',
    'simulators/brotli/verification.md',
    'talks/brotli/README.md',
  ]) files.push(path.join(projectRoot, rel));
  await walk(path.join(siteRoot, 'src'), file => /\.(astro|js|mjs|ts|css)$/.test(file), files);
  await walk(path.join(siteRoot, 'public/js'), file => file.endsWith('.js'), files);
  return files;
}

export async function usedCodepoints() {
  const used = new Set();
  for (const file of await textSources()) {
    const text = await readFile(file, 'utf8');
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x20 && cp !== 0x7f) used.add(cp);
    }
  }
  return used;
}

export function readCmapText(text) {
  const set = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    set.add(Number.parseInt(trimmed, 16));
  }
  return set;
}

function unpackBase128(buf, offset) {
  let result = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[offset + i];
    if (byte === undefined) throw new Error('truncated woff2 base128');
    if (i === 0 && byte === 0x80) throw new Error('invalid woff2 base128');
    result = result * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return [result, offset + i + 1];
  }
  throw new Error('woff2 base128 overflow');
}

function parseFormat4(table, start) {
  const segCount = table.readUInt16BE(start + 6) / 2;
  let p = start + 14;
  const endCode = [];
  for (let i = 0; i < segCount; i++) { endCode.push(table.readUInt16BE(p)); p += 2; }
  p += 2;
  const startCode = [];
  const idDelta = [];
  const idRangeOffset = [];
  for (let i = 0; i < segCount; i++) { startCode.push(table.readUInt16BE(p)); p += 2; }
  for (let i = 0; i < segCount; i++) { idDelta.push(table.readInt16BE(p)); p += 2; }
  const rangeOffset = p;
  for (let i = 0; i < segCount; i++) { idRangeOffset.push(table.readUInt16BE(p)); p += 2; }
  const chars = new Set();
  for (let i = 0; i < segCount; i++) {
    for (let code = startCode[i]; code <= endCode[i]; code++) {
      let glyph = 0;
      if (idRangeOffset[i] === 0) glyph = (code + idDelta[i]) & 0xffff;
      else {
        const loc = rangeOffset + i * 2 + idRangeOffset[i] + (code - startCode[i]) * 2;
        glyph = table.readUInt16BE(loc);
        if (glyph !== 0) glyph = (glyph + idDelta[i]) & 0xffff;
      }
      if (glyph !== 0) chars.add(code);
    }
  }
  return chars;
}

function parseFormat12(table, start) {
  const groups = table.readUInt32BE(start + 12);
  const chars = new Set();
  let p = start + 16;
  for (let i = 0; i < groups; i++) {
    const startCode = table.readUInt32BE(p);
    const endCode = table.readUInt32BE(p + 4);
    const startGlyph = table.readUInt32BE(p + 8);
    p += 12;
    for (let code = startCode; code <= endCode; code++) {
      if (startGlyph + (code - startCode) !== 0) chars.add(code);
    }
  }
  return chars;
}

function parseCmap(table) {
  const subtables = table.readUInt16BE(2);
  const chars = new Set();
  for (let i = 0; i < subtables; i++) {
    const platform = table.readUInt16BE(4 + i * 8);
    const offset = table.readUInt32BE(4 + i * 8 + 4);
    if (platform !== 0 && platform !== 3) continue;
    const format = table.readUInt16BE(offset);
    const parsed = format === 4 ? parseFormat4(table, offset) : format === 12 ? parseFormat12(table, offset) : null;
    if (!parsed) throw new Error(`unsupported cmap format ${format}`);
    for (const cp of parsed) chars.add(cp);
  }
  if (chars.size === 0) throw new Error('cmap contained no Unicode characters');
  return chars;
}

export function woff2Cmap(bytes) {
  if (bytes.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a woff2 font');
  const numTables = bytes.readUInt16BE(12);
  const compressedSize = bytes.readUInt32BE(20);
  const tables = [];
  let cursor = 48;
  for (let i = 0; i < numTables; i++) {
    const flags = bytes[cursor];
    cursor += 1;
    const index = flags & 0x3f;
    const tag = index === 0x3f ? bytes.toString('latin1', cursor, cursor += 4) : knownTags[index];
    const [origLength, afterOrig] = unpackBase128(bytes, cursor);
    cursor = afterOrig;
    const version = flags >> 6;
    const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
    let length = origLength;
    if (transformed) {
      const [transformedLength, after] = unpackBase128(bytes, cursor);
      cursor = after;
      length = transformedLength;
    }
    tables.push({ tag, length, transformed });
  }
  const raw = brotliDecompressSync(bytes.subarray(cursor, cursor + compressedSize));
  let offset = 0;
  let cmap;
  for (const table of tables) {
    const slice = raw.subarray(offset, offset + table.length);
    offset += table.length;
    if (table.tag === 'cmap') {
      if (table.transformed) throw new Error('woff2 cmap is transformed');
      cmap = slice;
    }
  }
  if (offset !== raw.length) throw new Error(`woff2 table sizes do not fill the decompressed font (${offset} != ${raw.length})`);
  if (!cmap) throw new Error('woff2 has no cmap');
  return parseCmap(cmap);
}

export function characters(codepoints) {
  return [...codepoints].sort((a, b) => a - b).map(cp => String.fromCodePoint(cp)).join('');
}

export async function fontCoverage() {
  const [used, metaText, cmapText, regular, bold] = await Promise.all([
    usedCodepoints(),
    readFile(sourceMetaPath, 'utf8'),
    readFile(sourceCmapPath, 'utf8'),
    readFile(regularWoff2),
    readFile(boldWoff2),
  ]);
  const meta = JSON.parse(metaText);
  const cmapHash = createHash('sha256').update(cmapText).digest('hex');
  if (cmapHash !== meta.cmapSha256) throw new Error('LINE Seed source cmap does not match LINESeedJP-source.json');
  const source = readCmapText(cmapText);
  if (source.size !== meta.cmapCount) throw new Error(`LINE Seed source cmap has ${source.size} characters, expected ${meta.cmapCount}`);
  const regularCmap = woff2Cmap(regular);
  const boldCmap = woff2Cmap(bold);
  const required = new Set();
  for (const cp of used) if (source.has(cp)) required.add(cp);
  for (const cp of baseCodepoints()) if (source.has(cp)) required.add(cp);
  const missing = [...required].filter(cp => !regularCmap.has(cp) || !boldCmap.has(cp)).sort((a, b) => a - b);
  const notInUpstream = [...used].filter(cp => !source.has(cp)).sort((a, b) => a - b);
  const recorded = [...meta.notInUpstream].sort((a, b) => a.codePointAt(0) - b.codePointAt(0) || a.length - b.length);
  return {
    used: used.size,
    required: required.size,
    regular: regularCmap.size,
    bold: boldCmap.size,
    regularBytes: regular.length,
    boldBytes: bold.length,
    missing,
    notInUpstream: characters(notInUpstream),
    recordedNotInUpstream: recorded.join(''),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await fontCoverage();
  console.log(JSON.stringify({ ...report, missing: characters(report.missing) }));
}
