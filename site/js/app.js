// 作成画面のUI. ページ一覧の管理, 設定の読み取り, 製本の実行を受け持つ.

import Sortable from "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/modular/sortable.esm.js";
import { filesToPages, createBlankPage, compareNames, sortKeyOf } from "./sources.js";
import { buildBook } from "./build.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  dropzone: $("#dropzone"),
  fileInput: $("#file-input"),
  grid: $("#page-grid"),
  count: $("#page-count"),
  hint: $("#pages-hint"),
  form: $("#settings"),
  qualityOut: $("#quality-out"),
  btnBuild: $("#btn-build"),
  btnPreview: $("#btn-preview"),
  progress: $("#progress"),
  progressBar: $("#progress-bar"),
  progressText: $("#progress-text"),
  result: $("#result"),
};

// アプリの状態はこの配列だけ. 表示は render() で配列から作り直す.
let pages = [];
let busy = false;

// ---- ページ一覧の表示 ----

function render() {
  els.grid.replaceChildren(...pages.map(pageItem));
  els.count.textContent = `${pages.length} ページ`;
  els.hint.hidden = pages.length < 2;
  els.btnBuild.disabled = busy || pages.length === 0;
  els.btnPreview.disabled = busy || pages.length === 0;
}

function pageItem(page, index) {
  const li = document.createElement("li");
  li.className = "page-item";
  li.dataset.id = page.id;

  const thumb = document.createElement("div");
  thumb.className = "page-thumb";
  if (page.kind === "blank") {
    thumb.classList.add("is-blank");
  } else if (page.thumb) {
    const img = document.createElement("img");
    img.src = page.thumb;
    img.alt = "";
    thumb.append(img);
  } else {
    thumb.classList.add("is-loading");
  }

  const no = document.createElement("span");
  no.className = "page-no";
  no.textContent = index + 1;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "page-remove";
  remove.textContent = "×";
  remove.title = "このページを削除";
  remove.setAttribute("aria-label", `${index + 1}ページ目を削除`);
  remove.addEventListener("click", () => {
    pages = pages.filter((p) => p !== page);
    render();
  });

  const name = document.createElement("span");
  name.className = "page-name";
  name.textContent = page.name;
  name.title = page.name;

  thumb.append(no, remove);
  li.append(thumb, name);
  return li;
}

// サムネイルが届いたら, そのページの要素だけ差し替える.
function updateThumb(page) {
  const li = els.grid.querySelector(`[data-id="${page.id}"]`);
  const index = pages.indexOf(page);
  if (li && index >= 0) li.replaceWith(pageItem(page, index));
}

Sortable.create(els.grid, {
  animation: 150,
  delay: 150,
  delayOnTouchOnly: true,
  filter: ".page-remove",
  preventOnFilter: false,
  onEnd(event) {
    if (event.oldIndex === event.newIndex) return;
    const [moved] = pages.splice(event.oldIndex, 1);
    pages.splice(event.newIndex, 0, moved);
    render();
  },
});

// ---- ファイルの追加 ----

async function addFiles(fileList) {
  const files = [...fileList];
  if (files.length === 0) return;
  showResult("読み込み中…");
  try {
    const { pages: added, skipped } = await filesToPages(files, updateThumb);
    pages.push(...added);
    render();
    showResult(skipped.length ? `読み込めないファイルがありました：${skipped.join(", ")}` : "", skipped.length > 0);
  } catch (err) {
    console.error(err);
    showResult(`ファイルを読み込めませんでした（${err.message}）`, true);
  }
}

els.fileInput.addEventListener("change", () => {
  addFiles(els.fileInput.files);
  els.fileInput.value = "";
});

// ページ全体をドロップ先にする（ドロップエリアから少し外れても受け付ける）.
let dragDepth = 0;
const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes("Files");

window.addEventListener("dragenter", (event) => {
  if (!hasFiles(event)) return;
  dragDepth++;
  els.dropzone.classList.add("is-over");
});
window.addEventListener("dragleave", (event) => {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) els.dropzone.classList.remove("is-over");
});
window.addEventListener("dragover", (event) => {
  if (hasFiles(event)) event.preventDefault();
});
window.addEventListener("drop", (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  els.dropzone.classList.remove("is-over");
  addFiles(event.dataTransfer.files);
});

// ---- 一覧の操作ボタン ----

$("#btn-blank").addEventListener("click", () => {
  pages.push(createBlankPage());
  render();
});

$("#btn-sort-name").addEventListener("click", () => {
  pages.sort((a, b) => compareNames(sortKeyOf(a), sortKeyOf(b)));
  render();
});

$("#btn-reverse").addEventListener("click", () => {
  pages.reverse();
  render();
});

$("#btn-clear").addEventListener("click", () => {
  if (pages.length && confirm("すべてのページを削除しますか？")) {
    pages = [];
    render();
  }
});

// ---- 設定 ----

function readSettings() {
  const data = new FormData(els.form);
  return {
    title: String(data.get("title")).trim() || "無題の本",
    direction: data.get("direction"),
    layout: data.get("layout"),
    coverSingle: data.has("coverSingle"),
    showPageNumber: data.has("showPageNumber"),
    maxEdge: Number(data.get("maxEdge")),
    quality: Number(data.get("quality")) / 100,
    password: String(data.get("password")),
  };
}

els.form.quality.addEventListener("input", () => {
  els.qualityOut.textContent = els.form.quality.value;
});
els.form.addEventListener("submit", (event) => event.preventDefault());

// ---- 製本 ----

async function make() {
  busy = true;
  render();
  els.progress.hidden = false;
  showResult("");
  try {
    const settings = readSettings();
    const html = await buildBook(pages, settings, (done, total, message) => {
      els.progressBar.value = total ? done / total : 0;
      els.progressText.textContent = message;
    });
    return { settings, blob: new Blob([html], { type: "text/html" }) };
  } finally {
    busy = false;
    els.progress.hidden = true;
    render();
  }
}

els.btnBuild.addEventListener("click", async () => {
  try {
    const { settings, blob } = await make();
    download(blob, `${safeFileName(settings.title)}.html`);
    showResult(`できあがりました（${formatSize(blob.size)}）. `);
  } catch (err) {
    console.error(err);
    showResult(`製本に失敗しました（${err.message}）`, true);
  }
});

els.btnPreview.addEventListener("click", async () => {
  // ポップアップブロックを避けるため, 先にタブを開いておく.
  const tab = window.open("", "_blank");
  try {
    const { blob } = await make();
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    showResult(`プレビューを開きました（${formatSize(blob.size)}）. `);
  } catch (err) {
    tab?.close();
    console.error(err);
    showResult(`プレビューに失敗しました（${err.message}）`, true);
  }
});

function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- 小さな道具 ----

function showResult(text, isError = false) {
  els.result.hidden = !text;
  els.result.textContent = text;
  els.result.classList.toggle("is-error", isError);
}

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

render();
