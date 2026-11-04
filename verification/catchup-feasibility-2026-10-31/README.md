# ブログ＋新着情報収集：実現可能性の検証結果

2026-10-31。結論は **Hono＋Viteの静的ブログに、RSS/Atom収集・D1・Reactの島を組み合わせる構成は実現できる**。主要部分を隔離したローカル環境で動かして確認した。採用判断を要する依存関係があるため、ブログ本体の実装へは進んでいない。

最初に読むもの：

- このファイル：結果と判断事項。
- [設計案・全体図](DESIGN-NOTES.md)：データの流れ、公開先、保存する情報、今後の段階。
- [バージョン表](VERSIONS.md)：最新版と3日待機済み候補の違い。
- [検証の境界](TASK.md)：今回許可された作業と保存範囲。

## できたこと

| 問い | 結果 | 証跡 |
| --- | --- | --- |
| 本当に新着を取得できるか | 公式RSS/Atom 7本をHTTP取得・解析。条件付き取得の304も確認 | `evidence/feeds*.json`, `evidence/parser.json` |
| 本文を掲載せずタイトル・リンクだけ扱えるか | RSS/Atomを共通形へ変換。本文を正規化結果へ含めない | `probes/parser.test.mjs`：6テスト合格 |
| Workers/D1で動くか | 実際のworkerdでHono API、RSS解析、SQL保存が動作 | `evidence/runtime-2026-10-30.json` |
| 再取得で二重登録しないか | 同じIDは1件のまま。タイトル変更は反映し、初回発見日は維持 | 同上 |
| 失敗すると一覧が消えるか | 503、不正XML、容量上限超過でも保存済み行を保持。304は失敗と区別 | 同上 |
| 保存途中に失敗したらどうなるか | D1 batchの後半失敗で前半INSERTもrollback | 同上 |
| 実データをWorkersで処理できるか | Workers RSS 278件、Hono Atom 10件を保存。事前の合成1件を含み計289件 | 同上 |
| Reactの島は動くか | 静的HTML内の指定枠をmountし、クリック更新・一覧取得・取得失敗時の保持をブラウザ確認 | `evidence/browser.json` |
| GitHub Pagesのサブパスへ置けるか | `/`と`/Howitworks/`でReactとPagefindが動作 | 同上、`evidence/islands.json` |
| 検索対象はどうなるか | 静的記事1件がヒット。後から取得した一覧は0件 | 同上 |
| React Compilerは組み合わせられるか | Vite8＋plugin-react6＋Babel8でCounterの変換成功を確認 | `evidence/islands.json`の`compilerEvents` |
| Solid / Vueも実験できるか | 別ページに独立ビルドし、カウンターの0→1をブラウザ確認 | `evidence/browser.json` |
| JSが動かないと記事も読めないか | 検証ページのscriptをCSPでブロックしても静的記事本文は表示 | 同上 |
| 最新候補のNodeでも動くか | 24.22.2 LTS / 26.12.1 Currentの両方で解析・ビルド・workerd/D1試験合格 | `evidence/node-matrix.json` |

ブラウザの取得先は検証用JSON。Workers/D1側とは別の境界試験として確認した。**「実ブラウザ→Cloudflare上のAPI→本番D1」を通した試験や、公開済みサイトの受け入れ確認ではない。**

![静的記事1件・動的一覧0件を確認した検証画面](evidence/search-browser.png)

## 特に判断が必要な発見

### 1. 最新stable・3日待機・既知脆弱性の検出0件は、同じ条件ではない

候補を広く入れた比較用lockfileは369件。すべて公開から72時間経過し、公式npm registryのintegrityと一致した。`npm ci --strict-peer-deps --ignore-scripts`も成功した。

一方、`npm audit`は**high 3件・moderate 2件のパッケージ項目**を検出した。これは5個の独立したCVEという意味ではない。古いMiniflareに含まれるsharp/undiciと、Cloudflare Vite plugin内部の依存に起因する。実際の利用経路での悪用可能性の検証やセキュリティ監査全体を実施したわけではない。監査結果の全項目・範囲・参照先は`evidence/npm-audit.json`に保存した。

