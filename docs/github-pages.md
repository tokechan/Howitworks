# GitHub Pages 公開準備と手順

確認日：2026-10-28。現在はローカル準備のみ。GitHubのリポジトリ作成、設定変更、ソースのpush、Workflow実行、サイト公開は行っていません。

## 1. 現在地と、公開前に決めること

このフォルダにはまだ `.git` がなく、接続するGitHubリポジトリも未設定です。Astro・Pagefind・Slidev・シミュレーターを1つの静的サイトにまとめる仕組みはあります。

| 項目 | 準備案・現在の状態 |
| --- | --- |
| 所有者 | 個人のGitHubアカウント。アカウント名は未確定 |
| リポジトリ | `Howitworks` を推奨。既存リポジトリの有無を確認してから作成 |
| 公開URL | 上記なら `https://<owner>.github.io/Howitworks/` |
| ソースの公開範囲 | 原則公開の方針に合わせ、publicを候補とする。実際の作成前に確定 |
| デフォルトブランチ | 新規なら `main`。Workflowはリポジトリの実際のデフォルトブランチだけで動く |
| 独自ドメイン | 初回は設定しない案。GitHub標準ドメインで導線を確認 |
| 公開方法 | GitHub Actionsによる手動公開。pushを起点とする自動公開は設定しない |
| Brotli記事 | `status: draft` のまま。公開候補として内容を確認した後に `published` に変更 |

