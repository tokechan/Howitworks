# Brotliの受信パイプラインとエラー処理：記事用の動く図

- 作成・資料確認日：2026-10-27
- テーマID：brotli-cve-2026-111497
- [ブラウザーで開く図](index.html)
- [編集用の図のソース](figure.html)
- [元の調査ノート](../../notes/brotli-cve-2026-111497.md)
- [正常なHTTP自動展開の実験](../../notes/brotli-http-auto-decode-2026-10-27.md)

## 操作と内容

「見る場面」で正常な展開・不正入力を受け取った修正前・修正後を切り替え、「流れを再生」を押す。再生は一時停止・再開でき、1回で停止する。端末で動きを減らす設定が有効な場合は、再生ボタンで最終状態へ切り替わる。

正常な展開の103バイトと4,280バイトは、Node.js v24.22.1 / Undici 7.30.1を使ったHTTP/1.1実験の本文サイズ。ユーザーの追試でも同じ結果が得られた。点の数、データの区切り方、時間は測定値ではない。

修正前・修正後は、公式説明と修正差分から作った模式図。攻撃データを生成・実行していない。内部バッファの8つの枠と範囲外の枠は、容量と境界外書き込みを表す概念図であり、実際の入力順、バイト値、メモリ配置、悪用手順を再現するものではない。

## 記事への組み込み

`index.html` は単独で開ける図。サイトを作る際には、`assets/brotli-pipeline/` を静的ファイルとして配信し、記事からリンクするかiframeで埋め込める。Markdownがそのまま表示される場所では、リンクとして案内する。

以下の `src` は記事ページから見た相対URLの例。GitHub Pagesのプロジェクト配信ではリポジトリ名によるベースパスが付く場合があるため、実際の公開URLに合わせる。図は幅590px未満で縦に並ぶので、埋め込み側でも高さを確保する。

```html
<iframe
  src="../assets/brotli-pipeline/index.html"
  title="Brotliの受信パイプラインとエラー処理"
  width="100%"
  height="850"
  loading="lazy"
  style="border: 0"
></iframe>
```

図の下には、次のキャプションと出典を添える。

> 正常な展開は手元のHTTP/1.1実験に基づく。修正前・修正後は公式資料に基づく模式図。8バイトは入力の一時保持用バッファで、展開後の本文の容量ではない。脆弱性の発火や任意コード実行は検証していない。

サイト構成、GitHub Pagesの設定、Slidevへの組み込み、公開はまだ実施していない。

## 図の根拠

| 図で表したこと | 出典 |
| --- | --- |
| fetchがbr応答にデコーダーを選んで接続する | [Node.js v24.22.1同梱Undiciのfetch実装](https://github.com/nodejs/node/blob/v24.22.1/deps/undici/src/lib/web/fetch/index.js#L2256)、[実験記録](../../notes/brotli-http-auto-decode-2026-10-27.md) |
| 不正なブロック切り替えを入力待ちと誤認し、8バイトの内部バッファを越えて書き込み得た | [Node.js公式の脆弱性説明](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases#nodejs-brotli-decoder-out-of-bounds-write-permits-remote-code-execution-cve-2026-111497---high) |
| 形式エラーと入力不足を分け、呼び出し側にも状態を伝える修正 | [Google Brotliの修正コミット](https://github.com/google/brotli/commit/0ed4268a4401abcb4472096340477cf4af7d1a2b) |
| CVEと製品への影響、上流の修正リリース | [JPCERT/CC](https://www.jpcert.or.jp/at/2026/at260034.html)、[Brotli v1.2.1](https://github.com/google/brotli/releases/tag/v1.2.1)、[公式リポジトリ](https://github.com/google/brotli) |

## 編集と確認

図の内容は `figure.html` に保存している。`index.html` はその内容を埋め込んだ単独表示用のファイルで、外側にテーマ・表示サイズの調整機能を含む。内容を変更するときは、図のソースと単独表示版を同期する。

JavaScriptの構文を確認し、DOMの代用を使ったローカル実行で、幅320px・736pxの描画処理、3場面の切り替え、再生・一時停止・再開・終了、動きを減らす設定での最終状態への切り替えが通ることを確認した。これはブラウザーによる表示確認とは別のチェック。

ブラウザー検査でローカルファイルのURLを開く操作がブラウザーツールのポリシーに拒否されたため、実画面でのレイアウト・色・操作の確認は未完了。公開前には、幅320pxと736px、明暗テーマ、各場面の再生・一時停止・再開、動きを減らす設定で実画面を確認する。
