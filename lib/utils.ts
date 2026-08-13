/* ==========================================================
   SHARED UTILITIES — no logic here is duplicated elsewhere.
   ========================================================== */

export function hexToRgba(hex: string, a: number): string {
  if (typeof hex !== 'string' || hex.startsWith('var(')) return hex;
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function hexToHsl(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16) / 255;
  const g = parseInt(v.substring(2, 4), 16) / 255;
  const b = parseInt(v.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Some palette hues (e.g. a light indigo) read fine on a dark background
 * but are nearly invisible on white — opacity alone can't fix that, the
 * color itself is too pale. This caps lightness (and nudges saturation up
 * slightly to compensate) only when isLight is true, leaving dark theme's
 * original vivid colors untouched.
 */
export function legibleHue(hex: string, isLight: boolean): string {
  if (!isLight || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  const [h, s, l] = hexToHsl(hex);
  if (l <= 42) return hex; // already dark enough
  return hslToHex(h, Math.min(100, s + 8), 42);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats an ISO 'YYYY-MM-DD' string as 'D MMM YYYY' (e.g. '31 Mar 2026').
 *  Parses the string directly instead of going through `new Date(iso)`,
 *  since that parses as UTC midnight and can display the wrong day
 *  depending on the visitor's timezone. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTH_NAMES[(m - 1 + 12) % 12] ?? '';
  return `${d} ${month} ${y}`;
}

/** Short mobile label for a skill node. Checks SKILL_ABBREVIATIONS first
 *  (lib/content.ts) for a hand-picked short form; anything not listed
 *  there is shortened automatically (first word if that's ≤9 chars,
 *  otherwise a hard truncate) so a newly added skill never breaks the
 *  mobile layout while it's waiting for a manual entry. */
export function abbreviateSkill(label: string, overrides: Record<string, string>): string {
  if (overrides[label]) return overrides[label];
  if (label.length <= 9) return label;
  const firstWord = label.split(/[\s/]/)[0];
  if (firstWord.length <= 9) return firstWord;
  return firstWord.slice(0, 8) + '…';
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 150) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
