/*
 * Wordless guidance. Nothing here explains anything in language — a four-year-
 * old gets a pulsing ring where a finger should go, chevrons that rise for the
 * cast, a dotted ring with a dot travelling round it for the lure. Hints fade
 * in only after the child has hesitated, and vanish the instant they act.
 */

const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

export function createHints(layer) {
  const root = svg('svg', { width: '100%', height: '100%' });
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible';
  layer.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes hRing { 0%{transform:scale(.62);opacity:0} 22%{opacity:.95}
      100%{transform:scale(1.5);opacity:0} }
    @keyframes hDot { 0%,100%{transform:scale(1);opacity:.95} 50%{transform:scale(.82);opacity:.6} }
    @keyframes hRise { 0%{transform:translateY(16px);opacity:0} 25%{opacity:.95}
      100%{transform:translateY(-40px);opacity:0} }
    @keyframes hIn { 0%{transform:translateX(26px);opacity:0} 25%{opacity:.95}
      100%{transform:translateX(-16px);opacity:0} }
    @keyframes hSpin { to { transform: rotate(360deg) } }
    @keyframes hDash { to { stroke-dashoffset: -64 } }
    .hint-fade { transition: opacity .45s ease }
  `;
  document.head.appendChild(style);

  let group = null;
  let kind = null;
  let visible = false;

  function clear() {
    if (group) group.remove();
    group = null;
    kind = null;
  }

  function shell() {
    clear();
    group = svg('g', { opacity: 0 });
    group.setAttribute('class', 'hint-fade');
    root.appendChild(group);
    return group;
  }

  const COL = 'rgba(255,252,240,0.95)';
  const COL2 = 'rgba(255,214,150,0.9)';

  function buildRing() {
    const g = shell();
    for (let i = 0; i < 2; i++) {
      const c = svg('circle', {
        r: 30,
        fill: 'none',
        stroke: COL,
        'stroke-width': 4.5,
      });
      c.style.transformOrigin = 'center';
      c.style.transformBox = 'fill-box';
      c.style.animation = `hRing 1.9s ${i * 0.95}s ease-out infinite`;
      g.appendChild(c);
    }
    const d = svg('circle', { r: 9, fill: COL });
    d.style.transformOrigin = 'center';
    d.style.transformBox = 'fill-box';
    d.style.animation = 'hDot 1.5s ease-in-out infinite';
    g.appendChild(d);
    kind = 'ring';
    return g;
  }

  function buildRise() {
    const g = shell();
    for (let i = 0; i < 3; i++) {
      const p = svg('path', {
        d: 'M -22 12 L 0 -12 L 22 12',
        fill: 'none',
        stroke: i === 1 ? COL : COL2,
        'stroke-width': 6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      p.style.animation = `hRise 1.7s ${i * 0.4}s ease-out infinite`;
      g.appendChild(p);
    }
    kind = 'rise';
    return g;
  }

  function buildCircle(r = 62) {
    const g = shell();
    const c = svg('circle', {
      r,
      fill: 'none',
      stroke: COL,
      'stroke-width': 4,
      'stroke-dasharray': '10 12',
      'stroke-linecap': 'round',
      opacity: 0.85,
    });
    c.style.animation = 'hDash 2.2s linear infinite';
    g.appendChild(c);
    const orbit = svg('g', {});
    orbit.style.transformOrigin = 'center';
    orbit.style.animation = 'hSpin 2.2s linear infinite';
    const d = svg('circle', { r: 11, cy: -r, fill: COL2 });
    orbit.appendChild(d);
    g.appendChild(orbit);
    kind = 'circle';
    return g;
  }

  function buildInward() {
    const g = shell();
    for (let i = 0; i < 3; i++) {
      const p = svg('path', {
        d: 'M 14 -22 L -10 0 L 14 22',
        fill: 'none',
        stroke: i === 1 ? COL : COL2,
        'stroke-width': 6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      p.style.animation = `hIn 1.6s ${i * 0.38}s ease-out infinite`;
      g.appendChild(p);
    }
    kind = 'inward';
    return g;
  }

  const builders = { ring: buildRing, rise: buildRise, circle: buildCircle, inward: buildInward };

  /**
   * Show hint `type` at screen position (x, y). Rebuilds only when the type
   * changes, so the animation doesn't restart every frame.
   */
  function show(type, x, y, opt) {
    // Rebuilding resets the group to transparent, so a switch of hint type has
    // to re-trigger the fade even when a hint was already on screen.
    const rebuilt = kind !== type;
    if (rebuilt) builders[type](opt);
    if (!group) return;
    group.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})`);
    if (!visible || rebuilt) {
      visible = true;
      const g = group;
      requestAnimationFrame(() => g.setAttribute('opacity', '1'));
    }
  }

  function hide() {
    if (!visible) return;
    visible = false;
    if (group) group.setAttribute('opacity', '0');
  }

  return { show, hide, clear, get visible() { return visible; } };
}
