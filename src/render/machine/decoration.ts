// ============================================================================
// 装飾スタイル — flowが setDecoration() で書き込み、render-machine 全体が読む。
// CONTRACTS.md 逸脱（許可済み）: Progress.decoration は state に存在しないため、
// このモジュールレベルの変数で受け渡す。
// ============================================================================

export let decorationStyle = 'classic';

export function setDecoration(d: string): void {
  decorationStyle = d;
}

export interface Accent {
  /** 主色 */
  a: string;
  /** 副色 */
  b: string;
  /** 光暈（glow）用の半透明色 */
  glow: string;
  /** 強い光暈 */
  glowStrong: string;
}

/** 現在の装飾に応じた差し色を返す。rainbowはtimeで色相回転（毎フレーム計算、軽量） */
export function getAccent(time: number): Accent {
  switch (decorationStyle) {
    case 'pink':
      return {
        a: '#ff6fae', b: '#ffc2e0',
        glow: 'rgba(255,111,174,0.45)', glowStrong: 'rgba(255,111,174,0.75)',
      };
    case 'rainbow': {
      const hue = (time * 36) % 360;
      const hue2 = (hue + 70) % 360;
      return {
        a: `hsl(${hue.toFixed(0)},85%,62%)`,
        b: `hsl(${hue2.toFixed(0)},85%,72%)`,
        glow: `hsla(${hue.toFixed(0)},90%,60%,0.45)`,
        glowStrong: `hsla(${hue.toFixed(0)},90%,60%,0.8)`,
      };
    }
    case 'flower':
      return {
        a: '#ffb703', b: '#8ecae6',
        glow: 'rgba(255,183,3,0.4)', glowStrong: 'rgba(255,183,3,0.75)',
      };
    default:
      return {
        a: '#3fd0ff', b: '#a9f0ff',
        glow: 'rgba(63,208,255,0.4)', glowStrong: 'rgba(63,208,255,0.75)',
      };
  }
}
