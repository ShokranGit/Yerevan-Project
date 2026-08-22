/* ===================================================================
   Yerevan Project; THE PHONE
   -------------------------------------------------------------------
   The desktop layout is a fixed sidebar beside a map. Poured into a
   390 px screen it became a 48% tall panel that could not be collapsed,
   above a map 126 px high that was itself covered by a 269 px timeline
   card and two 96 px thumbnails. There was no gesture that produced a
   usable map, so on a phone this was a list with a decorative strip.

   The phone gets a different arrangement of the same parts, and this
   file owns it. Nothing here is a second copy of anything: the panel,
   the timeline, the controls and the two viewers are MOVED, so every
   listener app.js attached still works and the two layouts never drift.

     THE MAP is the whole screen.
     THE PANEL is a sheet over it with three heights: peek, half, full.
       Drag the grip, or tap it. Opening an entry raises it to full;
       the map button drops it to peek so the reader can see what was
       just drawn.
     THE TIMELINE is a bar docked above the sheet, collapsed to its
       window and its period bands, expanding to the rail and the spur.
     THE MAP CONTROLS leave the map. Basemap, terrain, figure-ground,
       the coordinate readout and the two 3D viewers move into their
       own sheet behind one button, so nothing floats over the drawing.

   Everything is undone cleanly if the window grows back past the
   breakpoint, because a phone in landscape is a small desktop.
   =================================================================== */

