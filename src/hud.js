// The whole interface is pictograms — no words, no numbers, no score.

const INK = '#7a6053';
const ROSE = '#ff8fae';
const GOLD = '#ffc45c';
const MINT = '#7fd3bd';
const SKY = '#8ec6f2';

const S = (body, extra = '') =>
  `<g fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</g>`;

export const ICONS = {
  hand: `
    <path d="M26 44V17a4.5 4.5 0 0 1 9 0v18" fill="${ROSE}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M35 30a4 4 0 0 1 8 0v6" fill="${ROSE}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M43 33a4 4 0 0 1 8 0v9c0 9-6 15-14 15h-6c-6 0-9-3-11-8l-5-11a4 4 0 0 1 7-4l4 6"
          fill="${ROSE}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>`,

  chalk: `
    ${S('<path d="M12 52c9-2 13-6 15-11"/>', 'stroke-dasharray="1 7" stroke-width="4"')}
    <g transform="rotate(-38 40 26)">
      <rect x="33" y="8" width="14" height="30" rx="6" fill="#fffaf0" stroke="${INK}" stroke-width="3.4"/>
      <rect x="33" y="18" width="14" height="6" fill="${ROSE}" stroke="none"/>
      <path d="M33 34h14" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
    </g>
    ${S('<path d="M27 41c4-4 8-6 12-7"/>', 'stroke-dasharray="2 7" stroke-width="4"')}`,

  scissors: `
    <g stroke="${INK}" stroke-width="3.6" stroke-linecap="round" fill="none">
      <path d="M20 12 44 45"/>
      <path d="M44 12 20 45"/>
      <circle cx="17" cy="51" r="6.5" fill="${ROSE}"/>
      <circle cx="47" cy="51" r="6.5" fill="${GOLD}"/>
      <circle cx="32" cy="30" r="2.6" fill="${INK}" stroke="none"/>
    </g>`,

  machine: `
    <g stroke="${INK}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M10 46h44a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3z" fill="#fff3e2"/>
      <path d="M43 14h8a4 4 0 0 1 4 4v28h-12z" fill="${MINT}"/>
      <path d="M17 14h28v11H17a5.5 5.5 0 0 1 0-11z" fill="${MINT}"/>
      <path d="M15 25v13" stroke-width="4"/>
      <path d="M15 40v5" stroke-width="3"/>
      <circle cx="49" cy="31" r="5" fill="${GOLD}"/>
      <path d="M30 8v6" stroke-width="3"/>
      <ellipse cx="30" cy="8" rx="5" ry="3" fill="${ROSE}"/>
    </g>`,

  twirl: `
    <g stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none">
      <path d="M50 32a18 18 0 1 1-6-13.4"/>
      <path d="M46 8v11H35"/>
    </g>
    <path d="M32 22a10 10 0 0 1 0 20 10 10 0 0 1 0-20z" fill="${ROSE}" opacity="0.5"/>`,

  sparkle: `
    <path d="M32 8c2.4 12 5.6 15.2 17.6 17.6C37.6 28 34.4 31.2 32 43.2 29.6 31.2 26.4 28 14.4 25.6 26.4 23.2 29.6 20 32 8z"
          fill="${GOLD}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M49 40c1.2 5.4 2.6 6.8 8 8-5.4 1.2-6.8 2.6-8 8-1.2-5.4-2.6-6.8-8-8 5.4-1.2 6.8-2.6 8-8z"
          fill="${ROSE}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="14" cy="47" r="4" fill="${SKY}" stroke="${INK}" stroke-width="2.6"/>`,

  soundOn: `
    <path d="M14 25h9l11-9v32l-11-9h-9z" fill="${GOLD}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    ${S('<path d="M41 24a11 11 0 0 1 0 16"/><path d="M47 18a19 19 0 0 1 0 28"/>', 'stroke-width="3.4"')}`,

  soundOff: `
    <path d="M14 25h9l11-9v32l-11-9h-9z" fill="#e6dbd2" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    ${S('<path d="M42 25l14 14"/><path d="M56 25L42 39"/>', 'stroke-width="3.6"')}`,

  bow: `
    <g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round">
      <path d="M30 32C22 20 8 22 9 32s13 12 21 0z" fill="${ROSE}"/>
      <path d="M34 32c8-12 22-10 21 0s-13 12-21 0z" fill="${ROSE}"/>
      <path d="M27 36l-6 18 11-9 11 9-6-18z" fill="${ROSE}"/>
      <ellipse cx="32" cy="32" rx="5.5" ry="6.5" fill="#fff3f7"/>
    </g>`,

  flower: `
    <g stroke="${INK}" stroke-width="3.2">
      <g fill="${ROSE}">
        <ellipse cx="32" cy="15" rx="8" ry="10"/>
        <ellipse cx="49" cy="27" rx="8" ry="10" transform="rotate(72 49 27)"/>
        <ellipse cx="42" cy="47" rx="8" ry="10" transform="rotate(144 42 47)"/>
        <ellipse cx="22" cy="47" rx="8" ry="10" transform="rotate(216 22 47)"/>
        <ellipse cx="15" cy="27" rx="8" ry="10" transform="rotate(288 15 27)"/>
      </g>
      <circle cx="32" cy="32" r="8" fill="${GOLD}"/>
    </g>`,

  button: `
    <g stroke="${INK}" stroke-width="3.2">
      <circle cx="32" cy="32" r="21" fill="${SKY}"/>
      <circle cx="32" cy="32" r="15" fill="none" stroke-width="2.4"/>
      <g fill="${INK}" stroke="none">
        <circle cx="26" cy="26" r="3.2"/><circle cx="38" cy="26" r="3.2"/>
        <circle cx="26" cy="38" r="3.2"/><circle cx="38" cy="38" r="3.2"/>
      </g>
    </g>`,

  star: `
    <path d="M32 7l7.6 15.6L57 25.1 44.5 37.2l3 17.3L32 46.4 16.5 54.5l3-17.3L7 25.1l17.4-2.5z"
          fill="${GOLD}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>`,
};

