/* ===================================================================
   Yerevan Project; THE RIBBON
   -------------------------------------------------------------------
   Seventeen interactive things used to float over this map, eight of
   them in one flat row above it, and the row had a worse problem than
   its length: six different KINDS of control sat in it looking
   identical. Districts switched something on and left it on. Reset
   view fired once and forgot. Draw put the map into a mode where every
   later click meant something else. About left the map altogether.
   Nothing in their appearance said which was which, so the row had to
   be learned rather than read.

   So the row is now two words, Map and Tools, and everything that used
   to be a button is a row inside one of them, where a toggle can look
   like a toggle and a choice can look like a choice.

   THE ONE THING A MENU COSTS, AND HOW IT IS PAID BACK.
   Folding controls into menus hides the state. On an ordinary web page
   that is fine. On a research map it is not: whether you are seeing
   the figure ground or a photograph, whether the districts are drawn,
   whether the pins are on, all change what the picture MEANS, and a
   reader who cannot see those settings cannot read the map honestly.
   So under the two words there is one quiet line of small type that
   says, in words, what is currently true. It never needs opening, and
   it doubles as a caption for a screenshot.

   HOW IT IS WIRED, and why it is wired the cowardly way.
   Every original control is still in the document, still carrying its
   own listeners from app.js, terrain.js, rail.js and draw.js. This
   file does not rewire any of them. It hides the old row on a desktop
   and drives it by proxy: a menu row clicks the real button and reads
   its state back from the aria-pressed attribute that button already
   maintains. Nothing here can break the map, because nothing here
   knows how the map works.

   On a phone the old row is not hidden at all. mobile.js moves it into
   the settings sheet, where it is already a decent list, and a menu
   inside a sheet would be a menu inside a sheet. The ribbon simply
   stands down.
   =================================================================== */

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  /* Six words in three languages, which is not enough to be worth a trip
     through i18n.js and the churn that would cost every other string. */
  var S = {
    en: { map: "Map", tools: "Tools", basemap: "Basemap", layers: "Layers",
          instruments: "Instruments", timeline: "Timeline", about: "About",
          terrain: "Terrain in 3D", districts: "Districts", pins: "Event pins",
          draw: "Draw on the map", reset: "Reset the view",
          vertical: "Vertical rail", horizontal: "Horizontal",
          on: "on", off: "off", noTool: "no tool", drawing: "drawing",
          d3: "3D", pinsShort: "pins", distShort: "districts" },
    hy: { map: "Քարտեզ", tools: "Գործիքներ", basemap: "Հենաքարտեզ", layers: "Շերտեր",
          instruments: "Գործիքներ", timeline: "Ժամանակագիծ", about: "Մասին",
          terrain: "Ռելիեֆը 3D-ով", districts: "Թաղամասեր", pins: "Իրադարձությունների կետեր",
          draw: "Գծել քարտեզին", reset: "Վերականգնել տեսքը",
          vertical: "Ուղղահայաց", horizontal: "Հորիզոնական",
          on: "միացված", off: "անջատված", noTool: "գործիք չկա", drawing: "գծում",
          d3: "3D", pinsShort: "կետեր", distShort: "թաղամասեր" },
    fa: { map: "نقشه", tools: "ابزارها", basemap: "نقشهٔ پایه", layers: "لایه‌ها",
          instruments: "ابزارها", timeline: "خط زمان", about: "درباره",
          terrain: "ناهمواری سه‌بعدی", districts: "نواحی", pins: "پین رویدادها",
          draw: "روی نقشه بکشید", reset: "بازنشاندن نما",
          vertical: "ریل عمودی", horizontal: "افقی",
          on: "روشن", off: "خاموش", noTool: "بدون ابزار", drawing: "در حال کشیدن",
          d3: "سه‌بعدی", pinsShort: "پین‌ها", distShort: "نواحی" }
  };

  function lang() {
    var c = (window.I18N && window.I18N.lang) || "en";
    return S[c] ? c : "en";
  }
  function s(k) { return S[lang()][k] || S.en[k] || k; }

  var openMenu = null, built = false;

  /* ---------------- reading the old controls ---------------- */

  function pressed(id) {
    var b = $(id);
    if (!b) return false;
    return b.getAttribute("aria-pressed") === "true" || b.classList.contains("on");
  }
  function proxy(id) {
    var b = $(id);
    if (b) b.click();
  }
  function basemapNow() {
    var sel = $("basemap-select");
    if (!sel || !sel.options.length) return "";
    var o = sel.options[sel.selectedIndex];
    return o ? o.textContent : "";
  }
  function verticalNow() {
    /* rail.js writes aria-pressed on its own switch: true while the vertical
       rail is the arrangement in use. */
    return pressed("tl-mode");
  }

  /* ---------------- the menus ---------------- */

  function row(label, kind, isOn, act) {
    var r = document.createElement("button");
    r.type = "button";
    r.className = "rb-row" + (isOn ? " on" : "");
    r.innerHTML = '<span>' + label + '</span>' +
      (kind === "switch" ? '<i class="rb-sw" aria-hidden="true"></i>'
       : kind === "radio" ? '<i class="rb-tick" aria-hidden="true"></i>' : '');
    r.setAttribute("role", kind === "switch" ? "switch" : kind === "radio" ? "menuitemradio" : "menuitem");
    r.setAttribute("aria-checked", isOn ? "true" : "false");
    r.addEventListener("click", function (e) {
      e.stopPropagation();
      act();
      /* The old control has just been clicked; let its own handler finish
         before the menu reads the state back. */
      setTimeout(function () { render(); }, 0);
    });
    return r;
  }

  function head(text) {
    var h = document.createElement("div");
    h.className = "rb-head";
    h.textContent = text;
    return h;
  }
  function sep() {
    var d = document.createElement("div");
    d.className = "rb-sep";
    return d;
  }

  function fillMap(box) {
    box.innerHTML = "";
    var sel = $("basemap-select");
    if (sel && sel.options.length) {
      box.appendChild(head(s("basemap")));
      Array.prototype.forEach.call(sel.options, function (o) {
        box.appendChild(row(o.textContent, "radio", o.value === sel.value, function () {
          sel.value = o.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }));
      });
      box.appendChild(sep());
    }
    box.appendChild(head(s("layers")));
    box.appendChild(row(s("districts"), "switch", pressed("districts-btn"), function () { proxy("districts-btn"); }));
    box.appendChild(row(s("pins"), "switch", pressed("pins-btn"), function () { proxy("pins-btn"); }));
    box.appendChild(row(s("terrain"), "switch", pressed("terrain-btn"), function () { proxy("terrain-btn"); }));
  }

  function fillTools(box) {
    box.innerHTML = "";
    box.appendChild(head(s("instruments")));
    if ($("draw-btn")) {
      box.appendChild(row(s("draw"), "switch", pressed("draw-btn"), function () { proxy("draw-btn"); }));
    }
    if ($("tl-mode")) {
      box.appendChild(sep());
      box.appendChild(head(s("timeline")));
      var v = verticalNow();
      box.appendChild(row(s("vertical"), "radio", v, function () { if (!verticalNow()) proxy("tl-mode"); }));
      box.appendChild(row(s("horizontal"), "radio", !v, function () { if (verticalNow()) proxy("tl-mode"); }));
    }
    box.appendChild(sep());
    box.appendChild(row(s("reset"), "action", false, function () { proxy("reset-btn"); close(); }));
  }

  /* ---------------- the state line ---------------- */

  function setHTML(el, html) {
    if (!el || el.innerHTML === html) return;
    el.innerHTML = html;
  }

  function stateLine() {
    var bits = [];
    var bm = basemapNow();
    if (bm) bits.push('<b>' + esc(bm) + '</b>');
    bits.push(dim(s("d3") + " " + (pressed("terrain-btn") ? s("on") : s("off")), pressed("terrain-btn")));
    bits.push(dim(s("distShort") + " " + (pressed("districts-btn") ? s("on") : s("off")), pressed("districts-btn")));
    bits.push(dim(s("pinsShort") + " " + (pressed("pins-btn") ? s("on") : s("off")), pressed("pins-btn")));
    bits.push(dim(pressed("draw-btn") ? s("drawing") : s("noTool"), pressed("draw-btn")));
    return bits.join('<span class="rb-dot">·</span>');
  }
  function dim(text, isOn) {
    return '<span class="' + (isOn ? "" : "rb-off") + '">' + esc(text) + '</span>';
  }
  function esc(x) {
    return String(x == null ? "" : x)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------- assembly ---------------- */

  function close() {
    if (!openMenu) return;
    openMenu.classList.remove("open");
    var t = $(openMenu.id === "rb-map-menu" ? "rb-map" : "rb-tools");
    if (t) t.setAttribute("aria-expanded", "false");
    openMenu = null;
  }

  function toggle(which) {
    var box = $(which === "map" ? "rb-map-menu" : "rb-tools-menu");
    var btn = $(which === "map" ? "rb-map" : "rb-tools");
    if (!box) return;
    var wasOpen = (openMenu === box);
    close();
    if (wasOpen) return;
    (which === "map" ? fillMap : fillTools)(box);
    box.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    openMenu = box;
  }

  function render() {
    dressPhone();
    setHTML($("rb-state"), stateLine());
    var m = $("rb-map"), t = $("rb-tools"), a = $("rb-about");
    if (m) m.firstChild.nodeValue = s("map") + " ";
    if (t) t.firstChild.nodeValue = s("tools") + " ";
    if (a) a.textContent = s("about");
    if (openMenu) (openMenu.id === "rb-map-menu" ? fillMap : fillTools)(openMenu);
  }

  function build() {
    if (built) return;
    var wrap = $("map-wrap"), old = $("map-controls");
    if (!wrap || !old) return;
    /* On a phone mobile.js has already moved the old row out of the map and
       into the settings sheet, where it is a decent list and where a menu
       would be a menu inside a sheet. Nothing to build. */
    if (document.body.classList.contains("is-phone")) return;
    built = true;

    var rb = document.createElement("div");
    rb.id = "ribbon";
    rb.innerHTML =
      '<div class="rb-row-top">' +
        '<span class="rb-host">' +
          '<button id="rb-map" class="rb-btn" type="button" aria-haspopup="true" aria-expanded="false">Map <i class="rb-caret">&#9662;</i></button>' +
          '<div id="rb-map-menu" class="rb-menu" role="menu"></div>' +
        '</span>' +
        '<span class="rb-host">' +
          '<button id="rb-tools" class="rb-btn" type="button" aria-haspopup="true" aria-expanded="false">Tools <i class="rb-caret">&#9662;</i></button>' +
          '<div id="rb-tools-menu" class="rb-menu" role="menu"></div>' +
        '</span>' +
        '<button id="rb-about" class="rb-btn rb-ghost" type="button">About</button>' +
      '</div>' +
      '<div id="rb-state" class="rb-state" aria-live="off"></div>';
    /* Appended, not inserted before the old row: on a phone that row is not
       a child of the map at all, and insertBefore would throw. */
    wrap.appendChild(rb);

    $("rb-map").addEventListener("click", function (e) { e.stopPropagation(); toggle("map"); });
    $("rb-tools").addEventListener("click", function (e) { e.stopPropagation(); toggle("tools"); });
    $("rb-about").addEventListener("click", function (e) { e.stopPropagation(); proxy("about-btn"); });

    document.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    /* The old buttons keep their own state on themselves, so watching the
       attribute they already write is enough to keep the line true no matter
       who changed it: this menu, a keyboard, or the map's own watchdog
       turning terrain off. */
    var obs = new MutationObserver(function () { render(); });
    ["terrain-btn", "districts-btn", "pins-btn", "draw-btn", "tl-mode", "basemap-select"].forEach(function (id) {
      var el = $(id);
      if (el) obs.observe(el, { attributes: true, attributeFilter: ["aria-pressed", "class", "value"] });
    });
    var sel = $("basemap-select");
    if (sel) sel.addEventListener("change", render);

    if (window.I18N && window.I18N.onChange) window.I18N.onChange(render);
    document.body.classList.add("has-ribbon");
    render();
  }

  /* ---------------- the same order, on a phone ----------------
     mobile.js moves the old row bodily into the settings sheet, and left to
     itself it arrives as eight identical pills in the order they happened to
     be written: exactly the fault the ribbon was built to cure, surviving on
     the one screen where space is scarcest.

     The ribbon does not build here, so this does the next best thing and
     dresses what is already there. The buttons are not replaced, rewired or
     copied. They are put in the same three groups the desktop menus use, the
     same headings are inserted above them, and the state line is prepended so
     a phone reader can see what is on without opening anything either. */

  var dressed = false, dressing = false;

  function dressPhone() {
    /* Re-entrancy is not a theoretical worry here: this runs from a
       MutationObserver on the sheet and its whole job is to mutate the sheet,
       so without a guard it calls itself until the tab stops answering. It
       also returns early once the order is already right, which makes the
       observer cost nothing on every later change. */
    if (dressing) return;
    var sheet = $("m-sheet"), ctl = $("map-controls");
    if (!sheet || !ctl || !sheet.contains(ctl)) return;

    if (!dressed) {
      dressed = true;
      ctl.classList.add("rb-phone");

      var line = document.createElement("div");
      line.id = "rb-state-m";
      line.className = "rb-state rb-state-phone";
      ctl.parentNode.insertBefore(line, ctl);
    }

    /* Rebuilt from scratch each time, because the order is the whole point and
       a late arrival (draw.js is late) must land in its group rather than at
       the end. Moving a node inside its own parent keeps every listener. */
    var groups = [
      ["basemap", ["basemap-select"]],
      ["layers",  ["districts-btn", "pins-btn", "terrain-btn"]],
      ["instruments", ["draw-btn", "tl-mode", "reset-btn"]],
      ["",        ["about-btn"]]
    ];
    /* What the sheet should read like, top to bottom, as a single string. If
       it already reads like that, there is nothing to do. */
    var want = [];
    groups.forEach(function (g) {
      var got = g[1].filter(function (id) { return $(id); });
      if (!got.length) return;
      if (g[0]) want.push("h:" + s(g[0]));
      got.forEach(function (id) { want.push(id); });
    });
    var have = Array.prototype.map.call(ctl.children, function (el) {
      return el.classList.contains("rb-mhead") ? "h:" + el.textContent : el.id;
    });
    if (have.join(">") === want.join(">")) {
      setHTML($("rb-state-m"), stateLine());
      return;
    }

    dressing = true;
    Array.prototype.slice.call(ctl.querySelectorAll(".rb-mhead")).forEach(function (h) { h.remove(); });
    groups.forEach(function (g) {
      var present = g[1].filter(function (id) { return $(id); });
      if (!present.length) return;
      if (g[0]) {
        var h = document.createElement("div");
        h.className = "rb-head rb-mhead";
        h.textContent = s(g[0]);
        ctl.appendChild(h);
      }
      present.forEach(function (id) { ctl.appendChild($(id)); });
    });

    setHTML($("rb-state-m"), stateLine());
    setTimeout(function () { dressing = false; }, 0);
  }

  /* draw.js and rail.js insert their buttons after this file runs, so the
     first build waits for them, and a bounded retry keeps the menus honest
     if either one is late. */
  var tries = 0;
  var timer = setInterval(function () {
    if ($("map-controls") && $("map-wrap")) {
      build();
      render();
      /* On a phone the sheet is built lazily by mobile.js, so the loop keeps
         going until the old row has actually arrived in it. */
      var phoneReady = !document.body.classList.contains("is-phone") ||
                       ($("m-sheet") && $("m-sheet").contains($("map-controls")));
      if ($("draw-btn") && $("tl-mode") && phoneReady) { clearInterval(timer); return; }
    }
    if (++tries > 40) clearInterval(timer);
  }, 250);

  /* The sheet is created and filled when it is first opened, and its contents
     can be moved again when the phone rotates, so the dressing is re-applied
     on any change to the sheet rather than once. */
  var sheetObs = null;
  function watchSheet() {
    var sheet = $("m-sheet");
    if (!sheet || sheetObs) return;
    sheetObs = new MutationObserver(function () { dressPhone(); });
    sheetObs.observe(sheet, { childList: true, subtree: true });
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("#m-controls-btn")) {
      setTimeout(function () { watchSheet(); dressPhone(); render(); }, 60);
    }
  }, true);

  window.RIBBON = { render: render, close: close, dressPhone: dressPhone };
})();
