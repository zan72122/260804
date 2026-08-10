// NerikiriUI — DOMオーバーレイUI（色ちがい・もういっかい）（Agent-UI 所有）
// CONTRACT.md の「UI」節に準拠。#ui-root 配下に構築。play中は何も出さない。
(function () {
  'use strict';

  function cfg() {
    return (typeof window !== 'undefined' && window.NCFG) ? window.NCFG : {};
  }

  function safeEmit(name, payload) {
    var bus = (typeof window !== 'undefined') ? window.NBus : null;
    if (bus && typeof bus.emit === 'function') {
      try { bus.emit(name, payload); } catch (e) { console.error('ui emit error', name, e); }
    }
  }

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function buildRedoIcon() {
    // 絵文字フォント非依存の線画↻アイコン(SVGインライン)
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'nk-redo-svg');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // 円弧(約300度)+矢じり。stroke で描く回転矢印。
    path.setAttribute('d', 'M 19 6.5 A 8.2 8.2 0 1 1 12 3.8');
    path.setAttribute('class', 'nk-redo-arc');
    var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('d', 'M 19 1.6 L 19 7.2 L 13.6 6.3 Z');
    arrow.setAttribute('class', 'nk-redo-head');
    svg.appendChild(path);
    svg.appendChild(arrow);
    return svg;
  }

  window.NerikiriUI = {
    init: function (game) {
      var root = document.getElementById('ui-root');
      if (!root) return;

      var C = cfg();
      var THEMES = (C.THEMES && C.THEMES.length) ? C.THEMES : [];

      // --- DOM構築 ---
      var panel = el('div', 'nk-panel');
      panel.setAttribute('aria-hidden', 'true');

      var swatchRow = el('div', 'nk-swatch-row');
      var swatchButtons = [];

      THEMES.forEach(function (theme, idx) {
        var btn = el('button', 'nk-swatch-btn');
        btn.type = 'button';
        btn.setAttribute('aria-label', theme.name || ('theme' + idx));

        var swatch = el('span', 'nk-swatch');
        swatch.style.background =
          'radial-gradient(circle at 34% 28%, ' + (theme.tip || '#fff') + ' 0%, ' +
          (theme.swatch || theme.base || '#f0c') + ' 46%, ' +
          (theme.deep || theme.base || '#c08') + ' 100%)';
        var highlight = el('span', 'nk-swatch-hl');
        var ring = el('span', 'nk-swatch-ring');
        var check = el('span', 'nk-swatch-check');
        check.textContent = '';

        swatch.appendChild(highlight);
        btn.appendChild(swatch);
        btn.appendChild(ring);
        btn.appendChild(check);

        btn.addEventListener('pointerdown', function () {
          btn.classList.add('nk-pressed');
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
          btn.addEventListener(ev, function () { btn.classList.remove('nk-pressed'); });
        });

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          onChooseTheme(idx);
        });

        swatchRow.appendChild(btn);
        swatchButtons.push(btn);
      });

      var redoBtn = el('button', 'nk-redo-btn');
      redoBtn.type = 'button';
      redoBtn.setAttribute('aria-label', 'もういっかい');
      redoBtn.appendChild(buildRedoIcon());

      redoBtn.addEventListener('pointerdown', function () {
        redoBtn.classList.add('nk-pressed');
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
        redoBtn.addEventListener(ev, function () { redoBtn.classList.remove('nk-pressed'); });
      });
      redoBtn.addEventListener('click', function (e) {
        e.preventDefault();
        onRedo();
      });

      panel.appendChild(swatchRow);
      panel.appendChild(redoBtn);
      root.appendChild(panel);

      var showTimer = null;
      var visible = false;

      function markCurrentTheme() {
        var current = (game && game.state) ? game.state.themeIndex : 0;
        for (var i = 0; i < swatchButtons.length; i++) {
          if (i === current) swatchButtons[i].classList.add('nk-current');
          else swatchButtons[i].classList.remove('nk-current');
        }
      }

      function hide() {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        visible = false;
        panel.classList.remove('nk-show');
        panel.setAttribute('aria-hidden', 'true');
      }

      function show() {
        markCurrentTheme();
        visible = true;
        panel.setAttribute('aria-hidden', 'false');
        // 再フローを挟んでアニメを確実に発火
        panel.classList.remove('nk-show');
        // force reflow
        void panel.offsetWidth;
        panel.classList.add('nk-show');
      }

      function safeReset(themeIndex) {
        if (!game || typeof game.reset !== 'function') return;
        try { game.reset(themeIndex); } catch (e) { console.error('ui reset error', e); }
      }

      function onChooseTheme(idx) {
        if (!visible) return; // 連打/隠れている間のタップは無視(壊れ防止)
        hide();
        safeReset(idx);
        safeEmit('replay', { themeIndex: idx });
      }

      function onRedo() {
        if (!visible) return;
        var current = (game && game.state) ? game.state.themeIndex : 0;
        hide();
        safeReset(current);
        safeEmit('replay', { themeIndex: current });
      }

      // --- phase:change 購読 ---
      var bus = (typeof window !== 'undefined') ? window.NBus : null;
      if (bus && typeof bus.on === 'function') {
        bus.on('phase:change', function (payload) {
          var phase = payload && payload.phase;
          if (phase === 'reveal') {
            if (showTimer) clearTimeout(showTimer);
            showTimer = setTimeout(function () {
              showTimer = null;
              show();
            }, 1200);
          } else if (phase === 'play') {
            // 防御的に即隠す
            hide();
          } else {
            // finishing 等: まだ出さない
            hide();
          }
        });
      }

      hide();
    },
  };
})();
