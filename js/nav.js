/* =========================================================
   nav.js — 床の 足あとパッドを ノードに した 経路さがし
   家具に ぶつからない 道を 見つけて、経由点の 列を 返す。
   ========================================================= */
(function (global) {
  'use strict';

  var N = {};
  var nodes = [];        // [{x, z, key}]
  var edges = [];        // nodes と 同じ長さ。[{i, w}, ...]
  var LINK = 64;         // これ以内の パッド同士を つなぐ

  N.build = function () {
    nodes = [];
    var pads = Room.padList;
    for (var i = 0; i < pads.length; i++) {
      if ((pads[i].flag || 0) !== 0) continue;          // おわりの輪は のぞく
      var p = pads[i].p;
      if (Room.blockedAt(p[0], p[2], Room.BODY_R * 0.8)) continue;
      nodes.push({ x: p[0], z: p[2], key: pads[i].key || null });
    }
    edges = nodes.map(function () { return []; });
    for (var a = 0; a < nodes.length; a++) {
      for (var b = a + 1; b < nodes.length; b++) {
        var d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
        if (d > LINK) continue;
        if (!Room.segmentClear(nodes[a].x, nodes[a].z, nodes[b].x, nodes[b].z)) continue;
        edges[a].push({ i: b, w: d });
        edges[b].push({ i: a, w: d });
      }
    }
    N.nodes = nodes;
    N.edges = edges;
  };

  function nearestNode(x, z, mustSee) {
    var best = -1, bd = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var d = Math.hypot(nodes[i].x - x, nodes[i].z - z);
      if (d >= bd) continue;
      if (mustSee && !Room.segmentClear(x, z, nodes[i].x, nodes[i].z)) continue;
      bd = d; best = i;
    }
    return best;
  }
  N.nearestNode = nearestNode;

  /* [x,z] から [x,z] への 経由点。まっすぐ 行けるなら 1点だけ。 */
  N.path = function (from, to) {
    var fx = from[0], fz = from[2] === undefined ? from[1] : from[2];
    var tx = to[0], tz = to[2] === undefined ? to[1] : to[2];

    if (Room.segmentClear(fx, fz, tx, tz)) return [[tx, tz]];
    if (!nodes.length) return [[tx, tz]];

    var s = nearestNode(fx, fz, true);
    if (s < 0) s = nearestNode(fx, fz, false);
    var g = nearestNode(tx, tz, true);
    if (g < 0) g = nearestNode(tx, tz, false);
    if (s < 0 || g < 0) return [[tx, tz]];

    /* ダイクストラ（ノードは 数十個なので 単純な 線形さがしで じゅうぶん） */
    var n = nodes.length;
    var dist = new Float64Array(n).fill(Infinity);
    var prev = new Int32Array(n).fill(-1);
    var seen = new Uint8Array(n);
    dist[s] = 0;
    for (var it = 0; it < n; it++) {
      var u = -1, bd = Infinity;
      for (var k = 0; k < n; k++) if (!seen[k] && dist[k] < bd) { bd = dist[k]; u = k; }
      if (u < 0) break;
      if (u === g) break;
      seen[u] = 1;
      for (var e = 0; e < edges[u].length; e++) {
        var v = edges[u][e].i;
        var nd = dist[u] + edges[u][e].w;
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
      }
    }
    if (dist[g] === Infinity) return [[tx, tz]];

    var chain = [];
    for (var c = g; c >= 0; c = prev[c]) chain.push(c);
    chain.reverse();

    var pts = chain.map(function (i) { return [nodes[i].x, nodes[i].z]; });
    pts.push([tx, tz]);
    return smooth([fx, fz], pts);
  };

  /* まっすぐ 行ける ところは 経由点を まびいて、自然な 歩きに する */
  function smooth(start, pts) {
    var out = [];
    var cur = start;
    var i = 0;
    var guard = 0;
    while (i < pts.length && guard++ < 200) {
      var far = i;
      for (var j = pts.length - 1; j > i; j--) {
        if (Room.segmentClear(cur[0], cur[1], pts[j][0], pts[j][1])) { far = j; break; }
      }
      out.push(pts[far]);
      cur = pts[far];
      i = far + 1;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }

  global.Nav = N;
})(window);
