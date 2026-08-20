/* ===================================================================
   Yerevan Project — 3D TERRAIN
   -------------------------------------------------------------------
   Yerevan is not a city on a plane. It sits in an amphitheatre: the
   Hrazdan cuts a gorge through it, Kond and Kanaker stand above the
   centre, Nork rides the eastern ridge, and Ararat closes the horizon
   to the south-west. Flat maps of Yerevan hide the single fact that
   most explains where things were built and where crowds could gather.

   Elevation comes from the AWS Terrain Tiles open dataset (SRTM /
   NASADEM, ~30 m), keyless and CORS-open. Resolution is landform, not
   street furniture: the gorge and the ridges read clearly, individual
   steps of the Cascade do not.

   Its own file, like picker.js — it waits for window.__map, then
   re-applies itself after every basemap change, because setStyle
   discards sources.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var DEM = {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 14,
    attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> (SRTM/NASADEM)'
  };

  /* 1.5× is a compromise: Kentron's relief is tens of metres and would be
     invisible at 1×, while the 400 m between the gorge and Nork would look
     absurd much above 2×. */
  var EXAGGERATION = 1.5;

  /* Looking south-west from the city, down the Ararat plain. */
  var REGION = { center: [44.44, 40.05], zoom: 9.3, pitch: 74, bearing: 214 };

  var map = null;
  var enabled = true;

  function apply() {
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getSource("dem")) map.addSource("dem", DEM);
    map.setTerrain(enabled ? { source: "dem", exaggeration: EXAGGERATION } : null);
  }

  function safeApply() { try { apply(); } catch (err) { console.warn("terrain:", err); } }

  function setEnabled(v) {
    enabled = v;
    $("terrain-btn").classList.toggle("on", enabled);
    safeApply();
    if (!enabled && map.getPitch() > 60) map.easeTo({ pitch: 55, duration: 500 });
  }

  function addButtons() {
    var host = $("map-controls");
    if (!host || $("terrain-btn")) return;
    var anchor = $("about-btn");

    var t = document.createElement("button");
    t.className = "map-btn on";
    t.id = "terrain-btn";
    t.title = "3D terrain — the landform under the city";
    t.textContent = "Terrain";
    t.addEventListener("click", function () { setEnabled(!enabled); });

    var r = document.createElement("button");
    r.className = "map-btn";
    r.id = "region-btn";
    r.title = "Pull back to the Ararat plain";
    r.textContent = "Region";
    r.addEventListener("click", function () {
      if (!enabled) setEnabled(true);
      map.easeTo({
        center: REGION.center, zoom: REGION.zoom,
        pitch: REGION.pitch, bearing: REGION.bearing, duration: 2600
      });
    });

    host.insertBefore(t, anchor);
    host.insertBefore(r, anchor);
  }

  var waited = 0;
  var timer = setInterval(function () {
    if (window.__map) {
      clearInterval(timer);
      map = window.__map;
      /* MapLibre caps pitch at 60 by default; terrain is worth more than that. */
      try { map.setMaxPitch(85); } catch (e) {}
      addButtons();
      safeApply();
      /* setStyle drops every source, so the DEM has to be put back each time. */
      map.on("styledata", safeApply);
    } else if (++waited > 200) {
      clearInterval(timer);
    }
  }, 150);

})();