ユーザーサイトの `https://<owner>.github.io/` に置くなら、リポジトリ名を `<owner>.github.io`、`SITE_BASE` を `/` にします。プロジェクトサイトの場合はリポジトリ名の大文字・小文字もURLに合わせます。[AstroのGitHub Pages設定](https://docs.astro.build/en/guides/deploy/github/)

## 2. 配信するものと、ビルドの流れ

```text
Markdownの記事・検証記録 ── Astro ──────┐
シミュレーター・図・検証ログ ─ コピー ────┤
Slidev原稿・発表者ノート ── Slidev build ─┤
                                      ↓
                      まとめたHTMLをPagefindで索引化
                                      ↓
                       内部リンク・公開内容を確認
                                      ↓
                         1つのPages artifact
                                      ↓ publish=true のときだけ
                             GitHub Pages
```

Node.jsはビルドに使います。公開先ではHTML・CSS・JavaScript・検索索引を配信し、Node.jsサーバーや検索APIは起動しません。Slidevは `#/1` 形式のハッシュルーティングを使い、スライド途中のURLも静的配信で開ける構成です。

公開ビルドへ取り込む文書・ダウンロードは [config.mjs](../site/scripts/config.mjs) の明示リストで管理します。Brotli記事が公開状態になったときの対象：

- 記事、6つの検証記録・調査ノート・操作ガイド、検索索引。
- シミュレーター、パイプライン図、参照している検証画像。
- LTスライド本体と発表者ノート。ノートは閲覧者も読めます。
- 実験コード・実行ログ、スライド原稿、練習台本などの閲覧用テキスト。
- 必要なフォントとライセンス。

`status: draft` の記事とBrotli関連資料は通常ビルドから除外します。`INCLUDE_DRAFTS=1` はローカル確認用です。publicリポジトリに保存したMarkdown自体は、サイトの下書き除外とは別に公開されます。記事・台本・ログ・スクリーンショットも含め、配信する範囲を公開候補のレビューで確認します。

生成先は、`SITE_BASE` 未指定なら `site/dist/`、指定した場合は `/` でも **`site/.generated/base-site/`** です。Workflowがアップロードするのは後者だけです。リポジトリ全体や `node_modules/` を配信する設定にはしません。

## 3. 設定ファイル

[Workflowテンプレート](deployment/github-pages.yml.example) は **`.github/workflows/` の外** にあります。このままではGitHub Actionsに認識されません。

| 設定 | 内容 |
| --- | --- |
| 起動 | `workflow_dispatch` のみ。`publish` の初期値は `false` |
| `publish=false` | ビルド・内部リンク確認・artifact保存まで。deployジョブはスキップ |
| `publish=true` | 上記に加え、公開用チェック後にdeployを実行 |
| ビルド環境 | GitHub-hosted Ubuntu / Node.js 26.13.1。ローカルで確認した版を固定 |
| 依存復元 | `site/` と `talks/brotli/` の両方で `npm ci`。両方のlockfileを管理する |
| URL | `configure-pages` の `origin` と `base_path` を使う。ownerをソースに埋め込まない |
| 下書き | `INCLUDE_DRAFTS=0` 固定。公開チェックで下書きプレビューやBrotli記事の欠落を拒否 |
| Pages有効化 | `enablement: false`。WorkflowがPages設定を自動で有効化しない |
| 権限 | ビルドは `contents: read` / `pages: read`。deployだけ `pages: write` / `id-token: write` |
| 認証 | GitHubが提供する `GITHUB_TOKEN` とOIDC。今回の構成では個人PATを登録しない |
| 配信単位 | ブログ・デモ・Slidev・検索を1つのartifactにまとめる。保存期間は7日 |
| 競合 | `github-pages` グループで同時公開を避ける。進行中の公開はキャンセルしない |

Actionsは公式リポジトリのコミットSHAに固定しています。更新するときは参照する版とlockfileをレビューし、ビルドを再確認します。Node.jsの版も固定を永久維持する意図ではなく、更新時に明示的に変更・検証するためです。

GitHub Pagesの公式方式に合わせ、ビルドとdeployを依存関係で結び、deployに `github-pages` environmentを指定しています。[GitHubのカスタムWorkflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 4. 公開前にローカルで確認する

以下はリポジトリのルートで実行します。GitHubへは送信しません。依存復元がまだなら、まず `npm --prefix site ci` と `npm --prefix talks/brotli ci` を実行します。

### 下書きのまま、URL構成と画面を確認

```sh
INCLUDE_DRAFTS=1 SITE_BASE=/Howitworks/ npm --prefix site run build
SITE_BASE=/Howitworks/ npm --prefix site run check
SITE_BASE=/Howitworks/ PORT=4322 npm --prefix site run preview
```

[ローカル確認URL](http://127.0.0.1:4322/Howitworks/) を開きます。`SITE_BASE` はリンク・スライド・検索結果に付けるパスです。サーバー停止は `Ctrl+C`。4321番の通常プレビューとは出力先を分けています。

### 公開候補の確認後に、本番と同じ条件でビルド

まず記事の内容と出典をレビューし、[Brotli記事](../articles/brotli-cve-2026-111497.md) のfrontmatterを `status: published` に変更します。今回の準備では変更していません。情報確認日は、実際に確認した範囲に合わせます。

以下の `YOUR-ACCOUNT` と `/Howitworks/` を決定した公開先に置き換えます。

```sh
INCLUDE_DRAFTS=0 SITE_ORIGIN=https://YOUR-ACCOUNT.github.io SITE_BASE=/Howitworks/ npm --prefix site run build
SITE_BASE=/Howitworks/ npm --prefix site run check -- --release
SITE_BASE=/Howitworks/ PORT=4322 npm --prefix site run preview
```

`SITE_ORIGIN` はHTTPSのドメイン部分です。リポジトリ名を含めず、パスは `SITE_BASE` に分けます。`--release` はBrotli記事・関連資料が含まれ、下書きプレビューでなく、公開ドメインが指定されたビルドかを確認します。現在の下書き状態で失敗するのは意図した動作です。

画面で確認する項目：

1. トップ → 記事 → シミュレーター → 記事 → LT資料を往復できる。
2. シミュレーターでステップを進められ、正常な入力待ち・修正前後を切り替えられる。
3. `入力待ち`、`fetch`、`ブロートリ` で検索できる。種類・テーマを絞れて、結果のURLに正しいbaseが付く。
4. Slidevの途中、たとえば `/Howitworks/decks/brotli/#/11` を直接開いて再読み込みできる。発表者ノートと記事へ戻るリンクも確認。
5. 記事の図、検証画像、ログ、出典が開く。スマートフォン幅で記事が読める。

## 5. GitHub側の準備（公開を進めると決めた後）

この節は手順の記録であり、未実施です。所有者・リポジトリ名・ソースの公開範囲を決め、GitHubへの反映を了承した後に進めます。

1. 個人アカウントに対象リポジトリを用意する。新規なら空のリポジトリとして作成する。GitHub FreeではpublicリポジトリでPagesを利用できます。privateソースの場合はプラン条件を確認します。[提供条件と公開元設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
2. ローカルでGitを初期化し、送るファイルを確認する。ソース・設定・2つのlockfile・参照画像が対象。`site/dist/`、`site/.generated/`、`talks/brotli/dist/`、`node_modules/`、ローカルの表示確認画像は各 `.gitignore` で除外する。**`simulators/brotli/dist/` は手書きの配信ソースなので対象に含める**。`simulators/brotli/screenshots/` の参照画像も必要。ルートに一律の `dist/` や `screenshots/` 除外を追加しない。
3. Workflowを有効な場所へコピーし、他のソースと一緒にデフォルトブランチへcommit・pushする。remoteのURLと送信対象を確認してから行う。

```sh
# 有効化を決めたときだけ実行する。今回は未実施。
mkdir -p .github/workflows
cp docs/deployment/github-pages.yml.example .github/workflows/pages.yml
```

4. リポジトリの **Settings → Actions → General** で、使用する公式Actionsが許可されていることを確認する。デフォルトトークン権限を広く変更せず、Workflowのジョブ単位の権限を使う。
5. **Settings → Pages → Build and deployment → Source → GitHub Actions** を選ぶ。自動提案される別Workflowの追加は不要。`gh-pages` ブランチや `/docs` 配信は使わない。[公開元の公式手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
6. **Settings → Environments → github-pages** を確認し、deployment branchesをデフォルトブランチに限定する。既に制限がある場合はその条件とWorkflowを合わせる。
7. Custom domainは初回は空のままにする。標準の `github.io` URLでHTTPSになっていることを公開時に確認する。

Workflowファイルはデフォルトブランチに置く必要があります。テンプレートの条件もデフォルトブランチ限定なので、Run workflowで別ブランチを選ぶとジョブがスキップされます。[手動実行の公式手順](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

## 6. ビルド確認と、実際の公開を分ける

### 先に、公開しない実行

1. Actions → **GitHub Pages (manual)** → **Run workflow**。
2. デフォルトブランチを選び、**publishをオフのまま** 実行する。
3. buildが成功し、deployがスキップされたことを確認する。
4. `github-pages` artifactをダウンロードして内容を確認する。ビルド対象のcommit SHAとrun URLを記録する。

この実行もGitHub側の操作なので、今回まだ実行していません。`configure-pages` が設定を読むため、ビルド確認だけでもPagesのSource設定が必要です。下書きのままなら記事のないサイトをビルドするため、**build成功だけではBrotli公開準備完了とはしません**。

### 公開すると決めた時点で実行

1. 公開先URL、公開する記事・関連資料、デフォルトブランチのcommit SHAを確認する。
2. 同じWorkflowを **publishをオンにして** 実行する。
3. build・公開チェック・deployの成功を確認する。公開チェックで失敗したらdeployは実行されない。
4. deployの出力URLを開き、節4の導線・検索・スライド直接URLを公開サイトでも確認する。
5. 実際の公開URL、commit SHA、run URL、確認日を記録する。

publish=trueの実行は、その実行時点のブランチから再ビルドします。先のartifactを昇格する方式ではありません。確認用run後にソースを変更した場合は、その変更を含む版を再確認してから公開します。

## 7. 公開後の更新・切り戻し

- 記事を更新 → 必要な検証 → ローカル確認 → commit/push → 手動のビルド確認 → 手動公開、の順で進めます。pushだけではサイトは更新されません。
- 問題が出たら、最後に正常だったcommitを確認し、問題の変更をrevertするcommitを作って同じ公開手順で配信し直します。履歴の強制書き換えは必要ありません。
- URL、base、記事の公開状態を変えた場合は、検索結果とデモ・スライドのリンクも再確認します。
- GitHub Pagesは公開先です。この記事の脆弱性情報や各社の対応状況が最新かどうかは、サイトのビルド成功とは別に出典を確認します。

## 8. 今回の準備で確認した範囲

ローカル検証結果は [サイトの確認記録](../site/verification.md) に記録します。GitHub-hosted Linuxでの `npm ci`・Workflow実行・Pages上の表示は、公開先が決まってから確認します。ローカルの成功をGitHub Actionsや公開環境での成功とは扱いません。

## 参照した公式Action

- [checkout v7](https://github.com/actions/checkout/tree/3d3c42e5aac5ba805825da76410c181273ba90b1)
- [setup-node v7](https://github.com/actions/setup-node/tree/949feb2413d6458794dcd2491c4babbbce0c15c1)
- [configure-pages v6.0.0](https://github.com/actions/configure-pages/tree/v6.0.0)
- [upload-pages-artifact v5.0.0](https://github.com/actions/upload-pages-artifact/tree/v5.0.0)
- [deploy-pages v5.0.1](https://github.com/actions/deploy-pages/tree/v5.0.1)
