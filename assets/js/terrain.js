/* ===================================================================
   Yerevan Project; TOPOGRAPHY, AND THE COST OF IT
   -------------------------------------------------------------------
   Yerevan is not a city on a plane. It sits in an amphitheatre: the
   Hrazdan cuts a gorge through it, Kond and Kanaker stand above the
   centre, Nork rides the eastern ridge, and the land falls away
   south-west toward the Ararat plain. A flat map of Yerevan hides the
   one fact that most explains where things were built and where
   crowds could gather.

   HILLSHADE is what you actually see: the elevation drawn as light and
   shadow, lying flat on the ground, under the streets and buildings.
   It is cheap. TERRAIN is the surface itself bending, which only reads
   once the camera is tilted and pulled back. It is not cheap: MapLibre
   renders the whole scene into an offscreen buffer and drapes it over
   a mesh, every frame.

   THIS FILE USED TO SAY "there is no switch, this is the map." That was
   wrong, and it cost Shokran a working map more than once. On a machine
   whose GPU cannot afford terrain, an always-on 3D surface does not
   degrade into a slower map; it degrades into a map you cannot drag,
   zoom or rotate at all, which is exactly what he reported. A research
   instrument that becomes unusable on the reader's hardware is not a
   research instrument.

   So there are now three things:

     1. A SWITCH. The 3D button beside the basemap picker. The choice is
        remembered in this browser.
     2. A WATCHDOG. Frame times are sampled while the map is actually
        moving. If the map cannot hold a usable rate, terrain is dropped
        automatically and the reader is told why, with one click to put
        it back. Hillshade stays: the landform is still legible flat.
     3. NO WORK IN THE HOT PATH. The old version re-ran on every
        "sourcedata" event, which fires once per tile, hundreds of times
        a minute, and called map.getStyle() twice each time. It is now
        one pass per style load.

   Elevation: AWS Terrain Tiles (terrarium encoding, SRTM/NASADEM,
   ~30 m), keyless and CORS-open.

   window.__terrain reports what actually got applied, and
   window.__health() reports whether the map booted at all. Claude's own
   browser tab is hidden, never runs requestAnimationFrame and therefore
   never finishes loading a map, so those two objects are the only
   honest way to ask what a real browser did.
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

  /* A frame slower than this, sustained, is a map you cannot drag. 55 ms is
     about 18 frames a second: sluggish but still usable, so the watchdog only
     fires below that, and only after two separate movements agree. */
  /* 55 ms was too lenient and it cost him the map. Measured in his own browser
     while he was dragging it: 50 ms a frame, twenty frames a second, which is
     already a map you fight rather than use, and the watchdog sat there and did
     nothing because fifty is less than fifty five. 34 ms is about thirty frames
     a second, which is the lowest rate at which dragging a map still feels like
     dragging something. Below that the terrain goes. */
  var SLOW_MS = 34, STRIKES = 2;

  /* A frozen map cannot be recovered from inside the map: every control is on
     the far side of the freeze. It can always be recovered from the address
     bar. ?3d=off beats the remembered preference and writes the opposite one,
     so the next plain load is also safe. */
  var KEY = "yerevan.terrain";

  var map = null, want = true, done = false, strikes = 0, dropped = false;

  function remembered() {
    try { var v = localStorage.getItem(KEY); return v === null ? null : v === "1"; }
    catch (e) { return null; }
  }
  function remember(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }

  function urlWants() {
    var m = /[?&]3d=(off|on|0|1)/i.exec(location.search);
    if (!m) return null;
    var v = m[1].toLowerCase();
    return (v === "on" || v === "1");
  }

  var pref = remembered();
  if (pref !== null) want = pref;
  var forced = urlWants();
  if (forced !== null) { want = forced; remember(forced); }

  /* The shading has to sit under the streets and buildings, or it draws over
     the figure-ground drawing. Everything below the first line / symbol /
     extrusion layer is ground: background, water, parks, land use.
     map.getStyle() serialises every source, GeoJSON data included, so it is
     called once per style load and never from an event that repeats. */
  function groundLayerId() {
    var layers = (map.getStyle() || {}).layers || [];
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].type === "line" || layers[i].type === "symbol" ||
          layers[i].type === "fill-extrusion") return layers[i].id;
    }
    return undefined;
  }

  function report(under) {
    window.__terrain = {
      dem: !!(map && map.getSource("dem")),
      hillshade: !!(map && map.getLayer("hillshade")),
      under: under,
      terrain: !!(map && map.getTerrain()),
      wanted: want,
      autoDropped: dropped,
      exaggeration: EXAGGERATION
    };
  }

  function apply() {
    if (!map || !map.isStyleLoaded()) return;

    var hasDem  = !!map.getSource("dem");
    var hasHill = !!map.getLayer("hillshade");
    var wantOn  = want && !dropped;

    /* The cheap path, and the one that runs almost every time: three lookups,
       no style serialisation, no allocation. */
    if (hasDem && hasHill && (!!map.getTerrain() === wantOn)) { done = true; return; }

    if (!hasDem) map.addSource("dem", DEM);

    /* Satellite imagery already carries its own shadows; shading it again just
       makes it muddy. A raster-only style has no line or symbol layer, which is
       exactly the signal, so groundLayerId() coming back undefined means skip.
       map.getStyle() serialises every source, GeoJSON data included, so it is
       reached only while the hillshade is still missing, never afterwards. */
    var under;
    if (!hasHill) {
      under = groundLayerId();
      if (under) {
        map.addLayer({
          id: "hillshade",
          type: "hillshade",
          source: "dem",
          paint: {
            "hillshade-exaggeration": 1,
            "hillshade-shadow-color": "#3f454d",
            "hillshade-highlight-color": "#ffffff",
            "hillshade-accent-color": "#6f757d",
            "hillshade-illumination-direction": 315,
            "hillshade-illumination-anchor": "map"
          }
        }, under);
        hasHill = true;
      }
    }

    setTerrain(wantOn);
    report(under);
    /* Not finished until the shading is actually on the map. On a style that
       has no ground layer to slip under there is nothing more to wait for, and
       the bounded retry gives up on its own. */
    done = hasHill;
  }

  function setTerrain(on) {
    if (!map) return;
    try {
      if (on) {
        if (!map.getSource("dem")) map.addSource("dem", DEM);
        map.setMaxPitch(85);
        if (!map.getTerrain()) map.setTerrain({ source: "dem", exaggeration: EXAGGERATION });
      } else {
        if (map.getTerrain()) map.setTerrain(null);
        if (map.getPitch() > 60) map.easeTo({ pitch: 45, duration: 400 });
        map.setMaxPitch(70);
      }
    } catch (e) { window.__terrainErr = String(e && e.message || e); }
    syncButton();
  }

  function safeApply() {
    try { apply(); }
    catch (err) {
      window.__terrainErr = String(err && err.message || err);
      console.warn("terrain:", err);
    }
  }

  /* ---------------- the switch ---------------- */

  function syncButton() {
    var b = document.getElementById("terrain-btn");
    if (!b) return;
    var on = !!(map && map.getTerrain());
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("on", on);
  }

  function toggle(on) {
    want = (typeof on === "boolean") ? on : !(map && map.getTerrain());
    dropped = false;
    strikes = 0;
    remember(want);
    setTerrain(want);
    report(window.__terrain ? window.__terrain.under : undefined);
    hideNote();
  }

  /* ---------------- the watchdog ----------------
     Frame times are only meaningful while the map is actually drawing, so the
     sample runs between movestart and moveend and nowhere else. Two slow
     movements in a row, and terrain goes; one fast one resets the count. */

  var sampling = false, frames = [], rafId = 0, lastT = 0, sampleStart = 0;

  function tick(t) {
    if (!sampling) return;
    if (lastT) frames.push(t - lastT);
    lastT = t;
    rafId = requestAnimationFrame(tick);
  }

  function startSample() {
    if (sampling || !map || !map.getTerrain() || dropped) return;
    sampling = true; frames = []; lastT = 0;
    sampleStart = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function endSample() {
    if (!sampling) return;
    sampling = false;
    if (rafId) cancelAnimationFrame(rafId);

    var elapsed = performance.now() - sampleStart;
    var median;
    if (frames.length >= 6) {
      frames.sort(function (a, b) { return a - b; });
      median = frames[Math.floor(frames.length / 2)];
    } else if (elapsed > 1200) {
      /* Fewer than six frames in more than a second is not too small a sample
         to judge, it is the worst case there is: the map drew almost nothing
         while it was moving. Measuring it as elapsed over frames rather than
         discarding it is the whole point of the watchdog, because the machines
         that need help are exactly the ones that cannot produce a sample. */
      median = elapsed / Math.max(1, frames.length);
    } else {
      return;                                     /* genuinely too short */
    }

    window.__frameMs = Math.round(median);
    if (median > SLOW_MS) {
      if (++strikes >= STRIKES) {
        dropped = true;
        setTerrain(false);
        /* Remembered, so a slow machine is not asked the same question on every
           visit. "Turn it back on" writes the opposite preference and the
           watchdog stands down for good in this browser. */
        remember(false);
        report(window.__terrain ? window.__terrain.under : undefined);
        showNote(Math.round(median));
      }
    } else {
      strikes = 0;
    }
  }

  function noteText(ms) {
    var I = window.I18N;
    var s = I ? I.t("perf.dropped") : "Terrain turned off to keep the map usable on this machine.";
    return s.replace("{ms}", I ? I.num(ms) : ms);
  }

  function showNote(ms) {
    var box = document.getElementById("perf-note");
    if (!box) return;
    var I = window.I18N;
    box.querySelector("span").textContent = noteText(ms);
    box.querySelector("#perf-undo").textContent = I ? I.t("perf.undo") : "Turn it back on";
    box.hidden = false;
  }
  function hideNote() {
    var box = document.getElementById("perf-note");
    if (box) box.hidden = true;
  }

  /* ---------------- the freeze watch ----------------
     THE HOLE IN THE WATCHDOG ABOVE, WHICH IS WHY THIS EXISTS.
     That watchdog samples frame times between movestart and moveend, and it
     only ever reaches a verdict when a movement COMPLETES. A map that has
     stopped responding does not complete movements. The drag produces no
     moveend, or no movestart at all, so endSample never runs, no strike is
     recorded, and the one mechanism built to rescue the reader sleeps through
     exactly the failure it was built for. It can measure slow. It could not
     see dead.

     This watch does not depend on the map's own events agreeing to fire. It
     asks two questions every second, and only while the document is actually
     visible, because a hidden tab does not run requestAnimationFrame at all
     and every measurement taken in one is a lie:

       1. Has a movement been running for more than six seconds?
       2. Did input arrive, and has the map not drawn a frame since?

     Either answer is a map the reader cannot use. Terrain goes at once,
     without waiting for a second strike: there is no second chance to
     collect, because the reader is already stuck.

     It also watches for a transform that has gone non finite. Once a NaN gets
     into the centre or the zoom, every later interaction computes NaN from
     NaN, the camera never moves again, and every handler still reports itself
     enabled, which is the most confusing version of this failure to diagnose
     from the outside. The last camera known to be finite is kept so it can be
     put back. */

  var lastRender = 0, lastInput = 0, lastGood = null, freezeTimer = 0, stuckTicks = 0;

  function camFinite() {
    if (!map) return true;
    var c = map.getCenter();
    return isFinite(c.lng) && isFinite(c.lat) && isFinite(map.getZoom()) &&
           isFinite(map.getBearing()) && isFinite(map.getPitch());
  }

  function noteInput() { lastInput = performance.now(); }

  function freezeDrop(why) {
    dropped = true;
    strikes = 0;
    setTerrain(false);
    remember(false);
    report(window.__terrain ? window.__terrain.under : undefined);
    window.__froze = { why: why, at: new Date().toISOString(), frameMs: window.__frameMs || null };
    showNote(window.__frameMs || 0);
    /* A map that stopped drawing needs to be told to draw again once the load
       that stopped it is gone. */
    try { map.resize(); map.triggerRepaint(); } catch (e) {}
  }

  function startFreezeWatch() {
    if (freezeTimer || !map) return;

    map.on("render", function () { lastRender = performance.now(); });
    map.on("moveend", function () { if (camFinite()) lastGood = {
      center: map.getCenter(), zoom: map.getZoom(),
      bearing: map.getBearing(), pitch: map.getPitch()
    }; });

    var el = map.getCanvasContainer ? map.getCanvasContainer() : map.getCanvas();
    ["wheel", "pointerdown", "mousedown", "touchstart"].forEach(function (ev) {
      el.addEventListener(ev, noteInput, { passive: true });
    });

    freezeTimer = setInterval(function () {
      if (!map || document.visibilityState !== "visible") return;

      if (!camFinite()) {
        window.__nanCam = true;
        if (lastGood) { try { map.jumpTo(lastGood); } catch (e) {} }
        if (map.getTerrain() && !dropped) freezeDrop("non finite camera");
        return;
      }

      if (!map.getTerrain() || dropped) return;

      /* Both conditions below require that the map has ALSO stopped drawing.
         A long camera animation is a movement that legitimately runs for many
         seconds: fitBounds across the country, a route walked along its own
         length. Those keep rendering the whole time, so the render clock stays
         fresh and nothing is dropped. A map that is stuck renders nothing, and
         that is the difference the render clock measures. */
      var now = performance.now();
      var noFrames = lastRender && now - lastRender > 1500;
      if (!noFrames) { stuckTicks = 0; return; }
      /* One second without a frame can be a garbage collection pause on any
         machine. Two consecutive checks cannot. */
      if (++stuckTicks < 2) return;
      if (sampling && now - sampleStart > 6000) { freezeDrop("movement never ended"); return; }
      if (lastInput && now - lastInput < 4000) freezeDrop("input with no frame drawn");
    }, 1000);
  }

  /* ---------------- wiring ---------------- */

  var retry = 0, retries = 0;
  function startRetry() {
    if (retry) return;
    retries = 0;
    retry = setInterval(function () {
      safeApply();
      if (done || ++retries > 40) { clearInterval(retry); retry = 0; }
    }, 300);
  }

  var waited = 0;
  var timer = setInterval(function () {
    if (window.__map) {
      clearInterval(timer);
      map = window.__map;
      try { map.setMaxPitch(want ? 85 : 70); } catch (e) {}
      safeApply();
      /* Retrying is unavoidable: map.isStyleLoaded() stays false while any
         source is still settling, and this map keeps feeding its GeoJSON
         sources, so the "styledata" event and a loaded style rarely coincide.
         The old file solved that by listening to "sourcedata", which fires
         once per tile, forever, hundreds of times a minute. This is a bounded
         retry instead: every 300 ms until it sticks, at most 12 seconds, and
         it stops for good the moment the pass succeeds. Cost when idle: zero. */
      startRetry();
      map.on("styledata", function () { done = false; startRetry(); });
      map.on("movestart", startSample);
      map.on("moveend", endSample);
      startFreezeWatch();
      syncButton();

      var b = document.getElementById("terrain-btn");
      if (b) b.addEventListener("click", function () { toggle(); });
      var undo = document.getElementById("perf-undo");
      if (undo) undo.addEventListener("click", function () { toggle(true); });
      var dis = document.getElementById("perf-dismiss");
      if (dis) dis.addEventListener("click", hideNote);
      if (window.I18N) window.I18N.onChange(function () {
        var box = document.getElementById("perf-note");
        if (box && !box.hidden) showNote(window.__frameMs || 0);
      });
    } else if (++waited > 200) {
      clearInterval(timer);
      window.__terrainErr = "window.__map never appeared; the map never booted";
    }
  }, 150);

  window.TERRAIN = {
    on: function () { toggle(true); },
    off: function () { toggle(false); },
    toggle: toggle,
    state: function () { return window.__terrain; }
  };

})();
