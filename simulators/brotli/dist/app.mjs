import { MODES, getFrame, clampStep, getTransfers } from './model.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = value => new Intl.NumberFormat('ja-JP').format(value);
const state = { mode: 'api', step: 0, encoding: 'br', speed: 1, playing: false };
let timer = null;
let previousPosition = '';
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let previousFrame = null;
let lastTransfer = null;
let motionCleanup = () => {};

function pause() {
  state.playing = false;
  clearTimeout(timer);
  timer = null;
}

function schedule() {
  clearTimeout(timer);
  if (!state.playing) return;
  timer = setTimeout(() => {
    state.step = clampStep(state.mode, state.step + 1);
    const frame = getFrame(state.mode, state.step, state.encoding);
    if (frame.complete || frame.waitForInput) pause();
    render();
    if (state.playing) schedule();
  }, 1800 / state.speed);
}

function move(step) {
  pause();
  state.step = clampStep(state.mode, step);
  render();
}

function play() {
  if (state.playing) { pause(); render(); return; }
  if (getFrame(state.mode, state.step).complete) state.step = 0;
  state.playing = true;
  render();
  schedule();
}

function switchMode(mode) {
  if (!MODES[mode] || mode === state.mode) return;
  pause();
  state.mode = mode;
  state.step = 0;
  previousPosition = '';
  render();
}

function room(title, content, { classes = '', symbol = '◇', count = '', bodyClass = '', subtitle = '', label = title, port = '' } = {}) {
  return `<section class="room ${classes}" aria-label="${escape(label)}" ${port ? `data-room="${port}"` : ''}><header class="room-heading"><h3><span class="room-symbol" aria-hidden="true">${symbol}</span>${title}</h3>${count ? `<span class="room-count">${count}</span>` : ''}</header>${subtitle ? `<p class="room-subtitle">${subtitle}</p>` : ''}<div class="room-body ${bodyClass}" ${port ? `data-port="${port}"` : ''}>${content}</div></section>`;
}
function empty(title, hint = '') { return `<p class="room-empty">${title}${hint ? `<span>${hint}</span>` : ''}</p>`; }
function badge(lane) { return `<span class="status-badge ${lane.tone}">${escape(lane.status)}</span>`; }
function card(title, text, { bytes, detail = '', tone = '', port = '' } = {}) {
  return `<div class="data-card ${tone}" ${port ? `data-port="${port}"` : ''}><strong>${title}</strong>${text ? `<small>${text}</small>` : ''}${bytes === undefined ? '' : `<span class="bytes">${number(bytes)}<small>B</small></span>`}${detail ? `<code>${detail}</code>` : ''}</div>`;
}

function apiBoard(frame) {
  const fetchLane = frame.lanes[0];
  const httpLane = frame.lanes[1];
  const incoming = room('HTTP RESPONSE', frame.step < 2
    ? empty('応答を待っています', '同じ本文を2つのAPIへ')
    : card('圧縮済みの本文', '別々のリクエストで比較', {
      bytes: 103, detail: `Content-Encoding:<br>${frame.br ? 'br' : '(none)'}`,
    }), { port: 'api-source', classes: `input-room ${frame.step === 2 || frame.step === 3 ? 'active' : ''}`, symbol: '▱', bodyClass: 'stack-body', count: '103B', label: 'HTTP応答の置き場' });

  function apiLane(lane) {
    let body;
    if (frame.step < 3) body = empty('本文の到着待ち', lane.id === 'fetch' ? 'ヘッダーに応じて経路を選ぶ' : '低水準のHTTPクライアント');
    else if (!lane.routeKnown) body = card('103Bを受信', 'これから本文を処理します');
    else body = card(lane.decodes ? 'Brotliデコーダー' : '自動展開なし', lane.decodes ? '103Bを元のバイト列へ復元' : '103Bをそのまま渡す', { tone: lane.decodes ? '' : 'green' })
      + `<div class="room-status">${badge(lane)}<span>${lane.bytes === null ? '処理経路を確認' : `${number(lane.bytes)}B → アプリへ`}</span></div>`;
    return room(lane.id === 'fetch' ? 'FETCH' : 'NODE:HTTP', body, {
      symbol: lane.id === 'fetch' ? 'ϟ' : '◇', classes: `${lane.id === 'http' ? 'tone-green' : ''} ${['decoder', 'bypass'].includes(lane.active) ? 'active' : ''}`,
      port: `api-${lane.id}`, label: `${lane.name}の処理領域`,
    });
  }
  const decoded = fetchLane.bytes === 4280
    ? card('fetch → 本文', '元の本文とバイト単位で一致', { bytes: 4280 })
    : empty('まだ出力されていません', frame.br ? '展開後の本文がここへ' : 'この条件では展開しません');
  const raw = httpLane.bytes === 103
    ? `<div class="raw-results ${fetchLane.bytes === 103 ? 'paired' : ''}">${fetchLane.bytes === 103 ? card('fetch', '', { bytes: 103, tone: 'green', port: 'api-raw-fetch' }) : ''}${card('node:http', '', { bytes: 103, tone: 'green', port: 'api-raw-http' })}</div>`
    : empty('まだ出力されていません', '圧縮されたままの本文がここへ');
  return `<div class="board-main api-board">${incoming}${apiLane(fetchLane)}${apiLane(httpLane)}</div><div class="board-queues">${room('DECODED BODY', decoded, { port: 'api-decoded', symbol: '▤', label: '展開された本文の置き場' })}${room('RAW BODY', raw, { symbol: '◇', classes: 'tone-green', label: '圧縮されたままの本文の置き場' })}</div>`;
}

