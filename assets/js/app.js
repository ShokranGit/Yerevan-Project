/* ===================================================================
   Yerevan Project — application logic
   -------------------------------------------------------------------
   Everything the map shows comes from data/events.json.
   You should not need to edit this file to add research material.
   =================================================================== */

(function () {
  "use strict";

  /* ---------------- configuration ---------------- */

  var BASEMAPS = {
    dark:  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
  };

  var HOME = { center: [44.5136, 40.1830], zoom: 13.1, pitch: 0, bearing: 0 };
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
    selectedId: null,
    basemap: "dark",
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

  fetch("data/events.json", { cache: "no-store" })
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

    var times = state.events.map(function (e) { return e._t; })
      .concat(state.events.map(function (e) { return e._tEnd; }));
    state.tMin = times.length ? Math.min.apply(null, times) : Date.UTC(2000, 0, 1);
    state.tMax = times.length ? Math.max.apply(null, times) : Date.UTC(2026, 0, 1);
    /* pad a little so end points aren't flush against the handles */
    var pad = Math.max((state.tMax - state.tMin) * 0.02, 86400000 * 30);
    state.tMin -= pad; state.tMax += pad;
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
      attributionControl: { compact: true }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 88, unit: "metric" }), "bottom-right");

    map.on("load", function () {
      addLayers();
      refresh();
      hideLoader();
      openFromHash();
    });

    map.on("idle", hideLoader);

    map.on("styledata", function () {
      if (map.isStyleLoaded() && !map.getSource(SRC)) { addLayers(); refresh(); }
    });

    map.on("error", function (e) {
      console.warn("map error:", e && e.error ? e.error.message : e);
    });

    /* Failsafe: never let the loading screen trap the interface. The panel,
       timeline and filters are useful even if basemap tiles cannot be reached. */
    setTimeout(function () {
      if (!loaderHidden) {
        hideLoader();
        refresh();
        mapNotice("<strong style=\"color:#e6e8ec\">Basemap did not load.</strong><br>" +
          "The timeline, themes and event list still work. This is usually a network " +
          "or firewall problem reaching the map tile server.");
      }
    }, 8000);
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
        "circle-stroke-color": "#ffffff",
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

  function emptyFC() { return { type: "FeatureCollection", features: [] }; }

  /* =================================================================
     FILTER + REFRESH
     ================================================================= */

  function visibleEvents() {
    var q = state.query.trim().toLowerCase();
    return state.events.filter(function (e) {
      if (e._tEnd < state.winStart || e._t > state.winEnd) return false;
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
            geometry: { type: "Point", coordinates: e.coordinates },
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
      if (e._tEnd < state.winStart || e._t > state.winEnd) return;
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
        '<div class="res-date">' + esc(fmtDate(e)) + '</div>' +
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
      map.easeTo({ center: e.coordinates, zoom: Math.max(map.getZoom(), 15), duration: 900 });
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

    (e.media || []).forEach(function (m) {
      if (m.type && m.type !== "image") return;
      h += '<figure class="d-media"><img src="' + esc(m.url) + '" alt="' + esc(m.caption || "") + '" loading="lazy">' +
           (m.caption ? '<figcaption>' + esc(m.caption) +
             (m.credit ? ' <em>' + esc(m.credit) + '</em>' : '') + '</figcaption>' : '') +
           '</figure>';
    });

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
    $("detail-body").querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.act === "zoom") {
          map.easeTo({ center: e.coordinates, zoom: 16.5, duration: 900 });
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

  function wireUI() {
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
    $("reset-btn").addEventListener("click", function () {
      map.easeTo({ center: HOME.center, zoom: HOME.zoom, duration: 900 });
    });
    $("basemap-btn").addEventListener("click", function () {
      state.basemap = state.basemap === "dark" ? "light" : "dark";
      document.body.classList.toggle("light", state.basemap === "light");
      map.setStyle(BASEMAPS[state.basemap]);
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
