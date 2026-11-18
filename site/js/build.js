// ページと設定から, 1つのHTMLファイル（本）を組み立てる.
//
// 出力されるHTMLは reader/ 以下のテンプレート・CSS・JSをそのまま埋め込んだもの.
// 本の中身は <script type="application/json" id="book-data"> に入る.

import { renderPage } from "./sources.js";
import { encryptText } from "./crypto.js";
import { t, getLang } from "./i18n.js";

const READER_FILES = {
  template: "reader/template.html",
  style: "reader/reader.css",
  script: "reader/reader.js",
  qrcode: "vendor/qrcode.min.js",
};

let readerCache = null;

async function loadReader() {
  if (!readerCache) {
    const entries = await Promise.all(
      Object.entries(READER_FILES).map(async ([key, path]) => {
        const res = await fetch(new URL(`../${path}`, import.meta.url));
        if (!res.ok) throw new Error(`${path} (HTTP ${res.status})`);
        return [key, await res.text()];
      }),
    );
    readerCache = Object.fromEntries(entries);
  }
  return readerCache;
}

// onProgress(done, total, message) で進み具合を知らせる.
export async function buildBook(pages, settings, onProgress = () => {}) {
  const reader = await loadReader();
  const total = pages.length;
  const encoded = [];
  let lastSize = null;

  for (let i = 0; i < total; i++) {
    onProgress(i, total, t("status.converting", { i: i + 1, n: total }));
    const canvas = await renderPage(pages[i], settings.maxEdge, lastSize);
    lastSize = { width: canvas.width, height: canvas.height };
    encoded.push({
      src: await canvasToDataURL(canvas, settings.quality),
      w: canvas.width,
      h: canvas.height,
    });
    // メモリを早めに手放す.
    canvas.width = canvas.height = 0;
  }

  // 本の中身. パスワードがあるときは, これをまとめて暗号化する.
  const content = {
    pages: encoded,
    toc: pages
      .map((page, i) => ({ page: i, title: (page.toc ?? "").trim() }))
      .filter((entry) => entry.title),
    marks: pages.flatMap((page, i) => (page.marked ? [i] : [])),
    colophon: settings.colophon || undefined, // 奥付（作者名, X ID, 感想URL, ハッシュタグ）
  };

  const book = {
    v: 2,
    lang: getLang(), // 読む画面の表示言語
    // 読み手のしおりを本ごとに保存するための識別子.
    id: crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2),
    title: settings.title,
    direction: settings.direction,
    layout: settings.layout,
    coverSingle: settings.coverSingle,
    showPageNumber: settings.showPageNumber,
    url: settings.url || undefined, // 公開先URL. 読み手の共有ボタンで使う
  };

  if (settings.password) {
    onProgress(total, total, t("status.encrypting"));
    book.encrypted = await encryptText(JSON.stringify(content), settings.password);
  } else {
    book.content = content;
  }

  onProgress(total, total, t("status.writing"));
  return fillTemplate(reader, book);
}

function fillTemplate(reader, book) {
  const values = {
    TITLE: escapeHtml(book.title),
    STYLE: reader.style,
    SCRIPT: reader.script,
    QRCODE: reader.qrcode,
    DATA: safeJson(book),
  };
  // 置換文字列中の "$" が特別扱いされないよう, 関数で置き換える.
  return reader.template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}

// WebPで書き出す. 未対応のブラウザ（toBlobがPNGを返す）ではJPEGにする.
async function canvasToDataURL(canvas, quality) {
  let blob = await toBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", quality);
  }
  return blobToDataURL(blob);
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// <script> の中に置いても安全なJSON（"</script>" などで閉じられないように）.
function safeJson(value) {
  return JSON.stringify(value).replace(/[<\u2028\u2029]/g, (c) =>
    `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
