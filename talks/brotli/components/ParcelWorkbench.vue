<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useIsSlideActive, useSlideContext } from '@slidev/client'

// Use Slidev's click state for both the audience and presenter views.
const { $clicks, $nav, $page, $renderContext } = useSlideContext()
const active = useIsSlideActive()
const lastStep = 4
const step = computed(() => Math.min(lastStep, Math.max(0, $clicks.value)))
const interactive = computed(() => active.value && ['slide', 'presenter'].includes($renderContext.value))
const playing = ref(false)
const still = ref(false)
const systemReduced = ref(false)
const noMotion = computed(() => still.value || systemReduced.value)
const sceneRevision = ref(0)
const motionForward = ref(false)
// A short pause after each cause lets the audience see its result.
const sceneHolds = [1300, 1600, 2100, 2300]
const captions = [
  'おかしな荷物が、届く。',
  '「まだ続きが来る」と、誤判断。',
  '受け取った入力を、置き続ける。',
  '作業台の範囲を、はみ出す。',
  '正しくは、異常なので止める。',
]
const phases = ['入力', '誤判定', '追加', '範囲外', '本来の判断']
let timer: ReturnType<typeof setTimeout> | undefined
let run = 0
let autoTarget: number | undefined
let media: MediaQueryList | undefined

