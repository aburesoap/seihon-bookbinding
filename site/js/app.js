// 作成画面のUI. ページ一覧の管理, 設定の読み取り, 製本の実行を受け持つ.

import Sortable from "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/modular/sortable.esm.js";
import { filesToPages, createBlankPage, compareNames } from "./sources.js";
import { buildBook } from "./build.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  dropzone: $("#dropzone"),
  fileInput: $("#file-input"),
  grid: $("#page-grid"),
  count: $("#page-count"),
  hint: $("#pages-hint"),
  sortButtons: [...document.querySelectorAll(".sort-btn")],
  form: $("#settings"),
  qualityOut: $("#quality-out"),
  btnBuild: $("#btn-build"),
  btnPreview: $("#btn-preview"),
  btnPanel: $("#btn-panel"),
  btnTheme: $("#btn-theme"),
  progress: $("#progress"),
  progressBar: $("#progress-bar"),
  progressText: $("#progress-text"),
  result: $("#result"),
};

// アプリの状態. 表示は render() で pages から作り直す.
let pages = [];
let busy = false;
let sortState = { key: null, desc: false };

// ---- 画面の好み（テーマ・パネル位置）----
// index.html の <head> でも同じキーを読み, 描画前に反映している.

const PREFS_KEY = "seihon:prefs";
const THEMES = ["auto", "light", "dark"];
const THEME_LABELS = { auto: "テーマ：自動", light: "テーマ：ライト", dark: "テーマ：ダーク" };

const prefs = loadPrefs();

function loadPrefs() {
  try {
    return { theme: "auto", panel: "right", ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return { theme: "auto", panel: "right" };
  }
}

function applyPrefs() {
  const root = document.documentElement;
  if (prefs.theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = prefs.theme;
  root.dataset.panel = prefs.panel;
  els.btnTheme.textContent = THEME_LABELS[prefs.theme];
  els.btnPanel.textContent = prefs.panel === "right" ? "設定を左へ" : "設定を右へ";
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* 保存できない環境では, その場限りの設定になる */ }
}

els.btnTheme.addEventListener("click", () => {
  prefs.theme = THEMES[(THEMES.indexOf(prefs.theme) + 1) % THEMES.length];
  applyPrefs();
});

els.btnPanel.addEventListener("click", () => {
  prefs.panel = prefs.panel === "right" ? "left" : "right";
  applyPrefs();
});

applyPrefs();

// ---- ページ一覧の表示 ----

function render() {
  els.grid.replaceChildren(...pages.map(pageItem));
  els.count.textContent = `${pages.length} ページ`;
  els.hint.hidden = pages.length === 0;
  els.btnBuild.disabled = busy || pages.length === 0;
  els.btnPreview.disabled = busy || pages.length === 0;
  for (const btn of els.sortButtons) {
    const active = btn.dataset.sort === sortState.key;
    btn.setAttribute("aria-pressed", String(active));
    btn.dataset.label ??= btn.textContent;
    btn.textContent = btn.dataset.label + (active ? (sortState.desc ? " ▼" : " ▲") : "");
  }
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

  const remove = button("×", "page-remove", () => {
    pages = pages.filter((p) => p !== page);
    render();
  });
  remove.title = "このページを削除";
  remove.setAttribute("aria-label", `${index + 1}ページ目を削除`);

  thumb.append(no, remove);
  if (page.marked) {
    const ribbon = document.createElement("span");
    ribbon.className = "ribbon";
    ribbon.title = "注目";
    thumb.append(ribbon);
  }

  const name = document.createElement("span");
  name.className = "page-name";
  name.textContent = page.name;
  name.title = page.name;

  // 見出し（目次）と注目（しおり）の切り替え
  const tools = document.createElement("div");
  tools.className = "page-tools";
  const tocBtn = button("見出し", "tool-btn is-toc", () => {
    page.toc = page.toc === null ? "" : null;
    render();
    if (page.toc !== null) els.grid.querySelector(`[data-id="${page.id}"] .toc-input`)?.focus();
  });
  tocBtn.setAttribute("aria-pressed", String(page.toc !== null));
  tocBtn.title = "目次に見出しを載せる";
  const markBtn = button("注目", "tool-btn is-mark", () => {
    page.marked = !page.marked;
    render();
  });
  markBtn.setAttribute("aria-pressed", String(page.marked));
  markBtn.title = "製本者のしおりを付ける";
  tools.append(tocBtn, markBtn);

  li.append(thumb, name, tools);

  if (page.toc !== null) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "toc-input";
    input.placeholder = "目次の見出し";
    input.value = page.toc;
    input.setAttribute("aria-label", `${index + 1}ページ目の見出し`);
    // 入力中は再描画しない（フォーカスが外れないように）.
    input.addEventListener("input", () => { page.toc = input.value; });
    li.append(input);
  }
  return li;
}

function button(text, className, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

// サムネイルが届いたら, そのページの要素だけ差し替える.
function updateThumb(page) {
  const li = els.grid.querySelector(`[data-id="${page.id}"]`);
  const index = pages.indexOf(page);
  if (!li || index < 0) return;
  // 見出しを入力中なら, フォーカスを奪わないよう差し替えを後回しにする.
  if (li.contains(document.activeElement)) {
    document.activeElement.addEventListener("blur", () => updateThumb(page), { once: true });
    return;
  }
  li.replaceWith(pageItem(page, index));
}

Sortable.create(els.grid, {
  animation: 150,
  delay: 150,
  delayOnTouchOnly: true,
  filter: "button, input",
  preventOnFilter: false,
  onEnd(event) {
    if (event.oldIndex === event.newIndex) return;
    const [moved] = pages.splice(event.oldIndex, 1);
    pages.splice(event.newIndex, 0, moved);
    sortState = { key: null, desc: false }; // 手で動かしたら, 並び替えの表示は解除
    render();
  },
});

// ---- 並び替え ----
// 同じボタンをもう一度押すと昇順・降順が入れ替わる.
// 同じPDFのページどうしは, どの並び替えでもページ順を保つ.

const SORTS = {
  name: (a, b) => compareNames(a.fileName, b.fileName),
  added: (a, b) => a.id - b.id,
  modified: (a, b) => a.lastModified - b.lastModified,
  size: (a, b) => a.size - b.size,
};

function inFileOrder(a, b) {
  return compareNames(a.fileName, b.fileName) || (a.pageNumber ?? 0) - (b.pageNumber ?? 0) || a.id - b.id;
}

for (const btn of els.sortButtons) {
  btn.addEventListener("click", () => {
    const key = btn.dataset.sort;
    sortState = { key, desc: sortState.key === key ? !sortState.desc : false };
    const sign = sortState.desc ? -1 : 1;
    pages.sort((a, b) => sign * SORTS[key](a, b) || inFileOrder(a, b));
    render();
  });
}

// ---- ファイルの追加 ----

async function addFiles(fileList) {
  const files = [...fileList];
  if (files.length === 0) return;
  showResult("読み込み中…");
  try {
    const { pages: added, skipped } = await filesToPages(files, updateThumb);
    pages.push(...added);
    sortState = { key: null, desc: false };
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
