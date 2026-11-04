# Howitworks

ソフトウェアの「どう動くのか」を調べ、試して、理解を深めるための個人の技術学習・ブログプロジェクトです。

調査から検証、記事化までの試行錯誤を、出典や実験結果と一緒に残します。ブログ自体も、技術を入れ替えて仕組みを学ぶための実験場です。

## 内容

- [記事](articles/)・[調査ノート](notes/)
- [実験コード](experiments/)・[検証記録](verification/)
- [シミュレーター](simulators/)
- [LT資料](talks/)

## ローカルで動かす

現在はAstro版とHono＋Vite版をローカルで検証しています。以下はHono＋Vite版の起動方法です。Node.js 24.22.1以上を使います。

```sh
npm --prefix web ci --ignore-scripts
npm --prefix web run dev
```

<http://127.0.0.1:4331/> で下書きを含む記事を開けます。変更後は停止して再実行し、ブラウザーを再読み込みします。

詳しい手順と実装範囲は、[Hono＋Vite版](web/README.md)・[Astro版](site/README.md)のREADMEを参照してください。

## ドキュメント

- [ブログの設計・フレームワーク比較の計画](docs/hono-islands-design.md)
- [RSS／Atomの新着を扱う仕組みの設計](docs/catchup-reader-design.md)
- [これまでの方針・運用メモ](docs/project-notes.md)
- [記事・調査ノートのテンプレート](templates/)
