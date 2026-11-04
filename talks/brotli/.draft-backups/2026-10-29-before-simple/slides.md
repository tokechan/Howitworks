---
theme: geist
title: 'Brotli — 呼んでないのに、なぜ？'
titleTemplate: '%s · Howitworks'
info: |
  Brotliを直接使わないコードにも脆弱性対応が必要になる理由。
  5分LT。本編12枚＋参考3枚。説明・デモ4分40秒＋予備20秒。元記事は2026-10-29の対応体験追記版。
  実測：2026-10-27。Windows・WSLの対応記録：2026-10-28〜29。脆弱性の説明は一次資料に基づく。
author: Howitworks
keywords: Brotli, Node.js, fetch, CVE-2026-111497
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
transition: none
duration: 5min
layout: cover
---

<div class="eyebrow">Brotli / Node.js</div>

# 呼んでないのに、<br><span class="pink">なぜ？</span>

<p class="subtitle">自動展開の実験と、更新して分かったこと。</p>

<div class="footnote">CVE-2026-111497 · 2026.10.29 更新</div>

<!--
**0:00–0:10 / 10秒**

> Brotliを呼んでいないのに、なぜ対応が必要なのか。実験と、実際に更新して分かったことをお話しします。

**【切り替え・0:10】** 2枚目へ。

**補足・出典（読み上げない）**

補足：対象はGoogle BrotliのC実装。圧縮形式そのものの欠陥という意味ではありません。「Node2Shell」「HTTP2Shell」は今回のCVEに関する通称です。

