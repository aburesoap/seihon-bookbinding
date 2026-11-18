// 作成画面の表示言語（日本語・英語）.
//
// HTML側では次の属性で訳語を指定する.
//   data-i18n="key"              … 要素の文字列
//   data-i18n-placeholder="key"  … placeholder
//   data-i18n-title="key"        … title
//   data-i18n-aria-label="key"   … aria-label
// JS側では t("key", { 名前: 値 }) で文字列を取り出す. 訳語中の {名前} が置き換わる.
//
// 表記のきまり：ひとかたまりの文章の末尾にはピリオドを付けない.
// 読む画面（reader/reader.js）の訳語は, あちらのファイルにまとめてある.

export const LANGS = ["ja", "en"];

const MESSAGES = {
  ja: {
    "meta.description": "PDFや画像をまとめて, 持ち運べるHTMLファイルに製本するツール",
    "header.tagline": "PDFや画像を, 1つのHTMLファイルにまとめます",
    "header.panelLeft": "設定を左へ",
    "header.panelRight": "設定を右へ",
    "header.theme.auto": "テーマ：自動",
    "header.theme.light": "テーマ：ライト",
    "header.theme.dark": "テーマ：ダーク",
    "header.lang": "English",

    "drop.title": "ファイルを選択",
    "drop.sub": "またはドラッグ&ドロップ（PDF・画像）",

    "pages.count": "{n} ページ",
    "pages.addBlank": "白紙を追加",
    "pages.clear": "すべて削除",
    "pages.clearConfirm": "すべてのページを削除しますか？",
    "pages.hint": "ドラッグで並び替えできます. 「見出し」で目次に載せる見出しを, 「注目」で製本者のしおりを付けられます",
    "pages.sortGroup": "並び替え",
    "sort.name": "名前",
    "sort.added": "追加順",
    "sort.modified": "更新日時",
    "sort.size": "サイズ",

    "page.blank": "白紙",
    "page.loading": "読み込み中",
    "page.remove": "このページを削除",
    "page.removeLabel": "{n}ページ目を削除",
    "page.toc": "見出し",
    "page.tocTitle": "目次に見出しを載せる",
    "page.tocPlaceholder": "目次の見出し",
    "page.tocLabel": "{n}ページ目の見出し",
    "page.mark": "注目",
    "page.markTitle": "製本者のしおりを付ける",

    "settings.label": "設定",
    "settings.pages": "ページ",
    "settings.book": "本の情報",
    "settings.title": "タイトル",
    "settings.untitled": "無題の本",
    "settings.direction": "綴じ方向",
    "settings.rtl": "右綴じ（左に進む）",
    "settings.ltr": "左綴じ（右に進む）",
    "settings.directionNote": "右綴じは縦書きの本やマンガ, 左綴じは横書きの資料向けです",
    "settings.display": "表示",
    "settings.layout": "ページの並べ方",
    "settings.layout.auto": "自動（横長の画面では見開き）",
    "settings.layout.spread": "常に見開き",
    "settings.layout.single": "常に単ページ",
    "settings.coverSingle": "表紙（1ページ目）を単独で表示",
    "settings.showPageNumber": "ページ番号を表示",
    "settings.quality": "画質",
    "settings.maxEdge": "ページの最大サイズ（長辺）",
    "settings.maxEdge.1280": "1280px（軽量）",
    "settings.maxEdge.1920": "1920px（標準）",
    "settings.maxEdge.2560": "2560px（高画質）",
    "settings.maxEdge.3840": "3840px（最高画質）",
    "settings.compression": "圧縮品質",
    "settings.qualityNote": "画像はWebP形式に変換して埋め込みます（未対応のブラウザではJPEG）",
    "settings.publish": "公開設定",
    "settings.password": "パスワード（任意）",
    "settings.passwordPlaceholder": "設定しない",
    "settings.passwordNote": "設定すると, ページの内容と目次をパスワードで暗号化（AES-GCM）します",
    "settings.share": "共有とQRコード",
    "settings.url": "公開先のURL（任意）",
    "settings.urlNote": "製本したHTMLを置く場所のURLです. 本にも書き込まれ, 読み手の共有ボタンからQRコードを表示できます",
    "settings.urlInvalid": "http:// または https:// で始まるURLを入力してください",
    "settings.qrPng": "PNGで保存",
    "settings.qrSvg": "SVGで保存",

    "action.preview": "プレビュー",
    "action.build": "製本する",

    "status.loading": "読み込み中…",
    "status.skipped": "読み込めないファイルがありました：{files}",
    "status.loadError": "ファイルを読み込めませんでした（{message}）",
    "status.converting": "ページを変換中（{i} / {n}）",
    "status.encrypting": "暗号化中",
    "status.writing": "HTMLを作成中",
    "status.done": "できあがりました（{size}）",
    "status.buildError": "製本に失敗しました（{message}）",
    "status.previewOpened": "プレビューを開きました（{size}）",
    "status.previewError": "プレビューに失敗しました（{message}）",

    "footer.license": "GitHub（MIT License）",
  },

  en: {
    "meta.description": "A tool that binds PDFs and images into a portable HTML file",
    "header.tagline": "Bind PDFs and images into a single HTML file",
    "header.panelLeft": "Settings to left",
    "header.panelRight": "Settings to right",
    "header.theme.auto": "Theme: Auto",
    "header.theme.light": "Theme: Light",
    "header.theme.dark": "Theme: Dark",
    "header.lang": "日本語",

    "drop.title": "Choose files",
    "drop.sub": "or drag and drop (PDF, images)",

    "pages.count": "{n} pages",
    "pages.addBlank": "Add blank page",
    "pages.clear": "Remove all",
    "pages.clearConfirm": "Remove all pages?",
    "pages.hint": "Drag to reorder. Use “Heading” to add a table of contents entry and “Mark” to add the binder's bookmark",
    "pages.sortGroup": "Sort",
    "sort.name": "Name",
    "sort.added": "Added",
    "sort.modified": "Modified",
    "sort.size": "Size",

    "page.blank": "Blank",
    "page.loading": "Loading",
    "page.remove": "Remove this page",
    "page.removeLabel": "Remove page {n}",
    "page.toc": "Heading",
    "page.tocTitle": "Add to the table of contents",
    "page.tocPlaceholder": "Heading",
    "page.tocLabel": "Heading for page {n}",
    "page.mark": "Mark",
    "page.markTitle": "Add the binder's bookmark",

    "settings.label": "Settings",
    "settings.pages": "Pages",
    "settings.book": "Book",
    "settings.title": "Title",
    "settings.untitled": "Untitled",
    "settings.direction": "Binding",
    "settings.rtl": "Right binding (pages go left)",
    "settings.ltr": "Left binding (pages go right)",
    "settings.directionNote": "Right binding suits vertical Japanese text and manga. Left binding suits horizontal documents",
    "settings.display": "Display",
    "settings.layout": "Page layout",
    "settings.layout.auto": "Auto (spread on wide screens)",
    "settings.layout.spread": "Always spread",
    "settings.layout.single": "Always single page",
    "settings.coverSingle": "Show the cover (page 1) on its own",
    "settings.showPageNumber": "Show page numbers",
    "settings.quality": "Image quality",
    "settings.maxEdge": "Maximum page size (long edge)",
    "settings.maxEdge.1280": "1280px (light)",
    "settings.maxEdge.1920": "1920px (standard)",
    "settings.maxEdge.2560": "2560px (high)",
    "settings.maxEdge.3840": "3840px (highest)",
    "settings.compression": "Compression quality",
    "settings.qualityNote": "Images are embedded as WebP (JPEG in browsers without WebP support)",
    "settings.publish": "Protection",
    "settings.password": "Password (optional)",
    "settings.passwordPlaceholder": "None",
    "settings.passwordNote": "When set, the pages and table of contents are encrypted with the password (AES-GCM)",
    "settings.share": "Sharing and QR code",
    "settings.url": "Public URL (optional)",
    "settings.urlNote": "Where you will put the bound HTML. It is written into the book, and readers can show it as a QR code from the share button",
    "settings.urlInvalid": "Enter a URL starting with http:// or https://",
    "settings.qrPng": "Save as PNG",
    "settings.qrSvg": "Save as SVG",

    "action.preview": "Preview",
    "action.build": "Bind",

    "status.loading": "Loading…",
    "status.skipped": "Some files could not be read: {files}",
    "status.loadError": "Could not read the files ({message})",
    "status.converting": "Converting pages ({i} / {n})",
    "status.encrypting": "Encrypting",
    "status.writing": "Writing HTML",
    "status.done": "Done ({size})",
    "status.buildError": "Binding failed ({message})",
    "status.previewOpened": "Opened the preview ({size})",
    "status.previewError": "Preview failed ({message})",

    "footer.license": "GitHub (MIT License)",
  },
};

let lang = "ja";

export function getLang() {
  return lang;
}

export function setLang(next) {
  lang = LANGS.includes(next) ? next : "ja";
  document.documentElement.lang = lang;
  translatePage();
}

export function t(key, vars = {}) {
  const text = MESSAGES[lang][key] ?? MESSAGES.ja[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

const ATTRS = ["placeholder", "title", "aria-label"];

export function translatePage(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const attr of ATTRS) {
    for (const node of root.querySelectorAll(`[data-i18n-${attr}]`)) {
      node.setAttribute(attr, t(node.getAttribute(`data-i18n-${attr}`)));
    }
  }
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));
}
