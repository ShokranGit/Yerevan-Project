/* ===================================================================
   Yerevan Project — TOPOGRAPHY
   -------------------------------------------------------------------
   Yerevan is not a city on a plane. It sits in an amphitheatre: the
   Hrazdan cuts a gorge through it, Kond and Kanaker stand above the
   centre, Nork rides the eastern ridge, and the land falls away
   south-west toward the Ararat plain. A flat map of Yerevan hides the
   one fact that most explains where things were built and where
   crowds could gather.

   There is no switch. This is the map.

   Two things are doing the work, and they are not the same thing:

   * TERRAIN  — the map surface itself bends, so a tilted camera shows
     real slope. Convincing when you look across the city; nearly
     invisible looking straight down at one square, because Kentron's
     own relief is only tens of metres over a couple of kilometres.

   * HILLSHADE — the same elevation drawn as light and shadow, flat on
     the ground. This is what makes the landform legible at *every*
     zoom, and it is why the first version of this file looked like
     nothing had happened. Shaded relief is the topographic map; the
     bending is the 3D.

   Elevation: AWS Terrain Tiles (terrarium encoding, SRTM/NASADEM,
   ~30 m), keyless and CORS-open. That resolution is landform, not
   street furniture — the gorge and the ridges read clearly, the
   individual steps of the Cascade do not.
   =================================================================== */

(function () {
  "use strict";

  var DEM = {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 14,
    attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> (SRTM/NASADEM)'
  };

  /* 1.8x: Kentron's relief would be invisible at 1x, and the ~400 m between
     the gorge floor and Nork would look like a mountain range much above 2x. */
  var EXAGGERATION = 1.8;

  var map = null;

  /* The shading has to sit under the streets and buildings, or it draws on
     top of the drawing. Find the first line/symbol layer and go beneath it. */
  function groundLayerId() {
    var layers = map.getStyle().layers || [];
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].type === "line" || layers[i].type === "symbol" ||
          layers[i].type === "fill-extrusion") return layers[i].id;
    }
    return undefined;
  }

  function apply() {
    if (!map || !map.isStyleLoaded()) return;

    if (!map.getSource("dem")) map.addSource("dem", DEM);

    if (!map.getLayer("hillshade")) {
      map.addLayer({
        id: "hillshade",
        type: "hillshade",
        source: "dem",
        paint: {
          "hillshade-exaggeration": 0.55,
          "hillshade-shadow-color": "#7d838c",
          "hillshade-highlight-color": "#ffffff",
          "hillshade-accent-color": "#9aa0a8",
          "hillshade-illumination-direction": 315,
          "hillshade-illumination-anchor": "map"
        }
      }, groundLayerId());
    }

    if (!map.getTerrain()) {
      map.setTerrain({ source: "dem", exaggeration: EXAGGERATION });
    }
  }

  function safeApply() { try { apply(); } catch (err) { console.warn("terrain:", err); } }

  var waited = 0;
  var timer = setInterval(function () {
    if (window.__map) {
      clearInterval(timer);
      map = window.__map;
      /* MapLibre caps pitch at 60 by default; terrain is worth more than that. */
      try { map.setMaxPitch(85); } catch (e) {}
      safeApply();
      /* setStyle drops every source and layer, so put them back each time. */
      map.on("styledata", safeApply);
    } else if (++waited > 200) {
      clearInterval(timer);
    }
  }, 150);

})();
