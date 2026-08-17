/* ==========================================================
   SKILL CONSTELLATION — LAYOUT ENGINE
   Pure math, no rendering. Framework/renderer-agnostic on purpose:
   this is the same simulation that used to live inline inside the
   canvas component's closures, factored out so SkillConstellation.tsx
   (the SVG + Framer Motion renderer) can call it without duplicating
   any of the tuned physics. If a future renderer swap ever happens
   again, only the rendering layer should need to change.
   ========================================================== */

import { CONSTELLATION_CONNECTIONS, CONSTELLATION_DATA, ConstellationCluster } from './heroConstellation';
import { abbreviateSkill } from './utils';
import { CONSTELLATION_ABBREVIATIONS } from './heroConstellation';

export const ENTRY_STAGGER_MS = 80;
export const ENTRY_DUR_MS = 560;
export const EXPAND_SPRING = 0.1;
export const HOVER_EXPANSION = 1.14;

export type Align = 'left' | 'right' | 'center';
export type Point = { x: number; y: number };

export type ConstellationNode = {
  id: string; // `${clusterId}:${label}` — stable React key
  label: string;
  shortLabel: string;
  hue: string;
  angle: number;
  baseR: number;
  phase: number;
  speed: number;
  radius: number;
  clusterIndex: number;
  labelDx: number;
  labelDy: number;
  labelAlign: Align;
  labelWidth: number;
  labelHeight: number;
};

export type ClusterLabelPlan = { dx: number; dy: number; align: Align; baseline: 'top' | 'bottom' | 'middle'; width: number; height: number };

export type ConstellationEdge = {
  a: number; // -1 = hub
  b: number;
  hue: string;
  kind: 'spoke' | 'primary' | 'secondary';
  control?: Point;
};

type Rect = { x: number; y: number; w: number; h: number };

export function clampNum(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function rectsOverlapArea(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y, b.y);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

export function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function quadPoint(t: number, ax: number, ay: number, cx: number, cy: number, bx: number, by: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * ax + 2 * mt * t * cx + t * t * bx,
    y: mt * mt * ay + 2 * mt * t * cy + t * t * by,
  };
}

export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/* Text measurement needs a canvas context even though nothing is ever
   drawn to it — it's the only reliable way to get real pixel widths
   for the label-collision solver below. One offscreen canvas, created
   lazily, shared across every layout() call. */
let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCtx) {
    const c = document.createElement('canvas');
    measureCtx = c.getContext('2d');
  }
  return measureCtx;
}
function measureText(text: string, font: string): number {
  const ctx = getMeasureCtx();
  if (!ctx) return text.length * 6.5; // SSR/no-canvas fallback estimate
  ctx.font = font;
  return ctx.measureText(text).width;
}

export const EDGES: ConstellationEdge[] = (() => {
  const idIndex = new Map(CONSTELLATION_DATA.map((c, i) => [c.id, i]));
  const edges: ConstellationEdge[] = [];
  CONSTELLATION_DATA.forEach((c, i) => edges.push({ a: -1, b: i, hue: c.hue, kind: 'spoke' }));
  CONSTELLATION_CONNECTIONS.forEach(({ a: fromId, b: toId, weight }) => {
    const a = idIndex.get(fromId);
    const b = idIndex.get(toId);
    if (a === undefined || b === undefined) return;
    edges.push({ a, b, hue: CONSTELLATION_DATA[a].hue, kind: weight });
  });
  return edges;
})();

export const RELATED_OF: number[][] = CONSTELLATION_DATA.map((_, ci) => {
  const set = new Set<number>();
  EDGES.forEach((e) => {
    if (e.kind === 'spoke') return;
    if (e.a === ci) set.add(e.b);
    if (e.b === ci) set.add(e.a);
  });
  return Array.from(set);
});

export function computeHaloR(W: number, H: number, isMobile: boolean): number {
  const scaleDim = Math.min(W, H);
  return isMobile ? clampNum(scaleDim * 0.085, 20, 42) : clampNum(scaleDim * 0.085, 44, 80);
}

/* Force-directed cluster placement: soft spring toward an ideal evenly-
   spaced angle + pairwise repulsion, clamped to stay inside the panel.
   Ported 1:1 from the canvas version — same constants, same 150-iteration
   relaxation — only the W/H/haloR/isMobile inputs are now explicit
   params instead of closure variables. */
