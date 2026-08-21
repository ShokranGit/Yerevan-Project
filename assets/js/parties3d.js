/* ===================================================================
   Yerevan Project — THE POLITICAL LANDSCAPE, 1887 TO NOW
   -------------------------------------------------------------------
   Every party sits at a point in a space with three real axes:

     x   left  <-> right
     z   Moscow <-> Brussels
     y   time — when the party was founded, running bottom to top

   so the model IS the timeline. Drag the year slider and the space
   fills in: parties appear at their founding, fade when they dissolve,
   and swell or shrink with the seats they held at that moment.

   Click one for the dossier — leaders with photographs, its elections,
   where it stands on five running arguments, and whatever this map
   already holds that touches it.

   Editorial honesty: spectrum and stance values are placements, not
   measurements, and election figures not marked verified came from the
   model's background knowledge rather than a checked source. Both are
   said plainly in the panel rather than hidden.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var D = null;

  var t   = function (k, v) { return window.I18N ? I18N.t(k, v) : k; };
  var tr  = function (o, f) { return window.I18N ? I18N.tr(o, f) : (o && o[f]) || ""; };
  var trL = function (o, f) { return window.I18N ? I18N.trList(o, f) : (o && o[f]) || []; };
  var num = function (n) { return window.I18N ? I18N.num(n) : String(n); };
  var LANG = function () { return window.I18N ? I18N.lang : "en"; };

  /* The linked entries used to come only from window.YerevanMap, which app.js
     publishes when the map finishes booting. If the tiles are slow or blocked —
     a conference wifi, an offline demo — the map never boots, the API never
     appears, and every node here silently reported nothing linked. The entries
     live in a flat file; read it directly and stop depending on the map. */
  var EVENTS = null;
  function allEvents() {
    var api = window.YerevanMap;
    if (api && api.events) { var e = api.events(); if (e && e.length) return e; }
    return EVENTS || [];
  }
  fetch("data/events.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { EVENTS = (j && j.events) || []; })
    .catch(function () { EVENTS = []; });
  var view = { yaw: 0.5, pitch: -0.18, zoom: 1, spin: true, sel: null, hover: null };
  var thumb = { yaw: 0.5, pitch: -0.18, zoom: 1, spin: true, sel: null, hover: null };
  var year = 2026, playing = false, playT = 0;

  var COL = {
    left: "#8fb8d4", centre: "#b8bcc2", right: "#c9262c",
    dead: "#4a5058", axis: "rgba(150,157,168,.28)"
  };

  /* A canvas caption has room for about twenty characters. */
  function shortName(p) {
    var n = tr(p, "name") || p.abbr || p.name || "";
    return n.length > 22 ? n.slice(0, 21) + "…" : n;
  }

  function colourFor(p) {
    if (p.spectrum <= -3) return COL.left;
    if (p.spectrum >= 3) return COL.right;
    return COL.centre;
  }

  function pos(p) {
    var y0 = D.axes.y.min, y1 = D.axes.y.max;
    var t = (Math.max(y0, p.founded) - y0) / (y1 - y0);
    return [p.spectrum * 7, t * 150 - 75, p.geo * 7];
  }

  function alive(p, y) {
    return p.founded <= y && (!p.dissolved || p.dissolved >= y);
  }

  function seatsAt(p, y) {
    var best = null;
    (p.elections || []).forEach(function (e) {
      if (e.year <= y && (!best || e.year > best.year)) best = e;
    });
    return best ? best.seats : 0;
  }

  function radius(p, y) {
    var s = seatsAt(p, y);
    return 3.4 + Math.sqrt(s) * 0.85;
  }

  function project(p, v, w, h, scale) {
    var cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
    var cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    var x = p[0] * cy - p[2] * sy;
    var z = p[0] * sy + p[2] * cy;
    var y = p[1] * cp - z * sp;
    z = p[1] * sp + z * cp;
    var d = 340, k = d / (d + z + 170);
    return { x: w / 2 + x * k * scale * v.zoom, y: h / 2 - y * k * scale * v.zoom, z: z, k: k };
  }

  function draw(canvas, v, opts) {
    opts = opts || {};
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || !D) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    var g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var scale = Math.min(w, h) / 230;
    var yr = opts.year == null ? 2026 : opts.year;

    if (opts.axes) {
      var A = [[[-75, -75, 0], [75, -75, 0]], [[0, -75, -75], [0, -75, 75]], [[0, -75, 0], [0, 75, 0]]];
      g.strokeStyle = COL.axis; g.lineWidth = 1;
      A.forEach(function (seg) {
        var a = project(seg[0], v, w, h, scale), b = project(seg[1], v, w, h, scale);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      });
      var lab = [
        [[-80, -75, 0], tr(D.axes.x, "minLabel")], [[80, -75, 0], tr(D.axes.x, "maxLabel")],
        [[0, -75, -82], tr(D.axes.z, "minLabel")], [[0, -75, 82], tr(D.axes.z, "maxLabel")]
      ];
      g.font = '10px Inter, "Noto Sans Armenian", Vazirmatn, system-ui, sans-serif';
      g.textAlign = "center";
      g.fillStyle = "rgba(150,157,168,.75)";
      lab.forEach(function (l) {
        var p = project(l[0], v, w, h, scale);
        g.fillText(l[1], p.x, p.y);
      });
    }

    var pts = {}, shown = [];
    D.parties.forEach(function (p) {
      pts[p.id] = project(pos(p), v, w, h, scale);
      if (alive(p, yr)) shown.push(p);
    });

    (D.links || []).forEach(function (l) {
      var A = D.parties.filter(function (p) { return p.id === l[0]; })[0];
      var B = D.parties.filter(function (p) { return p.id === l[1]; })[0];
      if (!A || !B || !alive(A, yr) || !alive(B, yr)) return;
      var a = pts[A.id], b = pts[B.id];
      var lit = v.sel && (l[0] === v.sel || l[1] === v.sel);
      g.strokeStyle = lit ? "rgba(201,38,44,.8)" : "rgba(150,157,168,.13)";
      g.lineWidth = lit ? 1.5 : 0.8;
      if (l[2] === "rival") g.setLineDash([3, 3]); else g.setLineDash([]);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    });
    g.setLineDash([]);

    shown.sort(function (a, b) { return pts[a.id].z - pts[b.id].z; });
    shown.forEach(function (p) {
      var q = pts[p.id];
      var r = Math.max(2, radius(p, yr) * q.k * scale * v.zoom * 0.5);
      var lit = v.sel === p.id || v.hover === p.id;
      var inPower = seatsAt(p, yr) > 0;

      g.globalAlpha = (v.sel && !lit) ? 0.3 : (inPower ? 0.95 : 0.5);
      g.fillStyle = colourFor(p);
      g.beginPath(); g.arc(q.x, q.y, r, 0, 6.2832); g.fill();

      if (lit) {
        g.globalAlpha = 1; g.strokeStyle = "#fff"; g.lineWidth = 2;
        g.beginPath(); g.arc(q.x, q.y, r + 3, 0, 6.2832); g.stroke();
      }
      if (opts.labels && (lit || inPower || q.k > 0.75)) {
        g.globalAlpha = lit ? 1 : 0.75;
        /* The abbreviation is a Latin acronym. In Armenian and Persian it
           says nothing, so the translated name is drawn instead — shortened,
           because a canvas has no room for a full party name. */
        g.font = (lit ? "600 " : "") + '11px Inter, "Noto Sans Armenian", Vazirmatn, system-ui, sans-serif';
        g.fillStyle = lit ? "#fff" : "#c9ced8";
        g.textAlign = "center";
        var cap = LANG() === "en" ? (p.abbr || p.name) : shortName(p);
        g.fillText(cap, q.x, q.y - r - 6);
      }
      g.globalAlpha = 1;
    });
  }

  function pickAt(canvas, v, e, yr) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var w = canvas.clientWidth, h = canvas.clientHeight, scale = Math.min(w, h) / 230;
    var best = null, bestD = 1e9;
    D.parties.forEach(function (p) {
      if (!alive(p, yr)) return;
      var q = project(pos(p), v, w, h, scale);
      var r = Math.max(7, radius(p, yr) * q.k * scale * v.zoom * 0.5) + 6;
      var d = Math.hypot(q.x - mx, q.y - my);
      if (d < r && d < bestD) { bestD = d; best = p; }
    });
    return best;
  }

  function wire(canvas, v, onPick) {
    var drag = false, lx = 0, ly = 0, moved = 0;
    canvas.addEventListener("pointerdown", function (e) {
      drag = true; moved = 0; lx = e.clientX; ly = e.clientY; v.spin = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (drag) {
        var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        v.yaw += dx * 0.008;
        v.pitch = Math.max(-1.3, Math.min(1.3, v.pitch + dy * 0.008));
        return;
      }
      var hit = pickAt(canvas, v, e, year);
      var id = hit ? hit.id : null;
      if (id !== v.hover) { v.hover = id; canvas.style.cursor = id ? "pointer" : "grab"; }
    });
    canvas.addEventListener("pointerup", function (e) {
      drag = false;
      if (moved < 5) { var hit = pickAt(canvas, v, e, year); onPick(hit ? hit.id : null); }
    });
    canvas.addEventListener("pointerleave", function () { drag = false; v.hover = null; });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      v.zoom = Math.max(0.5, Math.min(3, v.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    }, { passive: false });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function bar(v) {
    var pct = (v + 10) / 20 * 100;
    return '<i style="left:' + pct.toFixed(1) + '%"></i>';
  }

  function dossier(id) {
    var box = $("p3-info");
    var p = D.parties.filter(function (x) { return x.id === id; })[0];
    if (!p) {
      box.innerHTML = '<p class="p3-empty">' + esc(t("p3.empty")) + '</p>' +
        '<p class="p3-caveat">' + esc(t("p3.caveat")) + '</p>';
      return;
    }
    var all = allEvents();
    var byId = {}; all.forEach(function (e) { byId[e.id] = e; });
    var linked = (p.events || []).map(function (i) { return byId[i]; }).filter(Boolean);
    if (!linked.length && p.query) {
      var q = p.query.toLowerCase();
      linked = all.filter(function (e) {
        return ((e.title || "") + " " + (e.summary || "") + " " + (e.body || "")).toLowerCase().indexOf(q) > -1;
      });
    }

    /* The heading is the party's name in the reader's language; underneath it
       goes the name they did NOT just read, so the two are always tied
       together — English under Armenian, Armenian under English. */
    var primary = tr(p, "name") || p.name;
    var secondary = LANG() === "en" ? (p.name_hy || p.hy) : p.name;
    var h = '<h3>' + esc(primary) + '</h3>';
    if (secondary && secondary !== primary) h += '<p class="p3-hy">' + esc(secondary) + '</p>';
    h += '<p class="p3-meta">' + esc(tr(p, "position")) + ' &middot; ' +
         esc(t("p3.founded")) + ' ' + num(p.founded) +
         (p.dissolved ? ' &middot; ' + esc(t("p3.dissolved")) + ' ' + num(p.dissolved) : "") + '</p>';

    var ideo = trL(p, "ideology");
    if (ideo.length) {
      h += '<p class="p3-tags">' + ideo.map(function (i) {
        return '<span>' + esc(i) + '</span>';
      }).join("") + '</p>';
    }
    var pnote = tr(p, "note");
    if (pnote) h += '<p class="p3-note">' + esc(pnote) + '</p>';

    if (p.leaders && p.leaders.length) {
      h += '<p class="p3-h">' + esc(t("p3.figures")) + '</p><div class="p3-people">';
      p.leaders.forEach(function (l) {
        h += '<div class="p3-person" data-wiki="' + esc(l.wiki || "") + '">' +
          '<span class="p3-nophoto"></span>' +
          '<div><b>' + esc(tr(l, "name") || l.name) + '</b><em>' + esc(tr(l, "role")) + '</em></div></div>';
      });
      h += '</div>';
    }

    if (p.elections && p.elections.length) {
      h += '<p class="p3-h">' + esc(t("p3.elections")) + '</p><table class="p3-tbl"><tbody>';
      p.elections.slice().sort(function (a, b) { return a.year - b.year; }).forEach(function (e) {
        h += '<tr><td>' + num(e.year) +
             (e.verified ? ' <b title="' + esc(t("p3.checked")) + '">&#10003;</b>' : "") +
             '</td><td>' + (e.share != null ? num(e.share) + "%" : "&mdash;") +
             '</td><td>' + (e.seats != null ? esc(t("p3.seats", { n: num(e.seats) })) : "&mdash;") +
             '</td></tr>';
      });
      h += '</tbody></table>';
    }

    if (p.stances) {
      h += '<p class="p3-h">' + esc(t("p3.stands")) + '</p>';
      D.issues.forEach(function (iss) {
        var v = p.stances[iss.id];
        if (v == null) return;
        h += '<div class="p3-issue"><span>' + esc(tr(iss, "label")) + '</span>' +
             '<div class="p3-scale">' + bar(v) + '</div>' +
             '<em>' + esc(v < 0 ? tr(iss, "neg") : tr(iss, "pos")) + '</em></div>';
      });
    }

    if (linked.length) {
      h += '<p class="p3-h">' + esc(t("p3.onmap")) + '</p><ul class="g3-list">';
      linked.forEach(function (e) {
        h += '<li><button type="button" data-ev="' + esc(e.id) + '">' + esc(tr(e, "title") || e.id) +
             (e.date ? ' <span>' + esc(num(String(e.date).slice(0, 4))) + '</span>' : "") + '</button></li>';
      });
      h += '</ul>';
    } else {
      h += '<p class="p3-h">' + esc(t("p3.onmap")) + '</p><p class="p3-none">' +
           esc(t("p3.nothing")) + '</p>';
    }
    box.innerHTML = h;
    fillPhotos(box);
  }

  /* Portraits are fetched from Wikipedia at display time rather than stored.
     A stored URL rots and has to be re-checked by hand; a title does not, and
     the picture stays whatever Wikipedia currently shows. Cached per session. */
  var photoCache = {};
  function fillPhotos(box) {
    [].slice.call(box.querySelectorAll(".p3-person[data-wiki]")).forEach(function (el) {
      var title = el.getAttribute("data-wiki");
      if (!title) return;
      var put = function (url) {
        if (!url || !el.isConnected) return;
        var img = new Image();
        img.alt = ""; img.loading = "lazy"; img.src = url;
        var slot = el.querySelector(".p3-nophoto");
        if (slot) el.replaceChild(img, slot);
      };
      if (photoCache[title] !== undefined) { put(photoCache[title]); return; }
      fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var u = j && j.thumbnail && j.thumbnail.source;
          photoCache[title] = u || null;
          put(u);
        })
        .catch(function () { photoCache[title] = null; });
    });
  }

  function setYear(y) {
    year = y;
    var s = $("p3-year"); if (s && +s.value !== y) s.value = y;
    $("p3-year-label").textContent = num(y);
    var ev = (D.elections || []).filter(function (e) { return e.year === y; })[0];
    $("p3-year-note").innerHTML = ev
      ? '<b>' + esc(t("p3.electionOf", { kind: t("kind." + ev.kind) })) +
        (ev.verified ? ' &#10003;' : "") + '</b> ' + esc(tr(ev, "note"))
      : "";
  }

  /* The frame is requested BEFORE anything is drawn, and every draw is
     wrapped. A throw inside a requestAnimationFrame callback silently ends
     the chain: the picture freezes and nothing says why. That cost a
     debugging round on this very file. Never let a render loop sit one
     exception away from death. */
  var warned = false;
  function loop() {
    requestAnimationFrame(loop);
    try {
    if (thumb.spin) thumb.yaw += 0.002;
    if (view.spin) view.yaw += 0.0015;
    if (playing) {
      playT += 1;
      if (playT % 6 === 0) {
        var y = year + 1;
        if (y > D.axes.y.max) { y = 1988; }
        setYear(y);
      }
    }
    var t = $("p3-thumb-canvas");
    if (t) draw(t, thumb, { labels: false, year: 2026 });
    var b = $("p3-canvas");
    if (b && !$("p3-modal").hidden) draw(b, view, { labels: true, axes: true, year: year });
    } catch (err) {
      if (!warned) { warned = true; console.warn("parties3d draw:", err); }
    }
  }

  function open() { $("p3-modal").hidden = false; view.spin = false; dossier(view.sel); }
  function close() { $("p3-modal").hidden = true; playing = false; $("p3-play").textContent = t("p3.play"); }

  function init() {
    $("p3-thumb").addEventListener("click", open);
    $("p3-close").addEventListener("click", close);
    $("p3-modal").addEventListener("click", function (e) { if (e.target === this) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("p3-modal").hidden) close();
    });

    var s = $("p3-year");
    s.min = 1988; s.max = D.axes.y.max; s.value = D.axes.y.max;
    s.addEventListener("input", function () { playing = false; $("p3-play").textContent = t("p3.play"); setYear(+this.value); });
    $("p3-play").addEventListener("click", function () {
      playing = !playing;
      this.textContent = playing ? t("p3.pause") : t("p3.play");
      if (playing && year >= D.axes.y.max) setYear(1988);
    });
    $("p3-reset").addEventListener("click", function () {
      view.yaw = 0.5; view.pitch = -0.18; view.zoom = 1; view.sel = null;
      setYear(D.axes.y.max); dossier(null);
    });

    wire($("p3-canvas"), view, function (id) { view.sel = id; dossier(id); });

    $("p3-info").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || !b.dataset.ev) return;
      if (window.YerevanMap && window.YerevanMap.select) { close(); window.YerevanMap.select(b.dataset.ev); }
    });

    function legend() {
      $("p3-legend").innerHTML =
        '<span><i style="background:' + COL.left + '"></i>' + esc(t("p3.left")) + '</span>' +
        '<span><i style="background:' + COL.centre + '"></i>' + esc(t("p3.centre")) + '</span>' +
        '<span><i style="background:' + COL.right + '"></i>' + esc(t("p3.right")) + '</span>' +
        '<span class="p3-hint">' + esc(t("p3.hint")) + '</span>';
    }
    legend();

    /* The canvas repaints every frame; only the HTML around it needs telling. */
    if (window.I18N) {
      I18N.onChange(function () {
        legend();
        setYear(year);
        dossier(view.sel);
        $("p3-play").textContent = playing ? t("p3.pause") : t("p3.play");
      });
    }

    setYear(D.axes.y.max);
    dossier(null);
    loop();
  }

  fetch("data/parties.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && $("p3-thumb")) { D = j; init(); } })
    .catch(function (err) { console.warn("parties3d:", err); });

})();
