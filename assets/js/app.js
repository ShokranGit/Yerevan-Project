/* ===================================================================
   Yerevan Project — application logic
   -------------------------------------------------------------------
   Everything the map shows comes from data/events.json.
   You should not need to edit this file to add research material.
   =================================================================== */

(function () {
  "use strict";

  /* ---------------- configuration ---------------- */

  /* Three ways of seeing the same city.
     "kentron" is the figure-ground drawing from slide 10 of the proposal
     defence, rebuilt in 3D: grey fabric, red figure, dashed rings. */
  var BASEMAPS = {
    kentron: "assets/style-kentron.json",
    dark:    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    light:   "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
  };
  var BASEMAP_ORDER = ["kentron", "dark", "light"];
  var BASEMAP_LABEL = { kentron: "Figure-ground 3D", dark: "Dark", light: "Light" };

  var HOME  = { center: [44.5136, 40.1818], zoom: 14.4, pitch: 55, bearing: -24 };
  var HOME_FLAT = { center: [44.5136, 40.1830], zoom: 13.1, pitch: 0, bearing: 0 };

  /* palette — red and grey, from the proposal deck */
  var RED       = "#c9262c";
  var RED_DEEP  = "#8f1b20";
  var GREY_MASS = "#b8bcc2";
  /* Conventional cartographic water, for pools and fountain basins.
     Extruded barely half a metre, so it reads as a surface, not a block. */
  var WATER     = "#6fa8cf";
  var SRC = "events";
  var PLAY_MS = 18000; // full sweep duration

  /* ---------------- state ---------------- */

  var state = {
    raw: null,
    events: [],
    categories: [],
    activeCats: new Set(),
    query: "",
    sort: "date-asc",
    tMin: 0, tMax: 0,
    winStart: 0, winEnd: 0,
    cMin: Date.UTC(1900, 0, 1), cMax: Date.UTC(2000, 0, 1),
    cStart: Date.UTC(1900, 0, 1), cEnd: Date.UTC(2000, 0, 1),
    selectedId: null,
    basemap: "kentron",
    playing: false,
    playRAF: null
  };

  var map;
  var hoverPopup = new maplibregl.Popup({
    closeButton: false, closeOnClick: false, offset: 12, maxWidth: "260px"
  });

  /* ---------------- tiny helpers ---------------- */

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function parseDate(s) {
    if (!s) return null;
    var p = String(s).split("-");
    var y = +p[0], m = p.length > 1 ? +p[1] - 1 : 0, d = p.length > 2 ? +p[2] : 1;
    if (isNaN(y)) return null;
    return Date.UTC(y, m, d);
  }

  /* renders a date honouring its stated precision */
  function fmtDate(ev) {
    if (!ev.date) return "undated";
    var p = String(ev.date).split("-");
    var prec = ev.datePrecision || (p.length === 1 ? "year" : p.length === 2 ? "month" : "day");
    var out;
    if (prec === "year") out = p[0];
    else if (prec === "month") out = MONTHS[+p[1] - 1] + " " + p[0];
    else out = (+p[2]) + " " + MONTHS[+p[1] - 1] + " " + p[0];
    if (ev.dateEnd && ev.dateEnd !== ev.date) {
      var q = String(ev.dateEnd).split("-");
      var end = q.length === 1 ? q[0]
              : q.length === 2 ? MONTHS[+q[1] - 1] + " " + q[0]
              : (+q[2]) + " " + MONTHS[+q[1] - 1] + " " + q[0];
      out += " – " + end;
    }
    return out;
  }

  function fmtStamp(t) {
    var d = new Date(t);
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  function catById(id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i];
    }
    return { id: id, label: id, color: "#888" };
  }

  /* =================================================================
     LOAD
     ================================================================= */

  var KENTRON = null, FIGURE = null;

  Promise.all([
    fetch("data/kentron.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    fetch("data/figure.json",  { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ])
    .then(function (both) { KENTRON = both[0]; FIGURE = both[1]; })
    .then(function () { return fetch("data/events.json", { cache: "no-store" }); })
    .then(function (r) {
      if (!r.ok) throw new Error("events.json returned " + r.status);
      return r.json();
    })
    .then(init)
    .catch(function (err) {
      $("loading").innerHTML =
        '<div style="text-align:center;max-width:420px;line-height:1.7">' +
        '<strong style="color:#e6e8ec">Could not load data/events.json</strong><br>' +
        '<span style="font-size:12px">' + esc(err.message) + '</span><br><br>' +
        '<span style="font-size:12px">If you opened index.html directly from disk, run a local ' +
        'server instead:<br><code style="color:#d8873f">python3 -m http.server</code></span></div>';
      console.error(err);
    });

  /* =================================================================
     INIT
     ================================================================= */

  function init(data) {
    state.raw = data;
    state.categories = data.categories || [];
    state.events = (data.events || []).filter(function (e) {
      return e && e.coordinates && e.coordinates.length === 2;
    });

    /* normalise + derive */
    state.events.forEach(function (e) {
      e._t = parseDate(e.date);
      e._tEnd = parseDate(e.dateEnd) || e._t;
      e.categories = e.categories || [];
      e._search = [
        e.title, e.location, e.summary, e.analysis,
        (e.tags || []).join(" "), (e.actors || []).join(" ")
      ].join(" ").toLowerCase();
    });
    state.events = state.events.filter(function (e) { return e._t !== null; });

    /* --- co-located entries -------------------------------------------
       Several events share one address (the avenue itself, Opera Square).
       Drawn at their true coordinates they collapse into a single dot and
       all but one become unclickable. Entries sharing a location are fanned
       out on a small circle — roughly 15 m — purely for display. The stored
       coordinates are untouched.
       ------------------------------------------------------------------ */
    var byLoc = {};
    state.events.forEach(function (e) {
      var k = e.coordinates[0].toFixed(5) + "," + e.coordinates[1].toFixed(5);
      (byLoc[k] = byLoc[k] || []).push(e);
    });
    Object.keys(byLoc).forEach(function (k) {
      var group = byLoc[k];
      if (group.length < 2) { group[0]._display = group[0].coordinates; return; }
      var R = 0.00016;                                  /* ~18 m in latitude */
      var latScale = Math.cos(group[0].coordinates[1] * Math.PI / 180) || 1;
      group.forEach(function (e, i) {
        var a = (2 * Math.PI * i) / group.length - Math.PI / 2;
        e._display = [
          e.coordinates[0] + (R * Math.cos(a)) / latScale,
          e.coordinates[1] + R * Math.sin(a)
        ];
        e._fanned = true;
      });
    });

    /* --- timeline bounds ---------------------------------------------
       By default the timeline spans exactly the data, with a little padding
       so the first and last points aren't flush against the handles.
       meta.timelineStart / meta.timelineEnd override either end, so the
       timeline can hold open space for periods not yet filled in.
       ------------------------------------------------------------------ */
    var times = state.events.map(function (e) { return e._t; })
      .concat(state.events.map(function (e) { return e._tEnd; }));
    var dataMin = times.length ? Math.min.apply(null, times) : Date.UTC(2000, 0, 1);
    var dataMax = times.length ? Math.max.apply(null, times) : Date.UTC(2026, 0, 1);
    var pad = Math.max((dataMax - dataMin) * 0.02, 86400000 * 30);

    var meta = data.meta || {};
    var forcedMin = parseDate(meta.timelineStart);
    var forcedMax = parseDate(meta.timelineEnd);

    state.tMin = forcedMin !== null ? forcedMin : dataMin - pad;
    state.tMax = forcedMax !== null ? forcedMax : dataMax + pad;

    /* An entry falling outside an explicit range is not hidden: it is treated
       as STANDING CONTEXT — a condition that predates (or outlasts) the mapped
       period rather than an event inside it. Context entries stay visible at
       every timeline position and do not compress the scale. */

    state.winStart = state.tMin; state.winEnd = state.tMax;

    state.categories.forEach(function (c) { state.activeCats.add(c.id); });

    buildCategories();
    buildTimeline();
    buildAbout();
    wireUI();
    buildMap();
  }

  /* =================================================================
     MAP
     ================================================================= */

  var loaderHidden = false;
  var mapLoaded = false;
  function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    $("loading").classList.add("done");
  }

  function mapNotice(msg) {
    var n = document.createElement("div");
    n.style.cssText = "position:absolute;top:14px;left:14px;z-index:6;max-width:340px;" +
      "background:rgba(22,25,32,.95);border:1px solid #2a2f3a;border-left:2px solid #e8a13a;" +
      "border-radius:7px;padding:10px 13px;font-size:12px;line-height:1.55;color:#9aa1ad;" +
      "backdrop-filter:blur(8px)";
    n.innerHTML = msg;
    $("map-wrap").appendChild(n);
    setTimeout(function () { n.style.transition = "opacity .6s"; n.style.opacity = "0"; }, 9000);
    setTimeout(function () { n.remove(); }, 9800);
  }

  function buildMap() {
    map = new maplibregl.Map({
      container: "map",
      style: BASEMAPS[state.basemap],
      center: HOME.center,
      zoom: HOME.zoom,
      pitch: HOME.pitch,
      bearing: HOME.bearing,
      maxPitch: 70,
      attributionControl: { compact: true }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    /* Some styles never fire "load" — MapLibre only emits it after a first full
       render, and a style whose sources are still settling can skip it. "idle"
       always arrives. Boot from whichever comes first, exactly once. */
    var booted = false;
    function boot() {
      if (booted) return;
      booted = true;
      mapLoaded = true;
      window.__map = map;                 /* handy in the console */
      try { addFigureGround(); }
      catch (err) { window.__fgErr = String(err && err.message || err); console.warn("figure-ground:", err); }
      addLayers();
      refresh();
      hideLoader();
      wireMapFurniture();
      openFromHash();
    }

    map.on("load", boot);
    map.on("idle", function () { boot(); hideLoader(); });

    map.on("styledata", function () {
      if (!map.isStyleLoaded()) return;
      try { addFigureGround(); }
      catch (err) { window.__fgErr = String(err && err.message || err); }
      if (!map.getSource(SRC)) { addLayers(); refresh(); }
    });


    map.on("error", function (e) {
      console.warn("map error:", e && e.error ? e.error.message : e);
    });

    /* Failsafe: never let the loading screen trap the interface. The panel,
       timeline and filters are useful even if basemap tiles cannot be reached. */
    setTimeout(function () {
      hideLoader();
      if (!mapLoaded) {
        refresh();
        mapNotice("<strong style=\"color:#e6e8ec\">Basemap did not load.</strong><br>" +
          "The timeline, themes and event list still work. This is usually a network " +
          "or firewall problem reaching the map tile server.");
      }
    }, 20000);
  }

  function addLayers() {
    if (map.getSource(SRC)) return;   /* styledata may have run first */
    map.addSource(SRC, { type: "geojson", data: emptyFC() });

    /* soft glow beneath */
    map.addLayer({
      id: "ev-glow", type: "circle", source: SRC,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 18, 17, 30],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.13,
        "circle-blur": 0.9
      }
    });

    /* main dot */
    map.addLayer({
      id: "ev-dot", type: "circle", source: SRC,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          10, ["case", ["boolean", ["feature-state", "selected"], false], 8, 5],
          14, ["case", ["boolean", ["feature-state", "selected"], false], 12, 8],
          17, ["case", ["boolean", ["feature-state", "selected"], false], 17, 12]
        ],
        "circle-color": ["get", "color"],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.5],
        "circle-stroke-color": state.basemap === "dark" ? "#ffffff" : "#22262c",
        "circle-stroke-opacity": 0.9,
        "circle-opacity": 0.95
      }
    });

    map.on("mouseenter", "ev-dot", function (e) {
      map.getCanvas().style.cursor = "pointer";
      var f = e.features[0];
      hoverPopup.setLngLat(f.geometry.coordinates)
        .setHTML(
          '<div class="pop-date">' + esc(f.properties.dateLabel) + '</div>' +
          '<div class="pop-title">' + esc(f.properties.title) + '</div>'
        ).addTo(map);
    });
    map.on("mouseleave", "ev-dot", function () {
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
    });
    map.on("click", "ev-dot", function (e) {
      selectEvent(e.features[0].properties.id, false);
    });
  }


  /* =================================================================
     FIGURE AND GROUND
     -------------------------------------------------------------------
     Slide 10 of the proposal defence draws Kentron as figure-ground: the
     fabric of the city in outline, the buildings that frame the two
     squares and the avenue filled solid, the squares and the downtown
     ringed in dashed line. This rebuilds that drawing in three
     dimensions from OpenStreetMap building heights.

     Which buildings are "figure" is decided by an explicit spatial rule
     held in data/kentron.json — a 75 m buffer along the Opera–Republic
     axis plus the two squares — not by a hand-picked list. Change the
     rule there and the drawing follows.
     ================================================================= */

  function addFigureGround() {
    if (state.basemap !== "kentron") return;

    /* The figure: the buildings Alireza marked dark on slide 10. These are real
       OpenStreetMap footprints with real heights, extracted once and stored in
       data/figure.json — not selected at runtime. Deterministic, reviewable,
       and identical for every reader. */
    if (FIGURE && !map.getSource("figure")) {
      map.addSource("figure", { type: "geojson", data: FIGURE });
      /* Water is drawn FLAT, not extruded, and this is not a style preference.
         MapLibre anchors each extruded prism to a single ground elevation, so a
         low prism sitting on sloping ground gets swallowed by the hill on its
         uphill side. Republic Square falls 1.9 m across the Singing Fountains
         basin — 3.4 m once the 1.8x terrain exaggeration is applied — so half
         the pool disappeared at 0.5 m, and the height needed to survive would
         have made a shallow pool into a four-metre wall. A fill layer drapes
         over the terrain instead: every part of the pool is blue, and it
         follows the slope of the square, which is what a pool actually does. */
      map.addLayer({
        id: "figure-water", type: "fill", source: "figure",
        filter: ["==", ["get", "zone"], "water"],
        paint: { "fill-color": WATER, "fill-opacity": 0.9 }
      });
      map.addLayer({
        id: "figure-buildings", type: "fill-extrusion", source: "figure",
        filter: ["!=", ["get", "zone"], "water"],
        paint: {
          "fill-extrusion-color": ["match", ["get", "zone"], "republic", RED, GREY_MASS],
          "fill-extrusion-height": ["coalesce", ["get", "h"], 12],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.96,
          "fill-extrusion-vertical-gradient": true
        }
      });
    }

    if (KENTRON && KENTRON.rings && !map.getSource("rings")) {
      map.addSource("rings", { type: "geojson", data: KENTRON.rings });
      map.addLayer({
        id: "ring-kentron", type: "line", source: "rings",
        filter: ["==", ["get", "kind"], "kentron"],
        paint: { "line-color": "#3d4148", "line-width": 2.4, "line-dasharray": [3, 2.4], "line-opacity": 0.85 }
      });
      map.addLayer({
        id: "ring-squares", type: "line", source: "rings",
        filter: ["==", ["get", "kind"], "square"],
        paint: { "line-color": RED, "line-width": 2.6, "line-dasharray": [2.4, 2], "line-opacity": 0.95 }
      });
      map.addLayer({
        id: "ring-axis", type: "line", source: "rings",
        filter: ["==", ["get", "kind"], "axis"],
        paint: { "line-color": RED_DEEP, "line-width": 3, "line-dasharray": [1.4, 1.4], "line-opacity": 0.8 }
      });
    }
    window.__fg = { figure: FIGURE ? FIGURE.features.length : 0 };
  }

  function resetFigureGround() { /* nothing cached any more */ }

  function emptyFC() { return { type: "FeatureCollection", features: [] }; }

  /* =================================================================
     FILTER + REFRESH
     ================================================================= */

  /* Two time axes now cover the material: the century track (1900–2000) and
     the main track (2000 onward). An entry is in view if it falls inside
     either window. Anything older than 1900 is standing context. */
  function isContext(e) {
    return e._tEnd < state.cMin || e._t > state.tMax;
  }

  function inWindow(e) {
    if (isContext(e)) return true;
    var modern  = !(e._tEnd < state.winStart || e._t > state.winEnd);
    var century = !(e._tEnd < state.cStart   || e._t > state.cEnd);
    return modern || century;
  }

  function visibleEvents() {
    var q = state.query.trim().toLowerCase();
    return state.events.filter(function (e) {
      if (!inWindow(e)) return false;
      if (state.categories.length) {
        var hit = e.categories.some(function (c) { return state.activeCats.has(c); });
        if (!hit && e.categories.length) return false;
        if (!e.categories.length && state.activeCats.size === 0) return false;
      }
      if (q && e._search.indexOf(q) === -1) return false;
      return true;
    });
  }

  function sortEvents(list) {
    var s = state.sort;
    return list.slice().sort(function (a, b) {
      if (s === "title") return (a.title || "").localeCompare(b.title || "");
      return s === "date-desc" ? b._t - a._t : a._t - b._t;
    });
  }

  function refresh() {
    var vis = sortEvents(visibleEvents());

    if (map && map.getSource(SRC)) {
      map.getSource(SRC).setData({
        type: "FeatureCollection",
        features: vis.map(function (e) {
          return {
            type: "Feature",
            id: hashId(e.id),
            geometry: { type: "Point", coordinates: e._display || e.coordinates },
            properties: {
              id: e.id,
              title: e.title || "(untitled)",
              dateLabel: fmtDate(e),
              color: catById(e.categories[0]).color
            }
          };
        })
      });
      applySelectionState();
    }

    renderResults(vis);
    updateCategoryCounts();
    $("result-count").textContent = vis.length;
  }

  /* stable numeric id for feature-state */
  var idMap = {}, idSeq = 1;
  function hashId(s) {
    if (!(s in idMap)) idMap[s] = idSeq++;
    return idMap[s];
  }

  function applySelectionState() {
    if (!map || !map.getSource(SRC)) return;
    Object.keys(idMap).forEach(function (k) {
      map.setFeatureState({ source: SRC, id: idMap[k] }, { selected: k === state.selectedId });
    });
  }

  /* =================================================================
     PANEL — categories
     ================================================================= */

  function buildCategories() {
    var box = $("categories");
    box.innerHTML = "";
    state.categories.forEach(function (c) {
      var row = document.createElement("label");
      row.className = "cat";
      row.dataset.cat = c.id;
      row.innerHTML =
        '<span class="swatch" style="background:' + esc(c.color) + '"></span>' +
        '<span class="cat-label">' + esc(c.label) + '</span>' +
        '<span class="cat-count" data-count="' + esc(c.id) + '"></span>';
      row.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (state.activeCats.has(c.id)) state.activeCats.delete(c.id);
        else state.activeCats.add(c.id);
        syncCategoryUI();
        refresh();
      });
      box.appendChild(row);
    });
    syncCategoryUI();
  }

  function syncCategoryUI() {
    Array.prototype.forEach.call(document.querySelectorAll(".cat"), function (el) {
      el.classList.toggle("off", !state.activeCats.has(el.dataset.cat));
    });
  }

  function updateCategoryCounts() {
    var counts = {};
    state.events.forEach(function (e) {
      if (!inWindow(e)) return;
      e.categories.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), function (el) {
      el.textContent = counts[el.dataset.count] || 0;
    });
  }

  /* =================================================================
     PANEL — results list
     ================================================================= */

  function renderResults(list) {
    var ul = $("results");
    ul.innerHTML = "";
    if (!list.length) {
      ul.innerHTML = '<li class="empty">No events match the current filters.<br>' +
        'Widen the time window or re-enable a theme.</li>';
      return;
    }
    list.forEach(function (e) {
      var li = document.createElement("li");
      li.className = "res" + (e.id === state.selectedId ? " active" : "");
      li.innerHTML =
        '<div class="res-date">' + esc(fmtDate(e)) +
          (isContext(e) ? ' <span class="ctx">context</span>' : '') + '</div>' +
        '<div class="res-title">' + esc(e.title || "(untitled)") + '</div>' +
        '<div class="res-tags">' +
          e.categories.map(function (c) {
            var cat = catById(c);
            return '<span class="chip" style="border-color:' + esc(cat.color) + '55">' +
                   esc(cat.label) + '</span>';
          }).join("") +
        '</div>';
      li.addEventListener("click", function () { selectEvent(e.id, true); });
      ul.appendChild(li);
    });
  }

  /* =================================================================
     PANEL — detail view
     ================================================================= */

  function selectEvent(id, fly) {
    var e = state.events.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    state.selectedId = id;
    applySelectionState();
    history.replaceState(null, "", "#" + encodeURIComponent(id));

    if (fly !== false && map) {
      map.easeTo({ center: e._display || e.coordinates, zoom: Math.max(map.getZoom(), 16), duration: 900 });
    }

    var h = "";
    h += '<div class="d-date">' + esc(fmtDate(e)) + '</div>';
    h += '<h2 class="d-title">' + esc(e.title || "(untitled)") + '</h2>';
    if (e.location) h += '<div class="d-place">' + esc(e.location) + '</div>';

    if (e.categories.length) {
      h += '<div class="d-tags">' + e.categories.map(function (c) {
        var cat = catById(c);
        return '<span class="chip" style="border-color:' + esc(cat.color) +
               '88;color:' + esc(cat.color) + '">' + esc(cat.label) + '</span>';
      }).join("") + '</div>';
    }

    (e.media || []).forEach(function (m) { h += renderMedia(m); });

    if (e.summary) {
      h += '<div class="d-sec"><h3>What happened</h3><p>' + para(e.summary) + '</p></div>';
    }
    if (e.analysis) {
      h += '<div class="d-sec analysis"><h3>Analysis</h3><p>' + para(e.analysis) + '</p></div>';
    }
    if (e.actors && e.actors.length) {
      h += '<div class="d-sec"><h3>Actors</h3><ul>' +
           e.actors.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join("") + '</ul></div>';
    }
    if (e.tags && e.tags.length) {
      h += '<div class="d-sec"><h3>Keywords</h3><div class="d-tags">' +
           e.tags.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join("") +
           '</div></div>';
    }
    if (e.sources && e.sources.length) {
      h += '<div class="d-sec"><h3>Sources</h3><ul>' + e.sources.map(function (s) {
        if (typeof s === "string") return '<li>' + esc(s) + '</li>';
        return '<li>' + (s.url
          ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title || s.url) + '</a>'
          : esc(s.title || "")) + (s.note ? ' — ' + esc(s.note) : '') + '</li>';
      }).join("") + '</ul></div>';
    }
    if (e.fieldnote) {
      h += '<div class="d-sec"><h3>Field note</h3><p>' + para(e.fieldnote) + '</p></div>';
    }

    h += '<div class="d-actions">' +
         '<button data-act="zoom">Zoom here</button>' +
         '<button data-act="link">Copy link</button>' +
         '</div>';

    $("detail-body").innerHTML = h;
    $("detail-body").querySelectorAll(".embed-play").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = b.parentNode;
        box.innerHTML = '<iframe src="' + box.dataset.src +
          '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; ' +
          'gyroscope; picture-in-picture" allowfullscreen title="Embedded video"></iframe>';
      });
    });

    $("detail-body").querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.act === "zoom") {
          map.easeTo({ center: e._display || e.coordinates, zoom: 17, duration: 900 });
        } else {
          navigator.clipboard.writeText(location.href).then(function () {
            b.textContent = "Copied";
            setTimeout(function () { b.textContent = "Copy link"; }, 1400);
          });
        }
      });
    });

    $("browse-view").hidden = true;
    $("detail-view").hidden = false;
    $("detail-view").scrollTop = 0;
  }


  /* -----------------------------------------------------------------
     Media. Three kinds:
       image  — a still, shown inline
       video  — a self-hosted file (.webm/.mp4/.ogv), played inline
       embed  — YouTube/Vimeo, loaded only when the reader clicks, so
                no third-party request is made just by opening an entry
     Every item carries its own credit and licence, rendered under it.
     ----------------------------------------------------------------- */
  function mediaMeta(m) {
    var bits = [];
    if (m.caption) bits.push(esc(m.caption));
    var attrib = [];
    if (m.credit) attrib.push(esc(m.credit));
    if (m.license) {
      attrib.push(m.source
        ? '<a href="' + esc(m.source) + '" target="_blank" rel="noopener">' + esc(m.license) + '</a>'
        : esc(m.license));
    } else if (m.source) {
      attrib.push('<a href="' + esc(m.source) + '" target="_blank" rel="noopener">source</a>');
    }
    if (attrib.length) bits.push('<em>' + attrib.join(' · ') + '</em>');
    return bits.length ? '<figcaption>' + bits.join('<br>') + '</figcaption>' : '';
  }

  function renderMedia(m) {
    if (!m || !m.url && !m.embed) return "";
    var kind = m.type || (m.embed ? "embed" : "image");

    if (kind === "video") {
      return '<figure class="d-media"><video controls preload="none" playsinline ' +
             (m.poster ? 'poster="' + esc(m.poster) + '" ' : '') +
             'src="' + esc(m.url) + '"></video>' + mediaMeta(m) + '</figure>';
    }

    if (kind === "embed") {
      var src = esc(m.embed || m.url);
      return '<figure class="d-media"><div class="embed" data-src="' + src + '">' +
             (m.poster ? '<img src="' + esc(m.poster) + '" alt="" loading="lazy">' : '') +
             '<button class="embed-play" type="button" aria-label="Play video">&#9654;</button>' +
             '</div>' + mediaMeta(m) + '</figure>';
    }

    return '<figure class="d-media"><a href="' + esc(m.source || m.url) + '" target="_blank" rel="noopener">' +
           '<img src="' + esc(m.url) + '" alt="' + esc(m.caption || "") + '" loading="lazy"></a>' +
           mediaMeta(m) + '</figure>';
  }

  function para(txt) {
    return esc(txt).split(/\n{2,}/).join("</p><p>");
  }

  function closeDetail() {
    state.selectedId = null;
    applySelectionState();
    history.replaceState(null, "", location.pathname + location.search);
    $("detail-view").hidden = true;
    $("browse-view").hidden = false;
    refresh();
  }

  function openFromHash() {
    var id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (id) selectEvent(id, true);
  }

  /* =================================================================
     TIMELINE
     ================================================================= */

  function buildTimeline() {
    var s = $("tl-start"), e = $("tl-end");
    s.min = 0; s.max = 1000; s.value = 0;
    e.min = 0; e.max = 1000; e.value = 1000;

    /* density histogram */
    var BUCKETS = 60, hist = new Array(BUCKETS).fill(0);
    state.events.forEach(function (ev) {
      var f = (ev._t - state.tMin) / (state.tMax - state.tMin);
      if (f < 0 || f > 1) return;              /* standing context, not an event */
      var i = Math.min(BUCKETS - 1, Math.max(0, Math.floor(f * BUCKETS)));
      hist[i]++;
    });
    var peak = Math.max.apply(null, hist) || 1;
    $("tl-density").innerHTML = hist.map(function (n) {
      return '<span style="height:' + (n ? Math.max(2, (n / peak) * 20) : 0) + 'px"></span>';
    }).join("");

    /* year ticks */
    var y0 = new Date(state.tMin).getUTCFullYear(), y1 = new Date(state.tMax).getUTCFullYear();
    var span = y1 - y0, step = span > 24 ? 5 : span > 12 ? 3 : span > 6 ? 2 : 1;
    var ticks = [];
    for (var y = Math.ceil(y0 / step) * step; y <= y1; y += step) ticks.push(y);
    $("tl-ticks").innerHTML = ticks.map(function (t) { return "<span>" + t + "</span>"; }).join("");

    [s, e].forEach(function (input) {
      input.addEventListener("input", onSlide);
    });
    updateTimelineUI();
    buildCentury();
  }

  /* ---- the century track: 1900–2000, by decade ---- */
  function cFrac(t) { return (t - state.cMin) / (state.cMax - state.cMin); }

  function buildCentury() {
    var BUCKETS = 50, hist = new Array(BUCKETS).fill(0);
    state.events.forEach(function (ev) {
      var f = cFrac(ev._t);
      if (f < 0 || f > 1) return;
      hist[Math.min(BUCKETS - 1, Math.floor(f * BUCKETS))]++;
    });
    var peak = Math.max.apply(null, hist) || 1;
    $("cn-density").innerHTML = hist.map(function (n) {
      return '<span style="height:' + (n ? Math.max(2, (n / peak) * 18) : 0) + 'px"></span>';
    }).join("");

    var ticks = [];
    for (var y = 1900; y <= 2000; y += 20) ticks.push(y);
    $("cn-ticks").innerHTML = ticks.map(function (t) { return "<span>" + t + "</span>"; }).join("");

    ["cn-start", "cn-end"].forEach(function (id) {
      $(id).addEventListener("input", onCenturySlide);
    });
    updateCenturyUI();
  }

  function onCenturySlide() {
    var a = +$("cn-start").value, b = +$("cn-end").value;
    if (a > b) { if (this === $("cn-start")) { b = a; $("cn-end").value = a; } else { a = b; $("cn-start").value = b; } }
    state.cStart = state.cMin + (a / 1000) * (state.cMax - state.cMin);
    state.cEnd   = state.cMin + (b / 1000) * (state.cMax - state.cMin);
    updateCenturyUI();
    refresh();
  }

  function updateCenturyUI() {
    var a = +$("cn-start").value / 1000, b = +$("cn-end").value / 1000;
    $("cn-fill").style.left = (a * 100) + "%";
    $("cn-fill").style.width = ((b - a) * 100) + "%";
    $("cn-from").textContent = new Date(state.cStart).getUTCFullYear();
    $("cn-to").textContent   = new Date(state.cEnd).getUTCFullYear();
  }

  function onSlide() {
    var s = +$("tl-start").value, e = +$("tl-end").value;
    if (s > e) { if (this === $("tl-start")) { e = s; $("tl-end").value = s; } else { s = e; $("tl-start").value = e; } }
    state.winStart = state.tMin + (s / 1000) * (state.tMax - state.tMin);
    state.winEnd   = state.tMin + (e / 1000) * (state.tMax - state.tMin);
    updateTimelineUI();
    refresh();
  }

  function updateTimelineUI() {
    var s = +$("tl-start").value / 1000, e = +$("tl-end").value / 1000;
    var fill = $("tl-fill");
    fill.style.left = (s * 100) + "%";
    fill.style.width = ((e - s) * 100) + "%";
    $("tl-from").textContent = fmtStamp(state.winStart);
    $("tl-to").textContent = fmtStamp(state.winEnd);
  }

  function setWindow(sFrac, eFrac) {
    $("tl-start").value = Math.round(sFrac * 1000);
    $("tl-end").value = Math.round(eFrac * 1000);
    state.winStart = state.tMin + sFrac * (state.tMax - state.tMin);
    state.winEnd = state.tMin + eFrac * (state.tMax - state.tMin);
    updateTimelineUI();
    refresh();
  }

  function togglePlay() {
    if (state.playing) { stopPlay(); return; }
    state.playing = true;
    $("play-btn").classList.add("playing");
    $("play-btn").innerHTML = "&#10073;&#10073;";
    var startFrac = +$("tl-start").value / 1000;
    var from = startFrac, t0 = performance.now();
    if (+$("tl-end").value >= 1000) setWindow(startFrac, startFrac);

    function frame(now) {
      if (!state.playing) return;
      var p = Math.min(1, (now - t0) / PLAY_MS);
      setWindow(from, from + p * (1 - from));
      if (p < 1) state.playRAF = requestAnimationFrame(frame);
      else stopPlay();
    }
    state.playRAF = requestAnimationFrame(frame);
  }

  function stopPlay() {
    state.playing = false;
    if (state.playRAF) cancelAnimationFrame(state.playRAF);
    $("play-btn").classList.remove("playing");
    $("play-btn").innerHTML = "&#9654;";
  }

  /* =================================================================
     ABOUT
     ================================================================= */

  function buildAbout() {
    var m = (state.raw && state.raw.meta) || {};
    var h = "";
    if (m.description) h += "<p>" + para(m.description) + "</p>";
    if (m.author) h += "<p><strong>" + esc(m.author) + "</strong>" +
                       (m.affiliation ? " — " + esc(m.affiliation) : "") + "</p>";
    if (m.note) h += "<p>" + para(m.note) + "</p>";
    h += '<p style="font-size:12px;color:#6b7280;margin-top:22px">' +
         state.events.length + " events mapped · basemap © CARTO, © OpenStreetMap contributors" +
         (m.updated ? " · data updated " + esc(m.updated) : "") + "</p>";
    $("about-body").innerHTML = h;
  }

  /* =================================================================
     UI WIRING
     ================================================================= */


  /* =================================================================
     NORTH ARROW · COORDINATE READOUT
     ================================================================= */

  function wireMapFurniture() {
    var arrow = $("north");

    function syncArrow() {
      var b = map.getBearing();
      arrow.querySelector("svg").style.transform = "rotate(" + (-b).toFixed(1) + "deg)";
      arrow.classList.toggle("off-north", Math.abs(b) > 0.5);
    }
    map.on("rotate", syncArrow);
    map.on("pitch", syncArrow);
    syncArrow();

    arrow.addEventListener("click", function () {
      map.easeTo({ bearing: 0, duration: 700 });
    });

    /* Coordinates follow the pointer on a desktop and the centre of the map on
       a touch screen, where there is no pointer to follow. */
    var lat = $("coord-lat"), lng = $("coord-lng"), zm = $("coord-zoom");

    function show(ll) {
      var la = ll.lat, lo = ll.lng;
      lat.textContent = Math.abs(la).toFixed(5) + "° " + (la >= 0 ? "N" : "S");
      lng.textContent = Math.abs(lo).toFixed(5) + "° " + (lo >= 0 ? "E" : "W");
      zm.textContent  = "z" + map.getZoom().toFixed(1);
    }
    /* Scale bar, drawn into the same strip as the coordinates so the two can
       never overlap. Width is snapped to a round ground distance. */
    var bar = $("scale-bar"), barLabel = $("scale-label"), MAXPX = 88;

    function niceRound(d) {
      var pow = Math.pow(10, Math.floor(Math.log(d) / Math.LN10));
      var f = d / pow;
      return (f >= 5 ? 5 : f >= 3 ? 3 : f >= 2 ? 2 : 1) * pow;
    }

    function updateScale() {
      var y = map.getCanvas().clientHeight / 2;
      var a = map.unproject([0, y]), b = map.unproject([MAXPX, y]);
      var metres = a.distanceTo(b);
      if (!isFinite(metres) || metres <= 0) return;
      var round = niceRound(metres);
      bar.style.width = Math.max(18, Math.round(MAXPX * (round / metres))) + "px";
      barLabel.textContent = round >= 1000
        ? (round / 1000) + " km"
        : Math.round(round) + " m";
    }
    map.on("move", updateScale);
    map.on("zoom", updateScale);
    updateScale();

    map.on("mousemove", function (e) { show(e.lngLat); });
    map.on("mouseout", function () { show(map.getCenter()); });
    map.on("move", function () {
      if (!matchMedia("(hover: hover)").matches) show(map.getCenter());
      else zm.textContent = "z" + map.getZoom().toFixed(1);
    });
    show(map.getCenter());
  }

  function wireUI() {
    document.body.classList.toggle("light", state.basemap !== "dark");
    $("map-wrap").classList.toggle("on-light", state.basemap !== "dark");
    $("search").addEventListener("input", function () {
      state.query = this.value; refresh();
    });
    $("sort").addEventListener("change", function () {
      state.sort = this.value; refresh();
    });
    $("cat-all").addEventListener("click", function () {
      state.categories.forEach(function (c) { state.activeCats.add(c.id); });
      syncCategoryUI(); refresh();
    });
    $("cat-none").addEventListener("click", function () {
      state.activeCats.clear(); syncCategoryUI(); refresh();
    });
    $("detail-back").addEventListener("click", closeDetail);
    $("panel-toggle").addEventListener("click", function () {
      $("app").classList.toggle("panel-closed");
      setTimeout(function () { map && map.resize(); }, 300);
    });
    $("play-btn").addEventListener("click", togglePlay);
    $("tl-reset").addEventListener("click", function () { stopPlay(); setWindow(0, 1); });
    $("cn-reset").addEventListener("click", function () {
      $("cn-start").value = 0; $("cn-end").value = 1000;
      state.cStart = state.cMin; state.cEnd = state.cMax;
      updateCenturyUI(); refresh();
    });
    $("reset-btn").addEventListener("click", function () {
      var h = state.basemap === "kentron" ? HOME : HOME_FLAT;
      map.easeTo({ center: h.center, zoom: h.zoom, pitch: h.pitch, bearing: h.bearing, duration: 1100 });
    });
    $("about-btn").addEventListener("click", function () { $("about-modal").hidden = false; });
    $("about-close").addEventListener("click", function () { $("about-modal").hidden = true; });
    $("about-modal").addEventListener("click", function (e) {
      if (e.target === this) this.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (!$("about-modal").hidden) $("about-modal").hidden = true;
        else if (!$("detail-view").hidden) closeDetail();
      }
      if (e.key === " " && e.target === document.body) { e.preventDefault(); togglePlay(); }
    });
  }


})();
