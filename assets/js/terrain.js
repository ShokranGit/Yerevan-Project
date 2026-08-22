/* ===================================================================
   Yerevan Project; TOPOGRAPHY
   -------------------------------------------------------------------
   Yerevan is not a city on a plane. It sits in an amphitheatre: the
   Hrazdan cuts a gorge through it, Kond and Kanaker stand above the
   centre, Nork rides the eastern ridge, and the land falls away
   south-west toward the Ararat plain. A flat map of Yerevan hides the
   one fact that most explains where things were built and where
   crowds could gather.

   There is no switch. This is the map.

   HILLSHADE is what you actually see: the elevation drawn as light and
   shadow, lying flat on the ground, under the streets and buildings.
   TERRAIN is the surface itself bending, which only reads once the
   camera is tilted and pulled back; Kentron's own relief is a few
   tens of metres over a couple of kilometres, so looking straight down
   at one square, no amount of bending will look like anything.

   If the landform is invisible, the answer is almost always zoom, not
   settings: pull back to z12–13 and the amphitheatre appears.

   Elevation: AWS Terrain Tiles (terrarium encoding, SRTM/NASADEM,
   ~30 m), keyless and CORS-open. Landform resolution, not street
   furniture; the gorge and the ridges read clearly, the individual
   steps of the Cascade do not.

   window.__terrain reports what actually got applied. If Alireza says
   he cannot see the landscape, that object is the first thing to ask
   for, because Claude's own browser tab never finishes loading a map
   and cannot look at the result.
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

  /* The shading has to sit under the streets and buildings, or it draws over
     the figure-ground drawing. Everything below the first line / symbol /
     extrusion layer is ground: background, water, parks, land use. */
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

    /* Satellite imagery already carries its own shadows; shading it again just
       makes it muddy. A raster-only style has no line or symbol layer, which is
       exactly the signal, so groundLayerId() coming back undefined means skip. */
    var under = groundLayerId();

    if (under && !map.getLayer("hillshade")) {
      map.addLayer({
        id: "hillshade",
        type: "hillshade",
        source: "dem",
        paint: {
          /* Strong on purpose. This is a research map of a city whose
             shape is its terrain, not a pretty basemap. */
          "hillshade-exaggeration": 1,
          "hillshade-shadow-color": "#3f454d",
          "hillshade-highlight-color": "#ffffff",
          "hillshade-accent-color": "#6f757d",
          "hillshade-illumination-direction": 315,
          "hillshade-illumination-anchor": "map"
        }
      }, under);
    }

    if (!map.getTerrain()) {
      map.setTerrain({ source: "dem", exaggeration: EXAGGERATION });
    }

    window.__terrain = {
      dem: !!map.getSource("dem"),
      hillshade: !!map.getLayer("hillshade"),
      under: groundLayerId(),
      terrain: !!map.getTerrain(),
      exaggeration: EXAGGERATION
    };
  }

  function safeApply() {
    try { apply(); }
    catch (err) {
      window.__terrainErr = String(err && err.message || err);
      console.warn("terrain:", err);
    }
  }

  var waited = 0;
  var timer = setInterval(function () {
    if (window.__map) {
      clearInterval(timer);
      map = window.__map;
      /* MapLibre caps pitch at 60 by default; terrain is worth more than that. */
      try { map.setMaxPitch(85); } catch (e) {}
      safeApply();
      /* Tiles and style data arrive in waves; re-apply until it sticks. */
      map.on("styledata", safeApply);
      map.on("sourcedata", safeApply);
    } else if (++waited > 200) {
      clearInterval(timer);
      window.__terrainErr = "window.__map never appeared; the map never booted";
    }
  }, 150);

})();
