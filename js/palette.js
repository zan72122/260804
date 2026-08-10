/* Rainbow Glass Tower — colour palette bar.
   Builds one round swatch button per Tint.PALETTE entry into #palette and
   reports the armed colour via onPick. Selection happens on pointerdown so
   it feels instant to a small finger, and never leaks through to the canvas
   underneath. */
'use strict';

window.Palette = (function () {
  // Japanese colour names for aria-label; the child can't read, this is for
  // screen readers / parents only.
  const NAMES = {
    white: '白', pink: 'ピンク', orange: 'オレンジ', yellow: 'きいろ',
    green: 'みどり', blue: 'あお', purple: 'むらさき'
  };

  let root = null;
  let onPick = function () {};
  let selectedId = null;

  function palette() {
    return (window.Tint && Tint.PALETTE) || [];
  }

  function entryFor(id) {
    const list = palette();
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function applySelectionClasses() {
    const btns = root.querySelectorAll('.swatch');
    for (let i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-on', btns[i].dataset.colorId === selectedId);
    }
    root.classList.toggle('armed', !!selectedId);
  }

  function select(id) {
    if (!root) return;
    if (selectedId === id) {
      // tapping the armed swatch again disarms it
      selectedId = null;
      applySelectionClasses();
      onPick(null);
      return;
    }
    selectedId = id;
    applySelectionClasses();
    const t = entryFor(id);
    onPick(t ? { h: t.h, c: t.c } : null);
  }

  function build() {
    root.innerHTML = '';
    selectedId = null;
    root.classList.remove('armed');
    palette().forEach(function (t) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.colorId = t.id;
      btn.setAttribute('aria-label', NAMES[t.id] || t.id);
      if (window.Tint && Tint.css) {
        btn.style.setProperty('--sw', Tint.css(t, 0.55));
      }
      root.appendChild(btn);
    });
  }

  function swatchFrom(e) {
    const target = e.target;
    return (target && target.closest) ? target.closest('.swatch') : null;
  }

  function onPointerDown(e) {
    const btn = swatchFrom(e);
    if (!btn || !root.contains(btn)) return;
    // Selecting happens right here on down, so a tap that starts on the
    // swatch and drifts a little still counts, and the touch never reaches
    // the game canvas underneath.
    e.preventDefault();
    e.stopPropagation();
    select(btn.dataset.colorId);
  }

  // Belt-and-braces: some browsers still fire click after a touch even when
  // pointerdown's default was prevented. Swallow it so it can't double-fire
  // or fall through to the canvas.
  function onClick(e) {
    const btn = swatchFrom(e);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function init(opts) {
    root = document.getElementById('palette');
    onPick = (opts && typeof opts.onPick === 'function') ? opts.onPick : function () {};
    if (!root) return;
    build();
    if (!root._paletteBound) {
      root.addEventListener('pointerdown', onPointerDown, { passive: false });
      root.addEventListener('click', onClick);
      root._paletteBound = true;
    }
  }

  function getSelected() {
    if (!selectedId) return null;
    const t = entryFor(selectedId);
    return t ? { h: t.h, c: t.c } : null;
  }

  function clear() {
    if (!selectedId) return;
    selectedId = null;
    if (root) applySelectionClasses();
    onPick(null);
  }

  return { init: init, getSelected: getSelected, clear: clear };
})();
