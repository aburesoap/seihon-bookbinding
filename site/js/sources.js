// 読み込んだファイル（画像・PDF）をページ単位のデータに変換する.
//
// ページは次の形のオブジェクトで扱う.
//   { id, kind: "image" | "pdf" | "blank", name, thumb, ... }
// 描画は renderPage() に任せ, 種類ごとの違いはこのファイルの中に閉じ込める.

const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const THUMB_EDGE = 240;

let nextId = 1;
let pdfjsPromise = null;

// pdf.js はPDFが追加されたときに初めて読み込む.
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isImage(file) {
  return file.type.startsWith("image/");
}

// ファイル名を「自然な順」（2.png が 10.png より前）で比べる.
export function compareNames(a, b) {
  return a.localeCompare(b, "ja", { numeric: true, sensitivity: "base" });
}

// ファイルの配列からページの配列を作る. サムネイルは onThumb で後から届く.
export async function filesToPages(files, onThumb) {
  const sorted = [...files].sort((a, b) => compareNames(a.name, b.name));
  const pages = [];
  const skipped = [];

  for (const file of sorted) {
    if (isPdf(file)) {
      pages.push(...(await pdfToPages(file)));
    } else if (isImage(file)) {
      pages.push({ id: nextId++, kind: "image", name: file.name, file, thumb: null });
    } else {
      skipped.push(file.name);
    }
  }

  // サムネイルは1枚ずつ順番に作り, できたものから表示する.
  (async () => {
    for (const page of pages) {
      try {
        page.thumb = await makeThumb(page);
      } catch (err) {
        console.warn("サムネイルを作成できませんでした", page.name, err);
      }
      onThumb?.(page);
    }
  })();

  return { pages, skipped };
}

async function pdfToPages(file) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    pages.push({
      id: nextId++,
      kind: "pdf",
      name: `${file.name} p.${i}`,
      sortKey: `${file.name}\u0000${String(i).padStart(6, "0")}`,
      doc,
      pageNumber: i,
      thumb: null,
    });
  }
  return pages;
}

export function createBlankPage() {
  return { id: nextId++, kind: "blank", name: "白紙", thumb: null };
}

// 並び替え用のキー. PDFのページはファイル名＋ページ番号で並ぶ.
export function sortKeyOf(page) {
  return page.sortKey ?? page.name;
}

async function makeThumb(page) {
  if (page.kind === "blank") return null;
  const canvas = await renderPage(page, THUMB_EDGE);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// ページを長辺 maxEdge px 以内で描画したcanvasを返す.
// blank の場合は fallbackSize（直前のページの大きさなど）を使う.
export async function renderPage(page, maxEdge, fallbackSize) {
  if (page.kind === "image") return renderImage(page.file, maxEdge);
  if (page.kind === "pdf") return renderPdfPage(page, maxEdge);
  return renderBlank(maxEdge, fallbackSize);
}

async function renderImage(file, maxEdge) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = whiteCanvas(bitmap.width * scale, bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

async function renderPdfPage(page, maxEdge) {
  const pdfPage = await page.doc.getPage(page.pageNumber);
  const base = pdfPage.getViewport({ scale: 1 });
  const viewport = pdfPage.getViewport({ scale: maxEdge / Math.max(base.width, base.height) });
  const canvas = whiteCanvas(viewport.width, viewport.height);
  await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas;
}

function renderBlank(maxEdge, size) {
  const w = size?.width ?? 1000;
  const h = size?.height ?? 1414;
  const scale = maxEdge / Math.max(w, h);
  return whiteCanvas(w * scale, h * scale);
}

// 透過部分が黒くならないよう, 白で塗ったcanvasを用意する.
function whiteCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