そこで **Hono＋fast-xml-parser＋Wranglerだけの収集API案**も、別の新設ディレクトリで依存解決した。こちらのlockfile100件は3日条件とintegrity確認に合格し、同時点のnpm監査は検出0件だった。ローカルランタイム試験も、この案と同じWrangler内部Miniflareで行っている。これはAPI側の代案の結果であり、ブログ・Slidevを含む全プロジェクトの監査0件を意味しない。

| 選択肢 | 得られるもの | 判断すること |
| --- | --- | --- |
| フロントのViteと収集Workerを分ける | Cloudflare Vite pluginを必須にせず、今回の古い内部依存を避けられる | ビルド設定・開発サーバーを分けて持つ |
| Cloudflare Vite pluginを採用する | Workersとフロントの開発をまとめやすい | 修正版の3日待機、依存グラフ再確認、組み合わせの再検証が必要 |
| セキュリティ修正版の待機を例外化する | 修正を早く取り込める可能性 | 例外の根拠とリスクをユーザーが判断。今回は実施していない |

`npm audit fix`、override、forceによる依存変更はしていない。

### 2. 安定版Wranglerの中にもbeta依存がある

Wrangler4.154.0はMiniflare5.20261023.1-betaを内部で使う。直接Miniflareのstableだけを選ぶと4.20260730.0となり、古い依存に戻る結果になった。今回の比較環境では両方のメタデータ・依存を調べ、実行試験にはWranglerの内部版を使った。

「直接採用するライブラリはstable」と「間接依存もすべてprerelease禁止」は別ルール。後者を求める場合、この構成をそのまま採用できない。ユーザー判断が必要。

### 3. 今日の互換日を待機済みランタイムが受け付けなかった

`compatibilityDate: 2026-10-31`で起動すると、今回のworkerdは対応上限が`2026-10-30`として起動に失敗した。失敗ログを残し、**明示的に10/30を選んだ別試験**で機能を確認した。本番設定を変更・確定したわけではない。

互換日はnpmパッケージの版番号とは別の軸。採用時には、待機済みツールの更新を待つか、対応済み互換日を使用して後から進めるかを決める。

### 4. RSSが「タイトルだけを軽く返す」とは限らない