export function clusterBasePositions(W: number, H: number, isMobile: boolean, haloR: number): Point[] {
  const cx = W / 2;
  const cy = H / 2;
  const count = CONSTELLATION_DATA.length;
  const radiusX = W * (isMobile ? 0.36 : 0.47);
  const radiusY = H * (isMobile ? 0.34 : 0.45);
  const startAngle = -Math.PI / 2 - Math.PI / count;

  const labelMargin = isMobile ? 34 : 108;
  const marginX = clampNum(haloR + labelMargin, 0, W / 2 - 4);
  const marginY = clampNum(haloR + (isMobile ? 16 : 34), 0, H / 2 - 4);

  const positions = CONSTELLATION_DATA.map((_, i) => {
    const angle = startAngle + (i / count) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * radiusX, y: cy + Math.sin(angle) * radiusY, idealAngle: angle };
  });

  const minSep = haloR * 2 * HOVER_EXPANSION * 1.22;
  const springK = 0.06;
  const repelK = 0.65;

  for (let iter = 0; iter < 150; iter++) {
    positions.forEach((p) => {
      const ix = cx + Math.cos(p.idealAngle) * radiusX;
      const iy = cy + Math.sin(p.idealAngle) * radiusY;
      p.x += (ix - p.x) * springK;
      p.y += (iy - p.y) * springK;
    });
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < minSep) {
          const push = (minSep - dist) * repelK;
          const ux = dx / dist;
          const uy = dy / dist;
          positions[i].x -= ux * push * 0.5;
          positions[i].y -= uy * push * 0.5;
          positions[j].x += ux * push * 0.5;
          positions[j].y += uy * push * 0.5;
        }
      }
    }
    positions.forEach((p) => {
      p.x = clampNum(p.x, marginX, Math.max(marginX, W - marginX));
      p.y = clampNum(p.y, marginY, Math.max(marginY, H - marginY));
    });
  }
  return positions.map((p) => ({ x: p.x, y: p.y }));
}

export function buildNodes(clusterCenters: Point[], haloR: number, isMobile: boolean): ConstellationNode[] {
  const nodes: ConstellationNode[] = [];
  CONSTELLATION_DATA.forEach((cluster: ConstellationCluster, ci) => {
    const n = cluster.skills.length;
    const spread = haloR * clampNum(0.42 + n * 0.035, 0.42, 0.68);
    cluster.skills.forEach((label, i) => {
      const angle = (i / n) * Math.PI * 2 + ci * 1.3;
      nodes.push({
        id: `${cluster.id}:${label}`,
        label,
        shortLabel: abbreviateSkill(label, CONSTELLATION_ABBREVIATIONS),
        hue: cluster.hue,
        angle,
        baseR: spread,
        phase: Math.sin(ci * 3.1 + i * 1.7) * Math.PI,
        speed: 0.15 + ((ci + i) % 3) * 0.05,
        radius: isMobile ? 4 : 6,
        clusterIndex: ci,
        labelDx: 0,
        labelDy: 0,
        labelAlign: 'left',
        labelWidth: 0,
        labelHeight: 0,
      });
    });
  });
  return nodes;
}

/* Collision-avoiding label placement — same greedy "generate 4
   candidates, score against every obstacle, keep the cleanest" solver
   as the canvas version. Mutates node.labelDx/Dy/Align/width/height in
   place and returns the per-cluster name-label plan. Run once per
   layout (resize), not per frame — idle motion is subtle enough that a
   statically-solved position holds up fine. */
