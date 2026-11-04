// Educational state model. No decompressor or malicious input is executed here.
// Final normal-body sizes come from experiments/brotli-http/result-2026-10-27.txt.
export const OBSERVATION = Object.freeze({ compressed: 103, original: 4280, node: '24.22.1', undici: '7.30.1', date: '2026-10-27' });

export const MODES = Object.freeze({
  api: {
    name: 'APIの違い', title: '同じ本文。違う受け取り方。',
    subtitle: 'fetchとnode:httpを、同じHTTP応答で比較します。',
    steps: ['準備', 'リクエスト', 'ヘッダー', '本文を受信', '経路を選ぶ', '本文を処理', '読み出す', '結果を比較'],
    evidence: '最終結果は実測値。途中のステップは処理経路を説明するモデルです。',
  },
  stream: {
    name: '正常な入力待ち', title: 'まだ届いていない。だから、待つ。',
    subtitle: '正常な入力を3つの断片に分け、fetch内部のデコーダーを追います。',
    steps: ['準備', '接続', '断片Aが届く', '入力待ち', '断片Bが届く', '入力待ち', '断片Cが届く', '展開完了'],
    evidence: '断片の分け方と待機位置は模式表現。実際のチャンク境界・出力タイミングではありません。',
  },
  patch: {
    name: '修正前と修正後', title: '待つべきか。止めるべきか。',
    subtitle: '同じ種類の不正な入力を、修正前後で並べて追います。',
    steps: ['準備', '入力が届く', '不正な切り替え', '判断が分かれる', '結果を伝える', '入力の追加', '境界と停止', '違いを確認'],
    evidence: '公式説明・修正差分に基づくモデル。攻撃、メモリ破壊、修正の有効性を実行検証するものではありません。',
  },
});

const API_CODE = {
  fetch: [
    '// Node.jsで使った受信コードの要点',
    'const response = await fetch(url, {',
    "  headers: { 'Accept-Encoding': 'br' }", '});',
    '// 本文はfetch内部の処理経路を通る',
    'const body = await response.arrayBuffer();',
    'body.byteLength;',
  ],
  http: [
    '// node:httpでの受信コードの要点',
    "get(url, { headers: {", "  'Accept-Encoding': 'br'", '} }, async (response) => {',
    '  const chunks = [];', '  for await (const part of response)', '    chunks.push(part);',
    '  const body = Buffer.concat(chunks);', '});',
  ],
};
const STREAM_CODE = [
  '// デコーダー内部の流れを表す擬似コード',
  'Brotliデコーダーを接続する',
  '次の断片を受け取る',
  '続きを読み取る',
  '入力不足なら状態を保存して待つ',
  '次の断片が来たら、同じ状態から再開',
  '最後まで読めたら成功を返す',
];
const PATCH_CODE = {
  before: ['// 修正前の問題がある経路：擬似コード', 'ブロック切り替えを読む', '不正でも false を返す', '呼び出し側が「入力不足」と扱う', '入力を追加して、再び読み取る', '不正な状態で追加が続き得る'],
  after: ['// 修正後の状態伝播：擬似コード', 'ブロック切り替えを読む', '不正なら FORMAT_BLOCK_SWITCH', '形式エラーを呼び出し側へ伝える', '展開をエラーで終了する', '入力不足の場合だけ、続きを待つ'],
};

export function clampStep(mode, value) {
  if (!MODES[mode]) throw new Error(`Unknown mode: ${mode}`);
  return Math.max(0, Math.min(MODES[mode].steps.length - 1, Number.isFinite(value) ? Math.trunc(value) : 0));
}

export function getFrame(mode = 'api', rawStep = 0, encoding = 'br') {
  const step = clampStep(mode, rawStep);
  const base = { mode, step, title: MODES[mode].steps[step], total: MODES[mode].steps.length, complete: step === 7, waitForInput: false };
  if (mode === 'api') return { ...base, ...apiFrame(step, encoding === 'br') };
  if (mode === 'stream') return { ...base, ...streamFrame(step) };
  return { ...base, ...patchFrame(step) };
}

