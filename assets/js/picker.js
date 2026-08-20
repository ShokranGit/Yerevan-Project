/* ===================================================================
   Yerevan Project — COORDINATE PICK
   -------------------------------------------------------------------
   A crosshair button attached to the coordinate readout. Switch it on,
   click anywhere on the map, and that one coordinate is held in a
   small strip above the readout with a Copy button next to it.

   One at a time, on purpose. The live readout keeps following the
   cursor; the picked coordinate stays put until you pick another or
   clear it. Nothing is looked up, nothing is stored — it is a pair of
   numbers you can paste into a message.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var RED = "#c9262c";

  var map = null;
  var picking = false;
  var picked = null;
  var marker = null;

  function fmt(ll) {
    return ll.lat.toFixed(6) + ", " + ll.lng.toFixed(6);
  }

  function showPick(ll) {
    picked = ll;
    $("pick-val").textContent = fmt(ll);
    $("pick-out").hidden = false;

    if (!marker) {
      var dot = document.createElement("div");
      dot.className = "pick-dot";
      dot.style.background = RED;
      marker = new maplibregl.Marker({ element: dot }).setLngLat(ll).addTo(map);
    } else {
      marker.setLngLat(ll);
    }
  }

  function clearPick() {
    picked = null;
    $("pick-out").hidden = true;
    if (marker) { marker.remove(); marker = null; }
  }

  function setPicking(on) {
    picking = on;
    $("pick-btn").classList.toggle("on", on);
    $("pick-btn").setAttribute("aria-pressed", on ? "true" : "false");
    map.getCanvas().style.cursor = on ? "crosshair" : "";
  }

  function copy(txt, btn) {
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

  function wire() {
    $("pick-btn").addEventListener("click", function () { setPicking(!picking); });
    $("pick-clear").addEventListener("click", function () { clearPick(); });
    $("pick-copy").addEventListener("click", function () {
      if (picked) copy(fmt(picked), this);
    });

    map.on("click", function (e) {
      if (!picking) return;
      showPick(e.lngLat);
    });
  }

  var waited = 0;
  var timer = setInterval(function () {
    if (window.__map) {
      clearInterval(timer);
      map = window.__map;
      try { wire(); } catch (err) { console.warn("pick:", err); }
    } else if (++waited > 200) {
      clearInterval(timer);
    }
  }, 150);

})();
