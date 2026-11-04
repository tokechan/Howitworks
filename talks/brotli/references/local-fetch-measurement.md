---
layout: default
---

# 手元の<span class="blue">fetch</span>でも、戻っていた。

<div class="comparison">
  <div><div class="label">送った本文</div><div class="number">103<span>B</span></div><div class="caption">圧縮済み</div></div>
  <div><div class="label blue">受け取った本文</div><div class="number blue">4,280<span>B</span></div><div class="caption">元の内容と一致</div></div>
</div>

<div class="footnote">本人の正常系の実測 · 2026-10-27 · Node.js v24.22.1 / HTTP/1.1 / Content-Encoding: br</div>

<!--
**2:55–3:25 / 30秒**

- 自作の正常な本文／圧縮して103 Bで送信
- fetchで読み出すと4,280 B／元の本文と一致
- 受信側に展開コードは書いていない／内側で処理
- 発見：知らない名前でも、すでに使っていた
- 次：では、今回何が問題に？

本人の記録：E1 `notes/brotli-http-auto-decode-2026-10-27.md`、<a href="/evidence/result-2026-10-27.txt" target="_blank" rel="noopener noreferrer">生ログ</a>。macOS・Node.js v24.22.1、quality 4、ローカルHTTP/1.1のGET・200応答。Accept-Encoding: brを明示し、応答にContent-Encoding: br。同じ本文を使ったnode:httpと、Content-Encodingなしのfetchでは103 Bのまま。値はその入力と設定での観測で、一般的な圧縮率ではない。今回は保存済み記録を照合し、実験の再実行やCVEの再現はしていない。
-->

