---
theme: geist
title: 'Brotliって何？'
titleTemplate: '%s · Howitworks'
info: |
  脆弱性のニュースで出会った名前を調べてみた、5分のLT。
  本編8枚＋参考1枚。4分40秒＋予備20秒。公開情報と本人の正常系の検証記録に基づく。
  作成2026-10-28、簡素化2026-10-29。発表日未定。元記事は2026-10-29更新の下書き。
author: Howitworks
keywords: Brotli, 圧縮, Google, Node.js
colorSchema: light
aspectRatio: 16/9
canvasWidth: 980
fonts:
  sans: 'Inter Variable, Noto Sans JP Variable'
  mono: Menlo
  provider: none
drawings:
  persist: false
download: false
exportFilename: howitworks-brotli-lt
transition: fade
duration: 5min
layout: cover
---

# <span class="pink">Brotli</span>って何？

<p class="subtitle">知らない名前を、調べてみた。</p>

<!--
**0:00–0:10 / 10秒**

- 入口：先週から発生し出した脆弱性対応で初めて知って、気になった名前
- 今日：何者？／なぜある？／身近なところでの発見
- 次：きっかけの話

背景：公開情報と本人の検証だけ。元記事 `articles/brotli-cve-2026-111497.md`（2026-10-29更新・下書き）を簡素化。発表日は未定。
-->

---
layout: cover
---

<div class="eyebrow">脆弱性の調査をした際に</div>

# <span class="pink">Brotli</span>…？

<p class="subtitle">名前は知らない。でも、使っているらしい。</p>

<!--
**0:10–0:40 / 30秒**

- 脆弱性の調査中に知った名前／この名前知ってる方いますか？みたことある、効いたことある？何のライブラリ？
- 自分では書いた覚えがない／使っている道具にも関係？
- まずは正体を調べる