(function () {
  "use strict";

  var MQ = window.matchMedia("(max-width: 860px)");
  var on = false, home = {};

  function $(id) { return document.getElementById(id); }

  /* ---------------- the sheet ---------------- */

  var PEEK = 0, HALF = 1, FULL = 2;
  var snap = PEEK;

  function heights() {
    var h = window.innerHeight;
    return [148, Math.round(h * 0.55), Math.round(h * 0.92)];
  }

  function setSnap(i, animate) {
    snap = Math.max(0, Math.min(2, i));
    var app = $("app"), hs = heights();
    if (animate !== false) app.classList.add("m-anim");
    app.style.setProperty("--sheet-h", hs[snap] + "px");
    app.classList.toggle("m-peek", snap === PEEK);
    app.classList.toggle("m-full", snap === FULL);
    if (animate !== false) setTimeout(function () { app.classList.remove("m-anim"); }, 320);
    var p = $("panel");
    if (p) p.setAttribute("aria-expanded", snap === PEEK ? "false" : "true");
    /* The sheet just took height off the timeline; if a period's own timeline
       is open in there, keep it in the part that is still visible. */
    if (typeof revealSpur === "function") revealSpur();
  }

  function wireDrag(grip) {
    var startY = 0, startH = 0, dragging = false, moved = 0;

    function down(e) {
      dragging = true; moved = 0;
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      startH = $("panel").getBoundingClientRect().height;
      $("app").classList.remove("m-anim");
      document.addEventListener("touchmove", move, { passive: false });
      document.addEventListener("mousemove", move);
      document.addEventListener("touchend", up);
      document.addEventListener("mouseup", up);
    }
    function move(e) {
      if (!dragging) return;
      var y = (e.touches ? e.touches[0].clientY : e.clientY);
      var d = startY - y;
      moved = Math.abs(d);
      var h = Math.max(70, Math.min(window.innerHeight * 0.94, startH + d));
      $("app").style.setProperty("--sheet-h", Math.round(h) + "px");
      if (e.cancelable) e.preventDefault();
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener("touchmove", move);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("touchend", up);
      document.removeEventListener("mouseup", up);
      /* A tap, not a drag: step up, and wrap round at the top. */
      if (moved < 8) { setSnap(snap === FULL ? PEEK : snap + 1); return; }
      /* Otherwise settle on whichever stop is nearest. */
      var h = $("panel").getBoundingClientRect().height, hs = heights(), best = 0;
      for (var i = 1; i < hs.length; i++) {
        if (Math.abs(hs[i] - h) < Math.abs(hs[best] - h)) best = i;
      }
      setSnap(best);
    }
    grip.addEventListener("touchstart", down, { passive: true });
    grip.addEventListener("mousedown", down);
  }

  /* ---------------- build ---------------- */

  function build() {
    if (on) return;
    on = true;
    var app = $("app"), panel = $("panel");

    /* the grip */
    var grip = document.createElement("button");
    grip.id = "m-grip";
    grip.type = "button";
    grip.setAttribute("aria-label", label("m.sheet"));
    grip.innerHTML = "<i></i>";
    panel.insertBefore(grip, panel.firstChild);
    wireDrag(grip);

    /* the controls sheet, and the button that opens it */
    var btn = document.createElement("button");
    btn.id = "m-controls-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", label("m.controls"));
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"' +
      ' stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/>' +
      '<path d="M3 13l9 5 9-5"/></svg>';
    app.appendChild(btn);

    var sheet = document.createElement("div");
    sheet.id = "m-sheet";
    sheet.hidden = true;
    sheet.innerHTML = '<div class="m-sheet-head"><b></b>' +
      '<button type="button" class="m-close" aria-label="' + label("media.close") + '">&times;</button></div>' +
      '<div class="m-sheet-body"></div>';
    app.appendChild(sheet);
    sheet.querySelector("b").textContent = label("m.controls");
    sheet.querySelector(".m-close").addEventListener("click", function () { sheet.hidden = true; });
    btn.addEventListener("click", function () { sheet.hidden = !sheet.hidden; });

    /* move, never copy: the listeners app.js attached come with the nodes */
    var body = sheet.querySelector(".m-sheet-body");
    ["map-controls", "g3-thumb", "p3-thumb", "coords"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      home[id] = { parent: el.parentNode, next: el.nextSibling };
      body.appendChild(el);
    });

    /* the timeline: collapsed to its window, expanded on request */
    var tl = $("timeline");
    if (tl && !$("m-tl-toggle")) {
      var t = document.createElement("button");
      t.id = "m-tl-toggle";
      t.type = "button";
      t.setAttribute("aria-label", label("m.timeline"));
      t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>';
      t.addEventListener("click", function () {
        app.classList.toggle("m-tl-open");
        var open = app.classList.contains("m-tl-open");
        t.classList.toggle("open", open);
        /* The period chips are laid out from measured widths, and a clipped
           rail measures nothing. Ask the app to lay them out again now that
           the rail has a width. */
        if (open && window.__rebuildTimeline) {
          requestAnimationFrame(function () { window.__rebuildTimeline(); });
        }
      });
      tl.appendChild(t);
    }

    /* a way back to the map from a full sheet */
    var back = document.createElement("button");
    back.id = "m-map-btn";
    back.type = "button";
    back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"' +
      ' stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/>' +
      '<path d="M9 4v13M15 6.5v13"/></svg><span>' + label("m.map") + "</span>";
    back.addEventListener("click", function () { setSnap(PEEK); });
    panel.appendChild(back);

    document.body.classList.add("is-phone");
    setSnap(PEEK, false);
    window.addEventListener("resize", onResize);
  }

  function teardown() {
    if (!on) return;
    on = false;
    ["map-controls", "g3-thumb", "p3-thumb", "coords"].forEach(function (id) {
      var el = $(id), h = home[id];
      if (el && h && h.parent) h.parent.insertBefore(el, h.next);
    });
    ["m-grip", "m-controls-btn", "m-sheet", "m-map-btn", "m-tl-toggle"].forEach(function (id) {
      var el = $(id); if (el) el.remove();
    });
    var app = $("app");
    app.style.removeProperty("--sheet-h");
    app.classList.remove("m-peek", "m-full", "m-tl-open", "m-anim");
    document.body.classList.remove("is-phone");
    window.removeEventListener("resize", onResize);
  }

  var rz = 0;
  function onResize() {
    clearTimeout(rz);
    rz = setTimeout(function () { if (on) setSnap(snap, false); }, 150);
  }

  function label(k) {
    return window.I18N ? window.I18N.t(k) : k;
  }

  /* ---------------- reacting to the app ---------------- */

  /* Opening an entry raises the sheet; closing it drops back to peek so the
     map, which is the point, is the thing left on screen. */
  function watchDetail() {
    var dv = $("detail-view");
    if (!dv) return;
    new MutationObserver(function () {
      if (!on) return;
      /* If the reader came from the timeline, leave the timeline reachable:
         the half sheet keeps both the rail and the entry on the screen. */
      if (!dv.hidden && snap === PEEK) {
        setSnap($("app").classList.contains("m-tl-open") ? HALF : FULL);
      }
      else if (dv.hidden && snap === FULL) setSnap(HALF);
    }).observe(dv, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* A period's own timeline opens inside the timeline bar, below the rail,
     which on a phone means below the fold of a bar that is already clipped.
     Bring it into view when it appears. */
  function revealSpur() {
    var sp = $("tl-spur"), tl = $("timeline"), app = $("app");
    if (!on || !sp || !tl || sp.hidden || !app.classList.contains("m-tl-open")) return;
    requestAnimationFrame(function () {
      tl.scrollTop = Math.max(0, sp.offsetTop - 8);
    });
  }

  function watchSpur() {
    var sp = $("tl-spur");
    if (!sp) return;
    new MutationObserver(revealSpur).observe(sp, { attributes: true, attributeFilter: ["hidden"] });
  }

  function start() {
    if (MQ.matches) build(); else teardown();
    watchDetail();
    watchSpur();
    if (MQ.addEventListener) MQ.addEventListener("change", function () { MQ.matches ? build() : teardown(); });
    else if (MQ.addListener) MQ.addListener(function () { MQ.matches ? build() : teardown(); });
    if (window.I18N) window.I18N.onChange(function () {
      var s = $("m-sheet"); if (s) s.querySelector("b").textContent = label("m.controls");
      var b = $("m-map-btn"); if (b) b.querySelector("span").textContent = label("m.map");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.MOBILE = { peek: function () { setSnap(PEEK); }, half: function () { setSnap(HALF); },
                    full: function () { setSnap(FULL); }, active: function () { return on; } };

})();