function stop() {
  run++
  clearTimeout(timer)
  timer = undefined
  autoTarget = undefined
  playing.value = false
}
async function go(value: number) {
  if (interactive.value) await $nav.value.go($page.value, value)
}
function setStep(value: number) {
  stop()
  if (value === 0 && step.value === 0) restartArrival()
  void go(Math.min(lastStep, Math.max(0, value)))
}
function restartArrival() {
  motionForward.value = true
  sceneRevision.value++
}
async function play() {
  if (playing.value) return stop()
  stop()
  const id = run
  await go(0)
  if (id !== run || !interactive.value) return
  restartArrival()
  playing.value = true
  const advance = () => {
    timer = setTimeout(async () => {
      if (id !== run || !interactive.value) return stop()
      const next = step.value + 1
      autoTarget = next
      await go(next)
      autoTarget = undefined
      if (id !== run) return
      if (next >= lastStep) stop()
      else advance()
    }, sceneHolds[step.value] ?? 1800)
  }
  advance()
}
function onKey(event: KeyboardEvent) {
  if (interactive.value && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageDown', 'PageUp', 'Home', 'End', 'Escape'].includes(event.key)) stop()
}
function onControlsKey(event: KeyboardEvent) {
  const actions = {
    ArrowLeft: () => $nav.value.prev(),
    ArrowRight: () => $nav.value.next(),
    ArrowUp: () => $nav.value.prevSlide(),
    ArrowDown: () => $nav.value.nextSlide(),
  }
  const action = actions[event.key as keyof typeof actions]
  if (!action || !interactive.value) return
  event.preventDefault()
  event.stopPropagation()
  stop()
  void action()
}
function updatePreference() { systemReduced.value = media?.matches ?? false }
watch(active, () => {
  stop()
  motionForward.value = false
  sceneRevision.value++
})
watch(noMotion, () => { stop(); motionForward.value = false })
// A manual click in the other view must also interrupt this view's playback.
watch(step, (value, previous) => {
  if (playing.value && value !== autoTarget) stop()
  motionForward.value = interactive.value && (value > previous || value === 0)
  // Replacing the scene cancels its old delayed effects during rapid navigation.
  sceneRevision.value++
}, { flush: 'sync' })
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  updatePreference()
  media.addEventListener('change', updatePreference)
  window.addEventListener('keydown', onKey)
  motionForward.value = interactive.value && step.value === 0
})
onUnmounted(() => {
  stop()
  media?.removeEventListener('change', updatePreference)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <section class="parcel-workbench" :class="{ 'no-motion': noMotion, 'is-correct': step === 4, 'motion-forward': motionForward && !noMotion }" :data-step="step" aria-label="不正な入力の扱いを、荷物と作業台で表すたとえ">
    <svg :key="sceneRevision" class="bench-scene" viewBox="0 0 864 220" aria-hidden="true">
      <!-- Editable illustration: parcels mean received input, never expanded output. -->
      <g class="worker">
        <circle cx="150" cy="97" r="13" />
        <path d="M150 110 V152 M150 122 L125 140 M150 122 L178 112 M150 152 L130 178 M150 152 L170 178" />
      </g>
      <text class="worker-label" x="150" y="209" text-anchor="middle">開ける処理</text>
      <text class="decision" :class="{ visible: step >= 1 && step <= 3 }" x="150" y="44" text-anchor="middle">続き待ち</text>
      <g class="stop-mark" :class="{ visible: step === 4 }">
        <text class="correct-label" x="150" y="16" text-anchor="middle">正しい処理なら</text>
        <path d="M84 52 H216" />
        <text x="150" y="44" text-anchor="middle">異常 → 中止</text>
      </g>

      <path class="bench" d="M308 160 H558 M322 160 V181 M544 160 V181" />
      <path class="boundary" d="M558 77 V183" />
      <text class="bench-label" x="433" y="209" text-anchor="middle">入力を置く作業台</text>

      <path class="neighbor" :class="{ affected: step === 3 }" d="M590 160 H818 M604 160 V181 M804 160 V181" />
      <rect v-if="step === 3" class="impact-cue" x="590" y="104" width="228" height="56" />
      <text class="bench-label" x="704" y="209" text-anchor="middle">隣の作業場所</text>
      <text class="consequence" :class="{ visible: step === 3 }" x="704" y="87" text-anchor="middle">損なう可能性</text>

      <g v-if="step !== 4" class="parcel malformed">
        <rect width="62" height="54" />
        <path d="M0 16 H24 L32 7 L27 27 L37 16 H62 M31 27 V54" />
        <text x="46" y="44" text-anchor="middle">?</text>
      </g>
      <g class="parcel extra extra-one" :class="{ visible: step === 2 || step === 3 }">
        <rect width="62" height="54" /><path d="M0 16 H62 M31 0 V54" />
      </g>
      <g class="parcel extra extra-two" :class="{ visible: step === 2 || step === 3 }">
        <rect width="62" height="54" /><path d="M0 16 H62 M31 0 V54" />
      </g>
      <g class="parcel overflow" :class="{ visible: step === 3 }">
        <rect width="62" height="54" /><path d="M0 16 H62 M31 0 V54" />
      </g>
      <g v-if="step === 4" class="correct-scene">
        <path class="stop-gate" d="M318 86 V160" />
        <g class="parcel stopped-parcel">
          <rect width="62" height="54" />
          <path d="M0 16 H24 L32 7 L27 27 L37 16 H62 M31 27 V54" />
          <text x="46" y="44" text-anchor="middle">?</text>
        </g>
      </g>
    </svg>
    <div :key="`caption-${sceneRevision}`" class="bench-caption" role="status" aria-live="polite" aria-atomic="true">
      <span class="phase">{{ phases[step] }}</span><span>{{ captions[step] }}</span>
    </div>
    <div v-if="interactive" class="bench-controls" @click.stop @keydown="onControlsKey" @keydown.space.stop @keyup.space.stop @keydown.enter.stop @keyup.enter.stop>
      <button type="button" class="play" @click="play">{{ playing ? '一時停止' : step === lastStep ? 'もう一度再生' : '再生' }}</button>
      <button type="button" :disabled="step === 0 && !playing" @click="setStep(step - 1)">戻る</button>
      <button type="button" :disabled="step === lastStep" @click="setStep(step + 1)">次へ</button>
      <button type="button" @click="setStep(0)">最初から</button>
      <label class="motion-choice"><input v-model="still" type="checkbox" :disabled="systemReduced" />{{ systemReduced ? '動きを減らす設定に対応中' : '動きを省略' }}</label>
    </div>
  </section>
</template>

<style scoped>
.parcel-workbench { margin-top: -20px; --settle: cubic-bezier(.2,.75,.25,1); }
.bench-scene { width: 100%; height: 220px; overflow: visible; }
.bench-scene text { font-family: 'Inter Variable', 'Noto Sans JP Variable', sans-serif; fill: #666; font-size: 17px; }
.worker { fill: #fff; stroke: #222; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bench, .neighbor { fill: none; stroke: #222; stroke-width: 2; }
.neighbor { stroke: #bbb; }
.neighbor.affected { stroke: var(--talk-pink); }
.boundary { stroke: #aaa; stroke-width: 1; stroke-dasharray: 3 5; }
[data-step="3"] .boundary { stroke: var(--talk-pink); stroke-width: 1.5; }
.bench-scene .decision { fill: var(--talk-pink); font-size: 24px; font-weight: 600; }
.decision, .stop-mark, .consequence { opacity: 0; }
.stop-mark path { stroke: var(--talk-mint); stroke-width: 7; }
.stop-mark text { fill: #111; font-size: 24px; font-weight: 600; }
.stop-mark .correct-label { fill: #666; font-size: 13px; font-weight: 500; }
.stop-gate { fill: none; stroke: var(--talk-mint); stroke-width: 4; }
.bench-scene .consequence { fill: var(--talk-pink); font-size: 17px; }
.impact-cue { fill: var(--talk-pink); opacity: 0; }
.parcel { fill: #fff; stroke: var(--talk-blue); stroke-width: 1.5; }
.parcel path { fill: none; }
.malformed, .overflow, .stopped-parcel { stroke: var(--talk-pink); }
.parcel text { fill: var(--talk-pink); stroke: none; font-size: 20px; }
.malformed { transform: translate(330px,105px); }
.extra, .overflow { opacity: 0; }
.extra-one { transform: translate(405px,105px); }
.extra-two { transform: translate(480px,105px); }
.overflow { transform: translate(555px,105px); }
.stopped-parcel { transform: translate(245px,105px); }
.visible { opacity: 1; }

/* Animate only the new information. Completed parcels remain at rest.
   Previous scenes and reduced motion show their final state immediately. */
.motion-forward[data-step="0"] .malformed { animation: arrive-first 650ms var(--settle) both; }
.motion-forward[data-step="1"] .decision { animation: reveal 280ms var(--settle) both; }
.motion-forward[data-step="2"] .extra-one { animation: arrive-one 600ms var(--settle) both; }
.motion-forward[data-step="2"] .extra-two { animation: arrive-two 600ms 480ms var(--settle) both; }
.motion-forward[data-step="3"] .overflow { animation: cross-boundary 700ms var(--settle) both; }
.motion-forward[data-step="3"] .boundary { animation: boundary-cue 500ms 480ms ease-out both; }
.motion-forward[data-step="3"] .neighbor { animation: affect-neighbor 300ms 700ms ease-out both; }
.motion-forward[data-step="3"] .impact-cue { animation: impact-cue 650ms 700ms ease-out both; }
.motion-forward[data-step="3"] .consequence { animation: reveal 260ms 980ms var(--settle) both; }
.motion-forward[data-step="4"] .correct-scene { animation: scene-cut 200ms ease-out both; }
.motion-forward[data-step="4"] .stopped-parcel { animation: stop-arrival 600ms var(--settle) both; }
.motion-forward[data-step="4"] .stop-mark { animation: reveal 280ms 320ms var(--settle) both; }
.motion-forward .bench-caption > span:last-child { animation: caption-in 240ms var(--caption-delay, 0ms) ease-out both; }
[data-step="0"] { --caption-delay: 430ms; }
[data-step="1"] { --caption-delay: 180ms; }
[data-step="2"] { --caption-delay: 1000ms; }
[data-step="3"] { --caption-delay: 1100ms; }
[data-step="4"] { --caption-delay: 600ms; }
@keyframes arrive-first {
  from { opacity: 0; transform: translate(230px,65px); }
  to { opacity: 1; transform: translate(330px,105px); }
}
@keyframes arrive-one {
  from { opacity: 0; transform: translate(270px,30px); }
  18% { opacity: 1; }
  to { opacity: 1; transform: translate(405px,105px); }
}
@keyframes arrive-two {
  from { opacity: 0; transform: translate(300px,30px); }
  18% { opacity: 1; }
  to { opacity: 1; transform: translate(480px,105px); }
}
@keyframes cross-boundary {
  from { opacity: 0; transform: translate(410px,30px); }
  18% { opacity: 1; }
  to { opacity: 1; transform: translate(555px,105px); }
}
@keyframes boundary-cue {
  from { stroke: #aaa; stroke-width: 1; }
  35% { stroke: var(--talk-pink); stroke-width: 3; }
  to { stroke: var(--talk-pink); stroke-width: 1.5; }
}
@keyframes affect-neighbor { from { stroke: #bbb; } to { stroke: var(--talk-pink); } }
@keyframes impact-cue { 0%,100% { opacity: 0; } 35% { opacity: .08; } }
@keyframes stop-arrival {
  from { opacity: 0; transform: translate(195px,65px); }
  to { opacity: 1; transform: translate(245px,105px); }
}
@keyframes reveal { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scene-cut { from { opacity: 0; } to { opacity: 1; } }
@keyframes caption-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.bench-caption { display: flex; align-items: baseline; gap: 24px; margin-top: 14px; font-size: 29px; font-weight: 650; white-space: nowrap; }
.phase { width: 120px; flex-shrink: 0; color: #666; font-size: 18px; font-weight: 500; }
.is-correct .bench-caption > span:last-child { box-shadow: inset 0 -.19em var(--talk-mint); }
.bench-controls { display: flex; align-items: center; gap: 22px; margin-top: 23px; font-size: 14px; }
.bench-controls button { appearance: none; border: 0; border-bottom: 1px solid #ccc; background: none; color: #555; padding: 6px 0; cursor: pointer; transition: color 120ms, border-color 120ms; }
.bench-controls button:hover:not(:disabled) { color: var(--talk-blue); border-color: var(--talk-blue); }
.bench-controls button:active:not(:disabled) { transform: translateY(1px); }
.bench-controls button.play { color: var(--talk-blue); border-color: var(--talk-blue); font-weight: 600; min-width: 84px; text-align: left; }
.bench-controls button:disabled { opacity: .35; cursor: default; }
.motion-choice { margin-left: auto; display: flex; gap: 7px; align-items: center; color: #777; font-size: 12px; }
.motion-choice input { accent-color: var(--talk-blue); }
.no-motion *, .no-motion *::before, .no-motion *::after { transition: none !important; animation: none !important; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
@media print { .bench-controls { display: none; } * { animation: none !important; } }
</style>
