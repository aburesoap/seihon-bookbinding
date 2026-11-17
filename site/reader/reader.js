// Seihon 製本された本を読むためのスクリプト.
// 製本時にHTMLへそのまま埋め込まれる. 外部のファイルやライブラリには依存しない.
(function () {
  "use strict";

  var book = JSON.parse(document.getElementById("book-data").textContent);
  var rtl = book.direction === "rtl";

  var el = {
    book: document.getElementById("book"),
    stage: document.getElementById("stage"),
    slider: document.getElementById("slider"),
    label: document.getElementById("page-label"),
    left: document.getElementById("btn-left"),
    right: document.getElementById("btn-right"),
    layout: document.getElementById("btn-layout"),
    fullscreen: document.getElementById("btn-fullscreen"),
    lock: document.getElementById("lock"),
    lockInput: document.getElementById("lock-input"),
    lockError: document.getElementById("lock-error"),
  };

  var pages = [];        // [{ src, w, h }]
  var groups = [];       // 一度に表示するページ番号のまとまり（見開きなら2つずつ）
  var current = 0;       // 表示中のまとまりの先頭のページ番号
  var userLayout = null; // 利用者が切り替えた表示方法（null なら本の設定どおり）

  // ---- 表示方法の決定 ----

  function isSpread() {
    var layout = userLayout || book.layout;
    if (layout === "spread") return true;
    if (layout === "single") return false;
    // auto：横長で十分な幅があるときだけ見開き
    return window.innerWidth > window.innerHeight && window.innerWidth >= 700;
  }

  function makeGroups(count, spread) {
    var result = [];
    var i = 0;
    if (spread && book.coverSingle && count > 0) {
      result.push([0]);
      i = 1;
    }
    for (; i < count; i += spread ? 2 : 1) {
      result.push(spread && i + 1 < count ? [i, i + 1] : [i]);
    }
    return result;
  }

  function groupIndexOf(pageIndex) {
    for (var g = 0; g < groups.length; g++) {
      if (groups[g].indexOf(pageIndex) >= 0) return g;
    }
    return 0;
  }

  // ---- 描画 ----

  function relayout() {
    var spread = isSpread();
    groups = makeGroups(pages.length, spread);
    el.layout.textContent = spread ? "単ページ" : "見開き";
    el.slider.max = Math.max(0, groups.length - 1);
    show(groupIndexOf(current), null);
  }

  // from は "left" / "right" / null（めくる向きのアニメーション）
  function show(groupIndex, from) {
    groupIndex = Math.max(0, Math.min(groups.length - 1, groupIndex));
    var group = groups[groupIndex];
    if (!group) return;
    current = group[0];

    // 右綴じでは読む順と画面上の並びが逆になる.
    var visual = rtl ? group.slice().reverse() : group.slice();
    var size = fitSizes(visual.map(function (i) { return pages[i]; }));

    var spread = document.createElement("div");
    spread.className = "spread" + (from ? " from-" + from : "");
    visual.forEach(function (pageIndex, i) {
      var page = document.createElement("div");
      page.className = "page " + (visual.length === 1 ? "is-alone" : i === 0 ? "is-left" : "is-right");
      page.style.width = size[i].w + "px";
      page.style.height = size[i].h + "px";
      var img = document.createElement("img");
      img.src = pages[pageIndex].src;
      img.alt = (pageIndex + 1) + "ページ";
      img.draggable = false;
      page.appendChild(img);
      spread.appendChild(page);
    });
    el.stage.replaceChildren(spread);

    updateControls(groupIndex);
    preload(groupIndex);
    saveLocation();
  }

  // まとまり内のページの高さをそろえ, ステージに収まる大きさを計算する.
  function fitSizes(list) {
    var style = getComputedStyle(el.stage);
    var availW = el.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    var availH = el.stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    var totalW = list.reduce(function (sum, p) { return sum + p.w * availH / p.h; }, 0);
    var scale = Math.min(1, availW / totalW);
    var h = Math.floor(availH * scale);
    return list.map(function (p) { return { w: Math.floor(p.w * h / p.h), h: h }; });
  }

  function updateControls(groupIndex) {
    var group = groups[groupIndex];
    var first = group[0] + 1;
    var last = group[group.length - 1] + 1;
    el.label.textContent = (first === last ? first : first + "–" + last) + " / " + pages.length;
    el.slider.value = groupIndex;

    var atStart = groupIndex === 0;
    var atEnd = groupIndex === groups.length - 1;
    el.left.disabled = rtl ? atEnd : atStart;
    el.right.disabled = rtl ? atStart : atEnd;
  }

  function preload(groupIndex) {
    [groupIndex - 1, groupIndex + 1, groupIndex + 2].forEach(function (g) {
      (groups[g] || []).forEach(function (i) {
        var img = new Image();
        img.src = pages[i].src;
      });
    });
  }

  // ---- 移動 ----

  function step(delta, from) {
    var g = groupIndexOf(current) + delta;
    if (g < 0 || g >= groups.length) return;
    show(g, from);
  }

  function goLeft() { step(rtl ? 1 : -1, "left"); }
  function goRight() { step(rtl ? -1 : 1, "right"); }
  function goNext() { rtl ? goLeft() : goRight(); }
  function goPrev() { rtl ? goRight() : goLeft(); }

  // URLの #p=番号 で開いているページを覚えておく（再読み込みや共有のため）.
  function saveLocation() {
    try {
      history.replaceState(null, "", "#p=" + (current + 1));
    } catch (e) { /* file:// などで使えない環境では何もしない */ }
  }

  function loadLocation() {
    var match = /p=(\d+)/.exec(location.hash);
    return match ? Math.max(0, Math.min(pages.length - 1, Number(match[1]) - 1)) : 0;
  }

  // ---- 操作 ----

  function bindControls() {
    el.left.addEventListener("click", goLeft);
    el.right.addEventListener("click", goRight);

    el.slider.style.direction = rtl ? "rtl" : "ltr";
    el.slider.addEventListener("input", function () {
      show(Number(el.slider.value), null);
    });

    el.label.hidden = !book.showPageNumber;

    el.layout.addEventListener("click", function () {
      userLayout = isSpread() ? "single" : "spread";
      relayout();
    });

    if (document.fullscreenEnabled) {
      el.fullscreen.textContent = "全画面";
      el.fullscreen.addEventListener("click", toggleFullscreen);
    } else {
      el.fullscreen.hidden = true;
    }

    document.addEventListener("keydown", function (event) {
      if (event.target instanceof HTMLInputElement && event.target.type !== "range") return;
      switch (event.key) {
        case "ArrowLeft": goLeft(); break;
        case "ArrowRight": goRight(); break;
        case "PageDown": case " ": goNext(); break;
        case "PageUp": goPrev(); break;
        case "Home": show(0, null); break;
        case "End": show(groups.length - 1, null); break;
        case "f": toggleFullscreen(); break;
        default: return;
      }
      event.preventDefault();
    });

    bindPointer();

    var timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(relayout, 100);
    });
  }

  // 画面の左右をタップでページ送り, 中央で上下のバーを隠す. スワイプにも対応する.
  function bindPointer() {
    var start = null;

    el.stage.addEventListener("pointerdown", function (event) {
      start = { x: event.clientX, y: event.clientY, t: Date.now() };
    });

    el.stage.addEventListener("pointerup", function (event) {
      if (!start) return;
      var dx = event.clientX - start.x;
      var dy = event.clientY - start.y;
      var quick = Date.now() - start.t < 600;
      start = null;

      // ピンチで拡大しているときは, ページ送りをしない.
      if (window.visualViewport && window.visualViewport.scale > 1.05) return;

      if (quick && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        dx < 0 ? goRight() : goLeft();
        return;
      }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        var ratio = event.clientX / window.innerWidth;
        if (ratio < 0.3) goLeft();
        else if (ratio > 0.7) goRight();
        else el.book.classList.toggle("is-immersive");
      }
    });

    el.stage.addEventListener("pointercancel", function () { start = null; });
  }

  function toggleFullscreen() {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  // ---- パスワード ----

  function unlock() {
    el.lock.hidden = false;
    el.lockInput.focus();
    el.lock.addEventListener("submit", function (event) {
      event.preventDefault();
      el.lockError.hidden = true;
      decrypt(book.encrypted, el.lockInput.value).then(function (list) {
        el.lock.hidden = true;
        start(list);
      }, function () {
        el.lockError.textContent = "パスワードが違います. ";
        el.lockError.hidden = false;
        el.lockInput.select();
      });
    });
  }

  function decrypt(enc, password) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error("このブラウザでは復号できません"));
    var encoder = new TextEncoder();
    return subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (material) {
        return subtle.deriveKey(
          { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(enc.salt), iterations: enc.iterations },
          material,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
      })
      .then(function (key) {
        return subtle.decrypt({ name: "AES-GCM", iv: fromBase64(enc.iv) }, key, fromBase64(enc.data));
      })
      .then(function (plain) {
        return JSON.parse(new TextDecoder().decode(plain));
      });
  }

  function fromBase64(text) {
    var binary = atob(text);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ---- 開始 ----

  function start(list) {
    pages = list;
    current = loadLocation();
    bindControls();
    relayout();
  }

  if (book.encrypted) unlock();
  else start(book.pages);
})();
