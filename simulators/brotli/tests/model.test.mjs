import test from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, clampStep, MODES, getTransfers } from '../dist/model.mjs';

test('API comparison matches the three observed HTTP experiment outcomes', () => {
  const br = getFrame('api', 7, 'br');
  assert.deepEqual(br.lanes.map(lane => lane.bytes), [4280, 103]);
  assert.deepEqual(br.lanes.map(lane => lane.decodes), [true, false]);
  const raw = getFrame('api', 7, 'none');
  assert.deepEqual(raw.lanes.map(lane => lane.bytes), [103, 103]);
  assert(raw.lanes.every(lane => !lane.decodes));
});

test('a displayed final body size is withheld until the body-reading step', () => {
  for (let i = 0; i < 6; i++) assert(getFrame('api', i).lanes.every(lane => lane.bytes === null));
});

test('normal waiting resumes when another fragment arrives and can finish successfully', () => {
  const firstWait = getFrame('stream', 3);
  assert(firstWait.waitForInput);
  assert.equal(firstWait.arrived, 1);
  const resumed = getFrame('stream', 4);
  assert(!resumed.waitForInput);
  assert.equal(resumed.arrived, 2);
  assert(getFrame('stream', 5).waitForInput);
  assert.equal(getFrame('stream', 7).lanes[0].bytes, 4280);
  assert(getFrame('stream', 7).complete);
});

test('after a format error the fixed decoder stays halted and never appends input', () => {
  const stoppedPhase = getFrame('patch', 3).lanes[1].bufferPhase;
  for (let i = 3; i <= 7; i++) {
    const fixed = getFrame('patch', i).lanes[1];
    assert(fixed.terminal);
    assert.equal(fixed.bufferPhase, stoppedPhase);
    assert(!fixed.overflow);
    assert.equal(fixed.bytes, null);
  }
});

test('vulnerable model can reach a boundary violation; it never claims successful decoding', () => {
  assert(!getFrame('patch', 3).lanes[0].terminal);
  assert(!getFrame('patch', 3).lanes[0].overflow);
  assert(getFrame('patch', 6).lanes[0].overflow);
  for (let i = 0; i <= 7; i++) assert.equal(getFrame('patch', i).lanes[0].bytes, null);
});

test('stepping backward yields the original snapshot without retaining future state', () => {
  for (const mode of Object.keys(MODES)) {
    const initial = getFrame(mode, 0);
    getFrame(mode, 7);
    assert.deepEqual(getFrame(mode, 0), initial);
    assert.equal(clampStep(mode, -4), 0);
    assert.equal(clampStep(mode, 100), 7);
    assert.equal(clampStep(mode, NaN), 0);
  }
});

test('body transfers use the selected API route and never imply decoding without br', () => {
  for (const encoding of ['br', 'none']) {
    const received = getTransfers('api', 2, 3, encoding);
    assert.equal(received.length, 2);
    assert(received.every(t => t.detail === '103 B' && t.path[0] === 'api-source'));
    const output = getTransfers('api', 5, 6, encoding);
    assert.deepEqual(output[0].path, ['api-fetch', encoding === 'br' ? 'api-decoded' : 'api-raw-fetch']);
    assert.deepEqual(output[1].path, ['api-http', 'api-raw-http']);
    assert.equal(output[0].detail.includes('4,280'), encoding === 'br');
  }
});

test('stream transfers stop while waiting and deliver each fragment through reception to the decoder', () => {
  assert.deepEqual(getTransfers('stream', 2, 3), []);
  assert.deepEqual(getTransfers('stream', 4, 5), []);
  for (const [i, id] of ['A', 'B', 'C'].entries()) {
    assert.deepEqual(getTransfers('stream', i * 2 + 1, i * 2 + 2)[0].path, [`pending-${id}`, `received-${id}`, 'stream-decoder']);
  }
  assert.equal(getTransfers('stream', 6, 7)[0].detail, '4,280 B · 読み出し完了');
});

test('format errors transmit a status, never decoded bytes or further input on the fixed path', () => {
  const branch = getTransfers('patch', 2, 3);
  assert(branch.every(t => t.kind === 'status'));
  assert.deepEqual(branch[1].path, ['patch-after', 'patch-stop']);
  const later = [4, 5, 6, 7].flatMap(step => getTransfers('patch', step - 1, step));
  assert(later.length > 0);
  assert(later.every(t => t.path.every(id => !['patch-after', 'patch-stop'].includes(id))));
  assert.deepEqual(later[0].path, ['patch-continue', 'patch-before']);
});

test('backward steps, repeated frames and timeline seeks do not invent reverse data flow', () => {
  for (const mode of Object.keys(MODES)) {
    assert.deepEqual(getTransfers(mode, 6, 5), []);
    assert.deepEqual(getTransfers(mode, 3, 3), []);
    assert.deepEqual(getTransfers(mode, 0, 6), []);
  }
});
