// Seihon 製本された本を読むためのスクリプト.
// 製本時にHTMLへそのまま埋め込まれる. 外部のファイルやライブラリには依存しない.
(function () {
  "use strict";

  var book = JSON.parse(document.getElementById("book-data").textContent);
  var rtl = book.direction === "rtl";

  // ---- 表示言語（製本したときの言語）----
  // 表記のきまり：ひとかたまりの文章の末尾にはピリオドを付けない.

  var MESSAGES = {
    ja: {
      toc: "目次・しおり",
      tocKey: "目次・しおり（T）",
      bookmark: "しおり",
      bookmarkAdd: "しおりを挟む（B）",
      bookmarkRemove: "しおりを外す（B）",
      layout: "見開き／単ページの切り替え",
      theme: "テーマの切り替え",
      "theme.auto": "テーマ：自動",
      "theme.light": "テーマ：ライト",
      "theme.dark": "テーマ：ダーク",
      fullscreen: "全画面表示",
      fullscreenKey: "全画面表示（F）",
      left: "左のページへ",
      right: "右のページへ",
      seek: "ページ移動",
      close: "閉じる",
      page: "{n}ページ",
      sectionToc: "目次",
      sectionMarks: "注目ページ",
      sectionMine: "あなたのしおり",
      mineEmpty: "しおりはありません. 上のしおりボタンで, 表示中のページに挟めます",
      mark: "注目",
      removeBookmark: "{n}ページのしおりを外す",
      locked: "この本はパスワードで保護されています",
      password: "パスワード",
      open: "開く",
      wrongPassword: "パスワードが違います",
    },
    en: {
      toc: "Contents and bookmarks",
      tocKey: "Contents and bookmarks (T)",
      bookmark: "Bookmark",
      bookmarkAdd: "Add a bookmark (B)",
      bookmarkRemove: "Remove the bookmark (B)",
      layout: "Switch between spread and single page",
      theme: "Switch theme",
      "theme.auto": "Theme: Auto",
      "theme.light": "Theme: Light",
      "theme.dark": "Theme: Dark",
      fullscreen: "Full screen",
      fullscreenKey: "Full screen (F)",
      left: "Page to the left",
      right: "Page to the right",
      seek: "Go to page",
      close: "Close",
      page: "Page {n}",
      sectionToc: "Contents",
      sectionMarks: "Marked pages",
      sectionMine: "Your bookmarks",
      mineEmpty: "No bookmarks yet. Use the bookmark button above to add one to the current page",
      mark: "Marked",
      removeBookmark: "Remove the bookmark on page {n}",
      locked: "This book is protected with a password",
      password: "Password",
      open: "Open",
      wrongPassword: "Wrong password",
    },
  };
  var lang = MESSAGES[book.lang] ? book.lang : "ja";
  document.documentElement.lang = lang;

  function t(key, n) {
    var text = MESSAGES[lang][key] || MESSAGES.ja[key] || key;
    return text.replace("{n}", n);
  }

  function translatePage() {
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    ["title", "aria-label", "placeholder"].forEach(function (attr) {
      var list = document.querySelectorAll("[data-i18n-" + attr + "]");
      for (var j = 0; j < list.length; j++) list[j].setAttribute(attr, t(list[j].getAttribute("data-i18n-" + attr)));
    });
  }

  var el = {
    book: document.getElementById("book"),
    stage: document.getElementById("stage"),
    slider: document.getElementById("slider"),
    label: document.getElementById("page-label"),
    left: document.getElementById("btn-left"),
    right: document.getElementById("btn-right"),
    toc: document.getElementById("btn-toc"),
    bookmark: document.getElementById("btn-bookmark"),
    layout: document.getElementById("btn-layout"),
    theme: document.getElementById("btn-theme"),
    fullscreen: document.getElementById("btn-fullscreen"),
    drawer: document.getElementById("drawer"),
    drawerBody: document.getElementById("drawer-body"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),
    drawerClose: document.getElementById("btn-drawer-close"),
    lock: document.getElementById("lock"),
    lockInput: document.getElementById("lock-input"),
    lockError: document.getElementById("lock-error"),
  };

  var pages = [];        // [{ src, w, h }]
  var toc = [];          // 製本者が付けた目次 [{ page, title }]
  var marks = [];        // 製本者が付けた「注目」のページ番号
  var bookmarks = [];    // 読み手が挟んだしおりのページ番号
  var groups = [];       // 一度に表示するページ番号のまとまり（見開きなら2つずつ）
  var current = 0;       // 表示中のまとまりの先頭のページ番号
  var userLayout = null; // 利用者が切り替えた表示方法（null なら本の設定どおり）

  // ---- 保存（使えない環境では, その場限りになる）----

  var storage = {
    get: function (key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch (e) { /* 何もしない */ }
    },
  };

  var BOOKMARK_KEY = "seihon:bookmarks:" + (book.id || book.title);
  var THEME_KEY = "seihon:reader-theme";

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

  function currentGroup() {
    return groups[groupIndexOf(current)] || [];
  }

  // ---- 描画 ----

  function relayout() {
    var spread = isSpread();
    groups = makeGroups(pages.length, spread);
    el.book.classList.toggle("is-spread", spread);
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
      img.alt = t("page", pageIndex + 1);
      img.draggable = false;
      page.appendChild(img);
      page.appendChild(ribbonsFor(pageIndex));
      spread.appendChild(page);
    });
    el.stage.replaceChildren(spread);

    updateControls(groupIndex);
    preload(groupIndex);
    saveLocation();
  }

  function ribbonsFor(pageIndex) {
    var box = document.createElement("div");
    box.className = "ribbons";
    if (marks.indexOf(pageIndex) >= 0) box.appendChild(ribbon("is-author", t("mark")));
    if (bookmarks.indexOf(pageIndex) >= 0) box.appendChild(ribbon("is-reader", t("bookmark")));
    return box;
  }

  function ribbon(kind, title) {
    var span = document.createElement("span");
    span.className = "ribbon " + kind;
    span.title = title;
    return span;
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

    var marked = group.some(function (i) { return bookmarks.indexOf(i) >= 0; });
    el.bookmark.setAttribute("aria-pressed", String(marked));
    el.bookmark.title = t(marked ? "bookmarkRemove" : "bookmarkAdd");

    if (!el.drawer.hidden) renderDrawer();
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

  function goToPage(pageIndex) {
    var g = groupIndexOf(pageIndex);
    var now = groupIndexOf(current);
    if (g === now) return;
    // 先へ進むときは, 読む向きに合わせてめくる.
    var forward = g > now;
    show(g, forward === rtl ? "left" : "right");
  }

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

  // ---- 読み手のしおり ----

  function loadBookmarks() {
    try {
      var list = JSON.parse(storage.get(BOOKMARK_KEY) || "[]");
      return list.filter(function (i) { return typeof i === "number" && i >= 0 && i < pages.length; });
    } catch (e) {
      return [];
    }
  }

  function saveBookmarks() {
    bookmarks.sort(function (a, b) { return a - b; });
    storage.set(BOOKMARK_KEY, bookmarks.length ? JSON.stringify(bookmarks) : null);
  }

  // 表示中のページにしおりがあれば外し, なければ先頭のページに挟む.
  function toggleBookmark() {
    var group = currentGroup();
    var has = group.filter(function (i) { return bookmarks.indexOf(i) >= 0; });
    if (has.length) {
      bookmarks = bookmarks.filter(function (i) { return has.indexOf(i) < 0; });
    } else {
      bookmarks.push(group[0]);
    }
    saveBookmarks();
    show(groupIndexOf(current), null);
  }

  // ---- 目次・しおり一覧 ----

  function openDrawer() {
    renderDrawer();
    el.drawer.hidden = false;
    el.drawerBackdrop.hidden = false;
    el.toc.setAttribute("aria-expanded", "true");
    el.drawerClose.focus();
  }

  function closeDrawer() {
    el.drawer.hidden = true;
    el.drawerBackdrop.hidden = true;
    el.toc.setAttribute("aria-expanded", "false");
  }

  function renderDrawer() {
    var group = currentGroup();
    var sections = [];

    if (toc.length) {
      // 今いる章（現在のページ以前で最後の見出し）を強調する.
      var currentEntry = null;
      toc.forEach(function (entry) { if (entry.page <= group[group.length - 1]) currentEntry = entry; });
      sections.push(section(t("sectionToc"), toc.map(function (entry) {
        return item(entry.title, entry.page, null, entry === currentEntry);
      })));
    }

    if (marks.length) {
      sections.push(section(t("sectionMarks"), marks.map(function (i) {
        return item(t("page", i + 1), i, "is-author", group.indexOf(i) >= 0);
      })));
    }

    var mine = bookmarks.map(function (i) {
      var row = item(t("page", i + 1), i, "is-reader", group.indexOf(i) >= 0);
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "drawer-remove";
      remove.textContent = "×";
      remove.title = t("removeBookmark", i + 1);
      remove.setAttribute("aria-label", t("removeBookmark", i + 1));
      remove.addEventListener("click", function () {
        bookmarks = bookmarks.filter(function (b) { return b !== i; });
        saveBookmarks();
        show(groupIndexOf(current), null);
        renderDrawer();
      });
      row.appendChild(remove);
      return row;
    });
    sections.push(section(t("sectionMine"), mine, t("mineEmpty")));

    el.drawerBody.replaceChildren.apply(el.drawerBody, sections);
  }

  function section(heading, items, emptyText) {
    var box = document.createElement("section");
    box.className = "drawer-section";
    var h = document.createElement("h2");
    h.textContent = heading;
    box.appendChild(h);
    if (items.length === 0 && emptyText) {
      var p = document.createElement("p");
      p.className = "drawer-empty";
      p.textContent = emptyText;
      box.appendChild(p);
    }
    items.forEach(function (node) { box.appendChild(node); });
    return box;
  }

  function item(text, pageIndex, dotKind, isCurrent) {
    var row = document.createElement("div");
    row.className = "drawer-item";
    var link = document.createElement("button");
    link.type = "button";
    link.className = "drawer-link" + (isCurrent ? " is-current" : "");
    if (dotKind) {
      var dot = document.createElement("span");
      dot.className = "dot " + dotKind;
      link.appendChild(dot);
    }
    var label = document.createElement("span");
    label.className = "label";
    label.textContent = text;
    link.appendChild(label);
    if (book.showPageNumber && !dotKind) {
      var no = document.createElement("span");
      no.className = "no";
      no.textContent = pageIndex + 1;
      link.appendChild(no);
    }
    link.addEventListener("click", function () {
      goToPage(pageIndex);
      // 狭い画面では, 移動したら一覧を閉じてページを見せる.
      if (window.innerWidth < 700) closeDrawer();
    });
    row.appendChild(link);
    return row;
  }

  // ---- テーマ（自動 → ライト → ダーク）----

  var THEMES = ["auto", "light", "dark"];

  function currentTheme() {
    return document.documentElement.dataset.theme || "auto";
  }

  function applyTheme(theme) {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    el.theme.title = t("theme." + theme);
    storage.set(THEME_KEY, theme === "auto" ? null : theme);
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

    el.toc.addEventListener("click", function () {
      el.drawer.hidden ? openDrawer() : closeDrawer();
    });
    el.drawerClose.addEventListener("click", closeDrawer);
    el.drawerBackdrop.addEventListener("click", closeDrawer);

    el.bookmark.addEventListener("click", toggleBookmark);

    el.layout.addEventListener("click", function () {
      userLayout = isSpread() ? "single" : "spread";
      relayout();
    });

    el.theme.addEventListener("click", function () {
      applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
    });

    if (document.fullscreenEnabled) {
      el.fullscreen.addEventListener("click", toggleFullscreen);
    } else {
      el.fullscreen.hidden = true;
    }

    document.addEventListener("keydown", function (event) {
      if (event.target instanceof HTMLInputElement && event.target.type !== "range") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      switch (event.key) {
        case "ArrowLeft": goLeft(); break;
        case "ArrowRight": goRight(); break;
        case "PageDown": case " ": goNext(); break;
        case "PageUp": goPrev(); break;
        case "Home": show(0, null); break;
        case "End": show(groups.length - 1, null); break;
        case "f": toggleFullscreen(); break;
        case "b": toggleBookmark(); break;
        case "t": el.drawer.hidden ? openDrawer() : closeDrawer(); break;
        case "Escape": closeDrawer(); break;
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
      decrypt(book.encrypted, el.lockInput.value).then(function (content) {
        el.lock.hidden = true;
        start(content);
      }, function () {
        el.lockError.textContent = t("wrongPassword");
        el.lockError.hidden = false;
        el.lockInput.select();
      });
    });
  }

  function decrypt(enc, password) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error("Web Crypto API is not available"));
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

  function start(content) {
    // 初期の形式（ページの配列だけ）にも対応しておく.
    if (Array.isArray(content)) content = { pages: content };
    pages = content.pages;
    toc = content.toc || [];
    marks = content.marks || [];
    bookmarks = loadBookmarks();
    current = loadLocation();
    bindControls();
    relayout();
  }

  translatePage();
  applyTheme(currentTheme());
  if (book.encrypted) unlock();
  else start(book.content || book.pages);
})();