function apiFrame(step, br) {
  const decoding = br;
  const descriptions = [
    'サーバーは、同じ圧縮済み本文103バイトを返します。2つのAPIの違いを見ていきましょう。',
    'どちらもAccept-Encoding: brを送ります。これは「brの応答を受け取れる」という広告です。',
    br ? '応答のContent-Encoding: brは「本文にBrotliの符号化が適用されている」と伝えます。' : '同じ圧縮済み本文にContent-Encodingを付けない比較条件です。',
    '両方に届くHTTP本文は、同じ103バイトです。ここで本文が変わるわけではありません。',
    br ? 'fetchはbrを見てデコーダーを接続します。node:httpには、Content-Encodingによる自動展開がありません。' : 'Content-Encodingがないため、fetchもBrotliデコーダーを接続しません。',
    br ? 'fetch内部ではBrotliを展開します。node:httpでは、圧縮されたバイト列がそのまま流れます。' : 'どちらの経路も、圧縮済みのバイト列をそのまま渡します。',
    br ? '本文を最後まで読み出すと、fetchは4,280バイト、node:httpは103バイトです。' : '最後まで読み出した本文は、どちらも103バイト。圧縮されたままです。',
    br ? '違いは途中のデコーダーです。自分の受信コードに展開APIを書かなくても、fetch内部で展開されました。' : '本文が同じでも、ヘッダーが変わるとfetchの処理経路が変わります。',
  ];
  const lanes = ['fetch', 'http'].map(id => {
    const decodes = id === 'fetch' && decoding;
    return {
      id, name: id === 'fetch' ? 'fetch' : 'node:http',
      active: step < 3 ? 'source' : step < 4 ? 'input' : step < 6 ? (decodes ? 'decoder' : 'bypass') : 'output',
      status: step < 3 ? '受信前' : step < 4 ? '受信済み' : step < 6 ? (decodes ? '展開する' : 'そのまま渡す') : '読み出し完了',
      tone: step >= 6 ? 'success' : 'neutral', decodes,
      routeKnown: step >= 4,
      bytes: step >= 6 ? (decodes ? OBSERVATION.original : OBSERVATION.compressed) : null,
      result: step >= 6 ? (decodes ? '元の本文と一致' : '圧縮済み本文と一致') : '本文の読み出し前',
    };
  });
  return {
    description: descriptions[step], lanes, br, chunks: [],
    code: [
      { title: 'fetch', lines: API_CODE.fetch, active: step === 0 ? [] : step <= 2 ? [2, 3, 4] : step <= 5 ? [5, 6] : [6, 7] },
      { title: 'node:http', lines: API_CODE.http, active: step === 0 ? [] : step <= 2 ? [2, 3, 4] : step <= 5 ? [5, 6, 7] : [8] },
    ],
    note: 'Content-Lengthは送信時の103バイト。ここで測るのは、アプリが最後まで読み出した本文です。',
  };
}

function streamFrame(step) {
  const arrived = step < 2 ? 0 : step < 4 ? 1 : step < 6 ? 2 : 3;
  const waiting = step === 3 || step === 5;
  const descriptions = [
    '圧縮された正常な本文を、A・B・Cの3つの断片で届けるモデルです。1つずつ進めてみましょう。',
    'fetchがContent-Encoding: brを見て、Brotliデコーダーを本文の経路に接続します。',
    '断片Aが届きました。デコーダーは、今ある入力で読めるところまで処理します。',
    '続きの情報がまだ届いていません。これは正常な入力待ちです。「次の断片を届ける」で再開します。',
    '断片Bが届きました。前の状態を引き継いで、続きから読み取ります。',
    'さらに入力が必要です。形式エラーではなく、後続の断片を待っている状態です。',
    '最後の断片Cが届きました。デコーダーが残りを読み取ります。',
    '最後まで正常に読み取れました。アプリが最後まで集めた本文は4,280バイトです。',
  ];
  return {
    description: descriptions[step], waitForInput: waiting, arrived,
    chunks: ['A', 'B', 'C'].map((id, i) => ({ id, arrived: i < arrived, current: i === arrived - 1 && step >= 2 && !waiting && step < 7 })),
    lanes: [{ id: 'fetch', name: 'fetch内部のBrotliデコーダー', active: step < 2 ? 'source' : step === 7 ? 'output' : 'decoder',
      status: step < 2 ? '入力前' : waiting ? '入力待ち' : step === 7 ? '成功' : '読み取り中',
      tone: waiting ? 'waiting' : step === 7 ? 'success' : 'neutral',
      bytes: step === 7 ? OBSERVATION.original : null, decodes: true, routeKnown: step >= 1,
      result: step === 7 ? '元の本文と一致' : '完了時に本文全体を集計',
    }],
    code: [{ title: 'ストリーミング展開', lines: STREAM_CODE, active: [[1], [2], [3, 4], [5], [6, 4], [5], [6, 4], [7]][step] }],
    note: '入力待ちでも、それまでの状態は保持します。実際のデコーダーは、完了前に一部の出力を生成することもあります。',
  };
}