export function planLabels(
  W: number,
  H: number,
  isMobile: boolean,
  haloR: number,
  clusterCenters: Point[],
  nodes: ConstellationNode[]
): ClusterLabelPlan[] {
  const placedLabels: Rect[] = [];
  const haloBoxes = clusterCenters.map((c) => ({ x: c.x - haloR, y: c.y - haloR, w: haloR * 2, h: haloR * 2 }));
  const hubR = haloR * 0.42;
  const hubBox = { x: W / 2 - hubR, y: H / 2 - hubR, w: hubR * 2, h: hubR * 2 };

  function bestCandidate<M extends { dx: number; dy: number; align: Align }>(
    candidates: { rect: Rect; meta: M }[],
    excludeHaloIndex: number
  ): M {
    let best = candidates[0];
    let bestScore = Infinity;
    for (const candidate of candidates) {
      const { rect } = candidate;
      let score = 0;
      haloBoxes.forEach((box, hi) => {
        if (hi === excludeHaloIndex) return;
        score += rectsOverlapArea(rect, box);
      });
      score += rectsOverlapArea(rect, hubBox) * 4;
      placedLabels.forEach((r) => (score += rectsOverlapArea(rect, r) * 3));
      const oob =
        Math.max(0, -rect.x) + Math.max(0, -rect.y) + Math.max(0, rect.x + rect.w - W) + Math.max(0, rect.y + rect.h - H);
      score += oob * 60;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
      if (score === 0) break;
    }
    placedLabels.push(best.rect);
    return best.meta;
  }

  const clusterFont = isMobile ? "700 10.5px 'JetBrains Mono', monospace" : "700 12.5px 'JetBrains Mono', monospace";
  const nodeFont = isMobile ? "600 9.5px 'JetBrains Mono', monospace" : "500 11px 'JetBrains Mono', monospace";
  const clusterH = isMobile ? 14 : 17;
  const nodeH = isMobile ? 12 : 15;

  const clusterLabels: ClusterLabelPlan[] = CONSTELLATION_DATA.map((cluster, ci) => {
    const { x: cx, y: cy } = clusterCenters[ci];
    const w = measureText(cluster.name, clusterFont);
    const gap = 10;
    const sides: { dx: number; dy: number; align: Align; baseline: 'top' | 'bottom' | 'middle' }[] = cluster.labelSide
      ? [
          {
            top: { dx: 0, dy: -(haloR + gap), align: 'center' as Align, baseline: 'bottom' as const },
            bottom: { dx: 0, dy: haloR + gap + clusterH, align: 'center' as Align, baseline: 'top' as const },
            left: { dx: -(haloR + gap), dy: 0, align: 'right' as Align, baseline: 'middle' as const },
            right: { dx: haloR + gap, dy: 0, align: 'left' as Align, baseline: 'middle' as const },
          }[cluster.labelSide],
        ]
      : [
          { dx: 0, dy: -(haloR + gap), align: 'center' as Align, baseline: 'bottom' as const },
          { dx: 0, dy: haloR + gap + clusterH, align: 'center' as Align, baseline: 'top' as const },
          { dx: -(haloR + gap), dy: 0, align: 'right' as Align, baseline: 'middle' as const },
          { dx: haloR + gap, dy: 0, align: 'left' as Align, baseline: 'middle' as const },
        ];

    const candidates = sides.map((s) => {
      let rx = cx + s.dx;
      if (s.align === 'right') rx -= w;
      else if (s.align === 'center') rx -= w / 2;
      const ry = cy + s.dy - clusterH / 2;
      return { rect: { x: rx, y: ry, w, h: clusterH }, meta: s };
    });
    const chosen = bestCandidate(candidates, ci);
    return { ...chosen, width: w, height: clusterH };
  });

  nodes.forEach((n) => {
    const center = clusterCenters[n.clusterIndex];
    const angle = n.angle;
    const nx = center.x + Math.cos(angle) * n.baseR;
    const ny = center.y + Math.sin(angle) * n.baseR;
    const text = isMobile ? n.shortLabel : n.label;
    const w = measureText(text, nodeFont);
    const dist = n.radius + 7;
    const candidates = [
      { dx: dist, dy: 0, align: 'left' as Align },
      { dx: -dist, dy: 0, align: 'right' as Align },
      { dx: 0, dy: -(dist + 5), align: 'center' as Align },
      { dx: 0, dy: dist + nodeH, align: 'center' as Align },
    ].map((s) => {
      let rx = nx + s.dx;
      if (s.align === 'right') rx -= w;
      else if (s.align === 'center') rx -= w / 2;
      const ry = ny + s.dy - nodeH / 2;
      return { rect: { x: rx, y: ry, w, h: nodeH }, meta: s };
    });
    const chosen = bestCandidate(candidates, n.clusterIndex);
    n.labelDx = chosen.dx;
    n.labelDy = chosen.dy;
    n.labelAlign = chosen.align;
    n.labelWidth = w;
    n.labelHeight = nodeH;
  });

  return clusterLabels;
}

/* Bows domain-to-domain edges around the hub / other clusters' halos
   when a straight chord would visibly cut through one. Same candidate-
   bow search as the canvas version. */
