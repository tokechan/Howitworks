<script setup>
const article = import.meta.env.VITE_HOWITWORKS_ARTICLE;
</script>
<template>
  <a v-if="article" :href="article" target="_top" class="article-return" @click.stop>← 解説記事に戻る</a>
  <div class="slide-number">{{ $slidev.nav.currentPage }}</div>
</template>

<style scoped>
.slide-number { position: absolute; bottom: 33px; right: 34px; color: #888; font: 13px 'Inter Variable', sans-serif; pointer-events: none; }
.article-return { position: absolute; top: 12px; right: 26px; color: #666; font: 11px 'Inter Variable', sans-serif; text-decoration: none; z-index: 10; padding: 5px 8px; }
.article-return:hover, .article-return:focus-visible { color: #0070f3; text-decoration: underline; }
</style>
