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

  /* ?tl=horizontal is an escape hatch that beats anything remembered, so a
     rail that has gone wrong on someone's machine can always be stepped out
     of from the address bar without clearing site data. */
  function urlWants() {
    try {
      var v = new URLSearchParams(location.search).get("tl");
      if (v === "horizontal" || v === "off" || v === "0") return "horizontal";
      if (v === "vertical" || v === "1") return "vertical";
    } catch (e) { /* older browser */ }
    return null;
  }

  function saved() {
    var u = urlWants();
    if (u) return u;
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

    /* Two bands, so a percentage means the same thing in both. Each band
       is exactly the length of a rail, which is what the handle dates and
       the year labels are positioned inside. */
    var band = document.createElement("div");
    band.id = "rail-band";
    band.appendChild(lo); band.appendChild(hi);
    tl.appendChild(band);

    /* THE CENTURY, a second line of its own to the right of the first.
       It used to be a drawer behind a tab, and a drawer is a thing you have
       to find. Two lines side by side are a thing you can see. */
    var cband = document.createElement("div");
    cband.id = "rail-cn-band";
    var clo = document.createElement("b"); clo.id = "rail-cn-lo"; clo.className = "rail-date rail-date-cn";
    var chi = document.createElement("b"); chi.id = "rail-cn-hi"; chi.className = "rail-date rail-date-cn";
    cband.appendChild(clo); cband.appendChild(chi);
    tl.appendChild(cband);

    var cy = document.createElement("div");
    cy.id = "rail-cent-years";
    tl.appendChild(cy);

    /* The century's own slider is rotated exactly like the main one, so it
       is moved out to the rail and NOT into any container: the rotation is
       measured against the timeline. Its row of words and its tick row stay
       in the DOM as sources and are hidden by the stylesheet. */
    var sep = tl.querySelector(".tl-sep");
    var crow = tl.querySelector(".tl-row-century");
    var cslide = tl.querySelector(".tl-slider-century");
    var ctick = $("cn-ticks");
    [sep, crow, cslide, ctick].forEach(function (el, i) {
      if (!el) return;
      if (!el.id) el.id = "rail-tmp-" + i;
      take(el, tl);
    });

    /* the play button and the reset link go to the foot of the rail,
       because a rail whose time runs upward starts at the bottom */
    var foot = document.createElement("div");
    foot.id = "rail-foot";
    tl.appendChild(foot);
    take($("play-btn"), foot);
    take($("tl-reset"), foot);
    /* The century's reset lived in a row of words that the rail hides. With
       the drawer gone it would have had no way back to the full hundred
       years, so it joins the foot under its own line. */
    take($("cn-reset"), foot);

    labelChrome();
  }

  function labelChrome() {
    var cap = $("rail-cn-cap");
    if (cap) cap.textContent = t("tl.century");
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
    ["rail-years", "rail-lo", "rail-hi", "rail-plate", "rail-band",
     "rail-cn-band", "rail-cn-lo", "rail-cn-hi", "rail-cent-years",
     "rail-cn-cap", "rail-foot"].forEach(function (id) {
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
    pair("tl-fill", "rail-lo", "rail-hi", "tl-from", "tl-to");
    pair("cn-fill", "rail-cn-lo", "rail-cn-hi", "cn-from", "cn-to");
  }

  /* A fill carries its window as left% and width%, so its two ends are the
     two handles and no second reading of the range inputs is needed. The
     labels sit inside a band the same length as the rail, so the percentage
     lands where the handle is rather than approximately near it. */
  function pair(fillId, loId, hiId, fromId, toId) {
    var fill = $(fillId), lo = $(loId), hi = $(hiId);
    if (!fill || !lo || !hi) return;
    var l = parseFloat(fill.style.left || "0");
    var w = parseFloat(fill.style.width || "0");
    if (isNaN(l)) l = 0;
    if (isNaN(w)) w = 0;
    var top = Math.min(100, l + w);
    lo.style.bottom = l.toFixed(3) + "%";
    hi.style.bottom = top.toFixed(3) + "%";
    var from = $(fromId), to = $(toId);
    lo.textContent = from ? from.textContent : "";
    hi.textContent = to ? to.textContent : "";
    /* When the window is nearly shut the two labels would print over each
       other. The lower one steps down and the upper one steps up, which is
       the only place the rail lets a label leave its handle. */
    var tight = (top - l) < 11;
    lo.classList.toggle("tight-lo", tight);
    hi.classList.toggle("tight-hi", tight);
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
    capOnce();
  }

  /* The second line needs to say what it is once. It is not a control and
     it does not repeat: one word at the foot of the century, under its
     lowest year. */
  function capOnce() {
    if ($("rail-cn-cap") || !on) return;
    var tl = $("timeline");
    if (!tl) return;
    var cap = document.createElement("span");
    cap.id = "rail-cn-cap";
    cap.textContent = t("tl.century");
    tl.appendChild(cap);
  }

  /* ---------------- the guard ----------------
     The rail is CSS and JavaScript together: the script moves nodes, the
     stylesheet rotates them and narrows them to a line. If a browser ends up
     holding one half and not the other, the sliders stay full width, lie
     across the map and swallow every drag and click, and the map reads as
     frozen. That is a bad failure because the control that would undo it is
     underneath the thing that is broken.

     So the arrangement checks itself: a rail slider is a narrow column, and
     if it is not, the stylesheet in use does not know about the rail. Fall
     back to the horizontal bar and say why. A timeline in the wrong place
     beats a map that cannot be touched. */
  function railIsSane() {
    var els = [document.querySelector(".tl-slider"),
               document.querySelector(".tl-slider-century")];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el) continue;
      var r = el.getBoundingClientRect();
      if (r.width > 150 && r.height < r.width) return false;
    }
    return true;
  }

  function guard() {
    if (!on || !built) return;
    if (railIsSane()) return;
    window.__railErr = "the stylesheet does not know the rail; fell back to the horizontal timeline";
    if (window.console) console.warn("rail: " + window.__railErr);
    setVertical(false, false);
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
        setTimeout(guard, 400);
      });
    } else {
      unwatch();
      if (map) setTimeout(function () { map.resize(); }, 60);
    }
  }

  function watch() {
    /* Both fills, not just the first. The century's own window moved and its
       two end years went on saying 1900 and 2000, because nothing was
       watching the line that had changed. */
    var fill = $("tl-fill"), cfill = $("cn-fill");
    if (fill && !fillObs) {
      fillObs = new MutationObserver(placeDates);
      fillObs.observe(fill, { attributes: true, attributeFilter: ["style"] });
      if (cfill) fillObs.observe(cfill, { attributes: true, attributeFilter: ["style"] });
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
