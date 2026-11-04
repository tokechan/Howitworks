# 検証記録 E2：Macで選択されるNode.jsのBrotliリンク方式

- テーマID：brotli-cve-2026-111497
- 元の調査ノート：[Brotliの脆弱性と複数環境の更新](brotli-cve-2026-111497.md)
- 実施日：2026-10-27（日本時間、環境情報取得時刻 11:43:59）
- 対象：このチャットのログインシェルから起動するNode.js 1個
- 実施内容：ビルド設定、実行ファイルの動的リンク先、シンボルの読み取り
- 環境変更：インストール、更新、設定変更は行っていない

## 問いと実行前の予想

Macで選択されているNode.jsは、Brotliを自身のバイナリに静的リンクしているか、外部の共有ライブラリを動的リンクしているか。

静的リンクなら、共有Brotliを使うビルド設定がfalseになり、動的リンク先にBrotliが現れず、シンボル情報が残っていればBrotliの関数定義をNode.js内で確認できると予想した。

## 環境と対象の識別

| 項目 | 観測結果 |
| --- | --- |
| OS | macOS 15.8.1、ビルド24H32 |
| アーキテクチャ | arm64 |
| シェルが選んだ実行ファイル | `$HOME/.nvm/versions/node/v24.22.1/bin/node` |
| Node.jsが報告した実行ファイル | 上記と同じ |
| Node.jsバージョン | v24.22.1 |
| Brotli表示バージョン | 1.2.0 |
| 実行ファイル形式 | Mach-O 64-bit executable arm64 |

この公開用記録ではホームディレクトリの実パスを `$HOME` に置き換えた。Node.jsの場所はnvm配下だったが、インストール手順やダウンロード元の真正性は今回確認していない。

## 1. 実行対象とビルド設定を確認する

実行したコマンド：

```sh
command -v node
node -p 'JSON.stringify({ node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch, brotli: process.versions.brotli, node_shared_brotli: process.config.variables.node_shared_brotli, node_shared: process.config.variables.node_shared }, null, 2)'
```

観測結果（実行ファイルのホーム部分のみ置換）：

```text
$HOME/.nvm/versions/node/v24.22.1/bin/node
```

```json
{
  "node": "v24.22.1",
  "execPath": "$HOME/.nvm/versions/node/v24.22.1/bin/node",
  "platform": "darwin",
  "arch": "arm64",
  "brotli": "1.2.0",
  "node_shared_brotli": false,
  "node_shared": false
}
```

- `command -v node`：現在のシェルが `node` をどこから選ぶかを調べる。
- `node -p '式'`：JavaScriptの式を評価して、その結果を表示して終了する。
- `process.execPath`：実際に起動したNode.jsの実行ファイルの絶対パス。シンボリックリンクは解決される。
- `process.config`：そのNode.jsをコンパイルした際の設定。
- `node_shared_brotli`：Brotliを共有ライブラリとして使う設定。今回の `false` はBrotliの無効化を意味しない。
- `process.versions.brotli`：Node.jsが報告するBrotliのバージョン文字列。リンク方式や個別修正の取り込みを単独では判定できない。
- `JSON.stringify(..., null, 2)`：結果を2スペースの字下げで読みやすく表示する。

