// Stage 1: only files actually referenced by the original article are exposed.
export const references = [
  { id: 'http-client', source: 'experiments/brotli-http/client.mjs', title: 'HTTP検証のクライアントコード' },
  { id: 'http-run', source: 'experiments/brotli-http/run.mjs', title: 'HTTP検証の実行コード' },
  { id: 'http-result', source: 'experiments/brotli-http/result-2026-10-27.txt', title: 'HTTP検証の実行ログ' },
  { id: 'research', source: 'notes/brotli-cve-2026-111497.md', title: 'Brotliの調査ノート' },
  { id: 'http-note', source: 'notes/brotli-http-auto-decode-2026-10-27.md', title: 'HTTP自動展開の検証記録' },
  { id: 'linkage', source: 'notes/brotli-node-linkage-2026-10-27.md', title: 'Node.jsのリンク方式の検証記録' },
  { id: 'simulator-guide', source: 'simulators/brotli/README.md', title: 'Brotli Visualizerの操作説明' },
  { id: 'simulator-model', source: 'simulators/brotli/dist/model.mjs', title: 'Brotli Visualizerの説明モデル' },
  { id: 'simulator-checks', source: 'simulators/brotli/verification.md', title: 'Brotli Visualizerの確認記録' },
  { id: 'talk-guide', source: 'talks/brotli/README.md', title: 'Brotli LTの操作説明' },
] as const;

export const articleImage = 'simulators/brotli/screenshots/patch-flow.jpg';
export const simulatorFiles = ['index.html', 'styles.css', 'app.mjs', 'model.mjs'];