function streamBoard(frame) {
  const lane = frame.lanes[0];
  const received = frame.chunks.filter(chunk => chunk.arrived);
  const pending = frame.chunks.filter(chunk => !chunk.arrived);
  const incoming = room('RECEIVED', received.length ? received.map(chunk => card(`断片 ${chunk.id}`, '到着の記録', { port: `received-${chunk.id}` })).join('') : empty('到着した断片はありません', '断片A → B → C'), {
    symbol: '▱', bodyClass: 'stack-body', classes: `input-room ${[2, 4, 6].includes(frame.step) ? 'active' : ''}`, count: `${received.length} / 3`, label: '届いた断片の置き場',
  });
  const ring = `<div class="state-ring ${frame.waitForInput ? 'waiting' : frame.complete ? 'success' : ''}" role="img" aria-label="3つの断片のうち${received.length}つが到着"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="43"/><circle class="value" cx="50" cy="50" r="43" stroke-dasharray="270.18" stroke-dashoffset="${270.18 * (1 - received.length / 3)}"/></svg><span>${received.length} / 3</span></div>`;
  const processor = room('BROTLI DECODER', `<div class="decoder-label">${lane.status}</div><p class="decoder-hint">${frame.waitForInput ? '続きを読めるように、状態を保持して待っています。' : frame.complete ? '最後まで正常に読み取れました。' : '届いた断片を読み、足りなければ次の入力を待ちます。'}</p>${ring}${badge(lane)}`, {
    port: 'stream-decoder', symbol: 'ϟ', classes: `decoder-room ${frame.waitForInput ? 'waiting' : frame.step > 1 ? 'active' : ''}`, label: 'デコーダーの状態',
  });
  const waiting = pending.length ? `<div class="queue-items">${pending.map(chunk => `<div class="chunk-token" data-port="pending-${chunk.id}"><b>${chunk.id}</b><small>未到着</small></div>`).join('')}</div><p class="decoder-hint">${frame.waitForInput ? '上の「断片を届ける」で再開' : '入力待ちで自動再生を停止'}</p>` : empty('すべて届きました');
  const output = frame.complete ? card('fetch → 本文', '元の本文と一致', { bytes: 4280, tone: 'green' }) : empty('完了時に本文全体を表示', '途中の出力サイズはモデル化しません');
  return `<div class="board-main stream-board">${incoming}${processor}</div><div class="board-queues">${room('PENDING INPUT', waiting, { symbol: 'ϟ', classes: 'tone-gold', count: `${pending.length} 待機`, label: '未到着の断片' })}${room('DECODED BODY', output, { port: 'stream-output', symbol: '◇', classes: 'tone-green', label: '完了した本文' })}</div>`;
}

