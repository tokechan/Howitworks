<script setup>
import { ref, computed, nextTick } from 'vue';
const mode = ref(null);
const returnFocus = ref(null);
const closeButton = ref(null);
const base = import.meta.env.BASE_URL;
const simulator = computed(() => `${base}simulator/index.html`);
const fallback = computed(() => `${base}evidence/patch-flow.jpg`);
async function openDemo(nextMode) {
  mode.value = nextMode;
  await nextTick();
  closeButton.value?.focus();
}
async function closeDemo() {
  mode.value = null;
  await nextTick();
  returnFocus.value?.focus();
}
</script>

<template>
  <div ref="returnFocus" class="demo-actions" tabindex="-1">
    <button class="demo-open" @click="openDemo('live')">シミュレーターを開く <span aria-hidden="true">→</span></button>
    <button class="demo-fallback" @click="openDemo('image')">静止画で見る</button>
  </div>
  <div v-if="mode" class="demo-overlay" role="dialog" aria-modal="true" aria-label="Brotliの修正前後を比較" @keydown.esc.stop="closeDemo" @keydown.stop>
    <div class="demo-toolbar"><span>{{ mode === 'live' ? 'Brotli Visualizer · 説明モデル' : '修正前だけ追加の入力が戻る · 説明モデル' }}</span><button ref="closeButton" @click="closeDemo">スライドへ戻る ×</button></div>
    <div class="demo-viewport">
      <iframe v-if="mode === 'live'" :src="simulator" title="Brotliシミュレーター" class="simulator-frame" />
      <img v-else :src="fallback" alt="左の修正前では追加の入力カードが戻り、右の修正後では形式エラーとして終了する説明図" />
    </div>
  </div>
</template>

<style scoped>
.demo-actions { display: flex; align-items: center; gap: 28px; margin-top: 26px; }
.demo-open { background: #000; color: #fff; padding: 15px 23px; border: 1px solid #000; border-radius: 5px; font-size: 22px; cursor: pointer; }
.demo-open span { color: #50e3c2; margin-left: 15px; }
.demo-fallback { color: #666; background: none; border-bottom: 1px solid #999; font-size: 17px; cursor: pointer; }
.demo-overlay { position: absolute; inset: 0; z-index: 50; background: #fff; display: flex; flex-direction: column; }
.demo-toolbar { height: 42px; flex: 0 0 42px; display: flex; justify-content: space-between; align-items: center; padding: 0 18px; border-bottom: 1px solid #eaeaea; font-size: 13px; }
.demo-toolbar button { font-size: 14px; padding: 6px 12px; border: 1px solid #aaa; border-radius: 4px; cursor: pointer; color: #000; background: #fff; }
.demo-viewport { flex: 1; min-height: 0; overflow: hidden; position: relative; }
.simulator-frame { position: absolute; inset: 0; width: 1280px; height: 665px; transform: scale(.765625); transform-origin: top left; border: 0; }
.demo-viewport img { width: 100%; height: 100%; object-fit: contain; }
</style>