根拠：[JPCERT/CC 注意喚起](https://www.jpcert.or.jp/at/2026/at260034.html)（2026-10-26、確認2026-10-29）。対象はC実装の展開処理。ニュースの通称に依存せず、公式のCVE識別子で照合。詳細は7枚目のノート。
-->

---
layout: cover
---

# <span class="blue">Google</span>が作った、<br>圧縮技術。

<p class="subtitle">Webを、もっと軽く。</p>

<div class="history-line"><span>2015 <small>汎用圧縮として発表</small></span><span>2016 <small>RFC 7932</small></span></div>

<!--
**0:40–1:20 / 40秒**

- 正体：可逆圧縮／元と同じ内容に戻せる
- 背景：Webの読み込み待ち／通信量／Webフォントの圧縮需要
- 2015：Googleが汎用圧縮として発表／2016：形式をRFCに記載
- 発見：新しい名前だと思ったら、10年以上前から
- 次：小さくして、戻すイメージ

根拠（確認2026-10-29）：[Google Open Source Blog / Introducing Brotli](https://opensource.googleblog.com/2015/09/introducing-brotli-new-compression.html)（2015-09-22）、[RFC 7932](https://www.rfc-editor.org/rfc/rfc7932.html)（2016-07、Abstract・§1）。Webフォント由来の背景を含むため「2015年に初めて誕生」とは言わない。RFCの区分はInformational。速さや圧縮率は入力・設定次第、固定の改善率は示さない。
-->

---
layout: default
clicks: 3
---

# 小さく送って、<span class="mint-mark">そのまま戻す</span>。

<CompressionFlow />

<div class="footnote">くり返しの参照を示す模式図。実際のBrotliの符号・圧縮率ではありません。</div>

<!--
**1:20–2:20 / 60秒（操作込み）**

- 最初：helloが3回／同じ部分がある
- 【→ 1回】圧縮：最初のhello＋「前と同じを2回」／くり返しを参照に
- 【→ 2回】転送：小さく表したデータを送る
- 【→ 3回】展開：参照をたどる／helloが3回／元と同じ内容
- Brotli：この工夫に、辞書や符号化も組み合わせる
- 次：普段のどこで使われる？

操作：→／Spaceで3段階、←で戻る。ボタンの「再生」は約6秒で一巡。「最初から」で0段階に戻る。ページへ戻ったときはSlidevのクリック位置を再現し、勝手に再生しない。発表者画面からも段階を操作できる。時間が押したら「小さく送って同じ内容に戻す」だけ話し、3回進める。

根拠：[RFC 7932 §1.1・§4・§8](https://www.rfc-editor.org/rfc/rfc7932.html)（確認2026-10-29）。LZ77の後方参照、ハフマン符号、静的辞書などを組み合わせる方式。この図は後方参照の直感だけを抜き出したモデル。「参照×2」は実在のBrotli命令ではなく、各箱の幅もバイト数ではない。短い文字列ではヘッダーなどにより圧縮後に大きくなる場合もある。
-->

---
layout: default
---

# いつもの道具にも、<span class="blue">いた</span>。

<div class="familiar-tools"><div>Chrome</div><div>Node.js</div></div>

<p class="large-caption">Webを読むとき。データを受け取るとき。</p>

<!--
**2:20–2:55 / 35秒**

- Chrome：Webコンテンツの展開／HTTPでは br という名前
- Node.js：標準のnode:zlibに圧縮・展開API
- 自分が直接使わなくても、道具の内側に
- 次：手元でも確かめた

根拠（確認2026-10-29）：[Chrome Developers / Shared dictionaries](https://developer.chrome.com/blog/shared-dictionary-compression)（2024-03-06、BrotliのChrome導入は2016年）、[Node.js zlib API](https://nodejs.org/api/zlib.html#class-zlibbrotlidecompress)。これは利用例であり、この2製品が同じ脆弱性の影響を受けるという一覧ではない。利用される実装・版・入力経路は個別に確認。
-->

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

---
layout: default
clicks: 4
---

# 問題は、<span class="pink">開ける側の判断</span>。

<ParcelWorkbench />

<div class="footnote">荷物と作業台のたとえ。実際のメモリ配置・展開後のサイズを示す図ではありません。</div>

<!--
**3:25–4:20 / 55秒（操作込み）**

- 入口：梱包して戻すルール＝圧縮方式／開ける作業員＝そのルールを動かす実装
- 最初：おかしな荷物＝不正な入力／本来は「壊れているので中止」
- 【→ 1回】続き待ち、と誤判断／壊れているのに「まだ届いていない」
- 【→ 2回】受け取った入力を、小さい作業台へ置き続ける／2個が順に着くのを一拍待つ
- 【→ 3回】荷物 → 境界 → 隣の順に見る／台の範囲をはみ出す／メモリ破損の可能性
- 【→ 4回】一拍置き「正しい処理なら」／異常なので止める／別の処理との対比
- 着地：今回の不具合は、展開するC実装の判断と入力の扱い
- 注意：入っている＝脆弱・悪用可能、ではない／影響は版と使い方で確認
- 次：自分の道具の裏側へ

操作：→／Spaceで4段階、←で戻る。「再生」は最初から約8秒で一巡、「一時停止」は次の段階への自動進行を止める（現在の短い動きは着地まで進む）。通常はトークに合わせて手動で進める。再入場・再読み込みではSlidevのクリック位置を再現し、自動再生しない。発表者画面の操作とも同期。

**比喩の対応・限界**

- 作業台＝デコーダー内部の小さい入力バッファ。荷物＝受け取った圧縮入力の追加分。展開後の出力を台に積む話ではない。
- 実際は不正なブロック切り替え（invalid block switch）を、恒久的な形式エラーではなく一時的な入力不足と報告。8バイトの内部バッファへ追加し続け、範囲外書き込みに至り得る。
- 箱の数・大きさ・配置・作業員は説明用。実際のメモリ配置、入力バイト列、攻撃手順を再現しない。圧縮爆弾や正常な展開出力の巨大化とも別の問題。
- 境界と隣の短い強調は観客が影響を理解するため。脆弱な実装が異常を自動検知した表現ではない。
- 最後の場面は、異常を正しく判定した場合。壊したメモリを後から戻す動きではない。
- 結果はメモリ破損、異常終了、情報漏えい、コード実行につながる可能性。攻撃成功は断定せず、製品の修正情報・版・外部入力が届く経路で確認。「圧縮方式には今後も問題が起きない」という一般論にはしない。

一次情報（確認2026-10-29）：[Node.js 2026年10月のセキュリティリリース](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases#nodejs-brotli-decoder-out-of-bounds-write-permits-remote-code-execution-cve-2026-111497---high)、[Google Brotli v1.2.1](https://github.com/google/brotli/releases/tag/v1.2.1)、[修正差分](https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b)、[JPCERT/CC](https://www.jpcert.or.jp/at/2026/at260034.html)。CVE-2026-111497を照合。今回は圧縮形式の変更ではなく、実装のエラー判定と伝達の修正。

質疑の入口：修正版の例は参考9枚目のノート。通称Node2Shell / HTTP2Shellは本編では使わない。実際の攻撃やパッチの有効性は未検証。
-->

---
layout: cover
---

# あなたの道具の裏にも、<br><span class="mint-mark">いるかも。</span>

<p class="subtitle">実行環境。フレームワーク。その依存先。</p>

<!--
**4:20–4:40 / 20秒**

- 知らない名前／Webを軽くする技術／自分のfetchの裏にも
- 皆さんの言語の実行環境やフレームワークにも、いるかも
- 知らない名前から、依存先を一段たどってみる
- ここで終了／ありがとうございました

残り20秒：操作・間の予備。次の9枚目は質疑用。

根拠：前の利用例・本人のE1からの呼びかけ。すべての言語やフレームワークにBrotliが入るという主張ではない。
-->

---
layout: default
---

<div class="eyebrow">参考 / 本編ここまで</div>

# もう少し、知りたいときに。

<div class="reference-links compact-references">
  <a href="https://opensource.googleblog.com/2015/09/introducing-brotli-new-compression.html" target="_blank" rel="noopener noreferrer">Googleの発表 <span>歴史と目的 ↗</span></a>
  <a href="https://www.rfc-editor.org/rfc/rfc7932.html" target="_blank" rel="noopener noreferrer">RFC 7932 <span>圧縮の仕組み ↗</span></a>
  <a href="https://nodejs.org/en/blog/vulnerability/october-2026-security-releases" target="_blank" rel="noopener noreferrer">Node.jsの公式説明 <span>今回の脆弱性 ↗</span></a>
</div>

<!--
**質疑用 / 5分には含めない**

- 辞書：定番の語句を参照／後方参照：すでに出た並びを利用
- 符号化：出現頻度などに応じた短い表現／RFC §1.1・§4・§8
- 今回：不正なブロック切り替えを入力待ちと誤認／内部8 Bの入力バッファの範囲外へ書き込み得る
- 修正：入力不足と形式エラーを区別／圧縮形式を変更した話ではない

**修正版の例（2026-10-29に公式と照合。当時の例）**

- [Google Brotli v1.2.1](https://github.com/google/brotli/releases/tag/v1.2.1)：CVE-2026-111497の修正を明記。
- [Node.js v24.22.1](https://nodejs.org/en/blog/release/v24.22.1)：Brotli修正コミットの取り込みを明記。全製品共通の更新先ではない。
- [修正差分](https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b)：内部の戻り値の区別と伝達。
- [JPCERT/CC](https://www.jpcert.or.jp/at/2026/at260034.html)：影響範囲と製品ごとの対応確認。

追加の入口：[Google公式リポジトリ](https://github.com/google/brotli)、[Chromeでの利用](https://developer.chrome.com/blog/shared-dictionary-compression)、[Node.js API](https://nodejs.org/api/zlib.html#class-zlibbrotlidecompress)。本人の検証ログは6枚目のノート。元記事・対応体験・詳細なシミュレーターへのリンクはREADME。今回は各サービスの適用状況や端末の安全性を判定する資料ではない。
-->