function patchRoom(lane, frame) {
  const filled = { empty: 0, retained: 3, filling: 7, overflow: 8 }[lane.bufferPhase];
  const decision = frame.branched ? (lane.fixed ? '形式が不正' : '入力が足りない') : 'まだ判定していない';
  const code = frame.branched ? (lane.fixed ? 'ERROR_FORMAT_BLOCK_SWITCH' : 'NEEDS_MORE_INPUT') : '—';
  const memory = `<div><p class="memory-heading">入力用バッファ · 容量8バイト</p><div class="memory" role="img" aria-label="${lane.overflow ? '修正前は範囲外へ書き込み得る' : lane.terminal ? '修正後は形式エラー以降に追加しない' : '入力バッファ'}。枠の埋まり方は模式表現です。">${Array.from({ length: 8 }, (_, i) => `<span class="memory-cell ${i < filled ? 'filled' : ''}"></span>`).join('')}<span class="memory-boundary"></span><span class="memory-cell ${lane.overflow ? 'overflow' : ''}"></span></div><div class="memory-labels"><span>確保された範囲</span><span>範囲外</span></div></div>`;
  return room(lane.fixed ? 'AFTER / 修正後' : 'BEFORE / 修正前', `<p class="patch-question">呼び出し側に伝わる状態</p><div class="decision-box ${frame.branched ? lane.fixed ? 'stopped' : 'waiting' : ''}"><strong>${decision}</strong><code>${code}</code></div>${memory}${badge(lane)}`, {
    port: lane.fixed ? 'patch-after' : 'patch-before', symbol: lane.fixed ? '◇' : 'ϟ', classes: `patch-room ${lane.fixed ? 'fixed' : 'tone-gold'} ${lane.overflow ? 'danger' : ''} ${!lane.fixed && frame.branched ? 'waiting' : ''}`, label: lane.name,
  });
}

function patchBoard(frame) {
  const before = frame.lanes[0];
  const after = frame.lanes[1];
  const continuing = frame.step < 3 ? empty('まだ追加処理に入っていません') : card(before.overflow ? '境界外書き込みの可能性' : '入力待ちとして継続', before.overflow ? '周辺のメモリを壊し得る' : '不正な状態のまま入力を追加し得る', { tone: before.overflow ? 'red' : 'gold' });
  const stopped = after.terminal ? card('形式エラーで終了', '後のステップでも停止を維持', { detail: '正常な本文として渡さない' }) : empty('エラーはまだ伝わっていません');
  return `<div class="patch-source" data-port="patch-source"><span>共通入力：不正なブロック切り替え</span><small>公式資料に基づくモデル</small></div><div class="board-main patch-board">${patchRoom(before, frame)}${patchRoom(after, frame)}</div><div class="board-queues">${room('CONTINUE / 続ける', continuing, { port: 'patch-continue', symbol: 'ϟ', classes: 'tone-gold', label: '修正前の追加処理' })}${room('STOP / 止まる', stopped, { port: 'patch-stop', symbol: '◇', label: '修正後の終了処理' })}</div>`;
}

function renderStage(frame) {
  document.getElementById('stage-content').innerHTML = frame.mode === 'api' ? apiBoard(frame) : frame.mode === 'stream' ? streamBoard(frame) : patchBoard(frame);
}