| 公式フィード | 今回のサイズ | 項目数 |
| --- | ---: | ---: |
| [Cloudflare全体](https://developers.cloudflare.com/changelog/rss/index.xml) | 8,778,655 bytes | 1,433 |
| [Cloudflare Workers](https://developers.cloudflare.com/changelog/rss/workers.xml) | 2,940,780 bytes | 278 |
| [Reactブログ](https://react.dev/rss.xml) | 18,181 bytes | 24 |
| [Viteブログ](https://vite.dev/blog.rss) | 242,873 bytes | 12 |
| [Honoリリース](https://github.com/honojs/hono/releases.atom) | 27,485 bytes | 10 |
| [Reactリリース](https://github.com/react/react/releases.atom) | 139,105 bytes | 10 |
| [Viteリリース](https://github.com/vitejs/vite/releases.atom) | 38,468 bytes | 10 |

タイトルだけを保存しても、元のフィードに本文が入っていれば取得・解析時にはその容量を扱う。今回、4MiBという実験上の制限を設け、2.9MBのWorkers RSSを処理し、8.8MBの全体RSSを拒否した。全体RSSを採用するなら、上限・メモリ・解析方式を別途検討する。

Workers RSSの処理＋保存はローカルで約160msだったが、これはMac上のwall time。クラウドのCPU課金・本番の遅延やメモリ使用量を表す数字ではない。Workersのメモリ上限はisolate単位で128MBのため、複数同時取得も考慮する。[公式制限](https://developers.cloudflare.com/workers/platform/limits/)。

GitHubのリリースAtomはブログとは別物で、Viteにはcreate-vite等のリリースも混在していた。購読先・掲載対象を選ぶ必要がある。

### 5. React Compilerには実際にスキップされるコードがあった

単純なCounterはCompilerの`CompileSuccess`を確認できた。一方、今回書いた取得用コンポーネントはtry/catch内のthrowに対する未対応診断で最適化対象から外れた。Reactとしての動作は維持され、ブラウザでも取得・エラー表示を確認できた。

最初の確認方法はbundle内の`react.memo_cache_sentinel`の有無だったが、これはCompilerなしでもReact本体に含まれ、判定として不十分だった。そのため、**対象コンポーネントの変換イベントを確認する検査へ修正**した。初回のログも残してある。

公式のVite向け導入方法を用いた。plugin-react6では旧式のinline Babel設定を使わず、`reactCompilerPreset`と`@rolldown/plugin-babel`を組み合わせた。[React公式](https://react.dev/learn/react-compiler/installation)。

## RSS解析方式の比較

| 方式 | 実測した成立範囲 | 自分で持つ責任 |
| --- | --- | --- |
| fast-xml-parser＋小さな変換処理 | RSS/Atom 7本を解析。Node互換を明示的に無効にしたworkerdでもHono/D1と動作 | RSS/Atomの差、日付、リンク、ID、名前空間、対応外形式の扱い |
| rss-parser | Nodeで7本を解析。Node互換を使ったworkerdで保存済みAtom10件を解析 | バンドル時のNode組み込みモジュール処理、取得量制限、URL・タイトルの検査 |

2026-08-04以降の互換日では、WorkersのNode互換が既定で有効になっている。「フラグを書いていない＝Node互換が無効」ではなかった。一次資料と導入済みコードを照合し、既定・明示有効・明示無効を分けて試験した。rss-parserの今回のNode向けbundleは既定/有効で成功、無効ではNodeモジュール不足で起動しなかった。ブラウザ向けbundleはそのままでは組み込みモジュールを解決できない。[Cloudflareの変更告知](https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/)。

これは全npmパッケージがWorkersで動くという意味ではない。`parseURL`での外部取得や、あらゆるRSS方言を保証する試験でもない。

## Node・依存の確認範囲

既存Node24.22.1を変更せず、公式配布の24.22.2 LTSと26.12.1 Currentを検証フォルダへ展開して実行した。SHA256を公式SHASUMS256と照合。3バージョンで、6つの解析テスト、React/Compiler・Solid・Vueの5ビルド条件、workerd/D1の保存・異常系を確認した。実ブラウザの操作は既存Nodeで生成した検証ページに対して行った。

LTSとCurrentのどちらを選ぶかは未決定。Viteやライブラリの版、Nodeの系列、Nodeの型定義の系列をセットで選ぶ。完成版Slidevと既存Astroの再ビルド・アップグレードは今回行っていない。[バージョン詳細](VERSIONS.md)。

## 費用の見立て

Workers Paidは月額5ドルの基本料金に、月1,000万リクエスト・3,000万CPUミリ秒が含まれる。D1も読み取り250億行・書き込み5,000万行/月、ストレージ5GBが含まれる。超過分は課金される。[公式料金](https://developers.cloudflare.com/workers/platform/pricing/)。

例えば5フィードを1時間ごと・30日なら、収集の起動720回、フィードへの確認3,600回。API閲覧数やCPU使用量は別途加わる。この規模は小さく始めやすいが、ユーザーの契約・他アプリと共有する使用量・実際のCPU/D1メトリクスは未確認。「追加料金なし」とは確定していない。アカウントにはアクセスしていない。

## 採用前にユーザーが決めること

優先順は次の通り。検証のために選んだ条件を、本体の方針として固定していない。

1. **公開構成**：GitHub Pages＋独立した収集APIを続けるか、Cloudflareへまとめるか。一覧の静的スナップショット案もある。
2. **依存方針**：Cloudflare Vite pluginを使うか。間接依存betaを許容するか。セキュリティ修正と3日待機が衝突した場合の扱い。
3. **Nodeの系列**：LTS24かCurrent26か。今回の主要試験は両方合格。
4. **公開一覧の意味**：購読元の新着を自動掲載するか、自分で選んだものだけ掲載するか。初回の古い記事の扱いも決める。
5. **情報源と解析方式**：公式ブログかリリースか、製品別RSSか全体RSSか。小さな自作変換処理と汎用RSSライブラリのどちらを持つか。
6. **実験の広げ方**：最初はReactの島1つにするか、同時に別ページのSolid/Vueも作るか。Compilerの採用と性能改善の保証は別判断。

## 今回は確認していないこと

- Cloudflareアカウントの権限・契約・D1作成・実際のCron配送・本番のCPU/メモリ・料金。ローカルではscheduled handlerを手動呼び出しした。
- 本番URLからのCORS、DNS、GitHub Pages公開、CI連携、SSG全体と既存シミュレーター・完成版LTを接続した回帰確認。
- SSRしたReactのhydrate、visible時の遅延起動、複数ライブラリを同じDOMへ混在させること、実利用規模の性能比較。
- 本文Markdownのリーダー・AI要約・既読管理・全文検索。初期範囲はタイトルとリンク。
- 長期運用、RSSの同時実行・新旧逆転、購読先の移転、429、リダイレクト制限、全RSS方言、破壊的入力への網羅的セキュリティ試験。

## 再確認と証跡の見方

作業ディレクトリはこの検証フォルダ。`harness.mjs`は選んだ検証を順番に実行し、`runs/<日時>/`へコマンド・終了コード・ログを残す。`evidence/`は参照しやすい結果の写し。Node比較の各版のログとJSONは`evidence/node-matrix.json`に記載した`run`配下に残している。

依存と取得物を復元してから、次のように再実行できる。既存ブログのディレクトリでは実行しない。

```sh
cd /Users/svc-tokeshi/dev/Howitworks/verification/catchup-feasibility-2026-10-31
# npmのキャッシュ・ユーザー設定参照も、この検証範囲へ限定する
npm ci --ignore-scripts --strict-peer-deps --no-audit --no-fund \
  --userconfig=./isolated-user.npmrc --cache=./.npm-cache
node harness.mjs parser runtime-compatible rss-compat islands preservation
```

`runtime`は10/31互換日での起動失敗を再現する条件、`runtime-compatible`は対応済み10/30での機能確認。負例の起動失敗を、全体が実現不可能という意味で読まない。`rss-compat`は明示無効の負例を含むため、ランタイムのエラー出力があっても期待通りならハーネスは成功する。

`node probes/serve.mjs`で新設の検証ページだけを127.0.0.1:4497に表示できる。既存4331のブログとは別のもの。`/?scripts=off`は検証レスポンスだけscriptをブロックする。ブラウザのグローバル設定は変更していない。

`versions`はネットワークで最新メタデータを再取得し判定時点を更新する。更新検討時には、古い結果と新しい結果を混同せず再度lockfileの年齢・監査も確認する。

## データ保全

変更・追加は今回新設した検証ディレクトリ内。既存ブログ・記事・Brotliシミュレーター・完成版LT・既存lockfile・Macのnpmユーザー設定は変更していない。

開始時に記録した既存52,602ファイルの存在、原本164ファイルのSHA256を照合し、欠落0・変更0。全マシンをハッシュ監査したという意味ではなく、対象プロジェクトの確認結果。既存データを削除するコマンドは実行していない。

検証で新しく作った大容量の依存・キャッシュ・Nodeアーカイブと展開先は、結果を保存した後に許可範囲内で片付けた。対象の一覧は`evidence/cleanup.json`に記録済み。ソース・lockfile・公開メタデータ・実フィード・試験ログは保持している。検証サーバー4497は停止し、元のブログサーバー4331は停止していない。

## 主要な一次資料

上記の各結果はローカルログと次の一次資料を照合した。参照日2026-10-31。

- [Cloudflare公式RSS一覧](https://developers.cloudflare.com/fundamentals/new-features/available-rss-feeds/)
- [HonoのWorkersガイド](https://hono.dev/docs/getting-started/cloudflare-workers)
- [D1のローカル開発](https://developers.cloudflare.com/d1/best-practices/local-development/)、[D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Miniflare scheduled](https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/)
- [React Compilerの導入](https://react.dev/learn/react-compiler/installation)、[Vite manifest連携](https://vite.dev/guide/backend-integration)
- [fast-xml-parser公式リポジトリ](https://github.com/NaturalIntelligence/fast-xml-parser)、[rss-parser公式リポジトリ](https://github.com/bobby-brennan/rss-parser)
- [npm min-release-age](https://docs.npmjs.com/cli/v11/using-npm/config/#min-release-age)、[Node公式配布一覧](https://nodejs.org/dist/index.json)
