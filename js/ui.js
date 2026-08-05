/* =========================================================
   ui.js — 5つの準備作業（ぜんぶ ゆび1本）
   ========================================================= */
(function (global) {
  'use strict';

  var UI = {};
  var panel = null;

  UI.setPanel = function (el) { panel = el; };

  function activate(id) {
    U.$$('#panel .task').forEach(function (t) { t.classList.remove('active'); });
    var t = U.$(id);
    if (t) t.classList.add('active');
  }
  UI.activate = activate;

  function panelRect() { return panel.getBoundingClientRect(); }

  /* =========================================================
     STEP 1 : レンズみがき
     ========================================================= */
  UI.lens = (function () {
    var L = {}, cv, ctx, grid, gw = 14, total = 0, cleared = 0;
    var last = null, done = false, onDone = null, sparkHost, wiping = false;
    var accum = 0;

    function paintFog() {
      var w = cv.width, h = cv.height;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      var g = ctx.createRadialGradient(w * 0.38, h * 0.32, w * 0.05, w * 0.5, h * 0.5, w * 0.62);
      g.addColorStop(0, 'rgba(236,240,246,0.97)');
      g.addColorStop(0.55, 'rgba(206,214,226,0.95)');
      g.addColorStop(1, 'rgba(168,180,198,0.98)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      /* ざらつき */
      for (var i = 0; i < 900; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.28) + ')';
        ctx.fillRect(x, y, 2.5, 2.5);
      }
      for (var j = 0; j < 260; j++) {
        var x2 = Math.random() * w, y2 = Math.random() * h;
        ctx.fillStyle = 'rgba(140,155,175,' + (Math.random() * 0.25) + ')';
        ctx.beginPath(); ctx.arc(x2, y2, 1 + Math.random() * 4, 0, 6.3); ctx.fill();
      }
    }

    function resetGrid() {
      grid = new Uint8Array(gw * gw);
      total = 0; cleared = 0;
      for (var y = 0; y < gw; y++) {
        for (var x = 0; x < gw; x++) {
          var cx = (x + 0.5) / gw - 0.5, cy = (y + 0.5) / gw - 0.5;
          if (cx * cx + cy * cy <= 0.235) { total++; } else { grid[y * gw + x] = 2; }
        }
      }
    }

    function erase(px, py) {
      var r = cv.width * 0.16;
      ctx.globalCompositeOperation = 'destination-out';
      var g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 6.3); ctx.fill();

      var gx0 = Math.floor((px - r * 0.62) / cv.width * gw);
      var gx1 = Math.ceil((px + r * 0.62) / cv.width * gw);
      var gy0 = Math.floor((py - r * 0.62) / cv.height * gw);
      var gy1 = Math.ceil((py + r * 0.62) / cv.height * gw);
      for (var y = Math.max(0, gy0); y < Math.min(gw, gy1); y++) {
        for (var x = Math.max(0, gx0); x < Math.min(gw, gx1); x++) {
          var i = y * gw + x;
          if (grid[i] === 0) { grid[i] = 1; cleared++; }
        }
      }
    }

    function sparkle(clientX, clientY) {
      var host = sparkHost.getBoundingClientRect();
      var s = U.el('div', 'spark');
      s.style.left = (clientX - host.left + (Math.random() * 26 - 13)) + 'px';
      s.style.top = (clientY - host.top + (Math.random() * 26 - 13)) + 'px';
      sparkHost.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 750);
    }

    L.init = function (cb) {
      onDone = cb; done = false; last = null; accum = 0;
      cv = U.$('#fogCanvas');
      ctx = cv.getContext('2d');
      sparkHost = U.$('#lensSparkles');
      sparkHost.innerHTML = '';
      U.$('.lens-body').classList.remove('clean');
      paintFog();
      resetGrid();
    };

    function toLocal(p) {
      var r = cv.getBoundingClientRect();
      return {
        x: (p.x - r.left) / r.width * cv.width,
        y: (p.y - r.top) / r.height * cv.height
      };
    }

    L.bind = function () {
      var body = U.$('.lens-body');
      U.drag(body, {
        start: function (p) {
          if (done) return;
          wiping = true; last = toLocal(p);
          erase(last.x, last.y);
          if (global.Snd) Snd.polishOn();
        },
        move: function (p) {
          if (done || !wiping) return;
          var c = toLocal(p);
          if (last) {
            var dx = c.x - last.x, dy = c.y - last.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            var steps = Math.min(24, Math.ceil(d / (cv.width * 0.05)));
            for (var i = 1; i <= steps; i++) {
              erase(last.x + dx * i / steps, last.y + dy * i / steps);
            }
            accum += d;
            if (global.Snd) Snd.polishPitch(U.clamp(d / 24, 0, 1));
            if (accum > cv.width * 0.30) {
              accum = 0;
              sparkle(p.x, p.y);
              if (global.Snd) Snd.sparkle();
            }
          }
          last = c;
          var prog = total ? cleared / total : 0;
          if (prog > 0.62 && !done) finish();
        },
        end: function () {
          wiping = false; last = null;
          if (global.Snd) Snd.polishOff();
        }
      });
    };

    function finish() {
      done = true;
      if (global.Snd) { Snd.polishOff(); Snd.chime(659.25); }
      var body = U.$('.lens-body');
      body.classList.add('clean');
      /* 残りのくもりをふわっと消す */
      var a = 1;
      var iv = setInterval(function () {
        a -= 0.06;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, cv.width, cv.height);
        if (a <= 0) { clearInterval(iv); ctx.clearRect(0, 0, cv.width, cv.height); }
      }, 30);
      for (var i = 0; i < 12; i++) {
        (function (k) {
          setTimeout(function () {
            var r = U.centerOf(U.$('.lens-body'));
            var ang = Math.random() * 6.3, rad = r.w * (0.15 + Math.random() * 0.35);
            sparkle(r.x + Math.cos(ang) * rad, r.y + Math.sin(ang) * rad);
          }, k * 45);
        })(i);
      }
      setTimeout(function () { if (onDone) onDone(); }, 900);
    }

    return L;
  })();

  /* =========================================================
     STEP 2 : テーマディスクを えらんで さしこむ
     ========================================================= */
  UI.disc = (function () {
    var D = {}, onDone = null, locked = false;

    D.init = function (themes, cb) {
      onDone = cb; locked = false;
      var rack = U.$('#discRack');
      rack.innerHTML = '';
      U.$('#discSlot').classList.remove('hot');

      themes.forEach(function (th, i) {
        var d = U.el('div', 'disc');
        d.innerHTML =
          '<div class="face"></div><div class="emoji">' + th.icon + '</div>' +
          '<div class="hole"></div><div class="label">' + th.short + '</div>';
        d.querySelector('.face').style.background =
          'conic-gradient(from 210deg, ' + th.disc[0] + ', ' + th.disc[1] + ', ' + th.disc[2] + ', ' + th.disc[0] + ')';
        rack.appendChild(d);
        bindDisc(d, i);
      });
    };

    function bindDisc(d, idx) {
      var sx = 0, sy = 0, moved = 0, dragging = false;
      var slot = U.$('#discSlot');

      U.drag(d, {
        start: function (p) {
          if (locked) return;
          dragging = true; moved = 0;
          sx = p.x; sy = p.y;
          d.classList.add('dragging');
          if (global.Snd) Snd.tap();
        },
        move: function (p) {
          if (!dragging || locked) return;
          var dx = p.x - sx, dy = p.y - sy;
          moved = Math.max(moved, Math.sqrt(dx * dx + dy * dy));
          d.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.12)';
          var c = U.centerOf(d), s = U.centerOf(slot);
          var dist = Math.hypot(c.x - s.x, c.y - s.y);
          slot.classList.toggle('hot', dist < Math.max(s.w, s.h) * 1.5);
        },
        end: function (p) {
          if (!dragging || locked) return;
          dragging = false;
          d.classList.remove('dragging');
          var c = U.centerOf(d), s = U.centerOf(slot);
          var dist = Math.hypot(c.x - s.x, c.y - s.y);
          var pr = panelRect();
          var accept = (moved < 14) || dist < Math.max(pr.width, pr.height) * 0.60;
          if (accept) insert(d, idx);
          else {
            d.style.transition = 'transform .4s cubic-bezier(.3,1.4,.5,1)';
            d.style.transform = '';
            slot.classList.remove('hot');
            setTimeout(function () { d.style.transition = ''; }, 420);
          }
        }
      });
    }

    function insert(d, idx) {
      locked = true;
      var slot = U.$('#discSlot');
      slot.classList.add('hot');
      var c = U.centerOf(d), s = U.centerOf(slot);
      var cur = d.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      var bx = cur ? parseFloat(cur[1]) : 0, by = cur ? parseFloat(cur[2]) : 0;
      var tx = bx + (s.x - c.x), ty = by + (s.y - c.y);
      d.style.transition = 'transform .42s cubic-bezier(.4,.1,.2,1), opacity .3s ease .3s';
      d.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(.42) rotate(180deg)';
      d.style.opacity = '0.15';
      U.$$('#discRack .disc').forEach(function (o) { if (o !== d) o.classList.add('gone'); });
      if (global.Snd) Snd.snap();
      setTimeout(function () {
        if (global.Snd) Snd.chime(587.33);
        slot.classList.remove('hot');
        if (onDone) onDone(idx);
      }, 520);
    }

    return D;
  })();

  /* =========================================================
     STEP 3 : わくせいを スライドして あわせる
     ========================================================= */
  UI.planet = (function () {
    var P = {}, onDone = null, tracks = [], doneCount = 0, cb3 = null;

    P.init = function (theme, cb) {
      cb3 = cb; doneCount = 0; tracks = [];
      var host = U.$('#planetTracks');
      host.innerHTML = '';

      theme.planets.forEach(function (pl, i) {
        var tr = U.el('div', 'track');
        var target = 24 + i * 24 + (i === 1 ? 14 : 0);   // 目標位置（％）
        var startP = target > 50 ? 12 : 88;
        tr.innerHTML =
          '<div class="track-rail"></div>' +
          '<div class="track-target" style="left:' + target + '%"></div>' +
          '<div class="orb"><div class="ball"></div>' + (pl.ring ? '<div class="ring"></div>' : '') + '</div>';
        host.appendChild(tr);

        var orb = tr.querySelector('.orb');
        var col = pl.color;
        var hex = function (c, m) {
          return 'rgb(' + Math.round(U.clamp(c[0] * m, 0, 1) * 255) + ',' +
                          Math.round(U.clamp(c[1] * m, 0, 1) * 255) + ',' +
                          Math.round(U.clamp(c[2] * m, 0, 1) * 255) + ')';
        };
        orb.querySelector('.ball').style.background =
          'radial-gradient(circle at 33% 27%, #fff 2%, ' + hex(col, 1.15) + ' 30%, ' + hex(col, 0.62) + ' 66%, ' + hex(col, 0.22) + ' 100%)';
        orb.style.left = startP + '%';
        var st = { el: orb, tr: tr, pct: startP, target: target, done: false, idx: i };
        tracks.push(st);
        bindOrb(st);
      });
    };

    function railBox(st) {
      var rail = st.tr.querySelector('.track-rail');
      return rail.getBoundingClientRect();
    }

    function bindOrb(st) {
      var dragging = false, moved = 0, sx = 0;

      function setPct(p) {
        st.pct = U.clamp(p, 3, 97);
        st.el.style.left = st.pct + '%';
      }

      U.drag(st.el, {
        start: function (p) {
          if (st.done) return;
          dragging = true; moved = 0; sx = p.x;
          st.el.style.transition = '';
          st.el.style.transform = 'translate(-50%,-50%) scale(1.14)';
          if (global.Snd) Snd.tap();
        },
        move: function (p) {
          if (!dragging || st.done) return;
          moved = Math.max(moved, Math.abs(p.x - sx));
          var r = railBox(st);
          setPct((p.x - r.left) / r.width * 100);
          var near = Math.abs(st.pct - st.target) < 16;
          st.tr.querySelector('.track-target').style.opacity = near ? '1' : '';
        },
        end: function () {
          if (!dragging || st.done) return;
          dragging = false;
          st.el.style.transition = 'left .45s cubic-bezier(.3,1.5,.5,1), transform .3s';
          st.el.style.transform = 'translate(-50%,-50%) scale(1)';
          /* 少しのズレは のこす（自分で合わせた感じ）／大きくズレたら すいよせる */
          var d = st.pct - st.target;
          var fin = st.target + U.clamp(d, -7, 7);
          setPct(fin);
          lock(st);
        }
      }, { stop: true });

      /* レールを タップしても うごく */
      U.drag(st.tr, {
        start: function (p) {
          if (st.done || dragging) return;
          var r = railBox(st);
          setPct((p.x - r.left) / r.width * 100);
        },
        move: function (p) {
          if (st.done || dragging) return;
          var r = railBox(st);
          setPct((p.x - r.left) / r.width * 100);
        },
        end: function () {
          if (st.done || dragging) return;
          var d = st.pct - st.target;
          st.el.style.transition = 'left .45s cubic-bezier(.3,1.5,.5,1)';
          setPct(st.target + U.clamp(d, -7, 7));
          lock(st);
        }
      });
    }

    function lock(st) {
      st.done = true;
      st.tr.classList.add('done');
      st.el.classList.add('snapped');
      if (global.Snd) Snd.pop(st.idx + 2);
      doneCount++;
      setTimeout(function () { st.el.classList.remove('snapped'); }, 700);
      if (doneCount >= tracks.length) {
        setTimeout(function () {
          if (global.Snd) Snd.chime(523.25);
          if (cb3) cb3(tracks.map(function (t) { return t.pct; }));
        }, 620);
      }
    }

    return P;
  })();

  /* =========================================================
     STEP 4 : ケーブルを つなぐ（ちかづけると すいつく）
     ========================================================= */
  UI.cable = (function () {
    var C = {}, onDone = null, sockets = [], plugs = [], connected = 0;
    var svg = null;
    var COLORS = ['#7ee8ff', '#ffd36b', '#ff9ee0'];

    C.init = function (cb) {
      onDone = cb; connected = 0; sockets = []; plugs = [];
      svg = U.$('#cableSvg');
      svg.innerHTML = '';
      var sh = U.$('#sockets'), ph = U.$('#plugs');
      sh.innerHTML = ''; ph.innerHTML = '';

      for (var i = 0; i < 3; i++) {
        var s = U.el('div', 'socket', '<div class="hole2"></div><div class="bulb"></div>');
        sh.appendChild(s);
        sockets.push({ el: s, used: false });

        var p = U.el('div', 'plug', '<div class="pin"></div>');
        p.style.background = 'linear-gradient(180deg,' + COLORS[i] + ', ' + shade(COLORS[i], -0.45) + ')';
        ph.appendChild(p);
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', COLORS[i]);
        path.setAttribute('stroke-width', '7');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0.85');
        svg.appendChild(path);
        var st = { el: p, path: path, idx: i, home: null, dx: 0, dy: 0, done: false, color: COLORS[i] };
        plugs.push(st);
        bindPlug(st);
      }
      setTimeout(drawAll, 60);
    };

    function shade(hex, amt) {
      var n = parseInt(hex.slice(1), 16);
      var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      r = Math.round(U.clamp(r * (1 + amt), 0, 255));
      g = Math.round(U.clamp(g * (1 + amt), 0, 255));
      b = Math.round(U.clamp(b * (1 + amt), 0, 255));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function svgBox() { return svg.getBoundingClientRect(); }

    function drawAll() {
      var b = svgBox();
      svg.setAttribute('viewBox', '0 0 ' + b.width + ' ' + b.height);
      plugs.forEach(function (st) {
        var c = U.centerOf(st.el);
        if (!st.home) {
          st.home = { x: c.x - st.dx - b.left, y: c.y - st.dy - b.top };
        }
        var x1 = st.home.x, y1 = st.home.y + 14;
        var x2 = c.x - b.left, y2 = c.y - b.top;
        var mid = (y1 + y2) / 2 + Math.abs(x2 - x1) * 0.18 + 16;
        st.path.setAttribute('d',
          'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + mid + ', ' + x2 + ' ' + mid + ', ' + x2 + ' ' + y2);
      });
    }
    C.redraw = drawAll;

    function nearestFree(c) {
      var best = null, bd = 1e9;
      sockets.forEach(function (s) {
        if (s.used) return;
        var sc = U.centerOf(s.el);
        var d = Math.hypot(c.x - sc.x, c.y - sc.y);
        if (d < bd) { bd = d; best = s; }
      });
      return { s: best, d: bd };
    }

    function bindPlug(st) {
      var dragging = false, sx = 0, sy = 0, moved = 0;

      U.drag(st.el, {
        start: function (p) {
          if (st.done) return;
          dragging = true; moved = 0; sx = p.x - st.dx; sy = p.y - st.dy;
          st.el.classList.add('dragging');
          if (global.Snd) Snd.tap();
        },
        move: function (p) {
          if (!dragging || st.done) return;
          st.dx = p.x - sx; st.dy = p.y - sy;
          moved = Math.max(moved, Math.hypot(st.dx, st.dy));
          st.el.style.transform = 'translate(' + st.dx + 'px,' + st.dy + 'px) scale(1.1)';

          var c = U.centerOf(st.el);
          var n = nearestFree(c);
          var pr = panelRect();
          var pull = Math.min(pr.width, pr.height) * 0.55;
          sockets.forEach(function (s) { s.el.classList.remove('hot'); });
          if (n.s && n.d < pull) {
            n.s.el.classList.add('hot');
            /* じしゃくのように すいよせる */
            var sc = U.centerOf(n.s.el);
            var k = U.smoothstep(pull, pull * 0.15, n.d) * 0.55;
            st.dx += (sc.x - c.x) * k;
            st.dy += (sc.y - c.y) * k;
            st.el.style.transform = 'translate(' + st.dx + 'px,' + st.dy + 'px) scale(1.1)';
          }
          drawAll();
        },
        end: function () {
          if (!dragging || st.done) return;
          dragging = false;
          st.el.classList.remove('dragging');
          sockets.forEach(function (s) { s.el.classList.remove('hot'); });
          var c = U.centerOf(st.el);
          var n = nearestFree(c);
          var pr = panelRect();
          if (n.s && (moved < 14 || n.d < Math.max(pr.width, pr.height) * 0.9)) connect(st, n.s);
          else {
            st.dx = 0; st.dy = 0;
            st.el.style.transition = 'transform .4s cubic-bezier(.3,1.4,.5,1)';
            st.el.style.transform = '';
            setTimeout(function () { st.el.style.transition = ''; drawAll(); }, 420);
          }
        }
      });
    }

    function connect(st, sock) {
      sock.used = true; st.done = true;
      st.el.classList.add('done');
      var c = U.centerOf(st.el), sc = U.centerOf(sock.el);
      st.dx += sc.x - c.x; st.dy += sc.y - c.y + 2;
      st.el.style.transition = 'transform .28s cubic-bezier(.3,1.6,.5,1)';
      st.el.style.transform = 'translate(' + st.dx + 'px,' + st.dy + 'px) scale(1)';
      sock.el.classList.add('on');
      st.path.setAttribute('opacity', '1');
      st.path.setAttribute('stroke-width', '8');
      if (global.Snd) { Snd.click(); Snd.pop(connected + 3); }
      connected++;
      setTimeout(drawAll, 60);
      setTimeout(drawAll, 320);
      if (connected >= 3) {
        setTimeout(function () {
          if (global.Snd) Snd.chime(698.46);
          if (onDone) onDone();
        }, 700);
      }
    }

    return C;
  })();

  /* =========================================================
     STEP 5 : レバーを ひきさげる
     ========================================================= */
  UI.lever = (function () {
    var V = {}, onProg = null, onDone = null, p = 0, locked = false, auto = null;
    var knob, frame;

    function place() {
      var f = frame.getBoundingClientRect();
      var kh = knob.getBoundingClientRect().height || f.height * 0.22;
      var top = f.height * 0.08 + kh / 2;
      var bot = f.height * 0.92 - kh / 2;
      knob.style.top = (top + (bot - top) * p) + 'px';
    }

    function setP(v, silent) {
      var old = p;
      p = U.clamp(v, 0, 1);
      place();
      if (onProg) onProg(p);
      if (!silent && Math.floor(p * 8) !== Math.floor(old * 8) && global.Snd) Snd.tap();
    }

    V.init = function (progCb, doneCb) {
      onProg = progCb; onDone = doneCb; p = 0; locked = false;
      if (auto) { cancelAnimationFrame(auto); auto = null; }
      knob = U.$('#leverKnob');
      frame = U.$('.lever-frame');
      knob.style.transition = '';
      U.show(U.$('#leverArrow'));
      setTimeout(function () { setP(0, true); }, 30);
    };

    /* 画面が回ったときの 置きなおし */
    V.reposition = function () {
      if (!knob || !frame) return;
      if (!U.$('#task-lever').classList.contains('active')) return;
      knob.style.transition = '';
      place();
    };

    V.bind = function () {
      knob = U.$('#leverKnob');
      frame = U.$('.lever-frame');
      var dragging = false, moved = 0, sy = 0, p0 = 0;

      function range() {
        var f = frame.getBoundingClientRect();
        var kh = knob.getBoundingClientRect().height || f.height * 0.22;
        return { top: f.top + f.height * 0.08 + kh / 2, bot: f.top + f.height * 0.92 - kh / 2 };
      }

      U.drag(knob, {
        start: function (e) {
          if (locked) return;
          dragging = true; moved = 0; sy = e.y; p0 = p;
          knob.style.transition = '';
          U.hide(U.$('#leverArrow'));
        },
        move: function (e) {
          if (!dragging || locked) return;
          moved = Math.max(moved, Math.abs(e.y - sy));
          var r = range();
          setP(p0 + (e.y - sy) / Math.max(1, r.bot - r.top));
        },
        end: function () {
          if (!dragging || locked) return;
          dragging = false;
          if (moved < 12) { runAuto(); return; }
          if (p > 0.68) finish();
          else {
            knob.style.transition = 'top .45s cubic-bezier(.3,1.4,.5,1)';
            setP(0);
            U.show(U.$('#leverArrow'));
            setTimeout(function () { knob.style.transition = ''; }, 480);
          }
        }
      }, { stop: true });

      /* わく全体を さわっても うごかせる */
      U.drag(frame, {
        start: function (e) { if (!locked && !dragging) { U.hide(U.$('#leverArrow')); moveTo(e); } },
        move: function (e) { if (!locked && !dragging) moveTo(e); },
        end: function () {
          if (locked || dragging) return;
          if (p > 0.68) finish();
          else { knob.style.transition = 'top .45s ease'; setP(0); U.show(U.$('#leverArrow')); }
        }
      });

      function moveTo(e) {
        var r = range();
        setP((e.y - r.top) / Math.max(1, r.bot - r.top));
      }
    };

    function runAuto() {
      if (locked) return;
      var t0 = null, from = p;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var k = U.clamp((ts - t0) / 1500, 0, 1);
        setP(from + (1 - from) * U.easeInOutCubic(k), true);
        if (k < 1) auto = requestAnimationFrame(step);
        else finish();
      }
      auto = requestAnimationFrame(step);
    }

    function finish() {
      if (locked) return;
      locked = true;
      if (auto) { cancelAnimationFrame(auto); auto = null; }
      knob.style.transition = 'top .3s cubic-bezier(.3,1.6,.5,1)';
      setP(1, true);
      U.hide(U.$('#leverArrow'));
      if (global.Snd) Snd.snap();
      if (onDone) onDone();
    }

    return V;
  })();

  global.UI = UI;
})(window);