const portNames = {
  'api-source': 'HTTP応答', 'api-fetch': 'fetch', 'api-http': 'node:http',
  'api-decoded': '展開された本文', 'api-raw-fetch': '圧縮された本文', 'api-raw-http': '圧縮された本文',
  'stream-decoder': 'デコーダー', 'stream-output': '展開された本文',
  'patch-source': '共通入力', 'patch-before': '修正前', 'patch-after': '修正後',
  'patch-continue': '入力の追加', 'patch-stop': '終了',
};
const portName = id => portNames[id] || (id.startsWith('pending-') ? `未到着の断片 ${id.at(-1)}` : `到着した断片 ${id.at(-1)}`);
const findPort = id => $('stage-content').querySelector(`[data-port="${id}"]`);
function portPositions() {
  const stage = $('stage-content').getBoundingClientRect();
  return new Map([...$('stage-content').querySelectorAll('[data-port]')].map(el => {
    const anchor = el.querySelector('.data-card') || el;
    const rect = anchor.getBoundingClientRect();
    return [el.dataset.port, { x: (rect.x + rect.width / 2 - stage.x) / stage.width, y: (rect.y + rect.height / 2 - stage.y) / stage.height }];
  }));
}
function flowText(frame, transfers) {
  if (transfers.length) return transfers.map(t => t.path.map(portName).join(' → ')).join(' ／ ');
  if (frame.waitForInput) return '入力待ち：カードは止まっています。次の断片を届けると再開します。';
  if (frame.complete) return '結果を比較しよう。ステップを戻すと、その時点の状態を見直せます。';
  if (frame.mode === 'api' && [4, 5].includes(frame.step)) return frame.step === 4 ? '枠内で経路を選択：fetchはヘッダーを確認。node:httpは自動展開しません。' : '枠内で本文を処理中。次のステップでアプリの本文へ移ります。';
  if (frame.mode === 'patch' && frame.step >= 3) return frame.step === 6 ? '修正前は境界外へ書き込み得る。修正後は停止したままです。' : '判断と状態を確認中。修正後の経路に追加の入力は流れません。';
  return frame.step === 0 ? '「▷│」で1ステップ進めよう。カードと矢印で移動先を追えます。' : '準備・判定のステップです。まだ本文の移動はありません。';
}

