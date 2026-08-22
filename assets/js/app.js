/* ===================================================================
   Yerevan Project, application logic
   -------------------------------------------------------------------
   Everything the map shows comes from data/events.json.
   You should not need to edit this file to add research material.
   =================================================================== */

(function () {
  "use strict";

  /* ---------------- configuration ---------------- */

  /* Ways of seeing the same city. "kentron" is the figure-ground drawing from
     slide 10 of the proposal defence, rebuilt in 3D: grey fabric, red figure,
     dashed rings. The others are there for checking the drawing against the
     world, satellite especially, when you want to see what is actually on a
     roof. Terrain and hillshade re-apply to whichever is chosen. */
  function rasterStyle(tiles, credit, maxzoom) {
    return {
      version: 8,
      sources: { base: { type: "raster", tiles: [tiles], tileSize: 256,
                         maxzoom: maxzoom || 19, attribution: credit } },
      layers: [{ id: "base", type: "raster", source: "base" }]
    };
  }
  var BASEMAPS = {
    kentron:   "assets/style-kentron.json",
    light:     "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    streets:   "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
    dark:      "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    satellite: rasterStyle(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      "Imagery &copy; Esri, Maxar, Earthstar Geographics", 19)
  };
  var BASEMAP_ORDER = ["kentron", "light", "streets", "dark", "satellite"];
  /* Basemap labels come from the dictionary, keyed by these same five ids. */

  var HOME  = { center: [44.5136, 40.1818], zoom: 14.4, pitch: 55, bearing: -24 };
  var HOME_FLAT = { center: [44.5136, 40.1830], zoom: 13.1, pitch: 0, bearing: 0 };

  /* palette; red and grey, from the proposal deck */
  var RED       = "#c9262c";
  /* forget-me-not purple: the flower adopted for the 1915 centenary, and the
     colour this map gives to 23-24 April of every year. */
  var COMMEM    = "#7d5ba6";
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
    episodes: [],
    winStart: 0, winEnd: 0,
    cMin: Date.UTC(1900, 0, 1), cMax: Date.UTC(2000, 0, 1),
    cStart: Date.UTC(1900, 0, 1), cEnd: Date.UTC(2000, 0, 1),
    selectedId: null,
    basemap: "kentron",
    cityPitch: 55,
    playing: false,
    playRAF: null
  };

  var map;
  var ROUTES = null, ROUTE_MARKS = null, ROUTE_ENDS = null;
  var routeRAF = null;
  var hoverPopup = new maplibregl.Popup({
    closeButton: false, closeOnClick: false, offset: 12, maxWidth: "260px"
  });

  /* ---------------- tiny helpers ---------------- */

  var $ = function (id) { return document.getElementById(id); };

  /* Three languages. i18n.js is loaded before this file, so these are safe to
     call at any point; the tiny guards are only for opening index.html with
     the script tag removed. */
  var t   = function (k, v) { return window.I18N ? I18N.t(k, v) : k; };
  var tr  = function (o, f) { return window.I18N ? I18N.tr(o, f) : (o && o[f]) || ""; };
  var trL = function (o, f) { return window.I18N ? I18N.trList(o, f) : (o && o[f]) || []; };
  var num = function (n) { return window.I18N ? I18N.num(n) : String(n); };

  function esc(s) {
    return String(s == null ? "" : s)
.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
.replace(/"/g, "&quot;");
  }

  function MONTH(i) { return window.I18N ? I18N.month(i) :
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]; }

  function parseDate(s) {
    if (!s) return null;
    var p = String(s).split("-");
    var y = +p[0], m = p.length > 1 ? +p[1] - 1 : 0, d = p.length > 2 ? +p[2] : 1;
    if (isNaN(y)) return null;
    return Date.UTC(y, m, d);
  }

  /* renders a date honouring its stated precision */
  function fmtDate(ev) {
    if (!ev.date) return t("date.undated");
    var p = String(ev.date).split("-");
    var prec = ev.datePrecision || (p.length === 1 ? "year" : p.length === 2 ? "month" : "day");
    var out;
    if (prec === "year") out = num(p[0]);
    else if (prec === "month") out = MONTH(+p[1] - 1) + " " + num(p[0]);
    else out = num(+p[2]) + " " + MONTH(+p[1] - 1) + " " + num(p[0]);
    if (ev.dateEnd && ev.dateEnd !== ev.date) {
      var q = String(ev.dateEnd).split("-");
      var end = q.length === 1 ? num(q[0])
              : q.length === 2 ? MONTH(+q[1] - 1) + " " + num(q[0])
              : num(+q[2]) + " " + MONTH(+q[1] - 1) + " " + num(q[0]);
      out += " – " + end;
    }
    return out;
  }

  function fmtStamp(t) {
    var d = new Date(t);
    return MONTH(d.getUTCMonth()) + " " + num(d.getUTCFullYear());
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

  var KENTRON = null, FIGURE = null, GAZ = null;

  function getJSON(u) {
    return fetch(u, { cache: "no-store" })
.then(function (r) { return r.ok ? r.json() : null; })
.catch(function () { return null; });
  }

  Promise.all([
    getJSON("data/kentron.json"),
    getJSON("data/figure.json"),
    getJSON("data/places.json")
  ])
.then(function (all) { KENTRON = all[0]; FIGURE = all[1]; GAZ = all[2]; })
.then(function () { return fetch("data/events.json", { cache: "no-store" }); })
.then(function (r) {
      if (!r.ok) throw new Error("events.json returned " + r.status);
      return r.json();
    })
.then(init)
.catch(function (err) {
      $("loading").innerHTML =
        '<div style="text-align:center;max-width:420px;line-height:1.7">' +
        '<strong style="color:#e6e8ec">' + esc(t("err.load")) + '</strong><br>' +
        '<span style="font-size:12px">' + esc(err.message) + '</span><br><br>' +
        '<span style="font-size:12px">' + esc(t("err.localhint")) +
        '<br><code style="color:#d8873f">python3 -m http.server</code></span></div>';
      console.error(err);
    });

  /* =================================================================
     INIT
     ================================================================= */

  function init(data) {
    state.raw = data;
    state.categories = data.categories || [];
    state.episodes = data.episodes || [];
    state.events = (data.events || []).filter(function (e) {
      return e && e.coordinates && e.coordinates.length === 2;
    });

    /* normalise + derive */
    state.events.forEach(function (e) {
      e._t = parseDate(e.date);
      e._tEnd = parseDate(e.dateEnd) || e._t;
      e.categories = e.categories || [];
      /* Indexed in all three languages at once: a reader searching in
         Armenian should find an entry even while reading it in English, and
         the Latin-script keywords stay findable from every interface. */
      var bag = [];
      ["title", "location", "summary", "analysis", "fieldnote"].forEach(function (f) {
        ["", "_hy", "_fa"].forEach(function (sfx) { if (e[f + sfx]) bag.push(e[f + sfx]); });
      });
      ["tags", "actors"].forEach(function (f) {
        ["", "_hy", "_fa"].forEach(function (sfx) {
          if (e[f + sfx] && e[f + sfx].join) bag.push(e[f + sfx].join(" "));
        });
      });
      e._search = bag.join(" ").toLowerCase();
      /* An entry can carry more than one route; the genocide ceremony
         walks two, in different decades. The first is the primary: it is
         what the camera frames and what the replay button draws. The rest
         are drawn beside it by buildRoutes(). */
      if (e.paths && e.paths.length && !e.path) e.path = e.paths[0].path;
    });
    state.events = state.events.filter(function (e) { return e._t !== null; });

    /* Marches. Built here rather than at draw time: the chevrons are real
       geometry and there is no reason to recompute them on every repaint. */
    try { buildRoutes(); buildDispersal(); }
    catch (err) { window.__routeErr = String(err && err.message || err); console.warn("routes:", err); }

    /* --- co-located entries -------------------------------------------
       Several events share one address (the avenue itself, Opera Square).
       Drawn at their true coordinates they collapse into a single dot and
       all but one become unclickable. Entries sharing a location are fanned
       out on a small circle, roughly 15 m, purely for display. The stored
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
       as STANDING CONTEXT; a condition that predates (or outlasts) the mapped
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
    setTimeout(function () { n.style.transition = "opacity.6s"; n.style.opacity = "0"; }, 9000);
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

    /* Published immediately, not on load. Terrain and the coordinate picker
       both wait on this handle, and if the style is slow or a style never
       fires "load" they used to wait forever. It is also the only way to ask a
       real browser what the map is doing, which matters because this project's
       own automation tab is hidden and never renders a frame. */
    window.__map = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    /* Some styles never fire "load"; MapLibre only emits it after a first full
       render, and a style whose sources are still settling can skip it. "idle"
       always arrives. Boot from whichever comes first, exactly once. */
    var booted = false;
    function boot() {
      if (booted) return;
      booted = true;
      mapLoaded = true;
      try { addFigureGround(); }
      catch (err) { window.__fgErr = String(err && err.message || err); console.warn("figure-ground:", err); }
      addLayers();
      try { addRoutes(); addDispersal(); addGeoLink(); }
      catch (err) { window.__routeErr = String(err && err.message || err); console.warn("routes:", err); }
      refresh();
      hideLoader();
      wireMapFurniture();

      /* The small public surface other files talk to. graph3d.js uses it to
         list what the map holds about a node and to open an entry when one is
         clicked. Keep it this narrow, three functions, no internals. */
      window.YerevanMap = {
        events: function () { return state.events.slice(); },
        select: function (id) { selectEvent(id, true); },
        search: function (q) {
          state.query = q || "";
          var box = $("search"); if (box) box.value = state.query;
          refresh();
        }
      };

      openFromHash();
    }

    map.on("load", boot);
    map.on("idle", function () { boot(); hideLoader(); });

    /* Adding a layer fires "styledata", and this handler adds layers, so it
       feeds itself. Every call is guarded by an existence check, but rebuilding
       the place markers was not, and it ran on every event. Debounced, and the
       markers are only rebuilt when a style swap has actually wiped them. */
    var styleJob = 0;
    map.on("styledata", function () {
      if (styleJob) return;
      styleJob = setTimeout(function () {
        styleJob = 0;
        if (!map.isStyleLoaded()) return;
        try { addFigureGround(); }
        catch (err) { window.__fgErr = String(err && err.message || err); }
        if (!map.getSource(SRC)) { addLayers(); refresh(); }
        try { addRoutes(); addDispersal(); addGeoLink(); } catch (err) { window.__routeErr = String(err && err.message || err); }
        if (state.selectedId && !placeMarkers.length) {
          var sel = state.events.filter(function (x) { return x.id === state.selectedId; })[0];
          var wide = sel ? frameFor(sel) : null;
          if (wide) showPlaces(wide, sel);            /* a style swap wipes the markers */
        }
      }, 120);
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
        mapNotice('<strong style="color:#e6e8ec">' + esc(t("notice.basemap")) + "</strong><br>" +
          esc(t("notice.basemapBody")));
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


  function addRoutes() {
    if (!ROUTES || !ROUTES.features.length) return;
    if (map.getSource("routes")) return;

    map.addSource("routes",      { type: "geojson", data: ROUTES });
    map.addSource("route-marks", { type: "geojson", data: ROUTE_MARKS });
    map.addSource("route-ends",  { type: "geojson", data: ROUTE_ENDS });
    map.addSource("route-anim",  { type: "geojson", data: emptyFC() });

    /* a soft halo, so the line survives a busy basemap */
    map.addLayer({
      id: "route-halo", type: "line", source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#000000", "line-opacity": 0.22, "line-blur": 2,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 16, 11]
      }
    });
    map.addLayer({
      id: "route-line", type: "line", source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["coalesce", ["get", "color"], RED],
        /* A route that is no longer walked is drawn fainter than one that is.
           line-dasharray is the one paint property MapLibre will not accept an
           expression for, so the difference has to be carried by opacity. */
        "line-opacity": ["case",
          ["==", ["get", "past"], 1], 0.42,
          ["boolean", ["feature-state", "selected"], false], 0.95, 0.6],
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 16, 5],
        "line-dasharray": [2.2, 1.4]
      }
    });
    map.addLayer({
      id: "route-marks", type: "line", source: "route-marks",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff", "line-opacity": 0.8,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 2.4]
      }
    });
    /* the walk itself, drawn as it is described */
    map.addLayer({
      id: "route-anim", type: "line", source: "route-anim",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 7],
        "line-opacity": 0.95, "line-blur": 0.4
      }
    });

    /* Both ends carry their own entry: the meeting that set the march off and
       the place it was stopped. Hollow ring for the start, solid for the end. */
    map.addLayer({
      id: "route-end", type: "circle", source: "route-ends",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4.5, 16, 8],
        "circle-color": ["case", ["==", ["get", "kind"], "end"], RED, "#ffffff"],
        "circle-stroke-width": 2.4,
        "circle-stroke-color": ["case", ["==", ["get", "kind"], "end"], "#ffffff", RED],
        "circle-opacity": 0.98
      }
    });

    map.on("mouseenter", "route-end", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "route-end", function () { map.getCanvas().style.cursor = ""; });
    map.on("click", "route-end", function (e) {
      var go = e.features[0].properties.go;
      if (go) selectEvent(go, true);
    });
    map.on("mouseenter", "route-line", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "route-line", function () { map.getCanvas().style.cursor = ""; });
    map.on("click", "route-line", function (e) {
      selectEvent(e.features[0].properties.id, true);
    });
  }

  /* Draw the march along its own length. Roughly a kilometre a second, so a
     four-kilometre walk takes about four seconds; long enough to read as a
     journey, short enough that nobody waits for it. */
  function animateRoute(ev) {
    if (routeRAF) { cancelAnimationFrame(routeRAF); routeRAF = null; }
    var src = map.getSource("route-anim");
    if (!src || !ev.path) return;
    var L = ev._pathLen || pathLength(ev.path);
    var dur = Math.max(1600, Math.min(6000, L));
    var t0 = performance.now();
    function frame(now) {
      var f = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - f, 2);
      src.setData({ type: "FeatureCollection", features: [{
        type: "Feature", properties: {},
        geometry: { type: "LineString", coordinates: pathTo(ev.path, L * eased) }
      }] });
      if (f < 1) routeRAF = requestAnimationFrame(frame);
      else {
        routeRAF = null;
        setTimeout(function () {
          if (!routeRAF && map.getSource("route-anim")) map.getSource("route-anim").setData(emptyFC());
        }, 900);
      }
    }
    routeRAF = requestAnimationFrame(frame);
  }

  function clearRouteAnim() {
    if (routeRAF) { cancelAnimationFrame(routeRAF); routeRAF = null; }
    if (map && map.getSource("route-anim")) map.getSource("route-anim").setData(emptyFC());
  }

  /* =================================================================
     SCALE; when an entry is not in Yerevan
     -------------------------------------------------------------------
     Most of this map is one district of one city, and the camera flies
     to a point at street zoom. Some entries are not: the walk starts in
     Gyumri, the earthquake destroyed Spitak, the war was fought in
     Karabakh, and the axis Tamanyan drew points at a mountain in another
     country. Sending the reader there alone, at zoom 16, is worse than
     useless; a screen of unfamiliar streets with no way to tell where
     it is or how far from everything else in the argument.

     So an entry outside the city opens a bird's-eye view instead: north
     up, flat, framed to hold both Yerevan and the place, with both named
     on the map and a dashed line between them carrying the distance.
     The reader is never shown somewhere without being shown where it is.

     Which places to frame comes from `frame: ["gyumri"]` on the entry,
     read against data/places.json. An entry that is simply far away and
     names nothing gets framed against Yerevan automatically, so the rule
     holds even for material added later by someone who has not read this.
     ================================================================= */

  var CITY_RADIUS_M = 8000;      /* beyond this an entry is "not in Yerevan" */
  /* Room for the furniture: the timeline strip owns the bottom ~280 px and the
     two 3-D thumbnails the right edge. A place framed underneath either of them
     is a place the reader never sees. */
  var WIDE_PAD = { top: 110, bottom: 300, left: 90, right: 190 };
  var placeMarkers = [];

  function placeById(id) {
    if (!GAZ || !GAZ.places) return null;
    for (var i = 0; i < GAZ.places.length; i++) {
      if (GAZ.places[i].id === id) return GAZ.places[i];
    }
    return null;
  }

  function anchorPlace() {
    return placeById((GAZ && GAZ.anchor) || "yerevan");
  }

  /* The places an entry should be framed with, or null for the ordinary
     street-scale behaviour. */
  function frameFor(e) {
    var anchor = anchorPlace();
    var list = [];

    if (e.frame && e.frame.length) {
      e.frame.forEach(function (id) {
        var pl = placeById(id);
        if (pl) list.push(pl);
      });
    }

    var far = anchor ? metres(anchor.at, e.coordinates) > CITY_RADIUS_M : false;

    if (!list.length) {
      if (!far) return null;                        /* an ordinary Yerevan entry */
      /* Far away and unlabelled: frame it against the city anyway, using the
         entry's own place name so the marker still says something. */
      list.push({ id: "_entry", kind: "site", at: e.coordinates,
                  label: tr(e, "location") || tr(e, "title") });
    }

    if (anchor && !list.some(function (p) { return p.id === anchor.id; })) list.push(anchor);
    return list.length > 1 || far ? list : null;
  }

  /* west, south, east, north over points, boxes and sightlines alike; a line
     that runs off the edge of the frame is a line the reader cannot compare */
  function framedBounds(places, e) {
    var w = 180, s = 90, e2 = -180, n = -90;
    function eat(q) {
      if (q[0] < w) w = q[0]; if (q[0] > e2) e2 = q[0];
      if (q[1] < s) s = q[1]; if (q[1] > n) n = q[1];
    }
    places.forEach(function (p) {
      (p.bbox ? [[p.bbox[0], p.bbox[1]], [p.bbox[2], p.bbox[3]]] : [p.at]).forEach(eat);
    });
    sightlineFeatures(e || {}).forEach(function (f) {
      var c = f.geometry.coordinates;
      eat(c[0]); eat(c[c.length - 1]);
    });
    return [[w, s], [e2, n]];
  }

  /* -----------------------------------------------------------------
     DISPERSAL: one object, several addresses
     -----------------------------------------------------------------
     A march is a line a crowd walked. This is the other kind of line a
     city draws: the path an object took after it stopped being a
     monument. The Lenin of Republic Square is now a body in a museum
     courtyard, a pedestal in a municipal yard eight kilometres away,
     and a head nobody will name an address for. None of that is visible
     from any single photograph, and all of it is visible on a map.

     So: one origin, several destinations, an arc from the origin to each
     destination that has coordinates, and a station with no coordinates
     rendered as a row in the panel and nothing on the map. A missing
     address is data too, and drawing it anywhere would be a lie.
     ----------------------------------------------------------------- */

  /* One line to ask a real browser what happened. Claude's automation tab is
     hidden, never runs requestAnimationFrame and therefore never finishes
     loading a map, so when Alireza says the map is frozen the only reliable
     evidence is what HIS browser reports. In the console: __health() */
  window.__health = function () {
    var m = window.__map, out = {
      mapConstructed: !!m,
      styleLoaded: m ? m.isStyleLoaded() : false,
      booted: mapLoaded,
      entries: state.events.length,
      rendered: document.querySelectorAll(".res").length,
      visibility: document.visibilityState,
      terrain: window.__terrain || null,
      terrainErr: window.__terrainErr || null,
      medianFrameMs: window.__frameMs || null,
      figureErr: window.__fgErr || null,
      routeErr: window.__routeErr || null
    };
    if (m) {
      out.zoom = +m.getZoom().toFixed(2);
      out.pitch = Math.round(m.getPitch());
      out.bearing = Math.round(m.getBearing());
      out.handlers = {
        drag: m.dragPan.isEnabled(), scroll: m.scrollZoom.isEnabled(),
        rotate: m.dragRotate.isEnabled(), touch: m.touchZoomRotate.isEnabled(),
        keyboard: m.keyboard.isEnabled()
      };
      out.layers = (m.getStyle() && m.getStyle().layers || []).length;
    }
    return out;
  };

  /* -----------------------------------------------------------------
     THE IMAGE VIEWER
     -----------------------------------------------------------------
     Every photograph on this site opens here and nowhere else. One overlay,
     built once and reused: the image at the largest size that fits, its
     caption underneath, a close button and a real fullscreen button. Arrow
     keys move between the photographs of the open entry, because an entry
     carrying six frames of one afternoon in 1991 is a sequence and should be
     readable as one.

     The rule it enforces: a click on an image never navigates. Nothing on
     this map should cost a reader their place in it.
     ----------------------------------------------------------------- */

  var lightbox = null, lbIndex = -1, lbShots = [];

  function buildLightbox() {
    if (lightbox) return lightbox;
    var el = document.createElement("div");
    el.id = "lightbox";
    el.hidden = true;
    el.innerHTML =
      '<div class="lb-bar">' +
        '<span class="lb-count"></span>' +
        '<button type="button" class="lb-btn lb-full" title="">&#9974;</button>' +
        '<button type="button" class="lb-btn lb-close" title="">&times;</button>' +
      '</div>' +
      '<button type="button" class="lb-nav lb-prev" aria-label="">&#8249;</button>' +
      '<button type="button" class="lb-nav lb-next" aria-label="">&#8250;</button>' +
      '<div class="lb-stage"><img alt=""></div>' +
      '<div class="lb-cap"></div>';
    document.body.appendChild(el);
    lightbox = el;

    el.querySelector(".lb-close").addEventListener("click", closeLightbox);
    el.querySelector(".lb-full").addEventListener("click", toggleLightboxFull);
    el.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); stepLightbox(-1); });
    el.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); stepLightbox(1); });
    /* the backdrop closes; the image and the caption do not */
    el.addEventListener("click", function (e) {
      if (e.target === el || (e.target.className || "") === "lb-stage") closeLightbox();
    });
    return el;
  }

  function lightboxLabels() {
    if (!lightbox) return;
    lightbox.querySelector(".lb-close").title = t("media.close");
    lightbox.querySelector(".lb-full").title = t("media.fullscreen");
    lightbox.querySelector(".lb-prev").setAttribute("aria-label", t("media.prev"));
    lightbox.querySelector(".lb-next").setAttribute("aria-label", t("media.next"));
  }

  function openLightbox(fig) {
    var host = (fig.closest && fig.closest("#detail-body")) || document;
    lbShots = Array.prototype.slice.call(host.querySelectorAll(".d-media img"));
    var img = fig.querySelector("img");
    lbIndex = lbShots.indexOf(img);
    if (lbIndex < 0) { lbShots = [img]; lbIndex = 0; }
    buildLightbox();
    lightboxLabels();
    paintLightbox();
    lightbox.hidden = false;
    document.body.classList.add("lb-open");
    lightbox.querySelector(".lb-close").focus();
  }

  function paintLightbox() {
    var img = lbShots[lbIndex];
    if (!img || !lightbox) return;
    var big = lightbox.querySelector(".lb-stage img");
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || "";
    var figure = img.closest ? img.closest("figure") : null;
    var figcap = figure ? figure.querySelector("figcaption") : null;
    lightbox.querySelector(".lb-cap").innerHTML = figcap ? figcap.innerHTML : "";
    var many = lbShots.length > 1;
    lightbox.querySelector(".lb-count").textContent =
      many ? num(lbIndex + 1) + " / " + num(lbShots.length) : "";
    lightbox.querySelector(".lb-prev").hidden = !many;
    lightbox.querySelector(".lb-next").hidden = !many;
  }

  function stepLightbox(d) {
    if (!lbShots.length) return;
    lbIndex = (lbIndex + d + lbShots.length) % lbShots.length;
    paintLightbox();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
    lightbox.hidden = true;
    lightbox.querySelector(".lb-stage img").removeAttribute("src");
    document.body.classList.remove("lb-open");
  }

  function toggleLightboxFull(e) {
    if (e) e.stopPropagation();
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (er) {} return; }
    if (lightbox && lightbox.requestFullscreen) {
      try { lightbox.requestFullscreen(); } catch (er) {}
    }
  }

  function lightboxOpen() { return lightbox && !lightbox.hidden; }

  /* One listener for the whole document: media is rendered into the panel and
     into year boxes, and new markup arrives every time an entry opens. */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".d-zoom") : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openLightbox(btn);
  });

  var DISPERSE = null, dispMarkers = [];

  /* A gentle arc, so the link reads as a relation and not as a street.
     Longitude is scaled by cos(latitude) for the offset, otherwise the bend
     leans east at Yerevan's latitude. */
  function arcBetween(a, b, bend) {
    var k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
    var dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
    var L = Math.sqrt(dx * dx + dy * dy) || 1e-9;
    var cx = (a[0] + b[0]) / 2 + (-dy / L) * bend * L / k;
    var cy = (a[1] + b[1]) / 2 + ( dx / L) * bend * L;
    var out = [], i, t;
    for (i = 0; i <= 48; i++) {
      t = i / 48;
      out.push([
        (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0],
        (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]
      ]);
    }
    return out;
  }

  function buildDispersal() {
    var lines = [], dots = [];
    state.events.forEach(function (e) {
      var dsp = e.dispersal;
      if (!dsp || !dsp.stations || !dsp.stations.length) return;
      var origin = dsp.stations[0];
      if (!origin.at) return;
      var colour = dsp.color || RED;
      dsp.stations.forEach(function (st, n) {
        if (!st.at) return;
        dots.push({ type: "Feature",
          properties: { id: e.id, sid: st.id, kind: st.kind || "now", colour: colour },
          geometry: { type: "Point", coordinates: st.at } });
        if (n === 0) return;
        lines.push({ type: "Feature",
          properties: { id: e.id, sid: st.id, colour: colour },
          geometry: { type: "LineString", coordinates: arcBetween(origin.at, st.at, 0.18) } });
      });
    });
    DISPERSE = { lines: { type: "FeatureCollection", features: lines },
                 dots:  { type: "FeatureCollection", features: dots } };
    window.__dispersal = { lines: lines.length, dots: dots.length };
  }

  function addDispersal() {
    if (!DISPERSE || !DISPERSE.lines.features.length) return;
    if (map.getSource("disp-line")) return;
    map.addSource("disp-line", { type: "geojson", data: emptyFC() });
    map.addSource("disp-dot",  { type: "geojson", data: emptyFC() });
    map.addLayer({
      id: "disp-line", type: "line", source: "disp-line",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["coalesce", ["get", "colour"], RED],
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.6, 17, 3.4],
        "line-dasharray": [1.6, 1.4]
      }
    });
    map.addLayer({
      id: "disp-dot", type: "circle", source: "disp-dot",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 17, 8],
        "circle-color": ["case", ["==", ["get", "kind"], "origin"], "#ffffff",
                         ["coalesce", ["get", "colour"], RED]],
        "circle-stroke-width": 2.2,
        "circle-stroke-color": ["case", ["==", ["get", "kind"], "origin"],
                                ["coalesce", ["get", "colour"], RED], "#ffffff"],
        "circle-opacity": 0.98
      }
    });
  }

  function clearDispersal() {
    dispMarkers.forEach(function (m) { m.remove(); });
    dispMarkers = [];
    if (map && map.getSource("disp-line")) map.getSource("disp-line").setData(emptyFC());
    if (map && map.getSource("disp-dot"))  map.getSource("disp-dot").setData(emptyFC());
  }

  function showDispersal(e) {
    clearDispersal();
    if (!map || !e.dispersal || !DISPERSE) return;
    var pick = function (fc) {
      return { type: "FeatureCollection",
               features: fc.features.filter(function (f) { return f.properties.id === e.id; }) };
    };
    if (map.getSource("disp-line")) map.getSource("disp-line").setData(pick(DISPERSE.lines));
    if (map.getSource("disp-dot"))  map.getSource("disp-dot").setData(pick(DISPERSE.dots));

    var colour = e.dispersal.color || RED;
    e.dispersal.stations.forEach(function (st, n) {
      if (!st.at) return;
      var el = document.createElement("div");
      el.className = "disp-note" + (st.kind === "origin" ? " origin" : "");
      el.style.setProperty("--mk", colour);
      el.innerHTML = '<b>' + esc(tr(st, "label") || "") + '</b>' +
                     '<span>' + esc(num(st.years || "")) + '</span>' +
                     '<i>' + esc(tr(st, "what") || "") + '</i>';
      el.addEventListener("click", function (evt) { evt.stopPropagation(); });
      /* The square and the courtyard are 260 m apart, which is close enough
         at street zoom for two labels to collide. So the origin hangs below
         its dot and the destinations sit above theirs. */
      dispMarkers.push(new maplibregl.Marker({
        element: el, anchor: st.kind === "origin" ? "top" : "bottom"
      }).setLngLat(st.at).addTo(map));
    });
  }

  /* The near stations are the ones worth opening on: framing all of them at
     once would put a courtyard 220 m away and a yard 8 km away in the same
     view, and the courtyard would vanish. The far ones are one click away in
     the panel. */
  function dispersalBounds(e, all) {
    var sts = (e.dispersal.stations || []).filter(function (s) { return s.at; });
    if (!sts.length) return null;
    var o = sts[0].at, pts = [];
    sts.forEach(function (s) {
      if (all || metres(o, s.at) < 1500) pts.push(s.at);
    });
    if (pts.length < 2) pts = [o, [o[0] + 0.002, o[1] + 0.0015]];
    return pathBounds(pts);
  }

  /* -----------------------------------------------------------------
     MARCH NOTES; a label pinned to a route saying when it was walked
     -----------------------------------------------------------------
     The genocide ceremony walks two routes that differ only in their first
     kilometre, and the whole argument is which years used which. A colour
     cannot say that; a word can. So each route carries a small note at its
     own midpoint naming its years, and the note for a route no longer
     walked is drawn in the past tense of the same colour.
     ----------------------------------------------------------------- */
  var marchNotes = [];

  function clearMarchNotes() {
    marchNotes.forEach(function (m) { m.remove(); });
    marchNotes = [];
  }

  function showMarchNotes(e) {
    clearMarchNotes();
    if (!map || !e || !e.paths || !e.paths.length) return;
    var colour = e.pathColor || catById(e.categories[0]).color;
    e.paths.forEach(function (p) {
      if (!p.path || p.path.length < 2) return;
      var L = p._len || pathLength(p.path);
      var hit = alongPath(p.path, L * 0.42);
      var at = (hit && hit.at) || p.path[Math.floor(p.path.length / 2)];
      var el = document.createElement("div");
      el.className = "march-note" + (p.active === false ? " past" : "");
      el.style.setProperty("--mk", colour);
      el.innerHTML = '<b>' + esc(tr(p, "label") || "") + '</b>' +
                     '<span>' + esc(t("march.years", { y: num(p.years || "") })) + '</span>';
      el.addEventListener("click", function (evt) {
        evt.stopPropagation();
        selectEvent(e.id, false);
      });
      marchNotes.push(
        new maplibregl.Marker({ element: el, anchor: "bottom" })
.setLngLat(at).addTo(map)
      );
    });
  }

  function clearPlaces() {
    clearMarchNotes();
    placeMarkers.forEach(function (m) { m.remove(); });
    placeMarkers = [];
    if (map && map.getSource("geo-link")) map.getSource("geo-link").setData(emptyFC());
    if (map && map.getSource("geo-sight")) map.getSource("geo-sight").setData(emptyFC());
  }

  /* Labels are HTML markers, not symbol layers, and that is deliberate: a
     symbol layer needs the basemap's glyph server, and one of the five
     basemaps here is a bare raster with none. HTML also inherits the page's
     Armenian and Persian faces and its text direction for free. */
  function showPlaces(places, e) {
    clearPlaces();
    if (!places || !map) return;

    if (map.getSource("geo-sight")) {
      var sl = sightlineFeatures(e || {});
      if (sl.length) map.getSource("geo-sight").setData({ type: "FeatureCollection", features: sl });
    }

    places.forEach(function (p) {
      var el = document.createElement("div");
      el.className = "geo-mark geo-" + (p.kind || "site");
      el.innerHTML = '<i></i><b>' + esc(tr(p, "label") || p.label || "") + '</b>';
      var note = tr(p, "note");
      if (note) el.title = note;
      placeMarkers.push(
        new maplibregl.Marker({ element: el, anchor: "bottom" })
.setLngLat(p.bbox ? [(p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2] : p.at)
.addTo(map)
      );
    });

    /* The connector. When the entry names several places it is drawn through
       all of them in the order given, for the walk from Gyumri that is the
       towns it passed, in sequence. It is dashed and schematic on purpose:
       this is not the road, and a solid line would claim to be. */
    var anchor = anchorPlace();
    var other = places.filter(function (p) { return !anchor || p.id !== anchor.id; })[0];
    var hasSight = !!(e && e.sightlines && e.sightlines.length);
    if (anchor && other && !hasSight && map.getSource("geo-link")) {
      var centre = function (q) {
        return q.bbox ? [(q.bbox[0] + q.bbox[2]) / 2, (q.bbox[1] + q.bbox[3]) / 2] : q.at;
      };
      var chain = (e && e.frame && e.frame.length > 1)
        ? places.slice()
        : [anchor, other];
      var line = [], i, j;
      for (j = 0; j < chain.length - 1; j++) {
        var a0 = centre(chain[j]), b0 = centre(chain[j + 1]);
        for (i = 0; i < 12; i++) {
          line.push([a0[0] + (b0[0] - a0[0]) * (i / 12), a0[1] + (b0[1] - a0[1]) * (i / 12)]);
        }
      }
      line.push(centre(chain[chain.length - 1]));
      map.getSource("geo-link").setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } }]
      });
      var a = anchor.at, b = centre(other);

      /* The chip is the straight-line distance, so it is only drawn when the
         line on the map IS that straight line. Where the connector runs through
         a chain of towns, a number floating beside it would be read as the
         length of the chain, which it is not; the panel carries it instead. */
      if (chain.length === 2) {
        var km = metres(a, b) / 1000;
        var mid = document.createElement("div");
        mid.className = "geo-dist";
        mid.textContent = t("scale.apart", { d: num(km >= 100 ? Math.round(km) : km.toFixed(1)) });
        placeMarkers.push(
          new maplibregl.Marker({ element: mid, anchor: "center" })
.setLngLat([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]).addTo(map)
        );
      }
    }
  }

  /* -----------------------------------------------------------------
     SIGHTLINES
     -----------------------------------------------------------------
     A street can be built to point at something. Tamanyan's plan opened
     a corridor toward Ararat; the avenue that was finally built points
     somewhere near it. That is an argument about two bearings, and two
     bearings are a thing a map can simply draw.

     An entry declares them:

       "sightlines": [
         { "kind": "axis",   "from": [lng,lat], "along": [lng,lat], "km": 70 },
         { "kind": "target", "from": [lng,lat], "to": "ararat" }
       ]

     "axis" is extended from `from` through `along` for `km`; "target"
     runs from `from` to a place in the gazetteer. The wedge between the
     two is the finding.
     ----------------------------------------------------------------- */

  function bearingDeg(a, b) {
    var T = Math.PI / 180;
    var la1 = a[1] * T, la2 = b[1] * T, d = (b[0] - a[0]) * T;
    var y = Math.sin(d) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(d);
    return (Math.atan2(y, x) / T + 360) % 360;
  }

  /* the point `km` along a bearing from a point; spherical, because at
     seventy kilometres a flat approximation is visibly wrong */
  function projectDeg(from, brg, km) {
    var T = Math.PI / 180, R = 6371.0088;
    var d = km / R, b = brg * T, la1 = from[1] * T, lo1 = from[0] * T;
    var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
    var lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1),
                               Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return [lo2 / T, la2 / T];
  }

  function sightlineFeatures(e) {
    if (!e.sightlines || !e.sightlines.length) return [];
    var out = [];
    e.sightlines.forEach(function (sl) {
      var from = sl.from, to = null;
      if (sl.kind === "axis" && sl.along) {
        to = projectDeg(from, bearingDeg(from, sl.along), sl.km || 60);
      } else if (sl.to) {
        var pl = typeof sl.to === "string" ? placeById(sl.to) : null;
        to = pl ? pl.at : (Array.isArray(sl.to) ? sl.to : null);
      }
      if (!to) return;
      var line = [], i;
      for (i = 0; i <= 32; i++) {
        line.push([from[0] + (to[0] - from[0]) * (i / 32),
                   from[1] + (to[1] - from[1]) * (i / 32)]);
      }
      out.push({ type: "Feature", properties: { kind: sl.kind || "target" },
                 geometry: { type: "LineString", coordinates: line } });
    });
    return out;
  }

  function addGeoLink() {
    if (!map.getSource("geo-link")) {
      map.addSource("geo-link", { type: "geojson", data: emptyFC() });
    }
    if (!map.getLayer("geo-link")) {
      map.addLayer({
        id: "geo-link", type: "line", source: "geo-link",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": RED, "line-opacity": 0.55,
          "line-width": 1.6, "line-dasharray": [1.5, 2.2]
        }
      });
    }
    if (!map.getSource("geo-sight")) {
      map.addSource("geo-sight", { type: "geojson", data: emptyFC() });
    }
    /* Two layers, not one with a match expression: line-dasharray is the one
       paint property MapLibre will not take a data expression for, and feeding
       it one silently throws the WHOLE layer out of the style. Split by filter
       instead. What was built is a solid white line; the bearing it was meant
       to have is dotted red. */
    if (!map.getLayer("geo-sight-axis")) {
      map.addLayer({
        id: "geo-sight-axis", type: "line", source: "geo-sight",
        filter: ["==", ["get", "kind"], "axis"],
        layout: { "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-opacity": 0.9, "line-width": 2 }
      });
    }
    if (!map.getLayer("geo-sight-target")) {
      map.addLayer({
        id: "geo-sight-target", type: "line", source: "geo-sight",
        filter: ["!=", ["get", "kind"], "axis"],
        layout: { "line-cap": "round" },
        paint: {
          "line-color": RED, "line-opacity": 0.85, "line-width": 1.8,
          "line-dasharray": [2, 2]
        }
      });
    }
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
     held in data/kentron.json, a 75 m buffer along the Opera–Republic
     axis plus the two squares, not by a hand-picked list. Change the
     rule there and the drawing follows.
     ================================================================= */

  /* The figure is drawn on every basemap, not just the figure-ground one; the
     point of switching to satellite is to check the red buildings against the
     real roofs, which only works if they are still there. */
  function addFigureGround() {

    /* The figure: the buildings Alireza marked dark on slide 10. These are real
       OpenStreetMap footprints with real heights, extracted once and stored in
       data/figure.json; not selected at runtime. Deterministic, reviewable,
       and identical for every reader. */
    if (FIGURE && !map.getSource("figure")) {
      map.addSource("figure", { type: "geojson", data: FIGURE });
      /* Water is drawn FLAT, not extruded, and this is not a style preference.
         MapLibre anchors each extruded prism to a single ground elevation, so a
         low prism sitting on sloping ground gets swallowed by the hill on its
         uphill side. Republic Square falls 1.9 m across the Singing Fountains
         basin, 3.4 m once the 1.8x terrain exaggeration is applied, so half
         the pool disappeared at 0.5 m, and the height needed to survive would
         have made a shallow pool into a four-metre wall. A fill layer drapes
         over the terrain instead: every part of the pool is blue, and it
         follows the slope of the square, which is what a pool actually does. */
      /* Two ways of putting a shape on the ground, and the choice is forced by
         the terrain, not by taste. Anything low sitting on a slope has to be
         DRAPED: a fill layer follows the hillside, while a short extrusion gets
         swallowed by the ground rising through it. So water, and any feature
         carrying "flat": true; plazas, platforms, terraces; go in this layer,
         and what stands ON them is extruded separately.
         Tsitsernakaberd is the case that forced it: the memorial platform is
         draped, and the stele and the twelve pylons rise out of it. */
      map.addLayer({
        id: "figure-water", type: "fill", source: "figure",
        filter: ["any",
          ["==", ["get", "zone"], "water"],
          ["==", ["get", "flat"], true]
        ],
        paint: {
          "fill-color": ["match", ["get", "zone"],
            "water", WATER, "republic", RED, "accent", RED, GREY_MASS],
          "fill-opacity": 0.9
        }
      });
      map.addLayer({
        id: "figure-buildings", type: "fill-extrusion", source: "figure",
        filter: ["all",
          ["!=", ["get", "zone"], "water"],
          ["!=", ["get", "flat"], true]
        ],
        paint: {
          "fill-extrusion-color": ["match", ["get", "zone"], "republic", RED, "accent", RED, GREY_MASS],
          "fill-extrusion-height": ["coalesce", ["get", "h"], 12],
          /* Per-feature base, so a shape can be built out of stacked slices.
             A MapLibre extrusion is always a vertical prism with a flat top; 
             it cannot taper and it cannot lean. Slicing is the way around that:
             ten short prisms, each one narrower and shifted, read as a tapering
             needle or a pylon leaning inward. See synthetic-monuments.md. */
          "fill-extrusion-base": ["coalesce", ["get", "base"], 0],
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
     MARCHES
     -------------------------------------------------------------------
     An entry with a "path" is not a point but a walk: a line of real
     street geometry, taken from OpenStreetMap, from where the march
     started to where it ended. It is drawn permanently, a march that
     only appears when you already know to look for it teaches nobody, 
     and it draws itself along its own length when the entry is opened,
     because the thing being described took an hour and a route, not a
     place.

     Direction is shown with chevrons built as geometry rather than as
     map symbols. A symbol layer needs the basemap's glyph server, and
     this map has five basemaps, one of them a bare raster with no
     glyphs at all. Little painted V shapes work on all of them.
     ================================================================= */

  function metres(a, b) {
    var R = 6371000, t = Math.PI / 180;
    var dla = (b[1] - a[1]) * t, dlo = (b[0] - a[0]) * t;
    var x = Math.sin(dla / 2) * Math.sin(dla / 2) +
            Math.cos(a[1] * t) * Math.cos(b[1] * t) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function pathLength(path) {
    var L = 0;
    for (var i = 0; i < path.length - 1; i++) L += metres(path[i], path[i + 1]);
    return L;
  }

  /* the point a given number of metres along the path, and the bearing there */
  function alongPath(path, target) {
    var run = 0;
    for (var i = 0; i < path.length - 1; i++) {
      var seg = metres(path[i], path[i + 1]);
      if (run + seg >= target) {
        var f = seg ? (target - run) / seg : 0;
        return {
          at: [path[i][0] + (path[i + 1][0] - path[i][0]) * f,
               path[i][1] + (path[i + 1][1] - path[i][1]) * f],
          i: i,
          bearing: Math.atan2(path[i + 1][0] - path[i][0],
                              path[i + 1][1] - path[i][1])
        };
      }
      run += seg;
    }
    return { at: path[path.length - 1], i: path.length - 2,
             bearing: Math.atan2(path[path.length - 1][0] - path[path.length - 2][0],
                                 path[path.length - 1][1] - path[path.length - 2][1]) };
  }

  /* the first n metres of a path, as its own line; this is what animates */
  function pathTo(path, target) {
    var out = [path[0]], run = 0;
    for (var i = 0; i < path.length - 1; i++) {
      var seg = metres(path[i], path[i + 1]);
      if (run + seg >= target) {
        var f = seg ? (target - run) / seg : 0;
        out.push([path[i][0] + (path[i + 1][0] - path[i][0]) * f,
                  path[i][1] + (path[i + 1][1] - path[i][1]) * f]);
        return out;
      }
      run += seg;
      out.push(path[i + 1]);
    }
    return out;
  }

  /* -----------------------------------------------------------------
     Going to an entry without dragging the whole city behind you
     -----------------------------------------------------------------
     easeTo interpolates the camera in a straight line at whatever zoom
     it ends on, so it requests every tile it passes over. Yerevan to
     Gyumri at zoom 16 is a hundred kilometres of that: measured at 309
     basemap tiles for one click, and with terrain on, a DEM tile for
     each as well. That is what froze the map.

     So a long move is not animated at all: it jumps, and pays for one
     viewport. Short moves keep easeTo, which looks better over a few
     streets and costs almost nothing.
     ----------------------------------------------------------------- */
  /* Eight kilometres: every place in Yerevan animates as before; you want to
     see the corridor go past, and only something genuinely outside the city,
     like the walk starting in Gyumri, jumps. */
  var JUMP_OVER_M = 8000;

  function goTo(target, zoom, pitch) {
    var here = map.getCenter();
    var far = metres([here.lng, here.lat], target);
    var opts = { center: target, zoom: zoom };
    if (pitch != null) opts.pitch = pitch;
    if (far > JUMP_OVER_M) {
      /* flyTo is not the answer either; arcing out and back in crosses every
         zoom level and asks for MORE tiles than the straight line did (measured
         693 against 309). Over this distance the animation is worthless anyway:
         nothing legible passes underneath. Jump, and load one viewport. */
      map.jumpTo(opts);
    } else {
      opts.duration = 900;
      map.easeTo(opts);
    }
  }

  function pathBounds(path) {
    var w = path[0][0], e = w, s2 = path[0][1], n = s2;
    path.forEach(function (p) {
      if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0];
      if (p[1] < s2) s2 = p[1]; if (p[1] > n) n = p[1];
    });
    return [[w, s2], [e, n]];
  }

  /* a chevron every SPACING metres, pointing the way the march went */
  var CHEVRON_M = 190;
  function chevrons(path, id) {
    var L = pathLength(path), out = [];
    var latScale = Math.cos(path[0][1] * Math.PI / 180) || 1;
    for (var d = CHEVRON_M * 0.6; d < L - 40; d += CHEVRON_M) {
      var p = alongPath(path, d);
      var b = p.bearing;                       /* radians, 0 = north */
      var size = 0.000075;                     /* ~8 m */
      function wing(turn) {
        var a = b + Math.PI + turn;
        return [p.at[0] + (Math.sin(a) * size) / latScale, p.at[1] + Math.cos(a) * size];
      }
      out.push({
        type: "Feature",
        properties: { id: id },
        geometry: { type: "LineString", coordinates: [wing(-0.75), p.at, wing(0.75)] }
      });
    }
    return out;
  }

  function buildRoutes() {
    var lines = [], marks = [], ends = [];
    state.events.forEach(function (e) {
      if (!e.path || e.path.length < 2) return;
      e._pathLen = pathLength(e.path);
      var colour = e.pathColor || catById(e.categories[0]).color;
      var set = (e.paths && e.paths.length) ? e.paths
              : [{ id: e.id, path: e.path, active: true }];
      set.forEach(function (p, n) {
        if (!p.path || p.path.length < 2) return;
        p._len = pathLength(p.path);
        lines.push({
          type: "Feature",
          id: hashId(p.id || (e.id + "-" + n)),
          properties: { id: e.id, sub: p.id || "", color: p.color || colour,
                        past: p.active === false ? 1 : 0 },
          geometry: { type: "LineString", coordinates: p.path }
        });
        chevrons(p.path, e.id).forEach(function (c) { marks.push(c); });
      });
      var route = e.route || {};
      ends.push({ type: "Feature",
        properties: { id: e.id, go: route.from || e.id, kind: "start" },
        geometry: { type: "Point", coordinates: e.path[0] } });
      ends.push({ type: "Feature",
        properties: { id: e.id, go: route.to || e.id, kind: "end" },
        geometry: { type: "Point", coordinates: e.path[e.path.length - 1] } });
      if (e.paths) {
        e.paths.forEach(function (p) {
          if (!p.path || p.path.length < 2 || p.path === e.path) return;
          ends.push({ type: "Feature",
            properties: { id: e.id, go: e.id, kind: "start" },
            geometry: { type: "Point", coordinates: p.path[0] } });
        });
      }
    });
    ROUTES      = { type: "FeatureCollection", features: lines };
    ROUTE_MARKS = { type: "FeatureCollection", features: marks };
    ROUTE_ENDS  = { type: "FeatureCollection", features: ends };
    /* Readable without a map. The container that verifies this project cannot
       reach a tile server, so the map never boots there and nothing that lives
       only inside a layer can be checked. The built collections are put on the
       window so the geometry can be tested on its own. */
    window.__routes = { lines: lines.length, chevrons: marks.length, ends: ends.length,
                        metres: Math.round(lines.reduce(function (n, f) {
                          return n + pathLength(f.geometry.coordinates); }, 0)) };
  }

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
      if (s === "title") {
        var la = window.I18N ? I18N.lang : "en";
        return tr(a, "title").localeCompare(tr(b, "title"), la);
      }
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
              title: tr(e, "title") || t("res.untitled"),
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
    $("result-count").textContent = num(vis.length);
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
      if (map.getSource("routes")) {
        map.setFeatureState({ source: "routes", id: idMap[k] }, { selected: k === state.selectedId });
      }
    });
  }

  /* =================================================================
     PANEL; categories
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
        '<span class="cat-label">' + esc(tr(c, "label")) + '</span>' +
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
     PANEL; results list
     ================================================================= */

  function renderResults(list) {
    var ul = $("results");
    ul.innerHTML = "";
    if (!list.length) {
      ul.innerHTML = '<li class="empty">' + esc(t("res.empty")) + '<br>' +
        esc(t("res.emptyHint")) + '</li>';
      return;
    }
    list.forEach(function (e) {
      var li = document.createElement("li");
      li.className = "res" + (e.id === state.selectedId ? " active" : "");
      li.innerHTML =
        '<div class="res-date">' + esc(fmtDate(e)) +
          (isContext(e) ? ' <span class="ctx">' + esc(t("res.context")) + '</span>' : '') + '</div>' +
        '<div class="res-title">' + esc(tr(e, "title") || t("res.untitled")) + '</div>' +
        '<div class="res-tags">' +
          e.categories.map(function (c) {
            var cat = catById(c);
            return '<span class="chip" style="border-color:' + esc(cat.color) + '55">' +
                   esc(tr(cat, "label")) + '</span>';
          }).join("") +
        '</div>';
      li.addEventListener("click", function () { selectEvent(e.id, true); });
      ul.appendChild(li);
    });
  }

  /* =================================================================
     PANEL; detail view
     ================================================================= */

  function selectEvent(id, fly) {
    var e = state.events.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    state.selectedId = id;
    applySelectionState();
    history.replaceState(null, "", "#" + encodeURIComponent(id));

    if (map) { clearRouteAnim(); clearPlaces(); clearDispersal(); }

    /* Not in Yerevan? Then the answer is not "go there", it is "show where
       there is". North up, flat, both places named, the distance between. */
    var wide = map ? frameFor(e) : null;
    if (wide && map) {
      /* remember the tilt so the city gets its 3D back afterwards */
      if (map.getPitch() > 1) state.cityPitch = map.getPitch();
      showPlaces(wide, e);
      if (fly !== false) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 300 });
        map.fitBounds(framedBounds(wide, e), {
          padding: WIDE_PAD, maxZoom: 11, pitch: 0, bearing: 0, duration: 1400
        });
      }
    } else if (fly !== false && map) {
      /* Coming back from a bird's-eye view, the city is a 3D drawing again.
         The tilt has to travel with the same easeTo; a separate one is simply
         cancelled by the move that follows it. */
      var back = (map.getPitch() < 1 && state.cityPitch) ? state.cityPitch : null;
      if (e.dispersal) {
        /* An object that came apart is framed around the pieces still near
           each other; the far ones are a click away in the panel. */
        var db = dispersalBounds(e, false);
        if (db) map.fitBounds(db, {
          padding: { top: 110, bottom: 210, left: 70, right: 70 },
          duration: 1100, maxZoom: 17,
          pitch: back != null ? Math.min(back, 40) : Math.min(map.getPitch(), 40)
        });
      } else if (e.path && e.path.length > 1) {
        /* A march is not a place. Frame the whole walk, then draw it. An entry
           with several routes is framed around all of them at once, the point
           of drawing two is seeing them diverge. */
        var allPts = e.path;
        if (e.paths && e.paths.length > 1) {
          allPts = [];
          e.paths.forEach(function (pp) {
            if (pp.path) allPts = allPts.concat(pp.path);
          });
        }
        map.fitBounds(pathBounds(allPts), {
          padding: { top: 90, bottom: 190, left: 60, right: 60 },
          duration: 1100, pitch: back != null ? Math.min(back, 45) : Math.min(map.getPitch(), 45)
        });
        setTimeout(function () { animateRoute(e); }, 700);
      } else {
        goTo(e._display || e.coordinates, Math.max(map.getZoom(), 16), back);
      }
    } else if (map && e.path && e.path.length > 1) {
      animateRoute(e);
    }

    if (map) { showMarchNotes(e); showDispersal(e); }

    var h = "";
    h += '<div class="d-date">' + esc(fmtDate(e)) + '</div>';
    h += '<h2 class="d-title">' + esc(tr(e, "title") || t("res.untitled")) + '</h2>';
    var place = tr(e, "location");
    if (place) h += '<div class="d-place">' + esc(place) + '</div>';
    var ep = e.episode ? episodeById(e.episode) : null;
    if (ep) {
      h += '<button class="d-episode" data-ep-go="' + esc(ep.id) + '"' +
           ' style="--ep:' + esc(ep.color || RED) + '">' + esc(tr(ep, "label")) + '</button>';
    }

    if (e.categories.length) {
      h += '<div class="d-tags">' + e.categories.map(function (c) {
        var cat = catById(c);
        return '<span class="chip" style="border-color:' + esc(cat.color) +
               '88;color:' + esc(cat.color) + '">' + esc(tr(cat, "label")) + '</span>';
      }).join("") + '</div>';
    }

    var wideP = frameFor(e);
    if (wideP) {
      var anch = anchorPlace();
      var oth = wideP.filter(function (x) { return !anch || x.id !== anch.id; })[0];
      if (oth && anch) {
        var kmP = metres(anch.at, oth.bbox
          ? [(oth.bbox[0] + oth.bbox[2]) / 2, (oth.bbox[1] + oth.bbox[3]) / 2] : oth.at) / 1000;
        h += '<div class="d-elsewhere">' +
             '<b>' + esc(tr(oth, "label") || oth.label || "") + '</b>' +
             '<span>' + esc(t("scale.fromCity", {
                 d: num(kmP >= 100 ? Math.round(kmP) : kmP.toFixed(1)),
                 city: tr(anch, "label") })) + '</span></div>';
      }
    }

    if (e.sightlines && e.sightlines.length >= 2) {
      var axis = null, targ = null;
      e.sightlines.forEach(function (sl) {
        if (sl.kind === "axis" && sl.along) axis = bearingDeg(sl.from, sl.along);
        else if (sl.to) {
          var pl = typeof sl.to === "string" ? placeById(sl.to) : null;
          var pt = pl ? pl.at : (Array.isArray(sl.to) ? sl.to : null);
          if (pt) targ = { b: bearingDeg(sl.from, pt), label: pl ? tr(pl, "label") : "" };
        }
      });
      if (axis != null && targ) {
        var gap = Math.abs(((targ.b - axis + 180) % 360) - 180);
        h += '<div class="d-axis">' +
             '<span class="ax-built"><i></i>' + esc(t("axis.built")) + ' <b>' +
               esc(num(axis.toFixed(1))) + '°</b></span>' +
             '<span class="ax-target"><i></i>' + esc(targ.label) + ' <b>' +
               esc(num(targ.b.toFixed(1))) + '°</b></span>' +
             '<em>' + esc(t("axis.apart", { d: num(gap.toFixed(1)) })) + '</em>' +
             '</div>';
      }
    }

    if (e.dispersal && e.dispersal.stations) {
      /* The list is the argument: one object, four addresses, one of them
         missing. The missing one gets a row and no dot. */
      h += '<div class="d-marches d-dispersal">';
      e.dispersal.stations.forEach(function (st, n) {
        var far = (st.at && n > 0) ? metres(e.dispersal.stations[0].at, st.at) : 0;
        var away = far >= 1000 ? num((far / 1000).toFixed(1)) + " " + t("unit.km")
                 : far ? num(Math.round(far)) + " " + t("unit.m") : "";
        h += '<button type="button" class="d-march d-station' +
             (st.kind === "origin" ? " origin" : "") + (st.at ? "" : " lost") + '"' +
             ' data-station="' + n + '"' + (st.at ? "" : " disabled") +
             ' style="--mk:' + esc(e.dispersal.color || RED) + '">' +
             '<i></i><b>' + esc(tr(st, "label") || "") + '</b>' +
             '<span>' + esc(num(st.years || "")) + '</span>' +
             '<em>' + esc(tr(st, "what") || "") + (away ? ", " + away : "") + '</em>' +
             '</button>';
      });
      h += '</div>';
    }

    if (e.paths && e.paths.length) {
      /* Two routes, one ritual. The list is the argument: same destination,
         same organisers, different first kilometre, different decades. */
      h += '<div class="d-marches">';
      e.paths.forEach(function (pp, n) {
        var Lp = pp._len || pathLength(pp.path || []);
        var farp = Lp >= 1000 ? num((Lp / 1000).toFixed(1)) + " " + t("unit.km")
                              : num(Math.round(Lp)) + " " + t("unit.m");
        h += '<button type="button" class="d-march' +
             (pp.active === false ? ' past' : '') + '" data-march="' + n + '"' +
             ' style="--mk:' + esc(e.pathColor || RED) + '">' +
             '<i></i><b>' + esc(tr(pp, "label") || "") + '</b>' +
             '<span>' + esc(num(pp.years || "")) + '</span>' +
             '<em>' + esc(farp) + '</em></button>';
      });
      h += '</div>';
    } else if (e.path && e.path.length > 1) {
      var L = e._pathLen || pathLength(e.path);
      var far = L >= 1000 ? num((L / 1000).toFixed(1)) + " " + t("unit.km")
                          : num(Math.round(L)) + " " + t("unit.m");
      h += '<div class="d-route">' +
           '<div class="d-route-head">' + esc(t("route.onfoot", { d: far })) + '</div>';
      var r = e.route || {};
      if (r.from) h += '<button class="d-route-end" data-go="' + esc(r.from) + '">' +
                       '<i class="rs"></i>' + esc(t("route.from")) + '</button>';
      if (r.to)   h += '<button class="d-route-end" data-go="' + esc(r.to) + '">' +
                       '<i class="re"></i>' + esc(t("route.to")) + '</button>';
      h += '<button class="d-route-replay" data-act="replay">' + esc(t("route.replay")) + '</button>';
      h += '</div>';
    }

    (e.media || []).forEach(function (m) { h += renderMedia(m); });

    var summary = tr(e, "summary"), analysis = tr(e, "analysis");
    if (summary) {
      h += '<div class="d-sec"><h3>' + esc(t("detail.happened")) + '</h3><p>' + para(summary) + '</p></div>';
    }
    if (analysis) {
      h += '<div class="d-sec analysis"><h3>' + esc(t("detail.analysis")) + '</h3><p>' + para(analysis) + '</p></div>';
    }

    /* ---- a chronology, where the argument is a sequence of decisions ----
       Different from the year boxes above: those are one rite returning, this
       is one object being made and then taken apart. Dates on the left, in the
       reader's own language and numerals. */
    if (e.chronology && e.chronology.length) {
      h += '<div class="d-sec"><h3>' + esc(t("detail.chronology")) + '</h3><div class="d-chron">';
      e.chronology.forEach(function (c) {
        h += '<div class="d-chron-row"><b>' + esc(num(c.when || "")) + '</b>' +
             '<p>' + para(tr(c, "note") || "") + '</p></div>';
      });
      h += '</div></div>';
    }

    /* ---- year by year ----
       A recurring rite is not one event; it is a series in which one variable
       moves. Only the years that carry the argument are given a box: the
       centenary, the year the rite fell inside a revolution, the year there
       was no march at all, the last year of the old square, and the break.
       The years between them are not silence; they are repetition, and
       repetition is stated once. */
    if (e.years && e.years.length) {
      h += '<div class="d-sec"><h3>' + esc(t("detail.chronicle")) + '</h3>';
      h += '<div class="d-years">';
      e.years.forEach(function (y, n) {
        var sk = "start." + (y.start || "unconfirmed");
        h += '<div class="d-year' + (y.start === "republic" ? " rep" : y.start === "freedom" ? " fre" : "") +
             '" data-yearidx="' + n + '" id="yr-' + esc(y.year) + '">' +
             '<div class="d-year-head"><b>' + esc(num(y.label || y.year)) + '</b>' +
             '<span class="d-year-sq">' + esc(t(sk)) + '</span></div>' +
             '<p>' + para(tr(y, "note") || "") + '</p>';
        (y.media || []).forEach(function (m) { h += renderMedia(m); });
        h += '</div>';
      });
      h += '</div></div>';
    }

    /* ---- the words ----
       Slogans are kept in Armenian first, transliterated second, glossed
       third. A translation alone would lose what is being claimed: the
       chants are quotations of older Armenian, and that is the claim. */
    if (e.slogans && e.slogans.length) {
      h += '<div class="d-sec"><h3>' + esc(t("detail.slogans")) + '</h3><div class="d-slogans">';
      e.slogans.forEach(function (sl) {
        h += '<div class="d-slogan"><b lang="hy">' + esc(sl.hy) + '</b>' +
             '<i>' + esc(sl.latin || "") + '</i>' +
             '<p>' + esc(tr(sl, "gloss") || "") + '</p></div>';
      });
      h += '</div></div>';
    }
    var actors = trL(e, "actors");
    if (actors.length) {
      h += '<div class="d-sec"><h3>' + esc(t("detail.actors")) + '</h3><ul>' +
           actors.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join("") + '</ul></div>';
    }
    var kws = trL(e, "tags");
    if (kws.length) {
      h += '<div class="d-sec"><h3>' + esc(t("detail.keywords")) + '</h3><div class="d-tags">' +
           kws.map(function (k) { return '<span class="chip">' + esc(k) + '</span>'; }).join("") +
           '</div></div>';
    }
    /* Bibliography stays in the script it was published in; that is how a
       reader looks it up. Only the note beside it is translated. */
    if (e.sources && e.sources.length) {
      h += '<div class="d-sec sources"><h3>' + esc(t("detail.sources")) + '</h3><ul>' + e.sources.map(function (s) {
        if (typeof s === "string") return '<li><span dir="ltr">' + esc(s) + '</span></li>';
        var note = tr(s, "note");
        return '<li><span dir="ltr">' + (s.url
          ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title || s.url) + '</a>'
          : esc(s.title || "")) + '</span>' + (note ? '' + esc(note) : '') + '</li>';
      }).join("") + '</ul></div>';
    }
    var fieldnote = tr(e, "fieldnote");
    if (fieldnote) {
      h += '<div class="d-sec"><h3>' + esc(t("detail.fieldnote")) + '</h3><p>' + para(fieldnote) + '</p></div>';
    }

    h += '<div class="d-actions">' +
         '<button data-act="zoom">' + esc(t("detail.zoom")) + '</button>' +
         '<button data-act="link">' + esc(t("detail.copy")) + '</button>' +
         '</div>';

    $("detail-body").innerHTML = h;
    $("detail-body").querySelectorAll(".embed-play").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = b.parentNode;
        box.innerHTML = '<iframe src="' + box.dataset.src +
          '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; ' +
          'gyroscope; picture-in-picture" allowfullscreen title="' + esc(t("media.embed")) + '"></iframe>';
      });
    });

    $("detail-body").querySelectorAll("[data-ep-go]").forEach(function (b) {
      b.addEventListener("click", function () {
        closeDetail();
        showEpisode(episodeById(b.dataset.epGo));
      });
    });

    $("detail-body").querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () { selectEvent(b.dataset.go, true); });
    });

    /* One button per address. Clicking the far one widens the frame to hold
       both it and the square, which is the only way to see how far a piece of
       a monument can travel and still be in the same city. */
    $("detail-body").querySelectorAll("[data-station]").forEach(function (b) {
      b.addEventListener("click", function () {
        var sts = e.dispersal.stations, st = sts[+b.dataset.station];
        if (!st || !st.at || !map) return;
        var o = sts[0].at;
        if (metres(o, st.at) > 1500) {
          map.fitBounds(pathBounds([o, st.at]), {
            padding: { top: 110, bottom: 220, left: 80, right: 80 }, duration: 1200, maxZoom: 15
          });
        } else {
          goTo(st.at, Math.max(map.getZoom(), 17.6));
        }
        b.parentNode.querySelectorAll(".d-station").forEach(function (o2) { o2.classList.remove("on"); });
        b.classList.add("on");
      });
    });

    /* One button per route: frame that route alone and walk it. */
    $("detail-body").querySelectorAll("[data-march]").forEach(function (b) {
      b.addEventListener("click", function () {
        var pp = (e.paths || [])[+b.dataset.march];
        if (!pp || !pp.path || !map) return;
        map.fitBounds(pathBounds(pp.path), {
          padding: { top: 90, bottom: 190, left: 60, right: 60 }, duration: 900
        });
        setTimeout(function () {
          animateRoute({ path: pp.path, _pathLen: pp._len });
        }, 600);
      });
    });

    $("detail-body").querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.act === "replay") {
          map.fitBounds(pathBounds(e.path), {
            padding: { top: 90, bottom: 190, left: 60, right: 60 }, duration: 900
          });
          setTimeout(function () { animateRoute(e); }, 600);
        } else if (b.dataset.act === "zoom") {
          var w2 = frameFor(e);
          if (w2) {
            showPlaces(w2, e);
            map.fitBounds(framedBounds(w2, e), {
              padding: WIDE_PAD, maxZoom: 11, pitch: 0, bearing: 0, duration: 1200
            });
          } else {
            goTo(e._display || e.coordinates, 17);
          }
        } else {
          navigator.clipboard.writeText(location.href).then(function () {
            b.textContent = t("detail.copied");
            setTimeout(function () { b.textContent = t("detail.copy"); }, 1400);
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
       image, a still, shown inline
       video; a self-hosted file (.webm/.mp4/.ogv), played inline
       embed; YouTube/Vimeo, loaded only when the reader clicks, so
                no third-party request is made just by opening an entry
     Every item carries its own credit and licence, rendered under it.
     ----------------------------------------------------------------- */
  /* Attribution. Credit and licence are read through tr(), so a photographer's
     name and the terms it is used under can be given in all three languages.

     A photograph taken by the researcher is marked as such before anything
     else. It is not a found image; it is fieldwork, it is evidence, and the
     person who stood in that courtyard is the source. */
  function mediaMeta(m) {
    var bits = [];
    var cap = tr(m, "caption");
    if (cap) bits.push(esc(cap));
    var attrib = [];
    if (m.fieldnote) attrib.push('<b class="own">' + esc(t("media.fieldwork")) + '</b>');
    var credit = tr(m, "credit");
    if (credit) attrib.push(esc(credit));
    var lic = tr(m, "license");
    if (lic) {
      attrib.push(m.source
        ? '<a href="' + esc(m.source) + '" target="_blank" rel="noopener">' + esc(lic) + '</a>'
        : esc(lic));
    } else if (m.source) {
      attrib.push('<a href="' + esc(m.source) + '" target="_blank" rel="noopener">' + esc(t("media.source")) + '</a>');
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
             '<button class="embed-play" type="button" aria-label="' + esc(t("media.play")) + '">&#9654;</button>' +
             '</div>' + mediaMeta(m) + '</figure>';
    }

    /* The local copy is the point; a link that rots takes the evidence with
       it. But an image that has been added to the data and not yet mirrored
       should still show, so the remote original is kept as a fallback of last
       resort rather than as the source. */
    var fb = m.remote ? ' data-fb="' + esc(m.remote) + '" onerror="if(this.dataset.fb){var u=this.dataset.fb;this.dataset.fb=\'\';this.src=u;}"' : "";
    /* No photograph on this site leaves the page. Clicking one opens it in the
       viewer, and that is the rule for every image here: a reader following an
       argument should never be thrown into a browser tab holding a bare JPEG
       with no way back except the back button. */
    return '<figure class="d-media"><button type="button" class="d-zoom" aria-label="' +
           esc(t("media.enlarge")) + '">' +
           '<img src="' + esc(m.url) + '"' + fb + ' alt="' + esc(tr(m, "caption")) + '" loading="lazy">' +
           '<i class="d-zoom-hint" aria-hidden="true"></i></button>' +
           mediaMeta(m) + '</figure>';
  }

  /* Research prose carries two marks and no more: **bold** for the sentence a
     section turns on, and *italic* for a transliteration or a foreign word.
     Escaping happens first, so nothing in the data can inject markup; the two
     patterns are then re-admitted deliberately. Em dashes are not used
     anywhere on this site, in any language, by rule. */
  function para(txt) {
    return esc(txt)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .split(/\n{2,}/).join("</p><p>");
  }

  function closeDetail() {
    clearRouteAnim();
    clearPlaces();
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

    buildEpisodes();

    buildCommem();

    renderTicks();

    [s, e].forEach(function (input) {
      input.addEventListener("input", onSlide);
    });
    updateTimelineUI();
    buildCentury();
  }

  /* Year labels on both tracks. Separate from buildTimeline because that
     rebinds the sliders and resets the window; relabelling must not. */
  function renderTicks() {
    var y0 = new Date(state.tMin).getUTCFullYear(), y1 = new Date(state.tMax).getUTCFullYear();
    var span = y1 - y0, step = span > 24 ? 5 : span > 12 ? 3 : span > 6 ? 2 : 1;
    var ticks = [], y;
    for (y = Math.ceil(y0 / step) * step; y <= y1; y += step) ticks.push(y);
    $("tl-ticks").innerHTML = ticks.map(function (t) { return "<span>" + num(t) + "</span>"; }).join("");

    var cn = [];
    for (y = 1900; y <= 2000; y += 20) cn.push(y);
    $("cn-ticks").innerHTML = cn.map(function (t) { return "<span>" + num(t) + "</span>"; }).join("");
  }

  /* -----------------------------------------------------------------
     THE ANNUAL COMMEMORATION; 23 and 24 April, every year
     -----------------------------------------------------------------
     An episode is one stretch of time with a beginning and an end. This is
     the other shape a political calendar takes: the same two days, returning,
     for as long as the axis runs. Two days inside a twenty-nine-year track is
     well under a pixel, so each year is drawn as a minimum-width stem rather
     than a band, in the purple of the forget-me-not adopted for the 1915
     centenary. Clicking any year opens the entry that explains all of them.
     ----------------------------------------------------------------- */

  function commemEvents() {
    return state.events.filter(function (e) { return e.recurs && e.recurs.days; });
  }

  function buildCommem() {
    var box = $("tl-commem");
    if (!box) return;
    var evs = commemEvents();
    if (!evs.length) { box.innerHTML = ""; return; }

    var html = "", key = $("tl-commem-key");
    evs.forEach(function (e) {
      var r = e.recurs, colour = r.color || COMMEM;
      /* Only the years the entry actually carries. A mark for every year of
         the axis is a calendar; a mark for the years that hold an argument is
         a reading. */
      var list = r.years || [];
      var d0 = r.days[0], d1 = r.days[r.days.length - 1];
      for (var q = 0; q < list.length; q++) {
        var y = list[q];
        var a = Date.UTC(y, (r.month || 1) - 1, d0);
        var b = Date.UTC(y, (r.month || 1) - 1, d1 + 1);
        var f0 = (a - state.tMin) / (state.tMax - state.tMin);
        var f1 = (b - state.tMin) / (state.tMax - state.tMin);
        if (f1 < 0 || f0 > 1) continue;
        html += '<button type="button" class="tl-cm" data-commem="' + esc(e.id) + '"' +
                ' data-year="' + y + '"' +
                ' title="' + esc(num(y) + ", " + (tr(e, "title") || "")) + '"' +
                ' style="left:' + (Math.max(0, f0) * 100).toFixed(4) + '%;width:' +
                (Math.max(0, (Math.min(1, f1) - Math.max(0, f0))) * 100).toFixed(4) +
                '%;--cm:' + esc(colour) + '"><i></i></button>';
      }
      if (key) key.style.setProperty("--cm", colour);
    });
    box.innerHTML = html;

    box.querySelectorAll("[data-commem]").forEach(function (b) {
      b.addEventListener("click", function (evt) {
        evt.stopPropagation();
        selectEvent(b.dataset.commem, true);
        var row = document.getElementById("yr-" + b.dataset.year);
        if (row) {
          row.classList.add("hit");
          setTimeout(function () { row.scrollIntoView({ block: "center" }); }, 60);
          setTimeout(function () { row.classList.remove("hit"); }, 2600);
        }
      });
    });

    if (key && !key._bound) {
      key._bound = true;
      key.addEventListener("click", function () {
        var e0 = commemEvents()[0];
        if (e0) selectEvent(e0.id, true);
      });
    }
  }

  /* -----------------------------------------------------------------
     EPISODES; a named stretch of time, marked on the track
     -----------------------------------------------------------------
     The 2018 revolution ran thirty-nine days inside a twenty-nine-year
     axis: four pixels wide at full range. So it is drawn as a marker
     with a label tethered to it, not as a band you could read; and it
     becomes a real band as soon as you zoom the window into it, which
     is what clicking the label does. A sticky note, then a period.
     ----------------------------------------------------------------- */

  function episodeSpan(ep) {
    var a = parseDate(ep.start), b = parseDate(ep.end);
    if (a === null || b === null) return null;
    var f0 = (a - state.tMin) / (state.tMax - state.tMin);
    var f1 = (b - state.tMin) / (state.tMax - state.tMin);
    if (f1 < 0 || f0 > 1) return null;
    return { a: a, b: b, f0: Math.max(0, f0), f1: Math.min(1, f1) };
  }

  /* The number on a chip is how many stops the period has, not how many
     entries happen to fall inside its date range. For the commemoration those
     are wildly different numbers: eleven years of rite, and everything else
     the city did between 2015 and 2026. */
  function episodeCount(ep) {
    if (ep.spur) {
      var st = spurStops(ep);
      if (st) return st.length;
    }
    var a = parseDate(ep.start), b = parseDate(ep.end);
    return state.events.filter(function (e) {
      return e.episode === ep.id || (e._t >= a && e._t <= b);
    }).length;
  }

  function buildEpisodes() {
    var box = $("tl-episodes"), rail = $("tl-rail");
    if (!box) return;
    if (!state.episodes.length) {
      box.innerHTML = "";
      if (rail) rail.innerHTML = "";
      return;
    }

    /* --- on the track itself: the span, in place, no label ---
       A thirty-nine-day episode is four pixels wide on a twenty-nine-year
       axis. It can show WHEN, and nothing else; the words go in the rail. */
    box.innerHTML = state.episodes.map(function (ep, i) {
      var sp = episodeSpan(ep);
      if (!sp) return "";
      return '<button type="button" class="tl-ep" data-ep="' + i + '"' +
             ' title="' + esc(tr(ep, "label")) + '"' +
             ' style="left:' + (sp.f0 * 100).toFixed(3) + '%;width:' +
             ((sp.f1 - sp.f0) * 100).toFixed(3) + '%;--ep:' + esc(ep.color || RED) + '">' +
             '<i class="tl-ep-band"></i></button>';
    }).join("");

    /* --- the rail: one labelled chip per period, in time order ---
       Chips are placed under their own span and then pushed right just far
       enough not to overlap the one before, so a chip always sits at or after
       the period it names. A tick joins each chip back to its place. */
    if (rail) {
      var w = rail.clientWidth || 1000;
      var items = [];
      state.episodes.forEach(function (ep, i) {
        var sp = episodeSpan(ep);
        if (sp) items.push({ ep: ep, i: i, sp: sp });
      });
      items.sort(function (x, y) { return x.sp.f0 - y.sp.f0; });

      rail.innerHTML = items.map(function (it) {
        return '<button type="button" class="tl-rail-chip" data-ep="' + it.i + '"' +
               ' title="' + esc(tr(it.ep, "label")) + '"' +
               ' style="--ep:' + esc(it.ep.color || RED) + '">' +
               '<i class="tl-rail-tick"></i>' +
               '<span>' + esc(tr(it.ep, "label")) + '</span>' +
               (episodeCount(it.ep) ? '<b>' + esc(num(episodeCount(it.ep))) + '</b>' : "") +
               '</button>';
      }).join("");

      /* lay them out after the browser has measured the text */
      /* A chip belongs under its own span, and must never sit on top of
         another. So: try each row in turn, take the first where the chip fits
         at or after its own position, and only if no row can take it fall back
         to the emptiest one. Chips are capped at 40% of the rail and ellipsed,
         which is what keeps a long Armenian label from making the problem
         unsolvable. Three rows is far more than this map will need. */
      var chips = rail.querySelectorAll(".tl-rail-chip");
      var ROW_H = 28, MAX_ROWS = 3;
      var rows = [], used = 1, r;
      for (r = 0; r < MAX_ROWS; r++) rows.push(0);

      Array.prototype.forEach.call(chips, function (c, n) {
        var want = items[n].sp.f0 * w;
        var cw = c.offsetWidth;
        var row = -1, left = 0;
        for (r = 0; r < MAX_ROWS; r++) {
          var tryLeft = Math.max(rows[r], want);
          if (tryLeft + cw <= w) { row = r; left = tryLeft; break; }
        }
        if (row < 0) {                       /* nothing fits; use the emptiest row */
          row = 0;
          for (r = 1; r < MAX_ROWS; r++) if (rows[r] < rows[row]) row = r;
          left = rows[row];
        }
        used = Math.max(used, row + 1);
        c.style.left = Math.round(left) + "px";
        c.style.top = (row * ROW_H) + "px";
        rows[row] = left + cw + 8;
        /* the tick leans back toward the span it names; only the top row can
           actually reach the track above */
        var tick = c.firstElementChild;
        tick.style.left = Math.max(2, Math.min(cw - 2, want - left)) + "px";
        tick.style.display = row === 0 ? "block" : "none";
      });
      rail.style.height = (used * ROW_H - 2) + "px";

      rail.querySelectorAll("[data-ep]").forEach(function (b) {
        b.addEventListener("click", function (evt) {
          evt.stopPropagation();
          showEpisode(state.episodes[+b.dataset.ep]);
        });
      });
    }

    box.querySelectorAll("[data-ep]").forEach(function (b) {
      b.addEventListener("click", function (evt) {
        evt.stopPropagation();
        showEpisode(state.episodes[+b.dataset.ep]);
      });
    });

    markActiveEpisode();
  }

  /* -----------------------------------------------------------------
     THE SPUR: a period's own timeline, opened on demand
     -----------------------------------------------------------------
     A rail chip names a period. Clicking it used to do one thing, zoom the
     main window onto that period, which is right but silent about what is
     inside. So it now also unfolds a second, temporary axis directly under
     the rail: the revolution as its thirty-nine days, the commemoration as
     its years. Each stop opens its own entry and moves the map, and the
     strip closes again on Escape or on the close button.

     The two periods are different shapes and the spur reads them from data
     rather than from a special case: episode.spur.kind is "events" (every
     entry that belongs to the period, in date order) or "years" (the year
     list carried by one recurring entry).
     ----------------------------------------------------------------- */

  var spurEp = null;

  function eventById(id) {
    for (var i = 0; i < state.events.length; i++) if (state.events[i].id === id) return state.events[i];
    return null;
  }

  function shortDate(ev) {
    var p = String(ev.date || "").split("-");
    if (p.length < 2) return num(p[0] || "");
    if (p.length < 3) return MONTH(+p[1] - 1);
    return num(+p[2]) + " " + MONTH(+p[1] - 1);
  }

  function openYear(host, n) {
    var y = (host.years || [])[n];
    if (!y) return;
    selectEvent(host.id, false);
    if (map) {
      var pp = null;
      (host.paths || []).forEach(function (x) { if (x.id === y.route) pp = x; });
      if (pp && pp.path && pp.path.length > 1) {
        map.fitBounds(pathBounds(pp.path), {
          padding: { top: 90, bottom: 210, left: 60, right: 60 }, duration: 1000
        });
        setTimeout(function () { animateRoute({ path: pp.path, _pathLen: pp._len }); }, 650);
      } else {
        goTo(host._display || host.coordinates, Math.max(map.getZoom(), 15));
      }
    }
    var row = document.getElementById("yr-" + y.year);
    if (row) {
      row.classList.add("hit");
      setTimeout(function () { row.scrollIntoView({ block: "center", behavior: "smooth" }); }, 80);
      setTimeout(function () { row.classList.remove("hit"); }, 2600);
    }
  }

  function spurStops(ep) {
    var sp = ep && ep.spur;
    if (!sp) return null;
    if (sp.kind === "years") {
      var host = eventById(sp.entry);
      if (!host || !host.years || !host.years.length) return null;
      return host.years.map(function (y, n) {
        return { key: String(y.year), head: num(y.label || y.year),
                 sub: t("start." + (y.start || "unconfirmed")),
                 go: function () { openYear(host, n); } };
      });
    }
    var list = state.events.filter(function (e) { return e.episode === ep.id; })
.sort(function (a, b) { return a._t - b._t; });
    if (!list.length) return null;
    return list.map(function (e) {
      return { key: e.id, head: shortDate(e), sub: tr(e, "title"),
               go: function () { selectEvent(e.id, true); } };
    });
  }

  function closeSpur() {
    var box = $("tl-spur");
    spurEp = null;
    if (box) { box.hidden = true; box.innerHTML = ""; }
    var rail = $("tl-rail");
    if (rail) rail.querySelectorAll(".tl-rail-chip").forEach(function (c) { c.classList.remove("open"); });
  }

  function openSpur(ep) {
    var box = $("tl-spur");
    if (!box) return;
    var stops = spurStops(ep);
    if (!stops) { closeSpur(); return; }
    if (spurEp === ep.id) { closeSpur(); return; }
    spurEp = ep.id;

    var colour = ep.color || RED;
    var h = '<div class="tl-spur-head" style="--ep:' + esc(colour) + '">' +
            '<b>' + esc(tr(ep, "label")) + '</b>' +
            '<span>' + esc(num(stops.length)) + '</span>' +
            '<button type="button" class="tl-spur-x" aria-label="' + esc(t("spur.close")) + '">&times;</button>' +
            '</div><div class="tl-spur-track" style="--ep:' + esc(colour) + '">';
    stops.forEach(function (st, i) {
      h += '<button type="button" class="tl-spur-stop" data-stop="' + i + '">' +
           '<i></i><b>' + esc(st.head) + '</b><span>' + esc(st.sub || "") + '</span></button>';
    });
    h += '</div>';
    box.innerHTML = h;
    box.hidden = false;

    box.querySelectorAll("[data-stop]").forEach(function (b) {
      b.addEventListener("click", function () {
        box.querySelectorAll("[data-stop]").forEach(function (o) { o.classList.remove("on"); });
        b.classList.add("on");
        stops[+b.dataset.stop].go();
      });
    });
    var x = box.querySelector(".tl-spur-x");
    if (x) x.addEventListener("click", closeSpur);

    var rail = $("tl-rail");
    if (rail) {
      rail.querySelectorAll(".tl-rail-chip").forEach(function (c) {
        c.classList.toggle("open", state.episodes[+c.dataset.ep] === ep);
      });
    }
  }

  /* Which period, if any, the window is currently sitting inside. */
  function markActiveEpisode() {
    var rail = $("tl-rail"), box = $("tl-episodes");
    if (!rail && !box) return;
    state.episodes.forEach(function (ep, i) {
      var a = parseDate(ep.start), b = parseDate(ep.end);
      var inside = a !== null && state.winStart <= a && state.winEnd >= b &&
                   (state.winEnd - state.winStart) < (b - a) * 4;
      [rail, box].forEach(function (host) {
        if (!host) return;
        var el = host.querySelector('[data-ep="' + i + '"]');
        if (el) el.classList.toggle("on", inside);
      });
    });
  }

  /* Clicking the note zooms the window onto the episode, with a week of air
     on each side so its edges are visible rather than flush with the track. */
  function showEpisode(ep) {
    if (!ep) return;
    openSpur(ep);
    var a = parseDate(ep.start), b = parseDate(ep.end);
    if (a === null || b === null) return;
    var pad = Math.max(7 * 864e5, (b - a) * 0.35);
    stopPlay();
    setWindow(
      Math.max(0, (a - pad - state.tMin) / (state.tMax - state.tMin)),
      Math.min(1, (b + pad - state.tMin) / (state.tMax - state.tMin))
    );
  }

  function episodeById(id) {
    for (var i = 0; i < state.episodes.length; i++) {
      if (state.episodes[i].id === id) return state.episodes[i];
    }
    return null;
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
    $("cn-from").textContent = num(new Date(state.cStart).getUTCFullYear());
    $("cn-to").textContent   = num(new Date(state.cEnd).getUTCFullYear());
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
    markActiveEpisode();
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
    var desc = tr(m, "description"), note = tr(m, "note");
    if (desc) h += "<p>" + para(desc) + "</p>";
    if (m.author) h += "<p><strong>" + esc(tr(m, "author") || m.author) + "</strong>" +
                       (m.affiliation ? "" + esc(tr(m, "affiliation") || m.affiliation) : "") + "</p>";
    if (note) h += "<p>" + para(note) + "</p>";
    h += '<p style="font-size:12px;color:#6b7280;margin-top:22px">' +
         esc(t("about.mapped", { n: num(state.events.length) })) + " · " + esc(t("about.credit")) +
         (m.updated ? " · " + esc(t("about.updated", { d: m.updated })) : "") + "</p>";
    if (window.I18N && I18N.lang !== "en") {
      h += '<p style="font-size:12px;color:#6b7280;margin-top:8px">' + esc(t("about.draft")) + "</p>";
    }
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
      /* Coordinates keep Latin digits in every language: they are machine
         values, copied straight into other tools. */
      lat.textContent = Math.abs(la).toFixed(5) + "° " + t(la >= 0 ? "dir.N" : "dir.S");
      lng.textContent = Math.abs(lo).toFixed(5) + "° " + t(lo >= 0 ? "dir.E" : "dir.W");
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
        ? num(round / 1000) + " " + t("unit.km")
        : num(Math.round(round)) + " " + t("unit.m");
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
      setTimeout(function () { map && map.resize(); buildEpisodes(); }, 320);
    });
    /* chip positions are measured in pixels, so they have to be laid out again
       whenever the rail changes width */
    var rz = null;
    window.addEventListener("resize", function () {
      clearTimeout(rz);
      rz = setTimeout(buildEpisodes, 180);
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
    /* Basemap dropdown. setStyle throws away every source and layer, so the
       figure-ground rebuilds from the "styledata" handler and terrain.js
       re-attaches the DEM the same way. */
    var bmSel = $("basemap-select");
    if (bmSel) {
      bmSel.innerHTML = BASEMAP_ORDER.map(function (k) {
        return '<option value="' + k + '">' + esc(t("basemap." + k)) + "</option>";
      }).join("");
      bmSel.value = state.basemap;
      bmSel.addEventListener("change", function () {
        state.basemap = this.value;
        var dark = state.basemap === "dark" || state.basemap === "satellite";
        document.body.classList.toggle("light", !dark);
        $("map-wrap").classList.toggle("on-light", !dark);
        map.setStyle(BASEMAPS[state.basemap]);
      });
    }

    $("about-btn").addEventListener("click", function () { $("about-modal").hidden = false; });
    $("about-close").addEventListener("click", function () { $("about-modal").hidden = true; });
    $("about-modal").addEventListener("click", function (e) {
      if (e.target === this) this.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (lightboxOpen()) { closeLightbox(); return; }
        if (!$("about-modal").hidden) $("about-modal").hidden = true;
        else if (spurEp) closeSpur();
        else if (!$("detail-view").hidden) closeDetail();
      }
      if (lightboxOpen()) {
        if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
        else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleLightboxFull(); }
        return;
      }
      if (e.key === " " && e.target === document.body) { e.preventDefault(); togglePlay(); }
    });

    /* Everything drawn from data has to be drawn again in the new language.
       Static labels are handled inside i18n.js; this is only what this file
       rendered itself. */
    if (window.I18N) {
      I18N.onChange(function () {
        var bm2 = $("basemap-select");
        if (bm2) {
          bm2.innerHTML = BASEMAP_ORDER.map(function (k) {
            return '<option value="' + k + '">' + esc(t("basemap." + k)) + "</option>";
          }).join("");
          bm2.value = state.basemap;
        }
        buildCategories();
        renderTicks();
        buildEpisodes();
        buildCommem();
        if (spurEp) { var _e = episodeById(spurEp); spurEp = null; if (_e) openSpur(_e); }
        lightboxLabels();
        buildAbout();
        updateTimelineUI();
        updateCenturyUI();
        refresh();
        if (state.selectedId && !$("detail-view").hidden) selectEvent(state.selectedId, false);
      });
    }
  }


})();
