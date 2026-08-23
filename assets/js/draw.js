/* ===================================================================
   Yerevan Project; THE DRAWING TOOLBAR
   -------------------------------------------------------------------
   A researcher looking at this map wants to say things about places
   the map does not yet hold: this block, that route, the area within
   four hundred metres of the plinth. Saying them needs two halves. The
   first is being able to draw the shape. The second, and the one that
   is usually missing, is being able to NAME it, so the shape can be
   spoken about afterwards rather than only looked at.

   So every shape here has a name, and the panel exists to give it one.
   "Copy for Claude" writes the whole set out as text: names, kinds,
   measurements and coordinates, in a form that can be pasted into a
   message and acted on. That is the point of the tool. The drawing is
   the easy half.

   Nothing is sent anywhere. Shapes live in this browser, under
   localStorage["yerevan.drawings"], until they are copied out or
   downloaded. data/drawings.json, if it exists, is loaded once as a
   published set: that is how a shape stops being a note to self and
   becomes part of the map for every reader.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var KEY = "yerevan.drawings";
  var SRC = "draw", TMP = "draw-tmp", VTX = "draw-vtx";

  var PALETTE = ["#c9262c", "#d8873f", "#d1b04a", "#5aa469", "#4f9dd1", "#7d5ba6", "#c2a25a", "#e6e8ec"];

  var map = null;
  var shapes = [];
  var mode = null;               /* null | point | line | area | rect | circle | select */
  var draft = null;              /* the shape being drawn */
  var hover = null;              /* cursor position, for the rubber band */
  var selected = null;           /* id of the selected shape */
  var dragVtx = -1;
  var labels = [];
  var open = false;

  /* ---------------- geometry ----------------
     Metres, not degrees. A length in degrees is not a length: one degree
     of longitude at this latitude is 850 m shorter than one of latitude,
     so anything measured without the cosine is wrong by a fifth. */

  var Rk = 6371008.8;
  function rad(d) { return d * Math.PI / 180; }

  function metres(a, b) {
    var p1 = rad(a[1]), p2 = rad(b[1]);
    var dp = p2 - p1, dl = rad(b[0] - a[0]);
    var s = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * Rk * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function lineLength(c) {
    var s = 0, i;
    for (i = 0; i < c.length - 1; i++) s += metres(c[i], c[i + 1]);
    return s;
  }

  /* Spherical excess. A planar shoelace would do at this scale, but this
     costs nothing and stays honest if a shape is ever drawn across the
     region rather than across a square. */
  function ringArea(c) {
    if (c.length < 3) return 0;
    var s = 0, i, n = c.length;
    for (i = 0; i < n; i++) {
      var a = c[i], b = c[(i + 1) % n];
      s += rad(b[0] - a[0]) * (2 + Math.sin(rad(a[1])) + Math.sin(rad(b[1])));
    }
    return Math.abs(s * Rk * Rk / 2);
  }

  function centroid(c) {
    var x = 0, y = 0, i;
    for (i = 0; i < c.length; i++) { x += c[i][0]; y += c[i][1]; }
    return [x / c.length, y / c.length];
  }

  function circleRing(centre, r, n) {
    n = n || 72;
    var out = [], i;
    var dLat = r / 110540;
    var dLng = r / (111320 * Math.cos(rad(centre[1])));
    for (i = 0; i <= n; i++) {
      var t = i / n * Math.PI * 2;
      out.push([centre[0] + Math.cos(t) * dLng, centre[1] + Math.sin(t) * dLat]);
    }
    return out;
  }

  function rectRing(a, b) {
    return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]];
  }

  /* ---------------- the shapes themselves ---------------- */

  function ring(s) {
    if (s.kind === "circle") return circleRing(s.centre, s.radius);
    if (s.kind === "rect") return rectRing(s.coords[0], s.coords[1]);
    return s.coords;
  }

  function isArea(s) { return s.kind === "area" || s.kind === "rect" || s.kind === "circle"; }

  function measure(s) {
    if (s.kind === "point") return null;
    if (s.kind === "circle") {
      return { area: Math.PI * s.radius * s.radius, len: 2 * Math.PI * s.radius, r: s.radius };
    }
    var c = ring(s);
    if (s.kind === "line") return { len: lineLength(c) };
    var closed = c.slice();
    if (closed.length && (closed[0][0] !== closed[closed.length - 1][0] ||
                          closed[0][1] !== closed[closed.length - 1][1])) closed.push(closed[0]);
    return { area: ringArea(c), len: lineLength(closed) };
  }

  function fmtLen(m) {
    if (m == null) return "";
    return m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m";
  }
  function fmtArea(a) {
    if (a == null) return "";
    if (a >= 1e6) return (a / 1e6).toFixed(2) + " km2";
    if (a >= 1e4) return (a / 1e4).toFixed(2) + " ha";
    return Math.round(a) + " m2";
  }
  function measureText(s) {
    var m = measure(s);
    if (!m) return "";
    if (s.kind === "line") return fmtLen(m.len);
    if (s.kind === "circle") return "r " + fmtLen(m.r) + " · " + fmtArea(m.area);
    return fmtArea(m.area) + " · " + fmtLen(m.len);
  }

  function anchor(s) {
    if (s.kind === "point") return s.coords[0];
    if (s.kind === "circle") return s.centre;
    return centroid(ring(s));
  }

  /* ---------------- storage ---------------- */

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(shapes)); }
    catch (e) { /* a full or blocked store is not a reason to stop drawing */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) shapes = JSON.parse(raw) || [];
    } catch (e) { shapes = []; }
    if (!Array.isArray(shapes)) shapes = [];
  }

  function uid() {
    return "s" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function t(k, v) { return window.I18N ? I18N.t(k, v) : k; }

  function nextName(kind) {
    var n = shapes.length + 1;
    var used = {};
    shapes.forEach(function (s) { used[s.name] = 1; });
    var base = t("draw.kind." + kind);
    while (used[base + " " + n]) n++;
    return base + " " + n;
  }

  /* ---------------- rendering ---------------- */

  function fc(features) { return { type: "FeatureCollection", features: features || [] }; }

  function geomOf(s) {
    if (s.kind === "point") return { type: "Point", coordinates: s.coords[0] };
    if (s.kind === "line") return { type: "LineString", coordinates: s.coords };
    return { type: "Polygon", coordinates: [ring(s)] };
  }

  /* Two levels, and the split matters. paintGeom runs on every frame of a
     vertex drag; paint also rebuilds the labels and the list, which means
     tearing down markers and replacing DOM. Doing that sixty times a second
     is not just slow, it destroys whatever input the reader is typing in. */
  function paintGeom() {
    if (!map || !map.getSource(SRC)) return;
    map.getSource(SRC).setData(fc(shapes.filter(function (s) { return !s.hidden; }).map(function (s) {
      return {
        type: "Feature",
        properties: { id: s.id, color: s.color, sel: s.id === selected, kind: s.kind },
        geometry: geomOf(s)
      };
    })));
    paintVertices();
  }

  function paint() {
    paintGeom();
    paintLabels();
    renderList();
  }

  function paintVertices() {
    if (!map.getSource(VTX)) return;
    var s = byId(selected);
    if (!s || mode !== "select" || s.hidden) { map.getSource(VTX).setData(fc()); return; }
    var pts;
    if (s.kind === "circle") pts = [s.centre, circleRing(s.centre, s.radius, 4)[0]];
    else if (s.kind === "rect") pts = s.coords;
    else pts = s.coords;
    map.getSource(VTX).setData(fc(pts.map(function (p, i) {
      return { type: "Feature", properties: { i: i, color: s.color }, geometry: { type: "Point", coordinates: p } };
    })));
  }

  function paintDraft() {
    if (!map || !map.getSource(TMP)) return;
    if (!draft) { map.getSource(TMP).setData(fc()); return; }
    var f = [], c = draft.coords.slice();
    if (draft.kind === "circle" && draft.centre) {
      var r = hover ? metres(draft.centre, hover) : 0;
      f.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(draft.centre, Math.max(1, r))] } });
      f.push({ type: "Feature", properties: { band: true }, geometry: { type: "LineString", coordinates: [draft.centre, hover || draft.centre] } });
    } else if (draft.kind === "rect" && c.length === 1) {
      if (hover) f.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [rectRing(c[0], hover)] } });
    } else if (c.length) {
      var live = hover ? c.concat([hover]) : c;
      if (draft.kind === "area" && live.length > 2) {
        f.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [live.concat([live[0]])] } });
      }
      f.push({ type: "Feature", properties: { band: true }, geometry: { type: "LineString", coordinates: live.length > 1 ? live : [live[0], live[0]] } });
      c.forEach(function (p, i) {
        f.push({ type: "Feature", properties: { vtx: true, first: i === 0 }, geometry: { type: "Point", coordinates: p } });
      });
    }
    map.getSource(TMP).setData(fc(f));
    liveReadout();
  }

  function liveReadout() {
    var box = $("draw-live");
    if (!box) return;
    if (!draft) { box.hidden = true; return; }
    var txt = "";
    if (draft.kind === "circle" && draft.centre && hover) txt = "r " + fmtLen(metres(draft.centre, hover));
    else if (draft.kind === "rect" && draft.coords.length === 1 && hover) {
      txt = fmtArea(ringArea(rectRing(draft.coords[0], hover)));
    } else if (draft.coords.length) {
      var live = hover ? draft.coords.concat([hover]) : draft.coords;
      txt = fmtLen(lineLength(live));
      if (draft.kind === "area" && live.length > 2) txt = fmtArea(ringArea(live)) + " · " + txt;
    }
    box.textContent = txt + (txt ? "   " : "") + t("draw.hint." + draft.kind);
    box.hidden = !txt && !draft;
  }

  function clearLabels() {
    labels.forEach(function (m) { m.remove(); });
    labels = [];
  }

  var labelSig = "";
  function paintLabels(force) {
    var sig = shapes.map(function (s) {
      return s.id + "|" + s.name + "|" + s.hidden + "|" + s.color + "|" + (s.id === selected);
    }).join(";") + "|" + open;
    if (!force && sig === labelSig) return;
    labelSig = sig;
    clearLabels();
    shapes.forEach(function (s) {
      if (s.hidden) return;
      var el = document.createElement("div");
      el.className = "draw-label" + (s.id === selected ? " on" : "");
      el.style.setProperty("--dc", s.color);
      el.innerHTML = '<b></b><span></span>';
      el.querySelector("b").textContent = s.name;
      el.querySelector("span").textContent = measureText(s);
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        ensureSelect(); select(s.id, true);
      });
      labels.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -6] })
        .setLngLat(anchor(s)).addTo(map));
    });
  }

  function addLayers() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: "geojson", data: fc() });
    map.addSource(TMP, { type: "geojson", data: fc() });
    map.addSource(VTX, { type: "geojson", data: fc() });

    map.addLayer({
      id: "draw-fill", type: "fill", source: SRC,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "sel"], 0.3, 0.16] }
    });
    map.addLayer({
      id: "draw-line", type: "line", source: SRC,
      filter: ["!=", ["geometry-type"], "Point"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["case", ["get", "sel"], 3.6, 2.2],
        "line-opacity": 0.95
      }
    });
    map.addLayer({
      id: "draw-point", type: "circle", source: SRC,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["case", ["get", "sel"], 8, 6],
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2, "circle-stroke-color": "#0f1115"
      }
    });

    map.addLayer({
      id: "draw-tmp-fill", type: "fill", source: TMP,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": "#e6e8ec", "fill-opacity": 0.12 }
    });
    map.addLayer({
      id: "draw-tmp-line", type: "line", source: TMP,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: { "line-color": "#e6e8ec", "line-width": 1.8, "line-dasharray": [2.2, 1.8] }
    });
    map.addLayer({
      id: "draw-tmp-vtx", type: "circle", source: TMP,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["case", ["get", "first"], 7, 4.5],
        "circle-color": ["case", ["get", "first"], "#c9262c", "#e6e8ec"],
        "circle-stroke-width": 1.6, "circle-stroke-color": "#0f1115"
      }
    });

    map.addLayer({
      id: "draw-vtx", type: "circle", source: VTX,
      paint: {
        "circle-radius": 6, "circle-color": "#ffffff",
        "circle-stroke-width": 2.4, "circle-stroke-color": ["get", "color"]
      }
    });
    raise();
  }

  var ORDER = ["draw-fill", "draw-line", "draw-point", "draw-tmp-fill",
               "draw-tmp-line", "draw-tmp-vtx", "draw-vtx"];

  /* After a basemap change everything is rebuilt, and whoever finishes first
     ends up at the bottom. This file has the fastest retry, so without this it
     wins the race and the reader's own shapes end up underneath the buildings
     they were drawn over. Nothing you draw should be hidden by the map. */
  function raise() {
    try {
      ORDER.forEach(function (id) { if (map.getLayer(id)) map.moveLayer(id); });
    } catch (e) { /* mid style swap; the idle handler will do it */ }
  }

  function onTop() {
    var ls = map.getStyle && map.getStyle().layers;
    if (!ls || !ls.length) return true;
    return ls[ls.length - 1].id === "draw-vtx";
  }

  function byId(id) {
    for (var i = 0; i < shapes.length; i++) if (shapes[i].id === id) return shapes[i];
    return null;
  }

  /* ---------------- drawing ---------------- */

  function setMode(m) {
    if (mode === m) m = null;
    cancelDraft();
    mode = m;
    if (m && !open) setOpen(true);
    document.querySelectorAll(".draw-tool").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tool") === mode);
    });
    if (map) {
      map.getCanvas().style.cursor = (mode && mode !== "select") ? "crosshair" : "";
      if (mode && mode !== "select") map.doubleClickZoom.disable();
      else map.doubleClickZoom.enable();
    }
    if (mode !== "select") { selected = null; }
    paint();
    liveReadout();
  }

  function cancelDraft() {
    draft = null; hover = null;
    paintDraft();
  }

  function startDraft(kind, at) {
    draft = { kind: kind, coords: [], centre: null };
    if (kind === "circle") draft.centre = at;
    else draft.coords.push(at);
  }

  function commit(kind, coords, centre, radius) {
    var s = {
      id: uid(), kind: kind,
      name: nextName(kind),
      color: PALETTE[shapes.length % PALETTE.length],
      note: "",
      coords: coords || [],
      created: new Date().toISOString().slice(0, 10)
    };
    if (centre) s.centre = centre;
    if (radius) s.radius = radius;
    shapes.push(s);
    save();
    cancelDraft();
    setMode("select");
    select(s.id, false);
    paint();
    var inp = document.querySelector('.draw-item[data-id="' + s.id + '"] .draw-name');
    if (inp) { inp.focus(); inp.select(); }
    return s;
  }

  function finishDraft() {
    if (!draft) return;
    var k = draft.kind, c = draft.coords;
    if (k === "line" && c.length >= 2) commit("line", c.slice());
    else if (k === "area" && c.length >= 3) commit("area", c.slice());
    else cancelDraft();
  }

  function onClick(e) {
    if (!mode || mode === "select") return;
    var at = [e.lngLat.lng, e.lngLat.lat];

    if (mode === "point") { commit("point", [at]); return; }

    if (!draft) { startDraft(mode, at); paintDraft(); return; }

    if (mode === "circle") {
      var r = metres(draft.centre, at);
      if (r < 1) return;
      commit("circle", [], draft.centre, r);
      return;
    }
    if (mode === "rect") {
      commit("rect", [draft.coords[0], at]);
      return;
    }
    /* line and area: clicking the first vertex again closes the shape */
    if (draft.coords.length > 1) {
      var p = map.project(draft.coords[0]), q = map.project(at);
      if (Math.hypot(p.x - q.x, p.y - q.y) < 12) { finishDraft(); return; }
    }
    draft.coords.push(at);
    paintDraft();
  }

  /* ---------------- selection and editing ---------------- */

  /* setMode toggles, which is right for a toolbar button and wrong everywhere
     else: asking for select mode when select mode is already on must not turn
     it off. Everything that selects goes through here. */
  function ensureSelect() { if (mode !== "select") setMode("select"); }

  function select(id, fly) {
    selected = id;
    paint();
    var row = document.querySelector('.draw-item[data-id="' + id + '"]');
    if (row) {
      document.querySelectorAll(".draw-item").forEach(function (r) { r.classList.remove("on"); });
      row.classList.add("on");
      row.scrollIntoView({ block: "nearest" });
    }
    if (fly) zoomTo(id);
  }

  function zoomTo(id) {
    var s = byId(id);
    if (!s) return;
    var pts = s.kind === "circle" ? circleRing(s.centre, s.radius, 16) : ring(s);
    if (s.kind === "point") { map.easeTo({ center: s.coords[0], zoom: Math.max(map.getZoom(), 16) }); return; }
    var b = pts.reduce(function (acc, p) {
      return [Math.min(acc[0], p[0]), Math.min(acc[1], p[1]), Math.max(acc[2], p[0]), Math.max(acc[3], p[1])];
    }, [180, 90, -180, -90]);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 90, duration: 700 });
  }

  function removeShape(id) {
    shapes = shapes.filter(function (s) { return s.id !== id; });
    if (selected === id) selected = null;
    save(); paint();
  }

  /* ---------------- the panel ---------------- */

  /* Update only what changes when the list must not be rebuilt. */
  function markRows() {
    document.querySelectorAll(".draw-item").forEach(function (r) {
      var id = r.getAttribute("data-id"), sh = byId(id);
      r.classList.toggle("on", id === selected);
      if (sh) {
        r.classList.toggle("off", !!sh.hidden);
        var sm = r.querySelector("small");
        if (sm) sm.textContent = t("draw.kind." + sh.kind) + "  ·  " + measureText(sh);
      }
    });
    var c = $("draw-count");
    if (c) c.textContent = shapes.length || "";
  }

  function listIsBusy() {
    var a = document.activeElement;
    return !!(a && a.closest && a.closest("#draw-list"));
  }

  function renderList() {
    var box = $("draw-list");
    if (!box) return;
    if (listIsBusy() && box.querySelectorAll(".draw-item").length === shapes.length) {
      markRows();
      return;
    }
    if (!shapes.length) {
      box.innerHTML = '<p class="draw-empty"></p>';
      box.querySelector("p").textContent = t("draw.empty");
      var cnt0 = $("draw-count"); if (cnt0) cnt0.textContent = "";
      return;
    }
    box.innerHTML = shapes.map(function (s) {
      return '<div class="draw-item' + (s.id === selected ? " on" : "") + (s.hidden ? " off" : "") +
             '" data-id="' + s.id + '">' +
               '<span class="draw-swatch" style="background:' + s.color + '"></span>' +
               '<div class="draw-meta">' +
                 '<input class="draw-name" type="text" value="">' +
                 '<small></small>' +
                 '<input class="draw-note" type="text" placeholder="">' +
               '</div>' +
               '<div class="draw-row-btns">' +
                 '<button class="draw-mini" data-act="zoom" title=""><svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L15 15" stroke="currentColor" stroke-width="1.5"/></svg></button>' +
                 '<button class="draw-mini" data-act="hide" title=""><svg viewBox="0 0 16 16"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/></svg></button>' +
                 '<button class="draw-mini" data-act="color" title=""><span style="background:' + s.color + '"></span></button>' +
                 '<button class="draw-mini danger" data-act="del" title="">&#215;</button>' +
               '</div>' +
             '</div>';
    }).join("");

    Array.prototype.forEach.call(box.querySelectorAll(".draw-item"), function (row) {
      var id = row.getAttribute("data-id"), s = byId(id);
      var nm = row.querySelector(".draw-name"), nt = row.querySelector(".draw-note");
      nm.value = s.name;
      nm.setAttribute("aria-label", t("draw.name"));
      nt.value = s.note || "";
      nt.placeholder = t("draw.notePh");
      row.querySelector("small").textContent = t("draw.kind." + s.kind) + "  ·  " + measureText(s);
      row.querySelector('[data-act="zoom"]').title = t("draw.zoom");
      row.querySelector('[data-act="hide"]').title = t("draw.hide");
      row.querySelector('[data-act="color"]').title = t("draw.colour");
      row.querySelector('[data-act="del"]').title = t("draw.del");

      nm.addEventListener("input", function () { s.name = nm.value; save(); paintLabels(); });
      nt.addEventListener("input", function () { s.note = nt.value; save(); });
      nm.addEventListener("focus", function () { ensureSelect(); selected = id; paintGeom(); markRows(); });
      row.addEventListener("click", function (ev) {
        if (ev.target.closest("input") || ev.target.closest("button")) return;
        ensureSelect(); select(id, true);
      });
      row.querySelector('[data-act="zoom"]').addEventListener("click", function () { select(id, true); });
      row.querySelector('[data-act="hide"]').addEventListener("click", function () {
        s.hidden = !s.hidden; save(); paint();
      });
      row.querySelector('[data-act="color"]').addEventListener("click", function () {
        s.color = PALETTE[(PALETTE.indexOf(s.color) + 1) % PALETTE.length]; save(); paint();
      });
      row.querySelector('[data-act="del"]').addEventListener("click", function () { removeShape(id); });
    });

    var cnt = $("draw-count");
    if (cnt) cnt.textContent = shapes.length;
  }

  /* ---------------- getting the shapes out ----------------
     The whole reason the tool exists. Text first, because text is what
     can be pasted into a message; the GeoJSON is for everything else. */

  function asText() {
    var lines = [t("draw.exportHead"), ""];
    shapes.forEach(function (s, i) {
      var m = measure(s), a = anchor(s);
      lines.push((i + 1) + '. "' + s.name + '"  [' + s.kind + "]" + (m ? "  " + measureText(s) : ""));
      lines.push("   centre " + a[1].toFixed(5) + " N, " + a[0].toFixed(5) + " E");
      if (s.note) lines.push("   note: " + s.note);
      if (s.kind === "circle") {
        lines.push("   circle centre [" + s.centre[0].toFixed(5) + "," + s.centre[1].toFixed(5) +
                   "] radius " + Math.round(s.radius) + " m");
      } else {
        lines.push("   coords " + JSON.stringify(ring(s).map(function (p) {
          return [+p[0].toFixed(5), +p[1].toFixed(5)];
        })));
      }
      lines.push("");
    });
    lines.push(t("draw.exportFoot"));
    lines.push(t("draw.exportAsk"));
    return lines.join("\n");
  }

  function asGeoJSON() {
    return {
      type: "FeatureCollection",
      note: "Drawn on the Yerevan Project map. Longitude, latitude. WGS84.",
      features: shapes.map(function (s) {
        return {
          type: "Feature",
          properties: {
            id: s.id, name: s.name, kind: s.kind, colour: s.color,
            note: s.note || "", drawn: s.created,
            radius_m: s.kind === "circle" ? Math.round(s.radius) : undefined,
            length_m: measure(s) ? Math.round(measure(s).len || 0) : undefined,
            area_m2: measure(s) && measure(s).area ? Math.round(measure(s).area) : undefined
          },
          geometry: geomOf(s)
        };
      })
    };
  }

  function flash(btn, key) {
    var old = btn.textContent;
    btn.textContent = t(key);
    btn.classList.add("ok");
    setTimeout(function () { btn.textContent = old; btn.classList.remove("ok"); }, 1400);
  }

  function copyText(btn) {
    var txt = asText();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.cssText = "position:fixed;top:-1000px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      ta.remove();
      flash(btn, "draw.copied");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { flash(btn, "draw.copied"); }, fallback);
    } else fallback();
  }

  function download() {
    var blob = new Blob([JSON.stringify(asGeoJSON(), null, 2)], { type: "application/geo+json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "yerevan-shapes.geojson";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function importFC(gj) {
    if (!gj || !gj.features) return 0;
    var n = 0;
    gj.features.forEach(function (f) {
      var g = f.geometry, p = f.properties || {};
      if (!g) return;
      var s = {
        id: uid(), name: p.name || nextName("area"), note: p.note || "",
        color: p.colour || p.color || PALETTE[shapes.length % PALETTE.length],
        created: p.drawn || new Date().toISOString().slice(0, 10), coords: []
      };
      if (g.type === "Point") { s.kind = "point"; s.coords = [g.coordinates]; }
      else if (g.type === "LineString") { s.kind = "line"; s.coords = g.coordinates; }
      else if (g.type === "Polygon") { s.kind = "area"; s.coords = g.coordinates[0]; }
      else return;
      if (p.radius_m && g.type === "Polygon") {
        s.kind = "circle"; s.centre = centroid(g.coordinates[0]); s.radius = p.radius_m;
      }
      shapes.push(s); n++;
    });
    if (n) { save(); paint(); }
    return n;
  }

  /* ---------------- chrome ---------------- */

  function setOpen(on) {
    open = on;
    $("app").classList.toggle("drawing", on);
    var b = $("draw-btn");
    if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    if (!on) { setModeSilently(null); selected = null; }
    paint();
  }

  function setModeSilently(m) {
    mode = m; cancelDraft();
    document.querySelectorAll(".draw-tool").forEach(function (x) { x.classList.remove("on"); });
    if (map) { map.getCanvas().style.cursor = ""; map.doubleClickZoom.enable(); }
  }

  var TOOLS = [
    ["point",  '<circle cx="10" cy="10" r="3.4" fill="currentColor"/><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".5"/>'],
    ["line",   '<path d="M3 15L8 7l4 5 5-9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'],
    ["area",   '<path d="M4 6l6-3 6 4-2 8-8 1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'],
    ["rect",   '<rect x="3.5" y="5" width="13" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["circle", '<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1.4" fill="currentColor"/>'],
    ["select", '<path d="M5 3l10 6-4.2 1.3L9 15z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>']
  ];

  function build() {
    var wrap = $("map-wrap");
    if (!wrap || $("draw-rail")) return;

    var rail = document.createElement("div");
    rail.id = "draw-rail";
    rail.innerHTML = TOOLS.map(function (tl) {
      return '<button type="button" class="draw-tool" data-tool="' + tl[0] + '">' +
             '<svg viewBox="0 0 20 20" aria-hidden="true">' + tl[1] + "</svg></button>";
    }).join("") + '<i class="draw-sep"></i>' +
      '<button type="button" class="draw-tool draw-clear" data-tool="__clear">' +
      '<svg viewBox="0 0 20 20"><path d="M5 6h10M8 6V4.5h4V6M6.5 6l.7 9h5.6l.7-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>';
    wrap.appendChild(rail);

    var panel = document.createElement("div");
    panel.id = "draw-panel";
    panel.innerHTML =
      '<div class="draw-head">' +
        '<b></b><span class="draw-n" id="draw-count"></span>' +
        '<button type="button" class="draw-x" id="draw-close">&#215;</button>' +
      '</div>' +
      '<div id="draw-list"></div>' +
      '<div class="draw-foot">' +
        '<button type="button" class="draw-act primary" id="draw-copy"></button>' +
        '<button type="button" class="draw-act" id="draw-dl"></button>' +
        '<button type="button" class="draw-act" id="draw-imp"></button>' +
        '<input type="file" id="draw-file" accept=".json,.geojson,application/json" hidden>' +
      '</div>';
    wrap.appendChild(panel);

    var live = document.createElement("div");
    live.id = "draw-live";
    live.hidden = true;
    wrap.appendChild(live);

    var btn = document.createElement("button");
    btn.id = "draw-btn";
    btn.type = "button";
    btn.className = "map-btn";
    btn.setAttribute("aria-pressed", "false");
    var ctl = $("map-controls");
    if (ctl) ctl.insertBefore(btn, ctl.firstChild);

    rail.addEventListener("click", function (e) {
      var b = e.target.closest(".draw-tool");
      if (!b) return;
      var tool = b.getAttribute("data-tool");
      if (tool === "__clear") {
        if (!shapes.length) return;
        if (window.confirm(t("draw.clearAsk"))) { shapes = []; selected = null; save(); paint(); }
        return;
      }
      setMode(tool);
    });

    btn.addEventListener("click", function () {
      setOpen(!open);
      /* On a phone this button lives inside the map-settings sheet, which is
         standing over the map you are about to draw on. Put it away. */
      var sheet = $("m-sheet");
      if (open && sheet && !sheet.hidden) sheet.hidden = true;
    });
    $("draw-close").addEventListener("click", function () { setOpen(false); });
    $("draw-copy").addEventListener("click", function () { copyText(this); });
    $("draw-dl").addEventListener("click", download);
    $("draw-imp").addEventListener("click", function () { $("draw-file").click(); });
    $("draw-file").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { importFC(JSON.parse(fr.result)); } catch (err) { /* not our file */ }
      };
      fr.readAsText(f);
      e.target.value = "";
    });

    labelChrome();
  }

  function labelChrome() {
    var b = $("draw-btn");
    if (b) { b.textContent = t("draw.title"); b.title = t("draw.titleLong"); }
    var h = document.querySelector("#draw-panel .draw-head b");
    if (h) h.textContent = t("draw.shapes");
    var c = $("draw-copy"); if (c) c.textContent = t("draw.copy");
    var d = $("draw-dl"); if (d) d.textContent = t("draw.download");
    var i = $("draw-imp"); if (i) i.textContent = t("draw.import");
    document.querySelectorAll(".draw-tool").forEach(function (x) {
      var k = x.getAttribute("data-tool");
      x.title = k === "__clear" ? t("draw.clear") : t("draw.tool." + k);
      x.setAttribute("aria-label", x.title);
    });
    renderList();
  }

  /* ---------------- wiring ---------------- */

  function wire() {
    addLayers();
    build();
    load();
    paint();

    /* the published set, if there is one */
    fetch("data/drawings.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (gj) {
        if (!gj) return;
        var have = {};
        shapes.forEach(function (s) { have[s.name] = 1; });
        var add = { type: "FeatureCollection", features: (gj.features || []).filter(function (f) {
          return !have[(f.properties || {}).name];
        }) };
        if (add.features.length) importFC(add);
      })
      .catch(function () {});

    map.on("click", onClick);
    map.on("mousemove", function (e) {
      if (!mode || mode === "select" || !draft) return;
      hover = [e.lngLat.lng, e.lngLat.lat];
      paintDraft();
    });
    map.on("dblclick", function (e) {
      if (draft && (mode === "line" || mode === "area")) { e.preventDefault(); finishDraft(); }
    });

    /* selecting and dragging vertices */
    map.on("click", "draw-fill", pick);
    map.on("click", "draw-line", pick);
    map.on("click", "draw-point", pick);
    function pick(e) {
      if (mode && mode !== "select") return;
      var f = e.features && e.features[0];
      if (!f) return;
      e.originalEvent.stopPropagation();
      ensureSelect();
      select(f.properties.id, false);
    }

    map.on("mousedown", "draw-vtx", function (e) {
      if (mode !== "select") return;
      e.preventDefault();
      dragVtx = e.features[0].properties.i;
      map.dragPan.disable();
    });
    map.on("mousemove", function (e) {
      if (dragVtx < 0) return;
      var s = byId(selected);
      if (!s) return;
      var at = [e.lngLat.lng, e.lngLat.lat];
      if (s.kind === "circle") {
        if (dragVtx === 0) s.centre = at;
        else s.radius = Math.max(1, metres(s.centre, at));
      } else {
        s.coords[dragVtx] = at;
        if (s.kind === "area" && dragVtx === 0 && s.coords.length > 2) {
          var last = s.coords.length - 1;
          if (s.coords[last][0] === s.coords[0][0]) s.coords[last] = at;
        }
      }
      paintGeom();
      markRows();
    });
    window.addEventListener("mouseup", function () {
      if (dragVtx < 0) return;
      dragVtx = -1;
      map.dragPan.enable();
      save();
      paint();
    });

    map.on("mouseenter", "draw-vtx", function () { if (mode === "select") map.getCanvas().style.cursor = "grab"; });
    map.on("mouseleave", "draw-vtx", function () { if (mode === "select") map.getCanvas().style.cursor = ""; });

    document.addEventListener("keydown", function (e) {
      if (!open) return;
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "").toUpperCase());
      if (e.key === "Escape") { if (draft) cancelDraft(); else setMode(null); return; }
      if (typing) return;
      if (e.key === "Enter" && draft) { finishDraft(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selected && mode === "select") {
        e.preventDefault(); removeShape(selected); return;
      }
      if (e.key === "Backspace" && draft && draft.coords.length) { draft.coords.pop(); paintDraft(); }
    });

    if (window.I18N) I18N.onChange(labelChrome);

    /* A style swap wipes every source and layer this file added, so they have
       to go back. One styledata handler is not enough: isStyleLoaded() is
       usually still false at the moment styledata fires, so the handler that
       would restore the drawing arrives too early and never fires again. The
       same bounded retry terrain.js needed, for the same reason. */
    var restore = 0, tries = 0;

    /* No isStyleLoaded() guard. That flag goes false and true again several
       times while a style settles, and a poll that only acts when it happens
       to sample a true tick can miss every one of them; measured in the lab,
       it missed on two runs in three. Adding a source is either possible or it
       throws, so ask by trying. */
    function tryRestore() {
      if (map.getSource(SRC)) { clearInterval(restore); restore = 0; return true; }
      try {
        addLayers(); paint();
        clearInterval(restore); restore = 0;
        /* Everything else is still rebuilding; take the top back once it has
           had time to finish. idle would be the right moment, but idle never
           arrives on a map whose tiles are failing, and the drawing has to
           survive that too. */
        setTimeout(raise, 1200);
        setTimeout(raise, 3200);
        return true;
      }
      catch (err) { return false; }
    }
    function armRestore() {
      if (restore || map.getSource(SRC)) return;
      tries = 0;
      restore = setInterval(function () {
        if (++tries > 80) { clearInterval(restore); restore = 0; return; }
        tryRestore();
      }, 150);
      tryRestore();
    }
    map.on("styledata", armRestore);
    map.on("style.load", armRestore);

    /* idle is the only moment everything else has certainly finished adding
       its own layers, so it is the moment to take the top back. The check is
       three property reads, and it runs only when the map has gone quiet. */
    map.on("idle", function () {
      if (map.getSource(SRC) && !onTop()) raise();
    });
    map.on("moveend", function () {
      if (map.getSource(SRC) && !onTop()) raise();
    });
  }

  var waited = 0;
  var timer = setInterval(function () {
    if (window.__map && window.__map.isStyleLoaded && window.__map.isStyleLoaded()) {
      clearInterval(timer);
      map = window.__map;
      try { wire(); } catch (err) { window.__drawErr = String(err && err.message || err); console.warn("draw:", err); }
    } else if (++waited > 300) {
      clearInterval(timer);
    }
  }, 150);

  window.DRAW = {
    active: function () { return !!(mode && mode !== "select"); },
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    shapes: function () { return shapes.slice(); },
    text: asText,
    geojson: asGeoJSON,
    add: importFC,
    clear: function () { shapes = []; selected = null; save(); paint(); }
  };

})();
