/* ===================================================================
   Yerevan Project — THE RELATIONAL MODEL, IN 3D
   -------------------------------------------------------------------
   The diagram from the proposal defence, rebuilt as something you can
   turn around: concepts on the inner spine, places around them, events
   further out, actors above, the wider frame beyond that.

   Drag to rotate, wheel to zoom, click a node to see what the map
   already holds about it. A node with no entries yet still exists and
   still says so — the point is that the structure is there first and
   the material fills in behind it.

   No 3D library. Nodes are points, links are segments, and all this
   needs is a rotation matrix and a perspective divide — about eighty
   lines of the four hundred here. A dependency would cost more than it
   would save, and this file has no build step, like everything else.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var GRAPH = null;

  var t  = function (k, v) { return window.I18N ? I18N.t(k, v) : k; };
  var tr = function (o, f) { return window.I18N ? I18N.tr(o, f) : (o && o[f]) || ""; };
  var num = function (n) { return window.I18N ? I18N.num(n) : String(n); };

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

  function makeView() {
    return { yaw: 0.6, pitch: -0.25, zoom: 1, spin: true, hover: null, sel: null };
  }

  /* --------------- maths --------------- */
  function project(p, view, w, h, scale) {
    var cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
    var cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    var x = p[0] * cy - p[2] * sy;
    var z = p[0] * sy + p[2] * cy;
    var y = p[1] * cp - z * sp;
    z = p[1] * sp + z * cp;
    var d = 320;
    var k = d / (d + z + 150);
    return { x: w / 2 + x * k * scale * view.zoom,
             y: h / 2 - y * k * scale * view.zoom, z: z, k: k };
  }

  var nbrCache = {};
  function isNeighbour(id, sel) {
    if (!nbrCache[sel]) {
      var s = {};
      GRAPH.links.forEach(function (l) {
        if (l[0] === sel) s[l[1]] = 1;
        if (l[1] === sel) s[l[0]] = 1;
      });
      nbrCache[sel] = s;
    }
    return !!nbrCache[sel][id];
  }

  /* --------------- drawing --------------- */
  function draw(canvas, view, opts) {
    opts = opts || {};
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    var g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!GRAPH) return;

    var scale = Math.min(w, h) / 260;
    var pts = {};
    GRAPH.nodes.forEach(function (n) { pts[n.id] = project(n.p, view, w, h, scale); });

    var links = GRAPH.links.slice().sort(function (a, b) {
      return (pts[a[0]].z + pts[a[1]].z) - (pts[b[0]].z + pts[b[1]].z);
    });
    links.forEach(function (l) {
      var a = pts[l[0]], b = pts[l[1]];
      if (!a || !b) return;
      var lit = view.sel && (l[0] === view.sel || l[1] === view.sel);
      var depth = (a.k + b.k) / 2;
      g.strokeStyle = lit ? "rgba(201,38,44,.85)"
        : "rgba(150,157,168," + (0.10 + 0.30 * (depth - 0.5)).toFixed(3) + ")";
      g.lineWidth = lit ? 1.6 : 0.9;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    });

    var order = GRAPH.nodes.slice().sort(function (a, b) { return pts[a.id].z - pts[b.id].z; });
    order.forEach(function (n) {
      var p = pts[n.id];
      var grp = GRAPH.groups[n.group] || { color: "#b8bcc2" };
      var r = Math.max(2, n.r * p.k * scale * view.zoom * 0.5);
      var lit = view.sel === n.id || view.hover === n.id;
      var dim = view.sel && !lit && !isNeighbour(n.id, view.sel);

      g.globalAlpha = dim ? 0.25 : (0.55 + 0.45 * (p.k - 0.5) * 2);
      g.fillStyle = grp.color;
      g.beginPath(); g.arc(p.x, p.y, r, 0, 6.2832); g.fill();

      if (lit) {
        g.globalAlpha = 1;
        g.strokeStyle = "#fff"; g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, r + 3, 0, 6.2832); g.stroke();
      }
      if (opts.labels && !dim && p.k > 0.55) {
        g.globalAlpha = lit ? 1 : 0.5 + 0.5 * (p.k - 0.5) * 2;
        /* The label font must carry Armenian and Persian glyphs, or a node
           renders as a row of boxes on a canvas that reports no error. */
        g.font = (lit ? "600 " : "") + Math.round(11 * Math.min(1.25, p.k * 1.15)) +
                 'px Inter, "Noto Sans Armenian", Vazirmatn, system-ui, sans-serif';
        g.fillStyle = lit ? "#fff" : "#c9ced8";
        g.textAlign = "center";
        g.fillText(tr(n, "label"), p.x, p.y - r - 6);
      }
      g.globalAlpha = 1;
    });
  }

  /* --------------- interaction --------------- */
  function pickAt(canvas, view, e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var scale = Math.min(w, h) / 260;
    var best = null, bestD = 1e9;
    GRAPH.nodes.forEach(function (n) {
      var p = project(n.p, view, w, h, scale);
      var r = Math.max(6, n.r * p.k * scale * view.zoom * 0.5) + 7;
      var d = Math.hypot(p.x - mx, p.y - my);
      if (d < r && d < bestD) { bestD = d; best = n; }
    });
    return best;
  }

  function wire(canvas, view, onPick) {
    var dragging = false, lx = 0, ly = 0, moved = 0;
    canvas.addEventListener("pointerdown", function (e) {
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY;
      view.spin = false; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (dragging) {
        var dx = e.clientX - lx, dy = e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        view.yaw += dx * 0.008;
        view.pitch = Math.max(-1.35, Math.min(1.35, view.pitch + dy * 0.008));
        return;
      }
      var hit = pickAt(canvas, view, e);
      var id = hit ? hit.id : null;
      if (id !== view.hover) { view.hover = id; canvas.style.cursor = id ? "pointer" : "grab"; }
    });
    canvas.addEventListener("pointerup", function (e) {
      dragging = false;
      if (moved < 5) { var hit = pickAt(canvas, view, e); onPick(hit ? hit.id : null); }
    });
    canvas.addEventListener("pointerleave", function () { dragging = false; view.hover = null; });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      view.zoom = Math.max(0.5, Math.min(3, view.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    }, { passive: false });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* --------------- the info side --------------- */
  function describe(id) {
    var box = $("g3-info");
    var n = GRAPH.nodes.filter(function (x) { return x.id === id; })[0];
    if (!n) {
      box.innerHTML = '<p class="g3-empty">' + esc(t("g3.empty")) + '</p>';
      return;
    }
    var all = allEvents();
    var byId = {};
    all.forEach(function (e) { byId[e.id] = e; });

    var linked = (n.events || []).map(function (i) { return byId[i]; }).filter(Boolean);
    if (!linked.length && n.query) {
      var q = n.query.toLowerCase();
      linked = all.filter(function (e) {
        return ((e.title || "") + " " + (e.summary || "") + " " + (e.body || "")).toLowerCase().indexOf(q) > -1;
      });
    }

    var nbrs = [];
    GRAPH.links.forEach(function (l) {
      if (l[0] === id) nbrs.push(l[1]);
      if (l[1] === id) nbrs.push(l[0]);
    });
    var label = function (i) {
      var m = GRAPH.nodes.filter(function (x) { return x.id === i; })[0];
      return m ? tr(m, "label") : i;
    };

    var grp = GRAPH.groups[n.group] || {};
    var html = '<h3>' + esc(tr(n, "label")) + '</h3>' +
      '<p class="g3-group"><i style="background:' + esc(grp.color || "#b8bcc2") + '"></i>' +
      esc(tr(grp, "label") || n.group) + '</p>';

    if (linked.length) {
      html += '<p class="g3-count">' +
              esc(linked.length === 1 ? t("g3.entry") : t("g3.entries", { n: num(linked.length) })) +
              '</p><ul class="g3-list">';
      linked.forEach(function (e) {
        html += '<li><button type="button" data-ev="' + esc(e.id) + '">' +
                esc(tr(e, "title") || e.id) +
                (e.date ? ' <span>' + esc(num(String(e.date).slice(0, 4))) + '</span>' : "") +
                '</button></li>';
      });
      html += '</ul>';
    } else {
      html += '<p class="g3-none">' + esc(t("g3.nothing")) + '</p>';
    }

    if (nbrs.length) {
      html += '<p class="g3-count">' + esc(t("g3.connected")) + '</p><p class="g3-nbrs">' +
        nbrs.map(function (i) {
          return '<button type="button" data-node="' + esc(i) + '">' + esc(label(i)) + '</button>';
        }).join("") + '</p>';
    }
    box.innerHTML = html;
  }

  /* --------------- boot --------------- */
  var thumbView = makeView(), bigView = makeView();

  function loop() {
    if (thumbView.spin) thumbView.yaw += 0.0022;
    if (bigView.spin) bigView.yaw += 0.0016;
    var t = $("g3-thumb-canvas");
    if (t) draw(t, thumbView, { labels: false });
    var b = $("g3-canvas");
    if (b && !$("g3-modal").hidden) draw(b, bigView, { labels: true });
    requestAnimationFrame(loop);
  }

  function open() {
    $("g3-modal").hidden = false;
    bigView.spin = false;
    describe(bigView.sel);
    setTimeout(function () { draw($("g3-canvas"), bigView, { labels: true }); }, 30);
  }
  function close() { $("g3-modal").hidden = true; }

  function init() {
    $("g3-thumb").addEventListener("click", open);
    $("g3-close").addEventListener("click", close);
    $("g3-modal").addEventListener("click", function (e) { if (e.target === this) close(); });
    $("g3-reset").addEventListener("click", function () {
      bigView.yaw = 0.6; bigView.pitch = -0.25; bigView.zoom = 1;
      bigView.sel = null; describe(null);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("g3-modal").hidden) close();
    });

    wire($("g3-canvas"), bigView, function (id) { bigView.sel = id; describe(id); });

    $("g3-info").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.node) { bigView.sel = b.dataset.node; describe(b.dataset.node); return; }
      if (b.dataset.ev && window.YerevanMap && window.YerevanMap.select) {
        close();
        window.YerevanMap.select(b.dataset.ev);
      }
    });

    function legend() {
      $("g3-legend").innerHTML = Object.keys(GRAPH.groups).map(function (k) {
        return '<span><i style="background:' + esc(GRAPH.groups[k].color) + '"></i>' +
               esc(tr(GRAPH.groups[k], "label")) + '</span>';
      }).join("");
    }
    legend();

    /* The canvas redraws itself every frame, so only the HTML side needs
       telling that the language changed. */
    if (window.I18N) I18N.onChange(function () { legend(); describe(bigView.sel); });

    describe(null);
    loop();
  }

  fetch("data/graph.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && $("g3-thumb")) { GRAPH = j; init(); } })
    .catch(function (err) { console.warn("graph3d:", err); });

})();
