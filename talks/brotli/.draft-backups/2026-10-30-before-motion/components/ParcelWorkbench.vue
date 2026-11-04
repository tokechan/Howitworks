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
  void go(Math.min(lastStep, Math.max(0, value)))
}
async function play() {
  if (playing.value) return stop()
  stop()
  const id = run
  await go(0)
  if (id !== run || !interactive.value) return
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
    }, 1800)
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
watch(active, stop)
watch(noMotion, stop)
// A manual click in the other view must also interrupt this view's playback.
watch(step, value => { if (playing.value && value !== autoTarget) stop() }, { flush: 'sync' })
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  updatePreference()
  media.addEventListener('change', updatePreference)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  stop()
  media?.removeEventListener('change', updatePreference)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <section class="parcel-workbench" :class="{ 'no-motion': noMotion, 'is-correct': step === 4 }" :data-step="step" aria-label="不正な入力の扱いを、荷物と作業台で表すたとえ">
    <svg class="bench-scene" viewBox="0 0 864 220" aria-hidden="true">
      <!-- Editable illustration: parcels mean received input, never expanded output. -->
      <g class="worker">
        <circle cx="150" cy="97" r="13" />
        <path d="M150 110 V152 M150 122 L125 140 M150 122 L178 112 M150 152 L130 178 M150 152 L170 178" />
      </g>
      <text class="worker-label" x="150" y="209" text-anchor="middle">開ける処理</text>
      <text class="decision" :class="{ visible: step >= 1 && step <= 3 }" x="150" y="44" text-anchor="middle">続き待ち</text>
      <g class="stop-mark" :class="{ visible: step === 4 }">
        <path d="M84 52 H216" />
        <text x="150" y="44" text-anchor="middle">異常 → 中止</text>
      </g>

      <path class="bench" d="M308 160 H558 M322 160 V181 M544 160 V181" />
      <path class="boundary" d="M558 77 V183" />
      <text class="bench-label" x="433" y="209" text-anchor="middle">入力を置く作業台</text>

      <path class="neighbor" :class="{ affected: step === 3 }" d="M590 160 H818 M604 160 V181 M804 160 V181" />
      <text class="bench-label" x="704" y="209" text-anchor="middle">隣の作業場所</text>
      <text class="consequence" :class="{ visible: step === 3 }" x="704" y="87" text-anchor="middle">損なう可能性</text>

      <g class="parcel malformed" transform="translate(330 105)">
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
    </svg>
    <div class="bench-caption" role="status" aria-live="polite" aria-atomic="true">
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
.parcel-workbench { margin-top: -20px; --bench-duration: 550ms; }
.bench-scene { width: 100%; height: 220px; overflow: visible; }
.bench-scene text { font-family: 'Inter Variable', 'Noto Sans JP Variable', sans-serif; fill: #666; font-size: 17px; }
.worker { fill: #fff; stroke: #222; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bench, .neighbor { fill: none; stroke: #222; stroke-width: 2; transition: stroke 250ms; }
.neighbor { stroke: #bbb; }
.neighbor.affected { stroke: var(--talk-pink); }
.boundary { stroke: #aaa; stroke-width: 1; stroke-dasharray: 3 5; }
.bench-scene .decision { fill: var(--talk-pink); font-size: 24px; font-weight: 600; }
.decision, .stop-mark, .consequence { opacity: 0; transition: opacity 200ms; }
.stop-mark path { stroke: var(--talk-mint); stroke-width: 7; }
.stop-mark text { fill: #111; font-size: 24px; font-weight: 600; }
.bench-scene .consequence { fill: var(--talk-pink); font-size: 17px; }
.parcel { fill: #fff; stroke: var(--talk-blue); stroke-width: 1.5; }
.parcel path { fill: none; }
.malformed, .overflow { stroke: var(--talk-pink); }
.parcel text { fill: var(--talk-pink); stroke: none; font-size: 20px; }
.extra, .overflow { opacity: 0; transition: transform var(--bench-duration) cubic-bezier(.22,1,.36,1), opacity 200ms; }
.extra-one { transform: translate(355px,105px); }
.extra-one.visible { transform: translate(405px,105px); }
.extra-two { transform: translate(430px,105px); }
.extra-two.visible { transform: translate(480px,105px); }
.overflow { transform: translate(505px,105px); }
.overflow.visible { transform: translate(555px,105px); }
.visible { opacity: 1; }
.bench-caption { display: flex; align-items: baseline; gap: 24px; margin-top: 14px; font-size: 29px; font-weight: 650; white-space: nowrap; }
.phase { width: 120px; flex-shrink: 0; color: #666; font-size: 18px; font-weight: 500; }
.is-correct .bench-caption > span:last-child { box-shadow: inset 0 -.19em var(--talk-mint); }
.bench-controls { display: flex; align-items: center; gap: 22px; margin-top: 23px; font-size: 14px; }
.bench-controls button { appearance: none; border: 0; border-bottom: 1px solid #ccc; background: none; color: #555; padding: 6px 0; cursor: pointer; }
.bench-controls button.play { color: var(--talk-blue); border-color: var(--talk-blue); font-weight: 600; min-width: 84px; text-align: left; }
.bench-controls button:disabled { opacity: .35; cursor: default; }
.motion-choice { margin-left: auto; display: flex; gap: 7px; align-items: center; color: #777; font-size: 12px; }
.motion-choice input { accent-color: var(--talk-blue); }
.no-motion *, .no-motion *::before, .no-motion *::after { transition: none !important; animation: none !important; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
@media print { .bench-controls { display: none; } }
</style>
