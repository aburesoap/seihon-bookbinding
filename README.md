# Seihon（製本）

PDFや画像ファイルを読み込み, 1つのHTMLファイルの「本」にまとめる静的Webツールです.
できあがったHTMLはオフラインでも開け, ブラウザだけで本のように読めます.

- 同人誌即売会のサンプル, 会議資料のとりまとめ, マニフェストの頒布などを想定しています
- 処理はすべてブラウザ内で行われ, ファイルが外部に送信されることはありません
- オープンソース（MIT License）, 無料で使えます

## できること

- PDF・画像（PNG, JPEG, WebP など）をまとめて選択, またはドラッグ&ドロップで追加
- ドラッグでページを並び替え, 削除, 白紙ページの追加, 名前順・逆順の並び替え
- 右綴じ（右開き）／左綴じ（左開き）
- 見開き／単ページ表示（自動切り替えあり）, 表紙の単独表示
- ページ番号の表示・非表示
- パスワードによる暗号化（PBKDF2 + AES-GCM）
- 画像はWebPに変換して埋め込み（サイズと品質を選択可能）

できあがった本は, キーボードの矢印キー, 画面の左右タップ, スワイプ, 下部のスライダーでページを移動できます.
画面中央をタップすると上下のバーが隠れます.

## ディレクトリ構成

```
site/                 GitHub Pagesで公開するファイル（ビルド不要）
  index.html          作成画面
  css/app.css         作成画面のスタイル
  js/app.js           作成画面のUI（ページ一覧, 設定, 製本ボタン）
  js/sources.js       PDF・画像の読み込みとページの描画
  js/build.js         HTMLファイルの組み立てと画像のWebP変換
  js/crypto.js        パスワードによる暗号化
  reader/             できあがる本（読む画面）のテンプレート
    template.html     HTMLの骨組み. {{TITLE}} などを置き換えて使う
    reader.css        読む画面のスタイル
    reader.js         読む画面の動き（外部ライブラリなし）
.github/workflows/    GitHub Pagesへの公開設定
```

作成画面は `reader/` のファイルをそのまま読み込み, 本の中身と一緒に1つのHTMLに埋め込みます.
読む画面のデザインを変えたいときは `reader/` 以下を編集してください.

## 手元で動かす

ES Modulesと `fetch` を使うため, `file://` ではなくローカルサーバー経由で開いてください.

```bash
cd site && python3 -m http.server 8000
```

ブラウザで http://localhost:8000 を開きます.

## 公開

`main` ブランチにpushすると, GitHub Actionsで `site/` がGitHub Pagesに公開されます.
初回のみ, リポジトリの Settings > Pages > Source を「GitHub Actions」に設定してください.

## 利用しているライブラリ

作成画面のみで使用し, CDN（jsDelivr）から読み込みます. できあがった本には含まれません.

- [PDF.js](https://mozilla.github.io/pdf.js/)（Apache License 2.0）: PDFのページを画像にする
- [SortableJS](https://sortablejs.github.io/Sortable/)（MIT License）: ページの並び替え

## メモ

- 画像はBase64で埋め込むため, 元の画像の合計よりファイルサイズが3割ほど大きくなります
- パスワードを設定しても, タイトルと表示設定は暗号化されません（ページの画像のみ暗号化）