export function computeEdgeCurves(W: number, H: number, haloR: number, clusterCenters: Point[], edges: ConstellationEdge[]) {
  const cx = W / 2;
  const cy = H / 2;
  const hubR = haloR * 0.42;

  function clearsAll(A: Point, ctrl: Point, B: Point, obstacles: { c: Point; r: number }[]) {
    for (const ob of obstacles) {
      const d1 = distPointToSegment(ob.c.x, ob.c.y, A.x, A.y, ctrl.x, ctrl.y);
      const d2 = distPointToSegment(ob.c.x, ob.c.y, ctrl.x, ctrl.y, B.x, B.y);
      if (Math.min(d1, d2) < ob.r * 1.08) return false;
    }
    return true;
  }

  edges.forEach((edge) => {
    if (edge.kind === 'spoke') {
      edge.control = undefined;
      return;
    }
    const A = clusterCenters[edge.a];
    const B = clusterCenters[edge.b];
    if (!A || !B) {
      edge.control = undefined;
      return;
    }

    const obstacles: { c: Point; r: number }[] = [{ c: { x: cx, y: cy }, r: hubR }];
    CONSTELLATION_DATA.forEach((_, ci) => {
      if (ci === edge.a || ci === edge.b) return;
      obstacles.push({ c: clusterCenters[ci], r: haloR * HOVER_EXPANSION });
    });

    const straightOk = obstacles.every((ob) => distPointToSegment(ob.c.x, ob.c.y, A.x, A.y, B.x, B.y) >= ob.r * 1.08);
    if (straightOk) {
      edge.control = undefined;
      return;
    }

    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const perp1 = { x: -dy / len, y: dx / len };
    const perp2 = { x: dy / len, y: -dx / len };

    for (const perp of [perp1, perp2]) {
      for (const bowMag of [haloR * 0.5, haloR * 0.8, haloR * 1.1, haloR * 1.4, haloR * 1.8, haloR * 2.2]) {
        const ctrl = { x: mx + perp.x * bowMag, y: my + perp.y * bowMag };
        if (clearsAll(A, ctrl, B, obstacles)) {
          edge.control = ctrl;
          return;
        }
      }
    }
    let perp = perp1;
    const towardHub = { x: cx - mx, y: cy - my };
    if (perp.x * towardHub.x + perp.y * towardHub.y > 0) perp = perp2;
    edge.control = { x: mx + perp.x * haloR * 2.2, y: my + perp.y * haloR * 2.2 };
  });
}

export function clusterDrift(ci: number, t: number, haloR: number, reduceMotion: boolean): Point {
  if (reduceMotion) return { x: 0, y: 0 };
  const speed = 0.00011 + (ci % 3) * 0.000025;
  const phase = ci * 2.1;
  const ampX = haloR * 0.16;
  const ampY = haloR * 0.13;
  return {
    x: Math.sin(t * speed + phase) * ampX,
    y: Math.cos(t * speed * 0.82 + phase * 1.3) * ampY,
  };
}

export function hubWobble(t: number, haloR: number, reduceMotion: boolean): Point {
  if (reduceMotion) return { x: 0, y: 0 };
  const amp = Math.min(2.2, Math.max(0.9, haloR * 0.018));
  return {
    x: Math.sin(t * 0.00017 + 1.15) * amp,
    y: Math.cos(t * 0.00013 * 1.0) * amp,
  };
}

export type ConstellationLayout = {
  W: number;
  H: number;
  isMobile: boolean;
  haloR: number;
  clusterCenters: Point[];
  nodes: ConstellationNode[];
  clusterLabels: ClusterLabelPlan[];
  edges: ConstellationEdge[];
};

/** Runs the full (resize-time) layout pass: cluster positions → nodes →
 *  label solve → edge curves. Everything downstream (idle wobble, hover
 *  spring, the text-overlap fade) is cheap per-frame math layered on
 *  top of this in the renderer, not recomputed here. */
export function computeLayout(W: number, H: number): ConstellationLayout {
  const isMobile = W < 560;
  const haloR = computeHaloR(W, H, isMobile);
  const clusterCenters = clusterBasePositions(W, H, isMobile, haloR);
  const nodes = buildNodes(clusterCenters, haloR, isMobile);
  const clusterLabels = planLabels(W, H, isMobile, haloR, clusterCenters, nodes);
  // Edges are a shared module-level array (EDGES) mutated in place with
  // solved control points — cloned per layout so a resize doesn't leave
  // stale curves from the previous panel size on screen momentarily.
  const edges = EDGES.map((e) => ({ ...e }));
  computeEdgeCurves(W, H, haloR, clusterCenters, edges);
  return { W, H, isMobile, haloR, clusterCenters, nodes, clusterLabels, edges };
}