export const PHASE_ICON = ['hand', 'chalk', 'scissors', 'machine', 'twirl', 'sparkle'];

export class Hud {
  constructor(onSound, onDeco) {
    this.toolWrap = document.getElementById('hud-tool');
    this.toolIcon = document.getElementById('tool-icon');
    this.pips = document.getElementById('hud-pips');
    this.soundBtn = document.getElementById('hud-sound');
    this.soundIcon = document.getElementById('sound-icon');
    this.decoBar = document.getElementById('deco-bar');

    this.pipEls = [];
    for (let i = 0; i < PHASE_ICON.length; i++) {
      const el = document.createElement('i');
      this.pips.appendChild(el);
      this.pipEls.push(el);
    }

    this.soundOn = true;
    this.soundIcon.innerHTML = ICONS.soundOn;
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.soundOn = !this.soundOn;
      this.soundIcon.innerHTML = this.soundOn ? ICONS.soundOn : ICONS.soundOff;
      onSound(this.soundOn);
    });

    this.onDeco = onDeco;
    this.decoButtons = [];
    this.current = -1;
  }

  setPhase(index) {
    if (index === this.current) return;
    this.current = index;
    this.toolIcon.innerHTML = ICONS[PHASE_ICON[index]] || '';
    this.toolWrap.classList.add('pop');
    setTimeout(() => this.toolWrap.classList.remove('pop'), 420);
    this.pipEls.forEach((el, i) => {
      el.className = i < index ? 'done' : i === index ? 'now' : '';
    });
  }

  buildDecoBar(kinds, selected) {
    this.decoBar.innerHTML = '';
    this.decoButtons = kinds.map((kind, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<svg viewBox="0 0 64 64">${ICONS[kind] || ICONS.star}</svg>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectDeco(i);
        this.onDeco(kind, i);
      });
      this.decoBar.appendChild(b);
      return b;
    });
    this.selectDeco(selected);
  }

  selectDeco(i) {
    this.decoButtons.forEach((b, k) => b.classList.toggle('sel', k === i));
  }

  showDecoBar(on) {
    this.decoBar.classList.toggle('hidden', !on);
  }
}

/** The pre-tap veil: a stitched ring around a pair of scissors. */
export function paintVeil() {
  const art = document.getElementById('veil-art');
  const dashes = [];
  const cx = 110, cy = 110, r = 78;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    dashes.push(`<rect x="${(x - 5).toFixed(1)}" y="${(y - 2.4).toFixed(1)}" width="10" height="4.8" rx="2.4"
      fill="${i % 3 === 0 ? ROSE : GOLD}" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
  }
  // expanding rings say "touch me" without a single word
  const rings = [0, 1, 2].map((i) =>
    `<circle class="ripple" style="animation-delay:${i * 0.8}s" cx="110" cy="110" r="60"
       fill="none" stroke="${ROSE}" stroke-width="3"/>`).join('');

  art.innerHTML = `
    ${rings}
    <g class="spin-slow">${dashes.join('')}</g>
    <g class="breathe">
      <circle cx="110" cy="110" r="56" fill="rgba(255,255,255,0.78)"/>
      <g transform="translate(110 110) scale(1.35) translate(-32 -32)">${ICONS.scissors}</g>
    </g>
    <g class="tap-hand" transform="translate(166 178)">
      <g transform="scale(0.72) translate(-32 -32)">${ICONS.hand}</g>
    </g>`;
}