Node.js APIの意味は[公式processドキュメント](https://nodejs.org/api/process.html#processconfig)で確認。共有Brotliを選ぶオプションは[Node.js v24.22.1のconfigure.py](https://github.com/nodejs/node/blob/v24.22.1/configure.py#L608)、同梱Brotliの静的ライブラリ設定は[brotli.gyp](https://github.com/nodejs/node/blob/v24.22.1/deps/brotli/brotli.gyp#L48)で確認した。

## 2. 実行ファイルの動的リンク先を確認する

確認済みの実行ファイルに対して、次のコマンドを実行した。ここでは実パスを `$HOME` 表記に置換している。

```sh
/usr/bin/file "$HOME/.nvm/versions/node/v24.22.1/bin/node"
/usr/bin/otool -L "$HOME/.nvm/versions/node/v24.22.1/bin/node"
```

`file` はファイル形式を表示する。結果は `Mach-O 64-bit executable arm64` だった。

`otool -L` は、そのMach-Oファイルに記録された共有ライブラリの依存先とバージョンを表示する。出力は次のとおり。

```text
$HOME/.nvm/versions/node/v24.22.1/bin/node:
    /System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation (compatibility version 150.0.0, current version 3038.1.255)
    /System/Library/Frameworks/Security.framework/Versions/A/Security (compatibility version 1.0.0, current version 61439.1.1)
    /usr/lib/libc++.1.dylib (compatibility version 1.0.0, current version 1800.101.0)
    /usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1351.0.0)
```

Brotliの共有ライブラリ `libbrotlidec` / `libbrotlienc` は出ていない。ほかの共有ライブラリが出ていても、Brotliの静的リンクとは矛盾しない。Node.js全体がすべて静的リンクされているという意味ではない。

この一覧に名前がないことだけで一般的に静的リンクを証明できるわけではない。別ライブラリを経由する依存や実行時の動的ロードもあり得るため、今回はビルド設定と次のシンボル確認を合わせて判断する。

## 3. Brotliの関数定義が実行ファイル内にあるかを確認する

```sh
/usr/bin/nm -m "$HOME/.nvm/versions/node/v24.22.1/bin/node" | rg ' _BrotliDecoderDecompressStream$'
```

実際の出力：

```text
000000010173d354 (__TEXT,__text) external _BrotliDecoderDecompressStream
```

- `nm`：実行ファイルなどのシンボル情報を表示する。シンボルは、関数・変数などに対応する名前。
- `-m`：Mach-Oのセグメント・セクションなどを含めて表示する。
- `| rg '...$'`：出力から指定した関数名で終わる行だけを取り出す。`rg` がない場合は同じ検索式を `grep` に渡してもよい。
- `(__TEXT,__text)`：今回の関数が実行ファイルのコード用セクションに定義されている。
- `external`：シンボルの公開範囲に関する表示。外部ライブラリから読み込むという意味ではない。
- `(undefined)`：このファイル内では未定義のシンボルを示す表示。今回の結果はこれではなかった。

`otool` と `nm` のオプション・表示の意味は、Mac上の `man otool` / `man nm` で確認した。別の配布物ではシンボルが除去されていることがあり、検索結果がない場合だけで結論を出さない。

## 判断

次の3つの観測が一致したため、この実行ファイルについてはBrotliを静的リンクしていると判断する。

1. ビルド設定の `node_shared_brotli` が `false`。
2. 動的リンク先にBrotliがない。
3. Brotliの展開関数がNode.js実行ファイルのコード領域に定義されている。

このNode.js内のBrotliのコードは、OS側のBrotli共有ライブラリを更新しても置き換わらない。

## Brotliが1.2.0と表示されたことの読み方

今回のNode.jsはv24.22.1を報告し、Brotliは1.2.0を報告した。一方、[Node.js v24.22.1の公式リリース情報](https://nodejs.org/en/blog/release/v24.22.1)には、CVE-2026-111497への対応として上流修正 `0ed4268a` をcherry-pickした記録がある。

ライブラリ全体のバージョンを上げず、特定の修正を取り込む場合がある。この観測は、そのリリース方針と整合する。Brotliが1.2.0と表示されたという理由だけで、未修正と断定してはいけない。

ここで照合したのは報告された製品バージョンと公式の修正履歴。手元のバイナリと公式配布物の完全一致確認や、CVEを発火させるテストは実施していない。

## 対象と限界

対象は今回のシェルで起動したnvm配下のNode.js 1個。別のターミナル、別のnvmバージョン、GUIアプリ、コンテナ、サーバーなどのNode.jsを一括で確認した結果ではない。

同日、ユーザー自身もビルド設定、動的リンク先、関数の定義を確認した。ユーザーのターミナルでは `rg` が見つからなかったため `grep` に置き換え、同じシンボル行が出たとの報告を得た。

この結果に続くE1は、別の[HTTP自動展開の検証記録](brotli-http-auto-decode-2026-10-27.md)にまとめている。