// Overlay coordinates come from the actual source and destination boxes. Replacing
// a frame cancels its overlay before measuring, so quick steps never leave ghosts.
function animateTransfers(transfers, oldPositions) {
  motionCleanup();
  if (!transfers.length || motionPreference.matches || $('reduce-motion').checked) return;
  const positions = portPositions();
  const stage = $('stage-content').getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'flow-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = '<defs><marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker></defs>';
  overlay.append(svg);
  document.body.append(overlay);
  const animations = [];
  const hidden = new Set();
  const marked = new Set();
  let cancelled = false;
  const cleanup = () => {
    if (cancelled) return;
    cancelled = true;
    animations.forEach(animation => animation.cancel());
    hidden.forEach(el => el.classList.remove('awaiting-arrival'));
    marked.forEach(el => el.classList.remove('flow-from', 'flow-to'));
    overlay.remove();
  };
  motionCleanup = cleanup;
  transfers.forEach((transfer, index) => {
    const points = transfer.path.map((id, i) => {
      const point = (i === 0 ? oldPositions.get(id) : positions.get(id)) || positions.get(id) || oldPositions.get(id);
      return point && { x: stage.x + point.x * stage.width, y: stage.y + point.y * stage.height };
    });
    if (points.some(point => !point)) return;
    const tone = transfer.tone || 'blue';
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
    line.setAttribute('class', `flow-path ${tone}`);
    line.setAttribute('marker-end', 'url(#flow-arrow)');
    svg.append(line);
    const token = document.createElement('div');
    token.className = `data-card flying-card ${transfer.tone}`;
    token.dataset.flow = transfer.path.join(' → ');
    token.style.width = `${Math.min(166, stage.width * .42)}px`;
    token.innerHTML = `<span class="flight-label">${transfer.kind === 'status' ? '判定を伝える' : transfer.kind === 'header' ? 'ヘッダー' : 'データが移動'}</span><strong>${escape(transfer.title)}</strong><small>${escape(transfer.detail)}</small>`;
    overlay.append(token);
    const from = findPort(transfer.path[0])?.closest('.room');
    const toPort = findPort(transfer.path.at(-1));
    const to = toPort?.closest('.room');
    if (from) { from.classList.add('flow-from'); marked.add(from); }
    if (to) { to.classList.add('flow-to'); marked.add(to); }
    const arrival = toPort?.matches('.data-card') ? toPort : toPort?.querySelector('.data-card');
    if (arrival && transfer.kind !== 'header') { arrival.classList.add('awaiting-arrival'); hidden.add(arrival); }
    const at = point => `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
    const frames = [{ transform: at(points[0]), opacity: 0, offset: 0 }, { transform: at(points[0]), opacity: 1, offset: .08 }];
    points.slice(1, -1).forEach((point, i) => {
      const offset = (i + 1) / (points.length - 1);
      frames.push({ transform: at(point), opacity: 1, offset: offset - .05 }, { transform: at(point), opacity: 1, offset: offset + .05 });
    });
    frames.push({ transform: at(points.at(-1)), opacity: 1, offset: .92 }, { transform: at(points.at(-1)), opacity: 0, offset: 1 });
    animations.push(token.animate(frames, { duration: 1250 / state.speed, delay: index * 90 / state.speed, easing: 'ease-in-out', fill: 'both' }));
  });
  Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(cleanup);
}

function renderResults(frame) {
  if (frame.mode === 'patch') {
    $('result-content').innerHTML = `<div class="output-section"><h4>処理の結果</h4>${frame.lanes.map(lane => `<div class="patch-result"><strong>${lane.fixed ? '修正後' : '修正前'} · ${escape(lane.result)}</strong><p>${lane.overflow ? 'クラッシュ・情報漏えい・任意コード実行につながる可能性。必ずコード実行になるとは限りません。' : lane.terminal ? '正常な本文として成功を返しません。' : 'この画面は脆弱性を実行するものではありません。'}</p></div>`).join('')}</div>`;
  } else {
    $('result-content').innerHTML = `<div class="output-section"><h4>アプリが最後まで読み出した本文</h4>${frame.lanes.map(lane => `<div class="output-row"><div><div class="output-name">${lane.id === 'http' ? 'node:http' : 'fetch'}</div><small>${escape(lane.result)}</small></div><div class="output-value ${lane.bytes === null ? '' : 'revealed'}">${lane.bytes === null ? '—' : number(lane.bytes)}${lane.bytes === null ? '' : '<small>B</small>'}</div></div>`).join('')}</div>`;
  }
  $('history').innerHTML = MODES[state.mode].steps.slice(0, frame.step + 1).map((label, i) => `<li><span>${String(i).padStart(2, '0')}</span>${escape(label)}</li>`).join('');
  $('history').scrollTop = $('history').scrollHeight;
}

function render() {
  const frame = getFrame(state.mode, state.step, state.encoding);
  const mode = MODES[state.mode];
  const position = `${state.mode}:${state.step}:${state.encoding}`;
  const changed = position !== previousPosition;
  const oldPositions = changed ? portPositions() : null;
  const sameScene = previousFrame?.mode === frame.mode && previousFrame?.br === frame.br;
  const transfers = changed && sameScene ? getTransfers(frame.mode, previousFrame.step, frame.step, state.encoding) : [];
  if (changed) motionCleanup();
  previousPosition = position;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  $('scene-title').textContent = mode.title;
  $('scene-subtitle').textContent = mode.subtitle;
  $('encoding-setting').hidden = state.mode !== 'api';
  $('play').textContent = state.playing ? 'Ⅱ Pause' : frame.complete ? '↻ Replay' : '▷ Run';
  $('play').setAttribute('aria-label', state.playing ? '一時停止' : frame.complete ? '最初から自動再生' : '自動再生');
  $('previous').disabled = state.step === 0;
  $('next').disabled = frame.complete;
  $('next').textContent = frame.waitForInput ? '断片を届ける' : '▷│';
  $('next').classList.toggle('deliver', frame.waitForInput);
  $('next').setAttribute('aria-label', frame.waitForInput ? '次の断片を届ける' : '1ステップ進む');
  $('next').title = frame.waitForInput ? '次の断片を届ける' : '1ステップ進む';
  $('step-count').textContent = `STEP ${state.step} / ${frame.total - 1}`;
  const focusedStep = document.activeElement?.closest?.('[data-step]')?.dataset.step;
  $('step-track').innerHTML = mode.steps.map((label, i) => `<button type="button" data-step="${i}" ${i === state.step ? 'aria-current="step"' : ''} data-past="${i < state.step}" aria-label="ステップ${i}：${escape(label)}"><span class="checkpoint">${i}</span>${escape(label)}</button>`).join('');
  if (focusedStep !== undefined) $('step-track').querySelector(`[data-step="${focusedStep}"]`)?.focus({ preventScroll: true });
  $('code-kind').textContent = state.mode === 'api' ? '受信コードの要点' : '説明用の擬似コード';
  $('code-content').innerHTML = frame.code.map(block => `<section class="code-block"><h4>${escape(block.title)}</h4><ol class="code-lines" aria-label="${escape(block.title)}のコード">${block.lines.map((line, i) => `<li class="${block.active.includes(i + 1) ? 'active' : ''} ${line.startsWith('//') ? 'comment' : ''}" ${block.active.includes(i + 1) ? 'aria-current="true"' : ''}><code>${escape(line)}</code></li>`).join('')}</ol></section>`).join('');
  $('code-footnote').textContent = state.mode === 'api' ? '光っている行と、中央の処理を見比べてください。実験コードの要点を表示しています。' : '実際のC / JavaScriptコードを簡略化して日本語で表しています。公式の実装は「出典とモデルの範囲」から確認できます。';
  $('stage-title').textContent = { api: 'HTTP PIPELINE', stream: 'STREAMING DECODER', patch: 'BEFORE / AFTER THE FIX' }[state.mode];
  $('current-step').textContent = String(state.step).padStart(2, '0');
  $('step-title').textContent = frame.title;
  $('explanation').textContent = frame.description;
  $('stage-caption').textContent = frame.note;
  $('evidence-label').textContent = mode.evidence;
  if (changed) {
    renderStage(frame);
    const back = sameScene && frame.step < previousFrame.step;
    const seek = sameScene && Math.abs(frame.step - previousFrame.step) > 1;
    $('flow-description').textContent = back || seek ? '選んだステップの状態を表示しています。移動は次に1ステップ進めると再生します。' : flowText(frame, transfers);
    $('flow-kind').textContent = back || seek ? '見直し' : frame.waitForInput ? '入力待ち' : transfers.length ? transfers[0].kind === 'status' ? '判定の流れ' : '今回の移動' : '見るところ';
    $('flow-kind').classList.toggle('waiting', frame.waitForInput);
    lastTransfer = transfers.length ? { transfers, oldPositions } : null;
    $('replay-flow').hidden = !lastTransfer;
    animateTransfers(transfers, oldPositions);
  }
  previousFrame = frame;
  renderResults(frame);
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => switchMode(button.dataset.mode)));
$('previous').addEventListener('click', () => move(state.step - 1));
$('next').addEventListener('click', () => move(state.step + 1));
$('reset').addEventListener('click', () => move(0));
$('play').addEventListener('click', play);
$('encoding').addEventListener('change', event => { pause(); state.encoding = event.target.value; state.step = 0; render(); });
$('speed').addEventListener('input', event => {
  state.speed = Number(event.target.value);
  const interval = Math.round(1800 / state.speed);
  $('speed-value').textContent = `${interval}ms`;
  $('speed').setAttribute('aria-valuetext', `1ステップ ${interval}ミリ秒`);
  if (state.playing) schedule();
});
$('step-track').addEventListener('click', event => { const button = event.target.closest('[data-step]'); if (button) move(Number(button.dataset.step)); });
document.addEventListener('keydown', event => {
  if ($('sources-dialog').open) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('button, input, select, textarea, a, summary, [contenteditable]')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); move(state.step + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(state.step - 1); }
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) play(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) { pause(); render(); } });
window.addEventListener('pagehide', pause);

$('replay-flow').addEventListener('click', () => { pause(); render(); if (lastTransfer) animateTransfers(lastTransfer.transfers, lastTransfer.oldPositions); });
$('reduce-motion').checked = motionPreference.matches;
$('reduce-motion').addEventListener('change', () => { document.body.classList.toggle('reduced-motion', $('reduce-motion').checked); motionCleanup(); });
motionPreference.addEventListener('change', () => { $('reduce-motion').checked = motionPreference.matches; document.body.classList.toggle('reduced-motion', motionPreference.matches); motionCleanup(); });
window.addEventListener('resize', () => { motionCleanup(); lastTransfer = null; $('replay-flow').hidden = true; });
document.addEventListener('scroll', event => {
  if (event.target === document || event.target.contains?.($('stage-content'))) motionCleanup();
}, { capture: true, passive: true });
window.addEventListener('pagehide', () => motionCleanup());

$('open-sources').addEventListener('click', () => { pause(); motionCleanup(); render(); $('sources-dialog').showModal(); });
$('close-sources').addEventListener('click', () => $('sources-dialog').close());
render();
