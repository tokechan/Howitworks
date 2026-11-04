<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useIsSlideActive, useSlideContext } from '@slidev/client'

// Slidev's click position is the single source of truth, including presenter sync.
const { $clicks, $nav, $page, $renderContext } = useSlideContext()
const active = useIsSlideActive()
const step = computed(() => Math.min(3, Math.max(0, $clicks.value)))
const compact = computed(() => step.value === 1 || step.value === 2)
const arrived = computed(() => step.value >= 2)
const interactive = computed(() => active.value && ['slide', 'presenter'].includes($renderContext.value))
const playing = ref(false)
const still = ref(false)
const systemReduced = ref(false)
const noMotion = computed(() => still.value || systemReduced.value)
const captions = ['同じ部分が、くり返される。', 'くり返しを、参照に。', '小さい形で、送る。', '元の内容に、戻る。']
const labels = ['元のデータ', '圧縮', '転送', '展開']
let timer: ReturnType<typeof setTimeout> | undefined
let run = 0
let media: MediaQueryList | undefined

function stop() {
  run++
  clearTimeout(timer)
  timer = undefined
  playing.value = false
}
async function go(value: number) {
  if (interactive.value) await $nav.value.go($page.value, value)
}
function setStep(value: number) {
  stop()
  void go(Math.min(3, Math.max(0, value)))
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
      await go(next)
      if (id !== run) return
      if (next >= 3) stop()
      else advance()
    }, 1800)
  }
  advance()
}
function onKey(event: KeyboardEvent) {
  if (interactive.value && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageDown', 'PageUp', 'Home', 'End', 'Escape'].includes(event.key)) stop()
}
function onControlsKey(event: KeyboardEvent) {
  // Slidev ignores shortcuts while a button is focused. Keep arrows usable
  // immediately after clicking a control, without changing Enter/Space behavior.
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
watch(active, () => stop())
watch(noMotion, () => stop())
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
  <section class="compression-flow" :class="{ 'no-motion': noMotion }" :data-step="step" aria-label="圧縮、転送、展開の説明モデル">
    <div class="flow-stage" aria-hidden="true">
      <div class="endpoint source">送る側</div>
      <div class="endpoint destination">受け取る側</div>
      <div class="transfer-line"><span>→</span></div>
      <div class="payload" :class="{ compact, arrived }">
        <div class="token token-first">hello</div>
        <div class="token token-second">hello</div>
        <div class="token token-third">hello</div>
        <div class="reference">↶ ×2</div>
      </div>
      <div class="same" :class="{ visible: step === 3 }">hello hello hello <span>＝ 元の内容</span></div>
    </div>
    <div class="flow-caption" role="status" aria-live="polite" aria-atomic="true">
      <span class="phase">{{ labels[step] }}</span>
      <span>{{ captions[step] }}</span>
    </div>
    <div v-if="interactive" class="flow-controls" @click.stop @keydown="onControlsKey" @keydown.space.stop @keyup.space.stop @keydown.enter.stop @keyup.enter.stop>
      <button type="button" class="play" @click="play">{{ playing ? '一時停止' : step === 3 ? 'もう一度再生' : '再生' }}</button>
      <button type="button" :disabled="step === 0 && !playing" @click="setStep(step - 1)">戻る</button>
      <button type="button" :disabled="step === 3" @click="setStep(step + 1)">次へ</button>
      <button type="button" @click="setStep(0)">最初から</button>
      <label class="motion-choice"><input v-model="still" type="checkbox" :disabled="systemReduced" />{{ systemReduced ? '動きを減らす設定に対応中' : '動きを省略' }}</label>
    </div>
  </section>
</template>

<style scoped>
.compression-flow { --flow-duration: 650ms; margin-top: -10px; }
.flow-stage { position: relative; height: 190px; }
.endpoint { position: absolute; top: 0; color: #666; font-size: 18px; }
.source { left: 0; }
.destination { left: 540px; }
.transfer-line { position: absolute; top: 88px; left: 320px; width: 195px; height: 1px; background: #ddd; }
.transfer-line span { position: absolute; top: -22px; right: -4px; background: #fff; padding-left: 6px; color: #aaa; font-size: 28px; }
.payload { position: absolute; left: 0; top: 58px; width: 300px; height: 64px; transition: transform var(--flow-duration) cubic-bezier(.22,1,.36,1), width var(--flow-duration) ease; }
.payload.arrived { transform: translateX(540px); }
.payload.compact { width: 196px; }
.token { position: absolute; top: 0; width: 92px; height: 64px; display: grid; place-items: center; background: #fff; border: 1.5px solid #0070f3; color: #0070f3; font: 25px Menlo, monospace; transition: transform var(--flow-duration) cubic-bezier(.22,1,.36,1), opacity 250ms ease; }
.token-first { left: 0; }
.token-second { left: 104px; }
.token-third { left: 208px; }
.compact .token-second { transform: translateX(-104px); opacity: 0; }
.compact .token-third { transform: translateX(-208px); opacity: 0; }
.reference { position: absolute; left: 104px; top: 0; width: 92px; height: 64px; display: grid; place-items: center; opacity: 0; border-bottom: 3px solid var(--talk-mint); font-size: 26px; transition: opacity 250ms ease; }
.compact .reference { opacity: 1; }
.same { position: absolute; left: 540px; top: 144px; opacity: 0; color: #666; font: 13px Menlo, monospace; transition: opacity 250ms ease; white-space: nowrap; }
.same span { font: 16px 'Noto Sans JP Variable', sans-serif; color: #000; margin-left: 8px; }
.same.visible { opacity: 1; }
.flow-caption { display: flex; align-items: baseline; gap: 24px; margin-top: 8px; font-size: 30px; font-weight: 650; }
.phase { width: 120px; flex-shrink: 0; font-size: 18px; font-weight: 500; color: #666; }
.flow-controls { display: flex; align-items: center; gap: 22px; margin-top: 27px; font-size: 14px; }
.flow-controls button { appearance: none; border: 0; border-bottom: 1px solid #ccc; background: none; color: #555; padding: 6px 0; cursor: pointer; }
.flow-controls button.play { color: #0070f3; border-color: #0070f3; font-weight: 600; min-width: 84px; text-align: left; }
.flow-controls button:disabled { opacity: .35; cursor: default; }
.motion-choice { margin-left: auto; display: flex; gap: 7px; align-items: center; color: #777; font-size: 12px; }
.motion-choice input { accent-color: #0070f3; }
.no-motion *, .no-motion *::before, .no-motion *::after { transition: none !important; animation: none !important; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
@media print { .flow-controls { display: none; } }
</style>
