/* ===================================================================
   Yerevan Project; THE VERTICAL RAIL
   -------------------------------------------------------------------
   The timeline, stood up the right edge of the map: one hairline with
   oldest at the foot and the present at the top, no box, no border and
   no shadow. It sits on the drawing the way a scale sits on a drawing.

   THE HORIZONTAL TIMELINE IS NOT REPLACED. A switch in the map
   settings moves between the two and the choice is remembered, because
   the point of trying a new arrangement is being able to go back to
   the old one.

   -------------------------------------------------------------------
   HOW IT WORKS, and why it is done this way

   Not a rewrite. Every number the timeline knows, where the window
   starts, where each period sits, how dense the years are, is already
   computed by app.js and written as "left: x%" and "width: y%" on
   elements inside .tl-slider. Rewriting that logic to speak in
   "bottom" and "height" would be a second implementation of the same
   arithmetic, and the two would drift apart within a week.

   So the slider is ROTATED instead: transform rotate(-90deg) maps the
   left edge to the bottom and the right edge to the top, which is
   exactly the direction Alireza asked for, and every percentage keeps
   meaning what it meant. Nothing inside the slider carries text, so
   nothing ends up sideways.

   What DOES carry text is handled here, outside the rotation: the year
   labels, the two dates on the handles, the period names, and the
   century drawer. Those are read from the horizontal DOM and re-laid
   out vertically, so they still come from one source of truth.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var KEY = "yerevan.timeline";
  var MQ = window.matchMedia("(max-width: 860px)");

  var on = false, built = false, map = null;
  var home = {};                 /* where a moved node came from */
  var fillObs = null, epObs = null;

  function t(k) { return window.I18N ? I18N.t(k) : k; }

  /* ---------------- the switch ---------------- */

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* private window */ }
  }

  function icon(vertical) {
    return vertical
      ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M8 2l-2 2M8 2l2 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4 6h2M4 9h2M4 12h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12M14 8l-2-2M14 8l-2 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4 10v2M7 10v2M10 10v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  }

  function addSwitch() {
    if ($("tl-mode")) return;
    var b = document.createElement("button");
    b.id = "tl-mode";
    b.type = "button";
    b.className = "map-btn";
    b.addEventListener("click", function () { setVertical(!on, true); });
    var ctl = $("map-controls");
    if (ctl) ctl.insertBefore(b, ctl.firstChild);
    labelSwitch();
  }

  function labelSwitch() {
    var b = $("tl-mode");
    if (!b) return;
    b.innerHTML = icon(!on);
    b.title = t(on ? "tl.horizontal" : "tl.vertical");
    b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }

  /* ---------------- building the vertical arrangement ----------------
     Nodes are MOVED, never copied, and where each came from is recorded
     so the horizontal timeline can be put back exactly as it was. */

  function take(el, into) {
    if (!el || !into) return;
    if (!home[el.id]) home[el.id] = { parent: el.parentNode, next: el.nextSibling };
    into.appendChild(el);
  }

  function build() {
    if (built) return;
    var tl = $("timeline"), wrap = $("map-wrap");
    if (!tl || !wrap) return;
    built = true;

    /* the year gutter, the handle dates and the period name plate all
       live outside the rotation */
    var years = document.createElement("div");
    years.id = "rail-years";
    tl.appendChild(years);

    var lo = document.createElement("b"); lo.id = "rail-lo"; lo.className = "rail-date";
    var hi = document.createElement("b"); hi.id = "rail-hi"; hi.className = "rail-date";
    tl.appendChild(lo); tl.appendChild(hi);

    var plate = document.createElement("div");
    plate.id = "rail-plate";
    plate.hidden = true;
    tl.appendChild(plate);

    /* the century, in a drawer that opens to the left */
    var drawer = document.createElement("div");
    drawer.id = "rail-century";
    var tab = document.createElement("button");
    tab.id = "rail-cent-tab";
    tab.type = "button";
    tab.innerHTML = '<span></span><i>&#8249;</i>';
    tab.addEventListener("click", function () {
      tl.classList.toggle("cent-open");
      tab.classList.toggle("open", tl.classList.contains("cent-open"));
      if (tl.classList.contains("cent-open")) requestAnimationFrame(layout);
    });
    tl.appendChild(tab);
    tl.appendChild(drawer);

    var cy = document.createElement("div");
    cy.id = "rail-cent-years";
    drawer.appendChild(cy);

    ["tl-sep-node", "cn-row", "cn-slider", "cn-ticks"].forEach(function () {});
    var sep = tl.querySelector(".tl-sep");
    var crow = tl.querySelector(".tl-row-century");
    var cslide = tl.querySelector(".tl-slider-century");
    var ctick = $("cn-ticks");
    [sep, crow, cslide, ctick].forEach(function (el, i) {
      if (!el) return;
      if (!el.id) el.id = "rail-tmp-" + i;
      take(el, drawer);
    });

    /* the play button and the reset link go to the foot of the rail,
       because a rail whose time runs upward starts at the bottom */
    var foot = document.createElement("div");
    foot.id = "rail-foot";
    tl.appendChild(foot);
    take($("play-btn"), foot);
    take($("tl-reset"), foot);

    labelChrome();
  }

  function labelChrome() {
    var tab = $("rail-cent-tab");
    if (tab) {
      tab.querySelector("span").textContent = t("tl.century");
      tab.title = t("tl.centuryOpen");
      tab.setAttribute("aria-label", tab.title);
    }
    labelSwitch();
  }

  function teardown() {
    if (!built) return;
    built = false;
    Object.keys(home).forEach(function (id) {
      var el = $(id), h = home[id];
      if (el && h && h.parent) h.parent.insertBefore(el, h.next);
    });
    home = {};
    ["rail-years", "rail-lo", "rail-hi", "rail-plate", "rail-century",
     "rail-cent-tab", "rail-foot"].forEach(function (id) {
      var el = $(id); if (el) el.remove();
    });
    var tl = $("timeline");
    if (tl) { tl.classList.remove("cent-open"); tl.style.removeProperty("--rail-h"); }
  }

  /* ---------------- laying out what carries words ----------------
     The year labels are not recomputed here. #tl-ticks is a flex row
     with justify-content: space-between, so its i-th child of n sits
     at i/(n-1) along the axis; reading the labels out and placing them
     at 1 - i/(n-1) from the top is the same information, upright, and
     it stays correct when app.js re-renders them in another language. */

  function mirrorTicks(fromId, intoId) {
    var src = $(fromId), box = $(intoId);
    if (!src || !box) return;
    var kids = src.children, n = kids.length;
    if (!n) { box.innerHTML = ""; return; }
    var html = "", i;
    for (i = 0; i < n; i++) {
      var f = (n === 1) ? 0.5 : i / (n - 1);
      html += '<span style="bottom:' + (f * 100).toFixed(3) + '%">' +
              '<i></i>' + escapeHTML(kids[i].textContent) + "</span>";
    }
    box.innerHTML = html;
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* The two dates ride with the handles. #tl-fill already carries the
     window as left% and width%, so the handles are its two ends and no
     second reading of the range inputs is needed. */
  function placeDates() {
    var fill = $("tl-fill"), lo = $("rail-lo"), hi = $("rail-hi");
    if (!fill || !lo || !hi) return;
    var l = parseFloat(fill.style.left || "0");
    var w = parseFloat(fill.style.width || "0");
    if (isNaN(l)) l = 0;
    if (isNaN(w)) w = 0;
    lo.style.bottom = l.toFixed(3) + "%";
    hi.style.bottom = Math.min(100, l + w).toFixed(3) + "%";
    var from = $("tl-from"), to = $("tl-to");
    lo.textContent = from ? from.textContent : "";
    hi.textContent = to ? to.textContent : "";
  }

  /* A period is a coloured length of the rail. Its name is not printed
     beside it, which would crowd the line; it flies out to the left on
     hover or focus, which is also how it works with a keyboard. */
  function plateFor(el) {
    var plate = $("rail-plate"), tl = $("timeline");
    if (!plate || !el || !tl) return;
    var name = el.getAttribute("title") || el.getAttribute("aria-label") || "";
    if (!name) { plate.hidden = true; return; }
    var r = el.getBoundingClientRect(), b = tl.getBoundingClientRect();
    plate.textContent = name;
    plate.style.top = Math.round(r.top + r.height / 2 - b.top) + "px";
    plate.style.setProperty("--ep", getComputedStyle(el).getPropertyValue("--ep") || "#c9262c");
    plate.hidden = false;
  }

  function wirePeriods() {
    var tl = $("timeline");
    if (!tl) return;
    tl.addEventListener("mouseover", function (e) {
      var b = e.target.closest(".tl-ep, .tl-cm");
      if (b && on) plateFor(b);
    });
    tl.addEventListener("mouseout", function (e) {
      if (!on) return;
      var b = e.target.closest(".tl-ep, .tl-cm");
      if (b) { var p = $("rail-plate"); if (p) p.hidden = true; }
    });
    tl.addEventListener("focusin", function (e) {
      var b = e.target.closest(".tl-ep, .tl-cm");
      if (b && on) plateFor(b);
    });
    tl.addEventListener("focusout", function () {
      var p = $("rail-plate"); if (p) p.hidden = true;
    });
  }

  /* ---------------- the one measurement the CSS cannot make ----------------
     A rotated box is laid out at its unrotated size, so the slider has
     to be given the rail's height as its WIDTH before it is turned. */
  function layout() {
    var tl = $("timeline");
    if (!tl || !on) return;
    var h = tl.clientHeight;
    var footH = 84, tabRoom = 10;
    var usable = Math.max(120, h - footH - tabRoom);
    tl.style.setProperty("--rail-h", usable + "px");
    placeDates();
    mirrorTicks("tl-ticks", "rail-years");
    mirrorTicks("cn-ticks", "rail-cent-years");
  }

  /* ---------------- switching ---------------- */

  function setVertical(v, byUser) {
    if (MQ.matches) v = false;            /* a phone keeps the bar it has */
    on = !!v;
    document.body.classList.toggle("tl-vertical", on);
    if (on) { build(); } else { teardown(); }
    labelSwitch();
    if (byUser) remember(on ? "vertical" : "horizontal");
    if (on) {
      requestAnimationFrame(function () {
        layout();
        watch();
        if (map) map.resize();
      });
    } else {
      unwatch();
      if (map) setTimeout(function () { map.resize(); }, 60);
    }
  }

  function watch() {
    var fill = $("tl-fill");
    if (fill && !fillObs) {
      fillObs = new MutationObserver(placeDates);
      fillObs.observe(fill, { attributes: true, attributeFilter: ["style"] });
    }
    var ticks = $("tl-ticks");
    if (ticks && !epObs) {
      epObs = new MutationObserver(function () {
        mirrorTicks("tl-ticks", "rail-years");
        mirrorTicks("cn-ticks", "rail-cent-years");
      });
      epObs.observe(ticks, { childList: true });
    }
  }

  function unwatch() {
    if (fillObs) { fillObs.disconnect(); fillObs = null; }
    if (epObs) { epObs.disconnect(); epObs = null; }
  }

  /* ---------------- start ---------------- */

  var rz = 0;
  function onResize() {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (MQ.matches && on) setVertical(false, false);
      else layout();
    }, 160);
  }

  function start() {
    addSwitch();
    wirePeriods();
    window.addEventListener("resize", onResize);
    if (window.I18N) I18N.onChange(function () {
      labelChrome();
      if (on) requestAnimationFrame(layout);
    });
    /* The rail is the arrangement now; the horizontal bar is the fallback.
       Anyone who switches back is remembered and stays switched back. */
    setVertical(saved() !== "horizontal", false);
  }

  var waited = 0;
  var timer = setInterval(function () {
    if ($("timeline") && $("map-controls")) {
      clearInterval(timer);
      map = window.__map || null;
      try { start(); } catch (err) { window.__railErr = String(err && err.message || err); console.warn("rail:", err); }
    } else if (++waited > 300) { clearInterval(timer); }
  }, 150);

  /* the map may boot after the rail does */
  var mw = 0;
  var mt = setInterval(function () {
    if (window.__map) { map = window.__map; clearInterval(mt); }
    else if (++mw > 300) clearInterval(mt);
  }, 200);

  window.RAIL = {
    vertical: function () { return on; },
    set: function (v) { setVertical(v, true); },
    layout: layout
  };

})();
