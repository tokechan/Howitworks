import { mkdir, copyFile } from 'node:fs/promises';

const talk = new URL('../', import.meta.url);
const project = new URL('../../', talk);
const files = [
  ...['index.html', 'styles.css', 'app.mjs', 'model.mjs'].map(name => [
    `simulators/brotli/dist/${name}`, `public/simulator/${name}`,
  ]),
  ['simulators/brotli/screenshots/patch-flow.jpg', 'public/evidence/patch-flow.jpg'],
  ['experiments/brotli-http/result-2026-10-27.txt', 'public/evidence/result-2026-10-27.txt'],
];
for (const [source, target] of files) {
  const destination = new URL(target, talk);
  await mkdir(new URL('./', destination), { recursive: true });
  await copyFile(new URL(source, project), destination);
}
await mkdir(new URL('public/licenses/', talk), { recursive: true });
for (const [pkg, name] of [
  ['slidev-theme-geist', 'slidev-theme-geist.txt'],
  ['@fontsource-variable/inter', 'inter.txt'],
  ['@fontsource-variable/noto-sans-jp', 'noto-sans-jp.txt'],
]) {
  await copyFile(new URL(`node_modules/${pkg}/LICENSE`, talk), new URL(`public/licenses/${name}`, talk));
}
console.log(`Prepared ${files.length} local demo/evidence assets.`);
