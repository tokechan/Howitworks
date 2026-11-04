# Hono版：段階0・1の確認記録

実施日：2026-10-31。対象：ローカルの `/Users/svc-tokeshi/dev/Howitworks`。

## 段階0：比較元を記録

| 対象 | 確認した状態 |
| --- | --- |
| Node.js / npm | v24.22.1 / 11.19.1、Mac上で実行 |
| 既存Astro / Pagefind | インストール済みは7.4.1 / 1.5.2。既存lockfileは変更しない |
| 完成版LT | Slidev CLI 53.0.0。原稿は本編7枚＋参考1枚。除外済み検証スライドは戻さない |
| 既存Astroの成果物 | `site/dist/index.html` とBrotli記事の生成物が存在 |
| 原稿 | `articles/brotli-cve-2026-111497.md` はdraft。移動・複製・更新日変更なし |
| Git | このディレクトリに `.git` はない。初期化、commit、pushは行わない |
| 依存導入 | `web/` 内で独立。既存のnpm `min-release-age=7` を維持し、採用版をlockfileへ固定 |

比較操作の入口は、Astro版が `npm --prefix site run dev`（4321）、シミュレーター単体が `node simulators/brotli/serve.mjs`（4177）、完成版LTが `talks/brotli/` の既存起動手順（3030）。この作業では既存サーバーを停止・置換していない。

[stage-0-source-hashes.json](stage-0-source-hashes.json) に、記事・ノート・LT・シミュレーター・実験・図・Astro・テンプレートの141ファイルのSHA-256を記録した。`node_modules`、通常のビルド生成物、作業用バックアップは比較対象外。シミュレーターの配信原本である `simulators/brotli/dist/` の4ファイルは対象に含めた。

これは原本の保護と状態の記録であり、既存Astro・LT全機能の再受け入れ試験ではない。原稿に残る発表前のLT紹介や、旧README・台本の表記も、この段階では更新していない。

## 段階1：作成したもの

`web/` に独立したパッケージ、Honoの静的生成、ViteのCSSビルドとmanifest接続、Markdown読込・検証・変換、ローカル配信サーバーを追加した。採用版はHono 4.13.13、Vite 8.3.5、Marked 18.1.1、YAML 2.9.1、Zod 4.6.7、TypeScript 7.0.2、Node型定義24.19.2。

初回検証でMarkedの表の描画コンテキストに不具合を発見し、修正した。あわせて、Honoが500を返した場合にSSG全体を成功扱いしない応答確認を追加した。

## 自動確認

| 条件 | 結果 |
| --- | --- |
| 通常ビルド、base `/` | 2ページ生成。下書き記事・参照資料・画像・シミュレーターの出力なし。13箇所のローカル参照を確認 |
| `INCLUDE_DRAFTS=1`、base `/` | 13ページ生成。134箇所のローカルリンク・画像・CSS・アンカーを確認 |
| 下書きプレビュー、base `/Howitworks/` | 13ページ生成。134箇所を確認。URLとCSSにbaseが付く |
| 型検査・テスト | `tsc --noEmit` と6件のテストが成功。base、メタデータ、不正URL、下書き除外、HTML、ノートのアンカーを確認 |
| 原本 | 141ファイルのハッシュが開始時と一致 |
| 記事のJavaScript依存 | 出力HTMLとブラウザーDOMの両方でscript要素0。本文・出典を初期HTMLに含む |

実行コマンドは [webのREADME](../README.md#ビルドと確認) に記載。通常ビルドの後に下書き版を再生成し、最終的な `web/dist/` はローカル閲覧用の下書き版に戻した。

起動した4331・4332へのHTTP確認では、記事とCSSの200、存在しないページの404、末尾スラッシュ補正の308、HEAD本文なし、POSTの405、不正URLの400、出力外へのパスの403を確認した。サブパス版のサーバーは `/Howitworks/` 外を404にする。

## ブラウザー確認

- IABで記事一覧から記事へ移動し、本文・表・コード・目次を確認。
- 幅1280pxと390pxで本文が横にはみ出さないことを確認。390pxでは比較表とコードの枠内だけを横スクロールできる。
- 目次から該当見出しへ移動できる。長文を移動する操作を安定させるため、ページ内移動は即時にした。
- 記事内画像が読み込まれ、調査ノートの `#response-record-2026-10-29` に移動できる。
- `/Howitworks/articles/brotli-cve-2026-111497/` への直接アクセスと再読み込みで、本文・CSSを表示できる。
- 記事ページでコンソールのwarn/errorは観測されなかった。

記録画像：[デスクトップ](screenshots/article-desktop.jpg)・[スマートフォン幅](screenshots/article-mobile.jpg)。ブラウザー設定そのもののJavaScript無効化は行っていない。JSなしの本文表示は、配信HTMLとscript要素0の確認を根拠とする。

## 未実施・残る範囲

Reactの島、hydrate、Compiler、Solid、Vue、Pagefind、Mermaid描画、コードの色分け、教材紹介ページ、完成版Slidevの新サイトへの統合は未実装。シミュレーター全3モードやLTの操作・ノート同期の再試験も、この作業には含めない。

既存 `site/` の削除・改名、記事公開状態の変更、Cloudflareリソース作成、CI設定変更、公開・deployは行っていない。