出典：[S1 JPCERT/CC](https://www.jpcert.or.jp/at/2026/at260034.html)、[S3 Brotli公式](https://github.com/google/brotli)。確認日：2026-10-28。元記事：`articles/brotli-cve-2026-111497.md`（2026-10-29の対応体験追記版・下書き）。発表日は未定。
-->

---
layout: default
---

# 同じ <span class="blue">103 B</span> を送った。

<div class="comparison">
  <div><div class="label">node:http</div><div class="number">103<span>B</span></div><div class="caption">圧縮されたまま</div></div>
  <div><div class="label blue">fetch</div><div class="number blue">4,280<span>B</span></div><div class="caption">元の本文に一致</div></div>
</div>

<div class="footnote">実測 · Node.js v24.22.1 / HTTP/1.1 / 応答 Content-Encoding: br</div>

<!--
**0:10–0:35 / 25秒**

**【操作】** 左の103 B、右の4,280 Bを指します。

> 同じ103バイトの圧縮データを返すサーバーを用意しました。
> node:httpでは103バイトのまま。fetchでは4,280バイトで、元の本文と一致しました。
> 受け取る側には、展開するコードを書いていません。応答にはContent-Encoding: brを付けています。

**【切り替え・0:35】** 数字を見る間を置き、3枚目へ。

**補足・出典（読み上げない）**

補足：2回の別々のリクエストです。全要求に `Accept-Encoding: br` を明示。正常な自作テキストをquality 4で圧縮し、HTTP/1.1のGET・200応答を比較しました。macOS 15.8.1 / arm64、Brotli表示1.2.0、Undici 7.30.1。HTTP/2・HTTPS・ブラウザーのfetchは未検証です。

根拠：E1 `notes/brotli-http-auto-decode-2026-10-27.md`、<a href="/evidence/result-2026-10-27.txt" target="_blank" rel="noopener noreferrer">保存した実行ログ</a>。実測日：2026-10-27。受信コード：`experiments/brotli-http/client.mjs`。
-->

---
layout: default
---

# <span class="blue">fetch</span> の内側。

<div class="pipeline">
  <div class="pipeline-label blue">fetch</div><div>103 B</div><div class="arrow">→</div><div class="mint-mark">デコーダー</div><div class="arrow">→</div><div>4,280 B</div>
  <div class="pipeline-label">node:http</div><div>103 B</div><div class="arrow">→</div><div class="muted">そのまま</div><div class="arrow">→</div><div>103 B</div>
</div>

<div class="footnote">正常応答・Content-Encoding: br の経路を簡略化</div>

<!--
**0:35–0:55 / 20秒**

**【操作】** 上段のデコーダーを指し、下段と比べます。

> fetchはbrを見て、圧縮を元に戻すデコーダーに本文をつなぎます。この処理のつながりがパイプラインです。
> 今回のnode:httpは、展開せずそのまま渡します。使うAPIで、内側の処理が違うんです。

**【切り替え・0:55】** 4枚目へ。

**補足・出典（読み上げない）**

補足：Node.js v24.22.1のfetchはUndiciを使います。`zlib.createBrotliDecompress()`を選び、本文と`pipeline()`で接続。ネイティブ側で`BrotliDecoderDecompressStream()`を呼びます。実際はヘッダーから経路を準備し、到着する本文を順に処理します。全受信後に初めてデコーダーを選ぶ図ではありません。

出典：[S9 Undici](https://github.com/nodejs/node/blob/v24.22.1/deps/undici/src/lib/web/fetch/index.js#L2256)、[S10 node_zlib.cc](https://github.com/nodejs/node/blob/v24.22.1/src/node_zlib.cc#L1546)、[S11 HTTP API](https://github.com/nodejs/node/blob/v24.22.1/doc/api/http.md#L30)。

ヘッダーの対照実験：同じfetchでもContent-Encodingを外すと103 Bのままでした。Accept-Encodingは要求側の受け入れ形式、Content-Encodingは応答本文の符号化。Content-Lengthの103と読み出した4,280は、それぞれ圧縮済み本文と展開後本文なので矛盾しません。E1の全3ケースは参考14ページ。

出典：[S13 RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4)、E1の保存ログ。
-->

---
layout: default
---

# 正常でも、<span class="mint-mark">待つ</span>。

<div class="sequence"><span>読む</span><span class="arrow">→</span><span class="blue">入力待ち</span><span class="arrow">→</span><span>再開</span></div>

<div class="large-caption">途中の状態を、保つ。</div>

<div class="footnote">ストリーミング処理の説明モデル</div>

<!--
**0:55–1:15 / 20秒**

> データは少しずつ届くことがあります。必要な情報がまだ足りなければ、途中の状態を保って待つ。続きが来たら再開します。
> この入力待ちは、正常な動きです。

**【間】** 「正常な動きです」で一拍。

**【切り替え・1:15】** 5枚目へ。

**補足・出典（読み上げない）**

補足：公開APIは、成功・エラー・追加入力が必要・出力先の空きが必要を区別します。ここでは入力待ちに絞っています。シミュレーターの断片A/B/Cや待つ位置は説明用で、実測したチャンク境界ではありません。

出典：[S12 Brotliの公開APIと入出力契約](https://github.com/google/brotli/blob/v1.2.1/c/include/brotli/decode.h#L230)。
-->

---
layout: default
---

# 修正前：違う理由、<span class="pink">同じ値</span>。

<div class="merge-comparison fault-comparison">
  <div><div>入力不足</div><div class="pink">形式エラー</div></div>
  <div class="arrow">→</div>
  <div class="mono giant pink">false</div>
</div>

<div class="large-caption">誤った入力待ち → <span class="pink">境界外書き込み</span></div>

<div class="footnote">内部の8 Bバッファ · 脆弱な実装と細工された入力で起こり得る経路</div>

<!--
**1:15–1:40 / 25秒**

> ところが問題の経路では、入力不足でも形式エラーでも、同じfalseを返していました。
> その取り違えから、細工された入力で内部の8バイトの範囲外へ書き込むことがあり、コード実行にもつながり得ます。
> 正常な展開とは別の問題です。

**【切り替え・1:40】** 6枚目へ。

**補足・出典（読み上げない）**

補足：対象は`DecodeBlockTypeAndLength`。すべてのエラーをfalseで返していたという主張ではありません。Brotli内部のブロックの種類・長さの読み取りであり、HTTP/2フレームの話ではありません。

出典：[S4 修正差分](https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b)。

補足：正常な103→4,280の展開自体が脆弱性なのではありません。影響を受ける実装へ攻撃者の細工したデータが届くことが条件です。必ずコード実行になるという意味でもありません。今回はメモリ破壊や攻撃を実行していません。

出典：[S5 Node.jsの脆弱性説明](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases#nodejs-brotli-decoder-out-of-bounds-write-permits-remote-code-execution-cve-2026-111497---high)、[S1 JPCERT/CC](https://www.jpcert.or.jp/at/2026/at260034.html)。

8 Bは入力の一時保持用で、4,280 Bの展開先とは別です。falseを返すのは修正対象の内部関数の当該経路であり、全エラー・公開APIを一律に説明したものではありません。
-->

---
layout: default
---

# 修正後：<span class="mint-mark">理由を伝える</span>。

<div class="plain-rows fix-rows">
  <div><span>入力不足</span><span class="arrow">→</span><strong class="blue">待つ</strong></div>
  <div><span>形式エラー</span><span class="arrow">→</span><strong class="pink">終了</strong></div>
</div>

<div class="footnote">内部の戻り値を区別し、呼び出し側へ伝達</div>

<!--
**1:40–2:00 / 20秒**

> 修正後は、入力が足りないなら待つ。形式が不正なら、そこで終了する。
> 理由を区別して、呼び出し側に伝えるようになりました。「待っていい」と「止めるべき」を分けたんですね。

**【切り替え・2:00】** 7枚目でデモを開きます。

**補足・出典（読み上げない）**

補足：戻り値がboolから`BrotliDecoderErrorCode`に変更。`BROTLI_DECODER_SUCCESS`、`BROTLI_DECODER_NEEDS_MORE_INPUT`、`BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH`を区別します。この「成功」は内部の読み取り成功で、本文全体の展開完了とは別です。公開APIの`RESULT_`付きの名前とも区別してください。

出典：[S4 修正差分](https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b)、[S2 Brotli v1.2.1](https://github.com/google/brotli/releases/tag/v1.2.1)。
-->

---
layout: default
---

<div class="eyebrow">DEMO / 35 sec</div>

# 同じ入力、<br><span class="blue">違う分岐。</span>

<DemoLink />

<div class="footnote">公式説明に基づく学習モデル · 脆弱性の実行再現ではありません</div>

<!--
**2:00–2:35 / 35秒（操作を含む）**

### 2:00–2:08｜デモを開く

**【操作・通常スライド側】** 「シミュレーターを開く」→「03 修正前と修正後」→ステップ3「判断が分かれる」。

> これは説明用のモデルです。左が修正前、右が修正後です。

### 2:08–2:15｜判定を見る

**【操作】** 左の「入力待ちと誤認」と右の「形式エラー」を指します。

> 同じ不正な入力を、左は入力待ち、右は形式エラーと判断します。

### 2:15–2:25｜追加入力を流す

**【操作】** `▷│`で4「結果を伝える」→5「入力の追加」。カードの移動を待ってから次へ。

> 次の入力を届けると、左だけ処理が続きます。右は止まったままです。

### 2:25–2:30｜境界と停止を見る

**【操作】** `▷│`で6「境界と停止」。左右の状態を指します。

> ここで止められるかどうかが違います。

### 2:30–2:35｜スライドへ戻る

**【操作】** 「スライドへ戻る ×」で閉じ、7枚目に戻ったことを確認して`→`で8枚目へ。デモ内の矢印キーはスライド送りではありません。

**デモの代替（必要な場合だけ読む）**

**【操作】** 開かない場合、または7枚目に入った時点で2:20を過ぎていた場合は「静止画で見る」に切り替えます。

> 左は不正な入力を入力待ちと扱って、追加の入力を受け取ります。右は形式エラーで終了します。

**【操作】** 閉じて8枚目へ。静止画も開かなければ口頭だけで進めます。デモ終了の目安は2:35、遅くても2:55。操作で使う予備は20秒までです。

**補足・出典（読み上げない）**

シミュレーターの断片・移動・バッファは説明モデルです。実際の脆弱なデコーダー、メモリ破壊、攻撃コードは実行しません。操作は投影する通常スライド側で行い、発表者画面とはページ移動のみ同期します。

根拠：`simulators/brotli/`、[S4 修正差分](https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b)、[S5 Node.js公式説明](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)。
-->

---
layout: default
---

# <span class="blue">Node.js</span> の中にも、Brotli。

<div class="static-link">Node.js <span class="bracket">[</span> <span class="mint-mark">Brotli</span> <span class="bracket">]</span></div>

<div class="large-caption">組み込まれたコードを、更新する。</div>

<div class="footnote">手元のNode.js 1個で静的リンクを確認 · E2 / macOS・nvm</div>

<!--
**2:35–2:55 / 20秒**

> では、何を更新するのか。MacのNode.jsを調べると、Brotliのコードが実行ファイルに入っていました。
> この場合、OS側だけ更新しても中身は変わりません。組み込んだ製品にも、修正を届ける必要があります。

**【切り替え・2:55】** 9枚目からWindowsの対応体験へ。

**補足・出典（読み上げない）**

補足：E2は`node_shared_brotli=false`、`otool -L`にBrotliの共有ライブラリなし、`nm -m`でコード領域に`_BrotliDecoderDecompressStream`の定義あり、の3点を合わせた判断です。`external`はシンボルの可視性で、動的リンクを意味しません。Node.js全体が完全静的、すべての配布物が同じ構成、とは主張していません。

根拠：E2 `notes/brotli-node-linkage-2026-10-27.md`（2026-10-27実測）、[S1 製品ごとの対応を確認する方針](https://www.jpcert.or.jp/at/2026/at260034.html)。
-->

---
layout: default
---

# 更新先は、<span class="blue">ひとつじゃなかった</span>。

<div class="inventory-rows">
  <div><strong>Windows</strong><span>nvmのNode.js</span></div>
  <div><strong>WSL</strong><span>Node.js ＋ OSのBrotli</span></div>
  <div><strong>Git</strong><span>同梱curl</span></div>
</div>

<div class="footnote">Windows 11・WSLの対応記録 · 2026.10.28–29 / E4 · 前半のMac実験とは別環境</div>

<!--
**2:55–3:25 / 30秒**

**【操作】** Windows→WSL→Gitの順に指します。

> そこで、Windowsの開発環境も調べてみました。
> Node.jsはWindowsだけでなくWSLにもあり、OSのBrotliや、Gitに付属するcurlも別でした。
> 導入元、版、外部データを展開する経路を整理し、配布元の修正情報と照らして、それぞれ更新しました。

**【切り替え・3:25】** 10枚目へ。

**補足・出典（読み上げない）**

**対応記録：2026-10-28に棚卸し、10-29に対処。** Windows 11とWSL Ubuntu 24.04の記録で、前半のMacのE1・E2とは別環境です。作業と値は本人の記録E4に基づき、修正版・適用条件を一次情報と照合しています。今回、対象PCのコマンドや生ログ、稼働中プロセスを再検査した結果ではありません。

### 何を調べたか

導入元、使用中の版、外部由来のデータがデコーダーへ届く経路、修正版の提供状況を対象別に整理しました。nvmの別バージョン、Electronアプリ、コンテナ、プロジェクトやCIの版固定も別の確認先です。ネットワーク以外のファイルなども入力になり得るため、通信しないという理由だけで対象外にしません。

### 記録上の対応前後

| 対象 | 対応前 → 対応後 | 確認・一次情報 |
| --- | --- | --- |
| Windows・選択中のNode.js | 24.21.0 → 24.22.1 | `node -v`。S6に当該CVEの修正取り込み |
| WSL・nvm管理のNode.js | 24.13.0 → 24.22.1 | `nvm current`とdefault設定。S6 |
| WSL・OSのlibbrotli1 | 1.1.0-2build2 → 1.1.0-2ubuntu0.1 | S22のUbuntu 24.04向け修正版に一致 |
| Git for Windows | 2.52.0 → 2.56.0(4) | 同梱curlの表示がbrotli/1.2.0 → 1.2.1。S23に修正の明記 |

### 判断で気を付けたこと

- WSLのcurlは更新後も`brotli/1.1.0`と表示。上流の表示だけでなく、配布元が示す修正済みパッケージ版`1.1.0-2ubuntu0.1`で照合しました。
- Ubuntuの「nodejsはsystem brotliを使用」はUbuntu公式パッケージの説明です。nvmで別途入れたNode.jsまで同じ構成と判断せず、別に更新しました。
- Gitは当時wingetで提示された(3)ではなく、公式の(4)を導入した記録。`ucrt64/bin/curl.exe -V`で見たのはGit同梱curlであり、Windows標準curlではありません。
- これは選択中の版やパッケージを更新した記録です。旧版の全削除や全プロセスへの反映完了を示すものではありません。残った項目は次ページ。

**出典・記録**

- E4：`notes/brotli-cve-2026-111497.md`「Windows・WSLの対応記録と一次情報の照合」。元記事の体験談「実際に対応してみると、『どのNode.jsか』から調べる必要があった」も参照。
- [S6 Node.js v24.22.1](https://nodejs.org/en/blog/release/v24.22.1)：Node.jsへの修正取り込み。
- [S22 UbuntuのCVE対応表](https://ubuntu.com/security/CVE-2026-111497)：パッケージの修正版とsystem brotliの注記。
- [S23 Git for Windows 2.56.0(4)](https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.4)：Brotli 1.2.1への更新。
- [S1 JPCERT/CC](https://www.jpcert.or.jp/at/2026/at260034.html)：影響と各製品の対応確認。

E4と追加資料の照合日：2026-10-29。版番号は当時の対応記録として示し、将来の一律の推奨版とはしません。
-->

---
layout: default
---

# 更新後も、<span class="pink">確認は残る</span>。

<div class="response-rows">
  <div><strong>Electron</strong><span>製品への<span class="mint-mark">修正取り込み</span></span></div>
  <div><strong>旧Node・イメージ</strong><span>利用前の更新</span></div>
  <div><strong>.NET</strong><span>一次情報で<span class="blue">判断を訂正</span></span></div>
</div>

<div class="footnote">更新操作・修正の確認・残る作業を区別 · 2026.10.29照合 / E4</div>

<!--
**3:25–4:00 / 35秒**

> 修正版があり、外部データを展開する可能性があるものから対応しました。
> ただ、アプリを更新しても、中のNode.jsまで修正済みとは限りません。Electronや残したイメージは、確認や更新が残りました。
> さらに一次情報を読み直すと、.NETの判断も訂正が必要でした。更新できたものと、残る作業を分けて記録しました。

**【切り替え・4:00】** 11枚目へ。

**補足・出典（読み上げない）**

### 優先順位と残った作業

当時は、外部データを展開する可能性があり、修正版が提供されている対象から対応しました。「更新した」にはアプリの更新操作も含まれ、製品全体の修正完了とは一致しません。元記録の「9件完了・6件待ち・8件対象外」は分類が重なるため、完了件数として用いません。

- **Electron製品**：VS Code・Obsidianはアプリを更新。ただし記録中のバイナリ文字列はNode.js 24.21.0・24.22.0でした。Electron 44.10.0自体のNode.js 24.22.1取り込みはS24で確認できますが、各製品への採用とは別。Chromiumが一定以上ならアプリ全体が修正済み、とは判断しません。S25は`net.fetch()`とNode.jsの`fetch()`の経路の違い、S30は両方の確認が必要な根拠です。文字列検出と稼働中ランタイムの確認も区別します。
- **旧Node.jsとコンテナ**：nvmに旧版が一部残り、Node.js 24.12.0を含む開発用イメージ2個は次回再ビルドの方針。削除・整理と修正を分け、残置分は未完了と記録しました。ローカル用でも外部データを扱う経路はあり得ます。Dockerの`--no-cache`はビルドキャッシュを使わない指定で、ベースイメージの更新確認は`--pull`。古い版・digestの固定があれば指定も改め、作り直したコンテナで確認する必要があります。今回は実行していません。
- **稼働中の実体**：OSパッケージを更新しただけでは、すでに動くプロセスへの反映までは確認できません。プロジェクト・CIの版固定も別の作業です。

### 記事化で訂正した.NETの判断

元記録では.NET 9.0.21を残し、9.0.22を通常更新として扱っていました。Microsoftの対象表では9.0.21は影響範囲内、修正版は9.0.22です。記録にある8.0.33と10.0.14はそれぞれの修正版と一致しますが、アプリが実際に選ぶ版までは別途確認が必要です。

ASP.NET CoreやHttpClientの自動展開が既定で無効という説明は、入力の到達条件です。設定で有効にした場合やBrotliStream等を使う場合は異なり、未修正の版を修正済みと扱う理由にはなりません。利用アプリと選ばれるランタイムを確認する項目として残します。ランタイム同梱型やNative AOTのアプリは再ビルド・再配布などが必要で、共有ランタイムの更新だけで済まない場合があります。

この体験談で示すのは「すべて安全になった」ことではなく、調べた対象ごとに、更新の根拠・判断の訂正・残る確認事項を記録したことです。対象PCの再検証や追加の更新作業は今回行っていません。

**出典・記録（2026-10-29照合）**

- E4：`notes/brotli-cve-2026-111497.md`の対応記録と訂正。S番号は記事と共通。
- [S24 Electron 44.10.0](https://github.com/electron/electron/releases/tag/v44.10.0)：Node.js 24.22.1への更新。
- [S25 Electron net API](https://www.electronjs.org/docs/latest/api/net#netfetchinput-init)：ChromiumとNode.jsの通信API。
- [S30 Patch the Planet / Exposure](https://patchtheplanet.org/brotli#exposure)：Electron製品ではChromiumとNode.jsの両方を確認。
- [S26 Microsoft .NET Advisory](https://github.com/dotnet/announcements/issues/494)：影響する版、入力の到達条件、修正方法。
- [S27 Docker build best practices](https://docs.docker.com/build/building/best-practices/#rebuild-your-images-often)：イメージの再ビルド、`--pull`と`--no-cache`。
-->

---
layout: default
---

# Vercelの<span class="blue">暫定対策</span>。

<div class="version-example"><div class="label">外部からの Brotli 応答</div><div class="giant">展開前に<span class="pink">拒否</span></div></div>

<div class="large-caption"><span class="mint-mark">再デプロイ</span>で適用</div>

<div class="footnote">HTTPクライアント経由の応答が対象 · 2026.10.28確認 / S14</div>

<!--
**4:00–4:25 / 25秒**

> サービス側にも、暫定対策があります。
> 10月28日に確認したVercelの告知では、fetchなどのBrotli応答を展開前に拒否し、既存プロジェクトは再デプロイで適用する案内でした。
> これも、正式な修正が届いたかとは分けて確認します。

**【切り替え・4:25】** 12枚目へ。

**補足・出典（読み上げない）**

- 公式Advisoryは、未修正Node.jsを使う新規デプロイメントに、Brotliを要求しない処理とBrotli応答を展開前に拒否する処理を適用すると説明。対象はfetch()とnode:http / node:httpsを使うHTTPクライアント。要求ヘッダーからbrを外すだけ、と要約しない。
- 既存プロジェクトは再デプロイ。Node.js 22 / 24はバージョン設定の変更不要。EOLの20は22 / 24へ変更して再デプロイする案内。直接の展開APIなど、告知対象外の経路まで保護されるとは判断しない。
- 未修正Node.js上でも保護するという説明から、process.versionだけでは暫定保護の有無を判定できないと整理できる。正式更新の完了は別に確認する。
- WAFはVercelを通る受信リクエストを保護するが、外部から取得するレスポンスは対象外。今回の経路の制限はランタイム側の対応。手元のnode:httpの標準動作が自動展開へ変わった、という意味ではない。
- 調査時に共有されたShohei Maeda氏の投稿の引用には「10/26 18:10 UTC以降＝10/27 03:10 JST」「正式更新は今週中」「node-fetchも対象」とある。ただし原ポストURLは未確認。確認したAdvisory本文には正確な時刻・期限・個別パッケージ名がなく、公式本文で確認できた範囲と分けて扱う。
- この対応は公式告知の調査結果。Vercel上で暫定パッチの適用や挙動を実行検証した結果ではない。

出典：[S14 Vercel Security Team / Node.js security advisory / Vercel-managed runtime protection](https://vercel.com/kb/bulletin/node-js-security-advisory#vercel-managed-runtime-protection)。掲載日2026-10-26、確認日2026-10-28。各社比較は元記事の「Vercelの暫定対策と、各社が届ける更新」および参考ページのノート。
-->

---
layout: cover
---

<div class="eyebrow">今日の持ち帰り</div>

# コードの奥まで、<br><span class="mint-mark">修正を届ける。</span>

<div class="takeaway"><span class="blue">依存先</span><span class="arrow">→</span><span class="pink">入力経路</span><span class="arrow">→</span><span>稼働中の実体</span></div>

<!--
**4:25–4:40 / 15秒**

> 直接呼んでいなくても、依存先が使っています。
> どこに入り、何を受け取り、修正がどこまで届いたか。残る作業も含めて確認する。これが今回の学びです。ありがとうございました。

**【終了・4:40】** 12枚目で止めます。13〜15枚目は質疑用。残り20秒は操作や間の予備です。

**補足・出典（読み上げない）**

補足：上流の公開、製品への取り込み、環境の更新、稼働中の実体への反映を分けて考えた整理です。各製品の具体的な更新手順は開発元の案内に従います。

時間：4:40で本編終了。残り20秒は操作や間の予備。質疑用ページへはそのまま進めない。

根拠：E1・E2・E4と[S1 JPCERT/CC](https://www.jpcert.or.jp/at/2026/at260034.html)、[S6 Node.jsリリース](https://nodejs.org/en/blog/release/v24.22.1)をつないだ考察。以降は質疑用の参考資料です。
-->

---
layout: default
---

<div class="eyebrow">参考 / 本編ここまで</div>

# さらに、たどる。

<div class="reference-links">
  <a href="https://www.jpcert.or.jp/at/2026/at260034.html" target="_blank" rel="noopener noreferrer">JPCERT/CC <span>影響と対応 ↗</span></a>
  <a href="https://github.com/google/brotli/releases/tag/v1.2.1" target="_blank" rel="noopener noreferrer">Brotli v1.2.1 <span>上流の修正 ↗</span></a>
  <a href="https://nodejs.org/en/blog/release/v24.22.1" target="_blank" rel="noopener noreferrer">Node.js v24.22.1 <span>修正の取り込み ↗</span></a>
</div>

<div class="footnote">詳細な出典は各ページの発表者ノート / 元記事はこの資料のREADMEから</div>

<!--
**質疑用・5分には含めない**

表示した3つは、注意喚起、上流、利用製品という異なる層の情報です。リンクはいずれも一次資料です。

- [S1 JPCERT/CCの注意喚起](https://www.jpcert.or.jp/at/2026/at260034.html)
- [S2 Brotli v1.2.1リリース](https://github.com/google/brotli/releases/tag/v1.2.1)
- [S3 Brotli公式リポジトリ](https://github.com/google/brotli)
- [S4 修正コミット](https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b)
- [S5 Node.js脆弱性説明](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases#nodejs-brotli-decoder-out-of-bounds-write-permits-remote-code-execution-cve-2026-111497---high)
- [S6 Node.js v24.22.1リリース](https://nodejs.org/en/blog/release/v24.22.1)

**各社対応の出典（2026-10-28確認・質疑用）**

- [S14 Vercel / 暫定的なHTTPクライアント保護](https://vercel.com/kb/bulletin/node-js-security-advisory#vercel-managed-runtime-protection)：展開前に拒否、既存プロジェクトは再デプロイ。
- [S15 Azure App Service Linux](https://azure.github.io/AppService/2026/10/22/node-python-emergency-release-app-service-linux.html)・[S16 Windows](https://azure.github.io/AppService/2026/10/22/node-emergency-release-app-service-windows.html)：Node.js 22.23.4 / 24.22.1。対象の組み込みランタイムの配布完了を確認。持ち込みランタイムは別途更新。
- [S17 Azure Functions](https://azure.github.io/AppService/2026/10/23/time-zone-runtime-certificate-updates-azure-functions.html)：10/26追記で対象プランの配布完了。カスタムイメージや別件の.NET更新まで含む報告ではない。
- [S18 New Relic NR26-11](https://docs.newrelic.com/docs/security/new-relic-security/security-bulletins/security-bulletin-nr26-11/)：Public locationsの対象モニターは自動更新。稼働中のNode 16 scripted API monitorは例外。Private locationsはランタイムイメージ更新とコンテナ再起動が必要。
- [S19 Mend.io 26.9.3.3](https://docs.mend.io/integrations/latest/mend-for-github-com-release-notes)：10/23に内部Node.jsなどの更新と当該CVE修正を記載。
- [S20 AWS / Amazon Linux](https://explore.alas.aws.amazon.com/CVE-2026-111497.html)：AL2023 nodejs24を10/24付でFixed。Lambda全体の完了とは読まない。
- [S21 Cloudflare WAF](https://developers.cloudflare.com/changelog/post/2026-10-25-emergency-waf-release/)：10/25の関連ルール追加。既定のLogは記録のみで、自動遮断やランタイム修正とは別。

これは各社の公開告知の比較で、各サービス上の実行検証ではない。AWS Lambda・Netlify・Render・Railwayは今回、同程度の適用範囲・完了状況を示す公式告知を確認できなかった。「未対応」とは判定しない。

外向き通信も、攻撃者の管理するURLへ到達する機能なら、既存の接続先の侵害や通信経路のハイジャックが必須とは限らない。S18の外部応答の到達条件からの考察。通信先が固定された構成と分けて説明する。

元記事：`articles/brotli-cve-2026-111497.md`。2026-10-29の対応体験追記版の下書きに基づき更新。対応体験のE4とS22〜S27・S30は9・10ページのノートに記載。公開サイトのURLはまだありません。発表者ノートのS番号とE番号は記事・調査ノートと共通です。
-->

---
layout: default
---

<div class="eyebrow">参考 / E1の実測</div>

# 3ケースの比較。

<table class="evidence-table">
  <thead><tr><th>受信API</th><th>Content-Encoding</th><th>アプリの本文</th></tr></thead>
  <tbody>
    <tr><td>node:http</td><td>br</td><td>103 B</td></tr>
    <tr><td class="blue">fetch</td><td>br</td><td class="blue">4,280 B</td></tr>
    <tr><td>fetch</td><td>なし</td><td>103 B</td></tr>
  </tbody>
</table>

<div class="footnote">2026-10-27 · Node.js v24.22.1 / HTTP/1.1 / 送信した本文はすべて103 B</div>

<!--
**質疑用・5分には含めない**

正常系の実測はこの3ケースです。すべての要求にAccept-Encoding: brを明示。サーバー側でも受信したヘッダーと送ったバイト数を確認しています。node:httpとヘッダーなしのfetchは圧縮済みのバイト列に一致。br付きfetchは元の本文に一致しました。

再現：プロジェクトルートで `node experiments/brotli-http/run.mjs`。macOS 15.8.1 / arm64、Brotli表示1.2.0、Undici 7.30.1。ローカルのGET・200応答に限る観測です。性能比較、HTTPS、HTTP/2、ブラウザーfetch、CVEの発火は検証していません。

根拠：E1 `notes/brotli-http-auto-decode-2026-10-27.md`、<a href="/evidence/result-2026-10-27.txt" target="_blank" rel="noopener noreferrer">生ログ</a>。
-->

---
layout: default
---

<div class="eyebrow">参考 / 表示と修正の取り込み</div>

# 表示だけでは、<span class="pink">決められない</span>。

<div class="version-example"><div class="label">Brotli の表示</div><div class="giant mono">1.2.0</div></div>

<div class="large-caption">Node.js v24.22.1：修正取り込みの記録あり</div>

<div class="footnote">製品のリリース情報で確認 · S6</div>

<!--
**質疑用・5分には含めない**

手元ではBrotliは1.2.0と表示されます。でも、今回のNode.jsの公式リリースには修正の取り込みが記録されています。表示だけでなく、製品側の履歴まで確認します。

補足：上流コミットを個別に取り込むcherry-pickです。E1は修正取り込みが記録された版による正常系の観測であり、脆弱性やパッチの有効性を実行検証した結果ではありません。手元のバイナリの真正性まで検証したわけでもありません。

補足：Vercelの暫定保護とは別の例です。こちらはNode.js本体への修正取り込み、Vercelはデコーダーへ届く前の経路の制限です。

出典：[S6 Node.js v24.22.1](https://nodejs.org/en/blog/release/v24.22.1)、E1・E2の表示記録。
-->

