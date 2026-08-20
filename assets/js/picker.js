/* ===================================================================
   Yerevan Project — BUILDING PICKER
   -------------------------------------------------------------------
   Click the map, get the building under the click. The footprint is
   resolved against OpenStreetMap (Overpass) in the reader's own browser,
   so each pick carries a real OSM id, a real height and a real name —
   which is exactly what data/figure.json needs.

   "Copy list"    -> readable lines, good for pasting into a message.
   "Copy GeoJSON" -> features ready to drop straight into data/figure.json.

   Its own file, so app.js stays the map and this stays the tool. It waits
   for app.js to publish the map on window.__map, then wires itself up.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var RED = "#c9262c", RED_DEEP = "#8f1b20", GREY_MASS = "#b8bcc2";
  var map = null;

  var picks = [];
  var picking = false;

  var OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  function ringsOf(el) {
    if (el.type === "way" && el.geometry) {
      return [el.geometry.map(function (p) { return [p.lon, p.lat]; })];
    }
    if (el.type === "relation" && el.members) {
      return el.members
        .filter(function (m) { return m.role === "outer" && m.geometry; })
        .map(function (m) {
          return m.geometry.map(function (p) { return [p.lon, p.lat]; });
        });
    }
    return [];
  }

  function pointInRing(pt, ring) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) &&
          x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function heightOf(tags) {
    if (!tags) return 12;
    var h = parseFloat(tags.height);
    if (isFinite(h) && h > 0) return h;
    var lv = parseFloat(tags["building:levels"]);
    if (isFinite(lv) && lv > 0) return Math.round(lv * 3.4 * 10) / 10;
    return 12;
  }

  function overpassAt(lng, lat) {
    var q = "[out:json][timeout:25];(" +
            'way["building"](around:30,' + lat + "," + lng + ");" +
            'relation["building"](around:30,' + lat + "," + lng + ");" +
            ");out geom tags;";
    var tried = 0;
    function attempt() {
      var url = OVERPASS[tried % OVERPASS.length];
      tried++;
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q)
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).catch(function (err) {
        if (tried < OVERPASS.length) return attempt();
        throw err;
      });
    }
    return attempt().then(function (json) {
      var els = (json && json.elements) || [];
      var containing = null, nearest = null, bestD = Infinity;
      els.forEach(function (el) {
        var rings = ringsOf(el);
        if (!rings.length) return;
        if (!containing && rings.some(function (r) { return pointInRing([lng, lat], r); })) {
          containing = { el: el, rings: rings };
        }
        rings[0].forEach(function (p) {
          var d = Math.hypot((p[0] - lng) * 0.7648, p[1] - lat);
          if (d < bestD) { bestD = d; nearest = { el: el, rings: rings }; }
        });
      });
      var hit = containing || nearest;
      if (!hit) return null;
      return {
        osm: hit.el.type + "/" + hit.el.id,
        name: (hit.el.tags && (hit.el.tags.name || hit.el.tags["name:en"])) || null,
        h: heightOf(hit.el.tags),
        exact: !!containing,
        rings: hit.rings
      };
    });
  }

  function picksSource() {
    return {
      type: "FeatureCollection",
      features: picks.map(function (p, i) {
        return {
          type: "Feature",
          properties: { n: String(i + 1), zone: p.zone },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] }
        };
      })
    };
  }

  function outlineSource() {
    return {
      type: "FeatureCollection",
      features: picks.filter(function (p) { return p.b && p.b.rings; }).map(function (p) {
        return {
          type: "Feature",
          properties: { zone: p.zone },
          geometry: { type: "Polygon", coordinates: p.b.rings }
        };
      })
    };
  }

  function syncPickLayers() {
    if (!map || !map.getSource) return;
    if (!map.getSource("picks")) {
      try {
        map.addSource("pick-outline", { type: "geojson", data: outlineSource() });
        map.addLayer({
          id: "pick-outline-fill", type: "fill", source: "pick-outline",
          paint: {
            "fill-color": ["match", ["get", "zone"], "republic", RED, GREY_MASS],
            "fill-opacity": 0.35
          }
        });
        map.addLayer({
          id: "pick-outline-line", type: "line", source: "pick-outline",
          paint: { "line-color": RED, "line-width": 1.6 }
        });
        map.addSource("picks", { type: "geojson", data: picksSource() });
        map.addLayer({
          id: "pick-dots", type: "circle", source: "picks",
          paint: {
            "circle-radius": 6, "circle-color": RED,
            "circle-stroke-width": 2, "circle-stroke-color": "#fff"
          }
        });
        map.addLayer({
          id: "pick-nums", type: "symbol", source: "picks",
          layout: {
            "text-field": ["get", "n"], "text-size": 10,
            "text-offset": [0, -1.3], "text-allow-overlap": true
          },
          paint: { "text-color": RED_DEEP, "text-halo-color": "#fff", "text-halo-width": 1.4 }
        });
      } catch (e) { /* style not ready yet */ }
      return;
    }
    map.getSource("picks").setData(picksSource());
    map.getSource("pick-outline").setData(outlineSource());
  }

  function renderPicks() {
    var list = $("pick-list");
    if (!list) return;
    if (!picks.length) {
      list.innerHTML = '<p class="pick-empty">Click a building on the map. ' +
                       'Each click is looked up in OpenStreetMap.</p>';
    } else {
      list.innerHTML = picks.map(function (p, i) {
        var label = p.status === "ok"
          ? (p.b.name || p.b.osm) + ' <span class="pick-meta">' + p.b.h + " m · " +
            p.b.osm + (p.b.exact ? "" : " · nearest") + "</span>"
          : '<span class="pick-meta">' + p.status + "</span>";
        return '<div class="pick-row" data-i="' + i + '">' +
          '<b>' + (i + 1) + '</b>' +
          '<div class="pick-main"><code>' + p.lat.toFixed(6) + ", " + p.lng.toFixed(6) +
          "</code><div>" + label + "</div></div>" +
          '<button class="pick-zone ' + p.zone + '" data-act="zone" title="Red or grey">' +
          (p.zone === "republic" ? "red" : "grey") + "</button>" +
          '<button class="pick-x" data-act="del" title="Remove">×</button>' +
          "</div>";
      }).join("");
    }
    $("pick-count").textContent = picks.length ? "(" + picks.length + ")" : "";
    syncPickLayers();
  }

  function addPick(lngLat) {
    var p = { lat: lngLat.lat, lng: lngLat.lng, zone: "republic", status: "looking up…", b: null };
    picks.push(p);
    renderPicks();
    overpassAt(p.lng, p.lat).then(function (b) {
      if (b) { p.b = b; p.status = "ok"; }
      else { p.status = "no building found — coordinates only"; }
      renderPicks();
    }).catch(function (err) {
      p.status = "lookup failed (" + err.message + ") — coordinates only";
      renderPicks();
    });
  }

  function copyText(txt, btn) {
    function done() {
      var old = btn.textContent;
      btn.textContent = "copied";
      setTimeout(function () { btn.textContent = old; }, 1200);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, fallback);
    } else fallback();
  }

  function picksAsText() {
    return picks.map(function (p, i) {
      var b = p.b;
      return (i + 1) + ". " + p.lat.toFixed(6) + ", " + p.lng.toFixed(6) +
        "  [" + (p.zone === "republic" ? "red" : "grey") + "]" +
        (b ? "  " + b.osm + (b.name ? "  " + b.name : "") + "  h=" + b.h + "m" +
             (b.exact ? "" : "  (nearest, click was outside any footprint)")
           : "  " + p.status);
    }).join("\n");
  }

  function picksAsGeoJSON() {
    return JSON.stringify({
      type: "FeatureCollection",
      features: picks.filter(function (p) { return p.b && p.b.rings; }).map(function (p) {
        return {
          type: "Feature",
          properties: { h: p.b.h, name: p.b.name, osm: p.b.osm, zone: p.zone },
          geometry: { type: "Polygon", coordinates: p.b.rings }
        };
      })
    }, null, 1);
  }

  function setPicking(on) {
    picking = on;
    $("pick-btn").classList.toggle("on", on);
    $("pick-panel").hidden = !on;
    var c = map.getCanvas();
    c.style.cursor = on ? "crosshair" : "";
    if (on) renderPicks();
  }

  function wirePicker() {
    $("pick-btn").addEventListener("click", function () { setPicking(!picking); });
    $("pick-close").addEventListener("click", function () { setPicking(false); });
    $("pick-clear").addEventListener("click", function () { picks = []; renderPicks(); });
    $("pick-copy").addEventListener("click", function () { copyText(picksAsText(), this); });
    $("pick-copy-geo").addEventListener("click", function () { copyText(picksAsGeoJSON(), this); });

    $("pick-list").addEventListener("click", function (e) {
      var btn = e.target.closest("button"); if (!btn) return;
      var i = +btn.closest(".pick-row").dataset.i;
      if (btn.dataset.act === "del") picks.splice(i, 1);
      else picks[i].zone = picks[i].zone === "republic" ? "avenue" : "republic";
      renderPicks();
    });

    map.on("click", function (e) {
      if (!picking) return;
      addPick(e.lngLat);
    });
    map.on("styledata", function () { if (picks.length) syncPickLayers(); });
  }

  /* app.js publishes the map on window.__map once the style has loaded. */
  var waited = 0;
  var timer = setInterval(function () {
    if (window.__map) {
      clearInterval(timer);
      map = window.__map;
      try { wirePicker(); } catch (err) { console.warn("picker:", err); }
    } else if (++waited > 200) {
      clearInterval(timer);
    }
  }, 150);

})();
