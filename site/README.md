# Howitworks ローカルブログ

Astroで既存MarkdownをHTMLへ変換し、Pagefindで日本語の全文検索を提供します。シミュレーターとSlidevの静的ビルドも同じサイトにまとめます。GitHub Pagesの設定・公開は未実施です。

## 起動

プロジェクトルートで、初回のみ依存パッケージを復元します。

```sh
npm --prefix site ci
npm --prefix talks/brotli ci
```

次で、下書きを含むサイト・スライド・検索データをビルドし、ローカルサーバーを起動します。

```sh
npm --prefix site run dev
```

表示先は <http://127.0.0.1:4321/>。停止はターミナルで `Ctrl+C`。

`dev` は検索まで確認するための「ビルド後プレビュー」です。変更の自動反映・HMRは行いません。原稿や画面を編集したら、プロセスを停止して同じコマンドを再実行するか、別ターミナルから `INCLUDE_DRAFTS=1 npm --prefix site run build` を実行してブラウザーを再読み込みします。元のSlidev開発サーバー（3030）や単独シミュレーター（4177）の起動は不要です。

ビルド済みの内容だけを再起動する場合：

```sh
npm --prefix site run preview
```

## ページ

| URL | 内容 |
| --- | --- |
| `/` | 検索と最近の記事 |
| `/articles/` | 記事一覧 |
| `/articles/brotli-cve-2026-111497/` | 出典・目次付きのBrotli記事 |
| `/search/` | 日本語・英語・別名検索、種類・テーマの絞り込み |
| `/topics/` | テーマ一覧とタグ別の記事 |
| `/labs/brotli/` | シミュレーターと記事へ戻るリンク |
| `/talks/brotli/` | LT紹介、スライドと発表者ノートへの入口 |
| `/decks/brotli/#/1` | Slidev本体。ハッシュルーティングで直接再読み込み可能 |
| `/evidence/<id>/` | 記事で参照する検証記録・ガイド |
| `/about/` | プロジェクトの方針 |

## 原稿の管理

- 記事は引き続き `../articles/*.md` が原本です。Content Collectionsでメタデータを検証します。
- `../templates/article.md` をコピーして、frontmatterのタイトル・概要・問い・日付・タグ・別名を埋めます。日付は引用符付き `YYYY-MM-DD`。
- 本文のH1は原稿で残して構いません。サイトではレイアウト側が1つだけ表示します。
- `status: draft` は通常ビルドから除外。`npm run dev` では `INCLUDE_DRAFTS=1` を設定して表示し、画面に「下書き」と表示します。公開状態への変更は原稿の編集で明示的に行います。
- 更新日と情報確認日は別項目です。画面変更だけでは、記事の情報確認日を更新しません。
- `tags` は `src/lib/content.ts` のテーマ一覧と対応させます。別名は記事末尾にも表示して全文検索へ含めます。
- 現在のシミュレーター・LT紹介ページはBrotli用です。新しいテーマの資料を追加するときは、紹介ページとビルド対象を合わせて追加します。

## 取り込む範囲とリンク

`scripts/config.mjs` に、サイトへ取り込む検証記録・ガイド・ソースを列挙しています。ノート全体を自動公開する設定ではありません。現在のBrotli記事から参照する6文書を選んでHTML化し、ソースやログはテキストとして配信しています。

Markdownの相対リンクはビルド時にサイト内URLへ変換します。未登録の参照先があるとビルドを止め、リンク切れのまま出力しません。`.generated/` と `dist/` は生成物なので直接編集しません。

資料本体は以下へコピー・ビルドします。

- 既存シミュレーター → `/demos/brotli/`。ブログの `/labs/brotli/` 内に表示。
- 既存Slidev → `/decks/brotli/`。発表者ノートを含めます。
- 実行ログとコード → `/downloads/`。コードは閲覧用の `.txt` として配信。
- フォントはローカル配信。ライセンスは `/licenses/`。

検索対象は記事・検証記録・シミュレーターとLTの紹介文です。スライド内部のノート全文をPagefindが実行・収集する構成ではありません。検索結果は記事、体験用ページ、検証記録・ガイドの順に優先し、同種の結果はPagefindの順位を保ちます。

## ビルドと検証

```sh
INCLUDE_DRAFTS=1 npm --prefix site run build
npm --prefix site run check
```

`check` は生成HTMLの内部リンク・画像・スクリプト・アンカー、記事の主要内容、検索ファイル、資料の存在を確認します。検索の実行と画面表示はブラウザーで別途確認します。確認結果は `verification.md` を参照。

通常の `npm run build` は下書きを除外します。現在のBrotli関連資料も、記事が下書きの間は通常ビルドからまとめて除外します。

GitHub PagesのプロジェクトURLを想定したローカル検証：

```sh
INCLUDE_DRAFTS=1 SITE_BASE=/Howitworks/ npm --prefix site run build
SITE_BASE=/Howitworks/ npm --prefix site run check
SITE_BASE=/Howitworks/ PORT=4322 npm --prefix site run preview
```

こちらは `.generated/base-site/` に出力し、通常の `dist/` と分けます。表示先は <http://127.0.0.1:4322/Howitworks/>。公開先のリポジトリ名・ドメインが決まったら `SITE_BASE` を合わせます。`SITE_BASE=/` を明示した場合も `.generated/base-site/` に出力します。

## GitHub Pagesへの公開準備

[設定と公開までの手順](../docs/github-pages.md) と、未有効の [Workflowテンプレート](../docs/deployment/github-pages.yml.example) を用意しています。GitHub側の設定・実行・公開は未実施です。

- 公開用は `INCLUDE_DRAFTS=0`。Brotli記事をレビューして `status: published` にしたときに関連資料も含まれます。
- `SITE_ORIGIN` にHTTPSのドメイン部分、`SITE_BASE` に `/Howitworks/` などのパスを指定します。WorkflowではPagesの設定から取得します。
- `SITE_BASE=/Howitworks/ npm --prefix site run check -- --release` で、直前に生成したサイトの公開条件も確認します。下書きプレビュー、Brotli記事の欠落、公開ドメインの未指定を拒否します。原稿の意味・出典の正確さは別途レビューします。
- 手動実行の `publish=false` はビルド確認まで、`publish=true` で公開チェックとdeployを行います。テンプレートは `.github/workflows/` に移すまで動きません。
- 新しい環境ではGit管理外の `talks/brotli/screenshots/` がなくてもビルド可能です。参照する `simulators/brotli/screenshots/` の画像は必要です。

## 参照した公式資料

- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [AstroのMarkdown設定](https://docs.astro.build/en/reference/configuration-reference/#markdown)
- [Pagefindの日本語対応](https://pagefind.app/docs/multilingual/)
- [Pagefindの索引対象設定](https://pagefind.app/docs/indexing/)
- [Slidevの静的配信](https://sli.dev/guide/hosting)
- [AstroとGitHub Pages](https://docs.astro.build/en/guides/deploy/github/)
