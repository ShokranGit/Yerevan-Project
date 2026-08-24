/* ===================================================================
   Yerevan Project; THE THIRTY-NINE DAYS
   A space-time cube for the 2018 revolution, standing on the map itself.
   -------------------------------------------------------------------
   Hägerstrand's diagram, and Kraak's later reading of it, put geography
   on the floor and time up the wall: a person becomes a line, standing
   still becomes a vertical segment, travelling becomes a slope, and a
   place used again and again becomes a column. That is exactly the
   shape of these thirty-nine days, so the cube is not an illustration
   of the revolution, it is its natural drawing.

   The decision that matters here: THE FLOOR OF THE CUBE IS THE REAL
   MAP. Not a thumbnail of Yerevan pasted under a chart in a separate
   window, the actual live basemap, at whatever zoom and bearing the
   reader left it. Turn the cube on and the city you were already
   reading grows thirty-nine days upward out of itself. Pan, rotate,
   zoom: the days move with the streets, because they are drawn in the
   same mercator space and share the same camera.

   Everything is a hairline. WebGL clamps line width to one pixel on
   every browser that matters, so instead of fighting that, the whole
   drawing is built out of one-pixel lines and small discs, and
   emphasis is carried by opacity and colour alone. That constraint
   turned out to be the right aesthetic anyway.

   READING IT
     up          time, 31 March to 8 May 2018
     floor       Yerevan, the map you already have
     a disc      an entry, at its place and on its day
     a column    a place holding still through time; the France Square
                 sit-in is ten days tall
     horizontal  movement inside a single day (the 22 April march to
                 the arrest is nearly flat, because it took two hours)
     a slope     movement across days; the walk from Gyumri leans in
                 from the northwest over a fortnight
     the ghosts  entries outside the timeline window, which is why
                 dragging the timeline slices the cube and pressing
                 play makes the revolution rise

   HONESTY
     Day precision. Every entry in the dossier is dated to the day, so
     an event sits at the height of its day and nothing pretends to
     know the hour. The two-hour march of 22 April is therefore drawn
     flat, which is correct: at this scale it IS flat.
     The Gyumri walk is the one interpolated thing here. The route
     through Vanadzor, Dilijan, Hrazdan and Abovyan is documented; the
     dates of the middle towns are not, so they are spaced along the
     route by distance between the two dates that are documented, 31
     March in Gyumri and 13 April in Yerevan. The caption says so on
     screen, where the reader can see it.
   =================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, d) { return (window.I18N && I18N.t) ? I18N.t(k) || d : d; };

  var EPISODE = "2018-revolution";
  var T0 = Date.UTC(2018, 2, 31);
  var T1 = Date.UTC(2018, 4, 8);

  /* The umbrella entry stands for the whole period and has no single
     moment of its own; it would sit at the bottom of the cube and mean
     nothing. The cube is built from the other sixteen. */
  var UMBRELLA = "velvet-revolution-2018";

  /* The walk from Gyumri. Towns documented, dates between them spaced
     by distance; see the note at the top of this file. */
  var MY_STEP = [
    { name: "Gyumri",   c: [43.8465, 40.7877] },
    { name: "Vanadzor", c: [44.4883, 40.8128] },
    { name: "Dilijan",  c: [44.8635, 40.7411] },
    { name: "Hrazdan",  c: [44.7683, 40.4979] },
    { name: "Abovyan",  c: [44.6272, 40.2704] },
    { name: "Yerevan",  c: [44.5152, 40.1859] }
  ];

  var COL = {
    line:   [0.788, 0.149, 0.173],   /* #c9262c, the episode's red */
    stay:   [0.855, 0.243, 0.259],
    node:   [0.957, 0.937, 0.902],   /* #f4efe6 */
    stalk:  [0.553, 0.569, 0.600],
    box:    [0.553, 0.569, 0.600],
    shade:  [0.050, 0.055, 0.065],
    slab:   [0.957, 0.937, 0.902]
  };

  var map = null, on = false, geo = null, layer = null;
  var lastMatrix = null, hover = null, wrap = null, labels = null;
  var winFrom = null, winTo = null;

  /* ---------------- small maths ---------------- */

  function dayMs(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function metresBetween(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dx = (b[0] - a[0]) * r * Math.cos((a[1] + b[1]) * 0.5 * r) * R;
    var dy = (b[1] - a[1]) * r * R;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------------- the geometry ---------------- */

  function build(events) {
    var all = (events || []).filter(function (e) {
      return e.episode === EPISODE && e.id !== UMBRELLA && e.coordinates;
    });
    if (!all.length) return null;

    /* The cube is proportioned by the city it stands on, not by a
       number picked in advance: as tall as the ground it covers is
       wide, so it reads as a cube and not as a mast or a pancake.
       Gyumri is a hundred kilometres away and would flatten
       everything, so the proportion is taken from the Yerevan
       entries and the walk simply leans in from outside. */
    var kentron = all.filter(function (e) { return e.coordinates[0] > 44.3; });
    var lo = [ 999, 999 ], hi = [ -999, -999 ];
    kentron.forEach(function (e) {
      lo[0] = Math.min(lo[0], e.coordinates[0]); hi[0] = Math.max(hi[0], e.coordinates[0]);
      lo[1] = Math.min(lo[1], e.coordinates[1]); hi[1] = Math.max(hi[1], e.coordinates[1]);
    });
    var padX = (hi[0] - lo[0]) * 0.22 || 0.004, padY = (hi[1] - lo[1]) * 0.16 || 0.004;
    var box = [ lo[0] - padX, lo[1] - padY, hi[0] + padX, hi[1] + padY ];
    var wide = metresBetween([box[0], box[1]], [box[2], box[1]]);
    var tall = metresBetween([box[0], box[1]], [box[0], box[3]]);
    var H = Math.max(3500, Math.min(9000, Math.max(wide, tall)));

    function alt(ms) { return (ms - T0) / (T1 - T0) * H; }

    var nodes = [], segs = [];
    function seg(a, b, col, a1, a2) {
      segs.push({ a: a, b: b, c: col, o1: a1, o2: a2 == null ? a1 : a2 });
    }

    /* --- the entries, each a disc at its place on its day --- */
    var chain = [];
    all.forEach(function (e) {
      var ms = dayMs(e.date); if (ms === null) return;
      var end = dayMs(e.dateEnd);
      var p = [e.coordinates[0], e.coordinates[1], alt(ms)];
      var n = { id: e.id, e: e, ms: ms, p: p,
                title: pick(e, "title"), place: pick(e, "location") };
      /* An entry that lasts is a column: the sit-in at France Square
         held that corner for ten days and the drawing should say so. */
      if (end && end > ms && e.id !== "my-step-march-2018-03-31") {
        n.top = alt(end);
        seg(p, [p[0], p[1], n.top], COL.stay, 0.85, 0.25);
      }
      nodes.push(n);
      chain.push(n);
    });
    chain.sort(function (a, b) { return a.ms - b.ms; });

    /* --- the worldline: the revolution's own thread through the cube --- */
    for (var i = 1; i < chain.length; i++) {
      if (chain[i - 1].p[0] < 44.3 || chain[i].p[0] < 44.3) continue; /* the walk carries that leg */
      seg(chain[i - 1].p, chain[i].p, COL.line, 0.62);
    }

    /* --- the walk from Gyumri, leaning in from the northwest --- */
    var lens = [], total = 0;
    for (i = 1; i < MY_STEP.length; i++) {
      var d = metresBetween(MY_STEP[i - 1].c, MY_STEP[i].c);
      lens.push(d); total += d;
    }
    var walkStart = dayMs("2018-03-31"), walkEnd = dayMs("2018-04-13"), acc = 0;
    var stepPts = MY_STEP.map(function (s, k) {
      if (k) acc += lens[k - 1];
      var f = total ? acc / total : 0;
      return { name: s.name, p: [s.c[0], s.c[1], alt(walkStart + f * (walkEnd - walkStart))] };
    });
    /* The walk is a hundred kilometres long and the cube is six across, so
       the far legs would shout over the city. They fade with distance: the
       thread arrives out of the northwest rather than dragging the eye to
       Lake Sevan. */
    function farFade(p) {
      var dx = Math.max(0, Math.max(box[0] - p[0], p[0] - box[2]));
      var dy = Math.max(0, Math.max(box[1] - p[1], p[1] - box[3]));
      var d = Math.sqrt(dx * dx + dy * dy);
      return Math.max(0.14, 0.62 - d * 3.2);
    }
    for (i = 1; i < stepPts.length; i++) {
      seg(stepPts[i - 1].p, stepPts[i].p, COL.line,
          farFade(stepPts[i - 1].p), farFade(stepPts[i].p));
    }

    /* --- the 22 April march, flat because two hours is flat --- */
    all.forEach(function (e) {
      if (!e.path || e.path.length < 2) return;
      var z = alt(dayMs(e.date));
      for (var k = 1; k < e.path.length; k++) {
        seg([e.path[k - 1][0], e.path[k - 1][1], z],
            [e.path[k][0], e.path[k][1], z], COL.line, 0.55);
      }
    });

    /* --- stalks: every disc dropped to the ground, so you can read
           where it is without leaving the height it is at --- */
    nodes.forEach(function (n) {
      if (n.p[0] < 44.3) return;
      seg([n.p[0], n.p[1], 0], n.p, COL.stalk, 0.05, 0.30);
    });

    /* --- the footprint: Kraak's ground projection, the plan of the
           thirty-nine days lying flat under them --- */
    for (i = 1; i < chain.length; i++) {
      if (chain[i - 1].p[0] < 44.3 || chain[i].p[0] < 44.3) continue;
      seg([chain[i - 1].p[0], chain[i - 1].p[1], 0],
          [chain[i].p[0], chain[i].p[1], 0], COL.shade, 0.40);
    }

    /* --- stations: a place the revolution kept coming back to gets a
           column of its own, full height, barely there. Republic
           Square is the tall one, and that is the finding. --- */
    var seen = {};
    chain.forEach(function (n) {
      if (n.p[0] < 44.3) return;
      var k = n.p[0].toFixed(4) + "," + n.p[1].toFixed(4);
      (seen[k] || (seen[k] = [])).push(n);
    });
    Object.keys(seen).forEach(function (k) {
      var g = seen[k]; if (g.length < 2) return;
      seg([g[0].p[0], g[0].p[1], 0], [g[0].p[0], g[0].p[1], H], COL.stalk, 0.16, 0.03);
    });

    /* --- the cube itself: four posts and two rectangles, so the
           volume has edges and the eye has something to hold --- */
    var corners = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
    corners.forEach(function (c) {
      seg([c[0], c[1], 0], [c[0], c[1], H], COL.box, 0.16, 0.05);
    });
    [0, H].forEach(function (z, zi) {
      for (var k = 0; k < 4; k++) {
        var a = corners[k], b = corners[(k + 1) % 4];
        seg([a[0], a[1], z], [b[0], b[1], z], COL.box, zi ? 0.08 : 0.18);
      }
    });

    /* --- the ruler: a day is a tick, a week is a longer one --- */
    var anchor = [box[0], box[3]];
    var ticks = [];
    var tickLen = (box[2] - box[0]) * 0.05;
    for (var ms2 = T0; ms2 <= T1; ms2 += 86400000) {
      var z = alt(ms2);
      var d = new Date(ms2);
      var weekly = d.getUTCDay() === 6;
      var L = weekly ? tickLen * 2.1 : tickLen;
      seg([anchor[0], anchor[1], z], [anchor[0] + L, anchor[1], z], COL.box, weekly ? 0.38 : 0.16);
      ticks.push({ ms: ms2, p: [anchor[0] + L * 1.25, anchor[1], z], weekly: weekly });
    }
    seg([anchor[0], anchor[1], 0], [anchor[0], anchor[1], H], COL.box, 0.40, 0.18);

    return { nodes: nodes, segs: segs, H: H, box: box, alt: alt,
             ticks: ticks, anchor: anchor, steps: stepPts,
             centre: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] };
  }

  /* i18n.js keeps the language on a getter and does the field juggling
     itself; tr() already knows about both the nested and the suffixed
     shapes in this data. */
  function pick(e, field) {
    if (window.I18N && I18N.tr) return I18N.tr(e, field) || "";
    var v = e[field];
    if (v && typeof v === "object") return v.en || "";
    return v || "";
  }

  /* ---------------- WebGL ---------------- */

  var LINE_VS =
    "attribute vec3 a_pos; attribute vec4 a_col; uniform mat4 u_m;" +
    "varying vec4 v_col;" +
    "void main(){ v_col = a_col; gl_Position = u_m * vec4(a_pos, 1.0); }";
  var LINE_FS =
    "precision mediump float; varying vec4 v_col;" +
    "void main(){ gl_FragColor = vec4(v_col.rgb * v_col.a, v_col.a); }";

  var DOT_VS =
    "attribute vec3 a_pos; attribute vec4 a_col; attribute float a_size;" +
    "uniform mat4 u_m; varying vec4 v_col;" +
    "void main(){ v_col = a_col; gl_Position = u_m * vec4(a_pos, 1.0);" +
    " gl_PointSize = a_size; }";
  var DOT_FS =
    "precision mediump float; varying vec4 v_col;" +
    "void main(){ vec2 d = gl_PointCoord - vec2(0.5);" +
    " float r = length(d);" +
    " float a = v_col.a * (1.0 - smoothstep(0.44, 0.5, r));" +
    " gl_FragColor = vec4(v_col.rgb * a, a); }";

  function shader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return s;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
  }

  function merc(p) {
    var m = maplibregl.MercatorCoordinate.fromLngLat({ lng: p[0], lat: p[1] }, p[2] || 0);
    return [m.x, m.y, m.z];
  }

  /* The timeline window, drawn as two rectangles across the cube: the floor
     and ceiling of the slab that is lit. Rebuilt on every window change
     rather than baked into the geometry, because that is the one thing here
     that moves while the reader watches. Pressing play walks it up the
     thirty-nine days. */
  function slabSegs() {
    if (winFrom === null || winTo === null || !geo) return [];
    var a = geo.alt(winFrom), b = geo.alt(winTo);
    if (b < a) { var t2 = a; a = b; b = t2; }
    if (b < 0 || a > geo.H) return [];
    a = Math.max(0, Math.min(geo.H, a));
    b = Math.max(0, Math.min(geo.H, b));
    var x = geo.box, out = [];
    var ring = [[x[0], x[1]], [x[2], x[1]], [x[2], x[3]], [x[0], x[3]]];
    [[a, 0.34], [b, 0.22]].forEach(function (lvl) {
      for (var k = 0; k < 4; k++) {
        var p = ring[k], q = ring[(k + 1) % 4];
        out.push({ a: [p[0], p[1], lvl[0]], b: [q[0], q[1], lvl[0]],
                   c: COL.slab, o1: lvl[1], o2: lvl[1] });
      }
    });
    return out;
  }

  /* Opacity outside the timeline window. The cube keeps its whole
     shape; the window is what is lit. */
  function litFactor(z) {
    if (winFrom === null || winTo === null) return 1;
    var a = geo.alt(winFrom), b = geo.alt(winTo);
    if (b < a) { var t2 = a; a = b; b = t2; }
    var edge = geo.H * 0.004;
    if (z >= a - edge && z <= b + edge) return 1;
    return 0.13;
  }

  function makeLayer() {
    var gl2 = null, lp = null, dp = null, lb = null, db = null;
    var lineCount = 0, dotCount = 0;

    return {
      id: "cube",
      type: "custom",
      renderingMode: "3d",

      onAdd: function (m, gl) {
        gl2 = gl;
        lp = program(gl, LINE_VS, LINE_FS);
        dp = program(gl, DOT_VS, DOT_FS);
        lb = gl.createBuffer();
        db = gl.createBuffer();
        this.refill();
      },

      refill: function () {
        if (!gl2 || !geo) return;
        var gl = gl2;

        var L = [];
        geo.segs.concat(slabSegs()).forEach(function (s) {
          var pa = merc(s.a), pb = merc(s.b);
          var oa = s.c === COL.slab ? s.o1 : s.o1 * litFactor(s.a[2]);
          var ob = s.c === COL.slab ? s.o2 : s.o2 * litFactor(s.b[2]);
          L.push(pa[0], pa[1], pa[2], s.c[0], s.c[1], s.c[2], oa);
          L.push(pb[0], pb[1], pb[2], s.c[0], s.c[1], s.c[2], ob);
        });
        lineCount = L.length / 7;
        gl.bindBuffer(gl.ARRAY_BUFFER, lb);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.DYNAMIC_DRAW);

        var D = [];
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        geo.nodes.forEach(function (n) {
          var p = merc(n.p), f = litFactor(n.p[2]);
          var big = (hover === n.id) ? 15 : 10;
          /* a red halo, then the ivory disc inside it */
          D.push(p[0], p[1], p[2], COL.line[0], COL.line[1], COL.line[2], 0.85 * f, big * dpr);
          D.push(p[0], p[1], p[2], COL.node[0], COL.node[1], COL.node[2], 0.95 * f, (big - 5) * dpr);
        });
        dotCount = D.length / 8;
        gl.bindBuffer(gl.ARRAY_BUFFER, db);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(D), gl.DYNAMIC_DRAW);
      },

      render: function (gl, matrix) {
        if (!geo) return;
        lastMatrix = matrix;
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(lp);
        gl.uniformMatrix4fv(gl.getUniformLocation(lp, "u_m"), false, matrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, lb);
        var ap = gl.getAttribLocation(lp, "a_pos"), ac = gl.getAttribLocation(lp, "a_col");
        gl.enableVertexAttribArray(ap); gl.enableVertexAttribArray(ac);
        gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(ac, 4, gl.FLOAT, false, 28, 12);
        gl.drawArrays(gl.LINES, 0, lineCount);

        gl.useProgram(dp);
        gl.uniformMatrix4fv(gl.getUniformLocation(dp, "u_m"), false, matrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, db);
        var bp = gl.getAttribLocation(dp, "a_pos"), bc = gl.getAttribLocation(dp, "a_col"),
            bs = gl.getAttribLocation(dp, "a_size");
        gl.enableVertexAttribArray(bp); gl.enableVertexAttribArray(bc); gl.enableVertexAttribArray(bs);
        gl.vertexAttribPointer(bp, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(bc, 4, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(bs, 1, gl.FLOAT, false, 32, 28);
        gl.drawArrays(gl.POINTS, 0, dotCount);

        drawLabels();
      }
    };
  }

  /* ---------------- labels, in HTML over the canvas ---------------- */

  function project(p) {
    if (!lastMatrix || !map) return null;
    var m = merc(p), M = lastMatrix;
    var x = M[0] * m[0] + M[4] * m[1] + M[8] * m[2] + M[12];
    var y = M[1] * m[0] + M[5] * m[1] + M[9] * m[2] + M[13];
    var w = M[3] * m[0] + M[7] * m[1] + M[11] * m[2] + M[15];
    if (w <= 0) return null;
    var c = map.getCanvas();
    var W = c.clientWidth, Hh = c.clientHeight;
    return { x: (x / w * 0.5 + 0.5) * W, y: (1 - (y / w * 0.5 + 0.5)) * Hh };
  }

  var MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function tickLabel(ms) {
    var d = new Date(ms), day = d.getUTCDate(), mo = d.getUTCMonth();
    var name = (window.I18N && I18N.month) ? I18N.month(mo) : MONTH[mo];
    var n = (window.I18N && I18N.num) ? I18N.num(day) : String(day);
    return n + " " + (name || MONTH[mo]);
  }

  function drawLabels() {
    if (!labels) return;
    var html = [];
    geo.ticks.forEach(function (k) {
      if (!k.weekly) return;
      var s = project(k.p); if (!s) return;
      html.push('<span class="cb-tick" style="left:' + s.x.toFixed(1) + 'px;top:' +
                s.y.toFixed(1) + 'px">' + tickLabel(k.ms) + '</span>');
    });
    geo.steps.forEach(function (st, i) {
      if (i === 0 || i === geo.steps.length - 1) {
        var s = project(st.p); if (!s) return;
        html.push('<span class="cb-town" style="left:' + s.x.toFixed(1) + 'px;top:' +
                  s.y.toFixed(1) + 'px">' + st.name + '</span>');
      }
    });
    if (hover) {
      var n = geo.nodes.filter(function (x) { return x.id === hover; })[0];
      var s2 = n && project(n.p);
      if (s2) {
        html.push('<span class="cb-hit" style="left:' + s2.x.toFixed(1) + 'px;top:' +
                  s2.y.toFixed(1) + 'px"><b>' + esc(tickLabel(n.ms)) + '</b>' +
                  esc(n.title) + '</span>');
      }
    }
    var out = html.join("");
    if (labels.innerHTML !== out) labels.innerHTML = out;
  }

  function esc(x) {
    return String(x == null ? "" : x).replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------------- picking ---------------- */

  function hitTest(ev) {
    if (!geo || !on) return null;
    var r = map.getCanvas().getBoundingClientRect();
    var mx = ev.clientX - r.left, my = ev.clientY - r.top;
    var best = null, bd = 16 * 16;
    geo.nodes.forEach(function (n) {
      var s = project(n.p); if (!s) return;
      var d = (s.x - mx) * (s.x - mx) + (s.y - my) * (s.y - my);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }

  /* ---------------- framing ---------------- */

  /* fitBounds knows how to frame ground, and the cube is mostly air. So the
     frame is measured instead of guessed: put the camera somewhere sensible,
     project the eight corners of the cube through the same matrix the layer
     draws with, and correct the zoom and the pan until all eight sit inside
     the rectangle the furniture leaves free. Four passes settle it. The
     reader never sees the passes; the camera jumps in silence and only the
     final move is animated. */

  function projWith(p, M) {
    var m = merc(p);
    var x = M[0] * m[0] + M[4] * m[1] + M[8] * m[2] + M[12];
    var y = M[1] * m[0] + M[5] * m[1] + M[9] * m[2] + M[13];
    var w = M[3] * m[0] + M[7] * m[1] + M[11] * m[2] + M[15];
    if (w <= 0) return null;
    var c = map.getCanvas(), W = c.clientWidth, Hh = c.clientHeight;
    return { x: (x / w * 0.5 + 0.5) * W, y: (1 - (y / w * 0.5 + 0.5)) * Hh };
  }

  function projBBox(pts, M) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
    pts.forEach(function (p) {
      var s = projWith(p, M); if (!s) return;
      n++;
      x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x);
      y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y);
    });
    if (n < pts.length) return null;
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  /* What the furniture leaves free, measured now rather than assumed. */
  function freeRect() {
    var c = map.getCanvas(), W = c.clientWidth, Hh = c.clientHeight;
    var box = c.getBoundingClientRect();
    var left = 24, right = 24, top = 64, bottom = 24;
    var panel = $("panel");
    if (panel && !document.body.classList.contains("is-phone")) {
      var r = panel.getBoundingClientRect();
      if (r.width && r.right > box.left) left = Math.max(left, r.right - box.left + 28);
    }
    var tl = $("timeline");
    if (tl) {
      var r2 = tl.getBoundingClientRect();
      if (r2.height) bottom = Math.max(bottom, box.bottom - r2.top + 20);
    }
    var w = Math.max(160, W - left - right), h = Math.max(160, Hh - top - bottom);
    return { w: w, h: h, cx: left + w / 2, cy: top + h / 2 };
  }

  function cubeCorners() {
    var b = geo.box, H = geo.H, out = [];
    [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].forEach(function (p) {
      out.push([p[0], p[1], 0]);
      out.push([p[0], p[1], H]);
    });
    return out;
  }

  function frameCube() {
    var pts = cubeCorners();
    var from = { center: map.getCenter(), zoom: map.getZoom(),
                 pitch: map.getPitch(), bearing: map.getBearing() };
    var pitch = 64, bearing = -22;
    map.jumpTo({ center: [geo.centre[0], geo.centre[1]], zoom: 12.4,
                 pitch: pitch, bearing: bearing });
    var rect = freeRect();
    for (var i = 0; i < 4; i++) {
      var M = map.transform.customLayerMatrix();
      var b = projBBox(pts, M);
      if (!b || !b.w || !b.h) break;
      var s = Math.min(rect.w / b.w, rect.h / b.h) * 0.94;
      map.jumpTo({ zoom: Math.max(9.5, Math.min(15.5, map.getZoom() + Math.log(s) / Math.LN2)) });
      M = map.transform.customLayerMatrix();
      b = projBBox(pts, M);
      if (!b) break;
      map.panBy([b.cx - rect.cx, b.cy - rect.cy], { duration: 0 });
    }
    var to = { center: map.getCenter(), zoom: map.getZoom() };
    map.jumpTo(from);
    map.easeTo({ center: to.center, zoom: to.zoom, pitch: pitch,
                 bearing: bearing, duration: 1700 });
  }

  /* The floor. A cube needs one, and on a pale basemap the hairlines need
     something to sit against; this does both jobs with one soft plate. */
  function floor(add) {
    if (!map) return;
    try {
      if (!add) {
        if (map.getLayer("cube-floor")) map.removeLayer("cube-floor");
        if (map.getSource("cube-floor")) map.removeSource("cube-floor");
        return;
      }
      var b = geo.box;
      var poly = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[
        [b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]
      ]] } };
      if (map.getSource("cube-floor")) {
        map.getSource("cube-floor").setData(poly);
      } else {
        map.addSource("cube-floor", { type: "geojson", data: poly });
        map.addLayer({ id: "cube-floor", type: "fill", source: "cube-floor",
          paint: { "fill-color": "#0d0f14", "fill-opacity": 0.34 } });
      }
    } catch (err) { window.__cubeErr = String(err); }
  }

  /* ---------------- on and off ---------------- */

  function ensureLabels() {
    if (labels) return;
    wrap = $("map-wrap") || document.body;
    labels = document.createElement("div");
    labels.id = "cube-labels";
    wrap.appendChild(labels);
  }

  /* The caption. It has to say how to read the drawing, and then get out of
     the way: a reader who has understood it once does not need it again, and
     on a phone it would sit on top of the city it is describing. So the
     title is a switch, and on a phone it starts closed. */
  function caption(show) {
    var c = $("cube-note");
    if (!show) { if (c) c.remove(); return; }
    if (c) return;
    var phone = document.body.classList.contains("is-phone");
    c = document.createElement("div");
    c.id = "cube-note";
    c.className = phone ? "min" : "";
    c.innerHTML =
      '<button type="button" class="cb-head">' +
        '<b>' + esc(t("cube.title", "The thirty-nine days")) + '</b>' +
        '<i class="cb-chev" aria-hidden="true"></i>' +
      '</button>' +
      '<div class="cb-body">' +
        '<p>' + esc(t("cube.body",
          "Time stands up off the map, 31 March to 8 May 2018. A disc is an entry on its day, " +
          "a column is a place holding still, a slope is movement across days. " +
          "Drag the timeline to slice the cube.")) + '</p>' +
        '<small>' + esc(t("cube.method",
          "Dated to the day. The walk from Gyumri passes Vanadzor, Dilijan, Hrazdan and Abovyan; " +
          "those middle dates are spaced along the route, only the two ends are documented.")) +
        '</small>' +
      '</div>';
    c.querySelector(".cb-head").addEventListener("click", function () {
      c.classList.toggle("min");
    });
    (wrap || document.body).appendChild(c);
  }

  function enter() {
    if (!map || on) return;
    var api = window.YerevanMap;
    geo = build(api && api.events ? api.events() : []);
    if (!geo) return;
    ensureLabels();
    readWindow();
    layer = makeLayer();
    try { map.addLayer(layer); } catch (err) { window.__cubeErr = String(err); return; }
    on = true;
    document.body.classList.add("cube-on");
    caption(true);
    setPressed(true);

    floor(true);
    frameCube();
    map.triggerRepaint();
  }

  function leave() {
    if (!map || !on) return;
    try { if (map.getLayer("cube")) map.removeLayer("cube"); } catch (err) {}
    floor(false);
    on = false; geo = null; layer = null; hover = null;
    document.body.classList.remove("cube-on");
    if (labels) labels.innerHTML = "";
    caption(false);
    setPressed(false);
    map.easeTo({ pitch: 55, bearing: -24, zoom: 14.4,
                 center: [44.5136, 40.1818], duration: 1300 });
  }

  function setPressed(v) {
    var b = $("cube-btn");
    if (b) b.setAttribute("aria-pressed", v ? "true" : "false");
  }

  function readWindow() {
    var api = window.YerevanMap;
    if (api && api.window) {
      var w = api.window();
      if (w && w.from != null) { winFrom = w.from; winTo = w.to; return; }
    }
    winFrom = winTo = null;
  }

  /* ---------------- wiring ---------------- */

  function boot() {
    map = window.__map;
    if (!map) { setTimeout(boot, 400); return; }

    var btn = $("cube-btn");
    if (btn) btn.addEventListener("click", function () { on ? leave() : enter(); });

    map.on("mousemove", function (e) {
      if (!on) return;
      var n = hitTest(e.originalEvent);
      var id = n ? n.id : null;
      if (id !== hover) {
        hover = id;
        map.getCanvas().style.cursor = id ? "pointer" : "";
        if (layer && layer.refill) layer.refill();
        map.triggerRepaint();
      }
    });

    map.on("click", function (e) {
      if (!on) return;
      var n = hitTest(e.originalEvent);
      if (n && window.YerevanMap) {
        e.preventDefault();
        window.YerevanMap.select(n.id, false);
      }
    });

    document.addEventListener("yy:hot", function (ev) {
      if (!on || !ev.detail) return;
      var id = ev.detail.on ? ev.detail.id : null;
      if (id === hover) return;
      if (!ev.detail.on && hover !== ev.detail.id) return;
      hover = id;
      if (layer && layer.refill) layer.refill();
      map.triggerRepaint();
    });

    document.addEventListener("yy:window", function () {
      if (!on) return;
      readWindow();
      if (layer && layer.refill) layer.refill();
      map.triggerRepaint();
    });

    /* A BASEMAP SWAP LOSES THE CUBE, and not by wiping it. MapLibre hands
       the custom layer back after the swap, so every check says it is
       there, while the new style's own layers have been stacked on top of
       it and the drawing is simply buried. The labels stay, the geometry
       goes, and nothing reports an error.

       style.load is no help either: with the basemaps stubbed it never
       fires at all, which is the same trap terrain.js and app.js each paid
       for once. So the swap is heard where it actually happens, on the
       select, and the layer is rebuilt on top three times over the seconds
       a style takes to settle. Rebuilding is idempotent and does not feed
       itself, which is what a styledata listener would have done. */
    function rebuild() {
      if (!on || !map.getStyle()) return;
      try {
        if (map.getLayer("cube")) map.removeLayer("cube");
        floor(true);
        layer = makeLayer();
        map.addLayer(layer);
        map.triggerRepaint();
      } catch (err) { window.__cubeErr = String(err); }
    }
    function rebuildSoon() {
      if (!on) return;
      [250, 1200, 3000].forEach(function (ms) { setTimeout(rebuild, ms); });
    }
    var bm = $("basemap-select");
    if (bm) bm.addEventListener("change", rebuildSoon);
    map.on("style.load", rebuildSoon);

    if (/[?&]cube=1/.test(location.search)) setTimeout(enter, 2200);
  }

  window.Cube = {
    enter: enter, leave: leave,
    toggle: function () { on ? leave() : enter(); },
    isOn: function () { return on; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 600); });
  } else setTimeout(boot, 600);
})();
