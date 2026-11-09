# 照合基準 2026-11-09

2026-10-31 の原本ハッシュ台帳（`stage-0-source-hashes.json`、141件）は、そのまま残しています。あの記録は、Hono の実験を始める時点の原稿・実装・図・手元のスクリーンショットを固定したものです。後からの編集で書き換えません。

`web` の `check` は、次の `source-baseline-2026-11-09.json` を現在の照合基準にします。

- `historical.sha256` は 2026-10-31 の台帳ファイルそのものの SHA-256 です。台帳を1バイトでも変えると検査は失敗します。
- `git ls-files` に含まれる台帳上のファイルは、この基準の SHA-256 と一致しなければなりません。
- 生成コピー6件（`talks/brotli/public/simulator/` の4ファイルと `public/evidence/` の2ファイル）は `.gitignore` の対象です。中身の正本は git にある `simulators/brotli/dist/`、`simulators/brotli/screenshots/patch-flow.jpg`、`experiments/brotli-http/result-2026-10-27.txt` で、いずれも 2026-10-31 のハッシュのままです。検査は正本のハッシュを確認します。コピーが手元にあるときは、そのバイト列も同じハッシュであることを確認します。コピーが無い clone では、正本だけで判定します。
- ライセンス本文3件は、依存パッケージの `node_modules` から `prepare-assets` がコピーしていました。clone には `node_modules` が無いので、`talks/brotli/.gitignore` の `public/licenses/` 除外を外し、2026-10-31 と同じバイト列を追跡対象にしました。ハッシュは台帳と一致しており、差分一覧には入りません。
- 残る56件は `talks/brotli/screenshots/` 51件と `site/screenshots/` 5件です。どちらも `.gitignore` にあり、この clone には届きません。ハッシュは記録せず、存在しない画像の値も作りません。著作者の手元にあるファイルが 2026-10-31 の台帳と一致するかどうかは、ここからは確認できません。後で git に加えた場合は追跡対象になるので、この基準を更新するまで検査は失敗します。
- `changedSince20261031` は、追跡対象のうち 2026-10-31 のハッシュと今のハッシュが違うファイルだけです。検査は、実際に違う集合とこの一覧が一致することを要求します。理由のない差分や、一覧に無い差分では通りません。

2026-10-31 から意図して変えた追跡対象は18件です。

| ファイル | 理由 |
| --- | --- |
| `talks/brotli/README.md` | Node.js 26.13.0 の起動手順 |
| `talks/brotli/package.json` | Node.js 26.13.0 の `engines` |
| `talks/brotli/package-lock.json` | Node.js 26.13.0 の `engines` |
| `talks/brotli/.gitignore` | 台帳にあるライセンス本文を clone でも照合できるよう、`public/licenses/` を追跡対象にした |
| `site/package.json` | Node.js 26.13.0 の `engines` と、フォント再生成スクリプト |
| `site/package-lock.json` | Node.js 26.13.0 の `engines` |
| `site/README.md` | 紙面の書体説明と、公式 LINE Seed からの再サブセット |
| `site/public/favicon.svg` | 紙面の配色 |
| `site/scripts/config.mjs` | 下書きビルドが参照するローカル資料の登録 |
| `site/scripts/verify.mjs` | 紙面の生成物検査と、LINE Seed の収録検査 |
| `site/src/styles/site.css` | 紙面のスタイルと、再生成した LINE Seed の説明 |
| `site/src/layouts/Base.astro` | 紙面の共通レイアウト |
| `site/src/components/ArticleCard.astro` | 紙面の記事カード |
| `site/src/components/ResourceLinks.astro` | 紙面の関連リンク |
| `site/src/pages/index.astro` | 紙面のトップ |
| `site/src/pages/articles/index.astro` | 紙面の記事一覧 |
| `site/src/pages/articles/[id].astro` | 紙面の記事ページ |
| `site/src/pages/topics/[id].astro` | 紙面のテーマページ |

再生成したフォント、その cmap、OFL、この文書、`web/scripts/verify.ts` は 2026-10-31 の台帳の対象外です。フォントの収録は `site` の `check` が検査します。
