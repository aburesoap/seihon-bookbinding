// QRコードの作成.
// 符号化は vendor/qrcode.min.js（qrcode-generator, グローバル変数 qrcode）に任せ,
// ここでは結果をSVGとcanvasに描く. 読む画面にも同じライブラリが埋め込まれる.

const MARGIN = 4; // 周囲の余白（モジュール数）. 読み取りやすさのため規格どおり4にする

function encode(text) {
  const qr = globalThis.qrcode(0, "M"); // 0 はデータ量に合わせて大きさを自動で選ぶ
  qr.addData(text, "Byte");
  qr.make();
  return qr;
}

// UTF-8 で符号化する（日本語を含むURLでも読み取れるように）.
if (globalThis.qrcode) {
  globalThis.qrcode.stringToBytes = globalThis.qrcode.stringToBytesFuncs["UTF-8"];
}

// 暗いモジュールを1つのpathにまとめたSVG文字列.
export function qrSvg(text) {
  const qr = encode(text);
  const count = qr.getModuleCount();
  const size = count + MARGIN * 2;
  let path = "";
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (qr.isDark(y, x)) path += `M${x + MARGIN} ${y + MARGIN}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`
    + `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

// 印刷にも使えるよう, 1モジュール scale px の大きめのcanvasに描く.
export function qrCanvas(text, scale = 16) {
  const qr = encode(text);
  const count = qr.getModuleCount();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = (count + MARGIN * 2) * scale;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (qr.isDark(y, x)) ctx.fillRect((x + MARGIN) * scale, (y + MARGIN) * scale, scale, scale);
    }
  }
  return canvas;
}

// http(s) のURLとして使えるかどうか.
export function isWebUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
