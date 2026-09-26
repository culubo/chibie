// 3D blueprint of one tray module (reservoir, insert, cover), drawn with three.js into <canvas id="tray">
(function () {
  var canvas = document.getElementById('tray');
  function load(src) {
    return new Promise(function (ok, fail) {
      var el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = fail; document.head.appendChild(el);
    });
  }
  function part(b64, flip) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var raw = new Int16Array(bytes.buffer), pos = new Float32Array(raw.length);
    for (var j = 0; j < raw.length; j++) pos[j] = raw[j] / 100;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (flip) g.rotateX(Math.PI);          // cover is modeled print-side down
    g.rotateX(-Math.PI / 2);               // STL is Z-up, three.js is Y-up
    g.computeBoundingBox();
    var b = g.boundingBox;
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    return g;
  }
  // Hard edges, plus (optionally) a single vertical line at the middle of each rounded corner,
  // instead of one line per facet of the curve.
  function edges(g, corners) {
    var hard = new THREE.EdgesGeometry(g, 25), out = Array.from(hard.attributes.position.array);
    if (!corners) return hard;
    var key = function (a, i) { return [a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5]].map(function (n) { return n.toFixed(2); }).join(); };
    var seen = {}, h = hard.attributes.position.array, soft = new THREE.EdgesGeometry(g, 1).attributes.position.array;
    for (var i = 0; i < h.length; i += 6) seen[key(h, i)] = 1;
    var cols = {};
    for (var j = 0; j < soft.length; j += 6) {
      if (seen[key(soft, j)] || Math.abs(soft[j] - soft[j + 3]) > 1e-3 || Math.abs(soft[j + 2] - soft[j + 5]) > 1e-3) continue;
      var k = soft[j].toFixed(2) + ',' + soft[j + 2].toFixed(2), c = cols[k] || (cols[k] = { x: soft[j], z: soft[j + 2], y0: Infinity, y1: -Infinity });
      c.y0 = Math.min(c.y0, soft[j + 1], soft[j + 4]); c.y1 = Math.max(c.y1, soft[j + 1], soft[j + 4]);
    }
    // group neighbouring facet lines into corners (facets are ~1 mm apart, walls ~2 mm)
    var pts = Object.keys(cols).map(function (k) { return cols[k]; }), used = [];
    pts.forEach(function (p0, i0) {
      if (used[i0]) return;
      var group = [p0]; used[i0] = 1;
      for (var q = 0; q < group.length; q++) pts.forEach(function (p, i) {
        var r = group[q], overlap = Math.min(p.y1, r.y1) - Math.max(p.y0, r.y0);
        // same corner = adjacent and mostly the same height (keeps short socket-block curves separate)
        if (!used[i] && Math.hypot(p.x - r.x, p.z - r.z) < 1.4 && overlap > 0.5 * Math.max(p.y1 - p.y0, r.y1 - r.y0)) { used[i] = 1; group.push(p); }
      });
      // the arc's middle is the point farthest from the chord between its two ends
      var a = group[0], b = group[0], best = group[0], far = -1;
      group.forEach(function (p) { group.forEach(function (r) { if (Math.hypot(p.x - r.x, p.z - r.z) > Math.hypot(a.x - b.x, a.z - b.z)) { a = p; b = r; } }); });
      var len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      group.forEach(function (p) { var d = Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / len; if (d > far) { far = d; best = p; } });
      var y0 = Math.min.apply(null, group.map(function (p) { return p.y0; })), y1 = Math.max.apply(null, group.map(function (p) { return p.y1; }));
      out.push(best.x, y0, best.z, best.x, y1, best.z);
    });
    var e = new THREE.BufferGeometry();
    e.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    return e;
  }
  function start() {
    var css = getComputedStyle(document.documentElement);
    var ink = new THREE.Color(css.getPropertyValue('--accent').trim());
    var paper = new THREE.Color((css.getPropertyValue('--card') || css.getPropertyValue('--bg')).trim()); // match the card behind the canvas
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    var scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    var fill = new THREE.MeshBasicMaterial({ color: paper, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    var line = new THREE.LineBasicMaterial({ color: ink });
    var P = window.TRAY_PARTS, stack = [[P.outer, false, 0, true], [P.insert, false, 95, false], [P.cover, true, 195, true]]; // last value: add one line per rounded corner
    var group = new THREE.Group();
    stack.forEach(function (s) {
      var g = part(s[0], s[1]), m = new THREE.Mesh(g, fill), e = new THREE.LineSegments(edges(g, s[3]), line);
      m.position.y = e.position.y = s[2];
      group.add(m, e);
    });
    group.position.y = -100;
    scene.add(group);
    cam.position.set(260, 180, 260); cam.lookAt(0, 0, 0);
    var controls = new THREE.OrbitControls(cam, canvas);
    controls.enableZoom = false; controls.enablePan = false; controls.autoRotate = true; controls.autoRotateSpeed = 1.2; controls.enableDamping = true;
    function size() {
      var w = canvas.clientWidth, h = canvas.clientHeight, half = 140;
      renderer.setSize(w, h, false);
      cam.left = -half * w / h; cam.right = half * w / h; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
    }
    new ResizeObserver(size).observe(canvas); size();
    (function tick() { controls.update(); renderer.render(scene, cam); requestAnimationFrame(tick); })();
  }
  new IntersectionObserver(function (entries, obs) {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    load('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js')
      .then(function () { return load('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'); })
      .then(function () { return load('assets/trays.js'); })
      .then(start)
      .catch(function () { canvas.style.display = 'none'; });
  }, { rootMargin: '200px' }).observe(canvas);
})();