function patchFrame(step) {
  const branched = step >= 3;
  const descriptions = [
    '比べるのは、不正なブロック切り替えを含む入力を処理する2つの経路です。実際の攻撃データは使いません。',
    '同じ種類の不正な入力が、デコーダーに届いた場面を考えます。',
    '読み取り中に不正なブロック切り替えに遭遇します。ここは、続きを待っても解決しない形式エラーです。',
    '判断が分かれます。修正前の問題がある経路は入力不足として扱い、修正後は形式エラーを返します。',
    '修正後は形式エラーが呼び出し側へ伝わり、展開を終了します。修正前は続きを待つ処理に入ってしまいます。',
    '修正前は不正な状態のまま入力を追加し続け得ます。修正後はエラーで終了しているため、この処理を続けません。',
    '修正前は8バイトの内部バッファを越えて書き込み得ます。修正後は、形式エラーで止まります。',
    '修正の要点は「入力が足りない」と「形式が不正」を区別して伝えること。境界外書き込みはメモリ破損につながり得ます。',
  ];
  const lanes = ['before', 'after'].map(id => {
    const fixed = id === 'after';
    return {
      id, name: fixed ? '修正後' : '修正前の問題がある経路', fixed,
      active: step < 2 ? 'input' : branched && fixed ? 'stop' : step >= 5 ? 'buffer' : 'decision',
      status: step < 2 ? '入力前後' : step < 3 ? '不正な切り替え' : fixed ? '形式エラー' : step >= 6 ? '境界外書き込みの可能性' : '入力待ちと誤認',
      tone: branched ? (fixed ? 'stopped' : step >= 6 ? 'danger' : 'waiting') : 'neutral',
      terminal: fixed && branched, overflow: !fixed && step >= 6,
      // These are display phases, not observed byte counts or an exploit trace.
      bufferPhase: step < 2 ? 'empty' : fixed ? 'retained' : step < 5 ? 'retained' : step < 6 ? 'filling' : 'overflow',
      bytes: null, result: branched && fixed ? 'エラーで終了' : step >= 6 ? 'メモリ破損が起こり得る' : '正常な本文は未確定',
    };
  });
  return {
    description: descriptions[step], lanes, branched, chunks: [],
    code: [
      { title: '修正前', lines: PATCH_CODE.before, active: [[1], [2], [2], [3, 4], [4], [5], [6], [6]][step] },
      { title: '修正後', lines: PATCH_CODE.after, active: [[1], [2], [2], [3], [4, 5], [5], [5], [3, 4, 5]][step] },
    ],
    note: '8バイトは入力の一時保持用。4,280バイトの展開結果とは別の領域です。枠の埋まり方・隣接領域は模式表現です。',
  };
}
// Paths describe the teaching model, not packet timing or native memory copies.
// IDs are shared with the rendered ports. Waiting and local decisions have no transfer.
export function getTransfers(mode, fromStep, toStep, encoding = 'br') {
  if (!MODES[mode] || toStep !== fromStep + 1) return [];
  const transfer = (path, title, detail, tone = '', kind = 'data') => ({ path, title, detail, tone, kind });
  if (mode === 'api') {
    if (toStep === 2) return ['fetch', 'http'].map(id => transfer(['api-source', `api-${id}`], '応答ヘッダー', `Content-Encoding: ${encoding === 'br' ? 'br' : '(none)'}`, '', 'header'));
    if (toStep === 3) return ['fetch', 'http'].map(id => transfer(['api-source', `api-${id}`], '圧縮された本文', '103 B', id === 'http' ? 'green' : ''));
    if (toStep === 6) return [
      transfer(['api-fetch', encoding === 'br' ? 'api-decoded' : 'api-raw-fetch'], 'fetch の本文', encoding === 'br' ? '4,280 B · 展開済み' : '103 B · 圧縮済み', encoding === 'br' ? '' : 'green'),
      transfer(['api-http', 'api-raw-http'], 'node:http の本文', '103 B · 圧縮済み', 'green'),
    ];
  }
  if (mode === 'stream') {
    if ([2, 4, 6].includes(toStep)) {
      const id = ['A', 'B', 'C'][toStep / 2 - 1];
      return [transfer([`pending-${id}`, `received-${id}`, 'stream-decoder'], `断片 ${id}`, '圧縮された入力')];
    }
    if (toStep === 7) return [transfer(['stream-decoder', 'stream-output'], '展開された本文', '4,280 B · 読み出し完了', 'green')];
  }
  if (mode === 'patch') {
    if (toStep === 1) return ['before', 'after'].map(id => transfer(['patch-source', `patch-${id}`], '共通の入力', '修正前後で比較'));
    if (toStep === 3) return [
      transfer(['patch-before', 'patch-continue'], '入力待ちと誤認', 'NEEDS_MORE_INPUT', 'gold', 'status'),
      transfer(['patch-after', 'patch-stop'], '形式エラー', 'ERROR_FORMAT_BLOCK_SWITCH', '', 'status'),
    ];
    if (toStep === 5) return [transfer(['patch-continue', 'patch-before'], '追加の入力', '修正前の経路だけで継続', 'gold')];
  }
  return [];
}
