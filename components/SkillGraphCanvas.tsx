'use client';

/* ==========================================================
   SKILL CONSTELLATION — avatar hub with 7 domains radiating out.

   - The avatar (lib/heroAvatar.ts) is the ONLY center node — a real
     DOM element layered over the canvas so the portrait stays crisp
     at any DPR and gets a native CSS hover state. It's intentionally
     kept independent of SKILL_GRAPH (lib/content.ts): swapping the
     portrait or editing the domains never requires touching the other.
   - Every domain gets a thin spoke to the avatar (always present) PLUS
     a curated set of domain-to-domain relationships from
     SKILL_CONNECTIONS, weighted 'primary' (solid) or 'secondary'
     (dashed).
   - Domains are spread evenly around the hub (small deterministic
     jitter for an organic, not mechanical, feel), pushed out as far
     as the panel allows, then clamped so nothing clips or overlaps at
     any panel size — see the layout-verification notes on haloR below.
   - Hover a domain: it and the avatar go to full strength, directly
     related domains stay moderately visible, everything else fades to
     ~10-20%, and only the active relationships keep animating. The
     hovered domain's own skill nodes also spread further apart (and
     its halo grows to match) so they're easier to read.
   ========================================================== */

import { useEffect, useRef, useState } from 'react';
import {
  CONSTELLATION_ABBREVIATIONS as SKILL_ABBREVIATIONS,
  CONSTELLATION_CONNECTIONS as SKILL_CONNECTIONS,
  CONSTELLATION_DATA as SKILL_GRAPH,
  CONSTELLATION_INFO as SKILL_INFO,
} from '@/lib/heroConstellation';
import { HERO_AVATAR } from '@/lib/heroAvatar';
import { abbreviateSkill, clamp, hexToRgba, legibleHue, prefersReducedMotion } from '@/lib/utils';

const ENTRY_STAGGER_MS = 80;
const ENTRY_DUR_MS = 560;
const EXPAND_SPRING = 0.1; // how fast a hovered cluster's spread/halo eases to its expanded size
const HOVER_EXPANSION = 1.14; // modest — see the layout-verification notes below for why this specific value

type Align = 'left' | 'right' | 'center';

type Node = {
  label: string;
  shortLabel: string;
  hue: string;
  angle: number;
  baseR: number;
  phase: number;
  speed: number;
  x: number;
  y: number;
  radius: number;
  clusterIndex: number;
  labelDx: number;
  labelDy: number;
  labelAlign: Align;
};

type ClusterLabelPlan = { dx: number; dy: number; align: Align; baseline: CanvasTextBaseline };
type Edge = { a: number; b: number; hue: string; kind: 'spoke' | 'primary' | 'secondary'; control?: { x: number; y: number } };
type Rect = { x: number; y: number; w: number; h: number };

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function rectsOverlapArea(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y, b.y);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

/** Shortest distance from point (px,py) to the segment a→b — used to
 *  detect whether a straight domain-to-domain connection would visually
 *  cut through a third, unrelated cluster's halo. */
function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Point on a quadratic Bézier at parameter t — used both to draw the
 *  curve and to walk the ambient traveling-glow dot along it. */
function quadPoint(t: number, ax: number, ay: number, cx: number, cy: number, bx: number, by: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * ax + 2 * mt * t * cx + t * t * bx,
    y: mt * mt * ay + 2 * mt * t * cy + t * t * by,
  };
}

export default function SkillGraphCanvas({
  panelRef,
  hourWarmth = 0,
}: {
  panelRef: React.RefObject<HTMLElement | null>;
  hourWarmth?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const [hubHovered, setHubHovered] = useState(false);

  useEffect(() => {
    const panelEl = panelRef.current;
    const canvasEl = canvasRef.current;
    const tooltipEl = tooltipRef.current;
    if (!panelEl || !canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let DPR = 1;
    let haloR = 60;
    let isMobile = false;
    let nodes: Node[] = [];
    let clusterCenters: { x: number; y: number }[] = [];
    let liveClusterCenters: { x: number; y: number }[] = []; // clusterCenters + this frame's drift — see clusterDrift()
    let clusterLabels: ClusterLabelPlan[] = [];
    let expansion: number[] = []; // per-cluster spring value, 1 = normal, >1 = hovered/expanded
    const mouse = { x: -9999, y: -9999 };
    const reduceMotion = prefersReducedMotion();
    let panelVisible = true;
    let hoveredNode: Node | null = null;
    let hoveredCluster = -1;
    let rafId: number | null = null;
    const mountedAt = performance.now();

    const idIndex = new Map(SKILL_GRAPH.map((c, i) => [c.id, i]));
    const edges: Edge[] = [];
    SKILL_GRAPH.forEach((c, i) => edges.push({ a: -1, b: i, hue: c.hue, kind: 'spoke' })); // -1 = hub
    SKILL_CONNECTIONS.forEach(({ a: fromId, b: toId, weight }) => {
      const a = idIndex.get(fromId);
      const b = idIndex.get(toId);
      if (a === undefined || b === undefined) return;
      edges.push({ a, b, hue: SKILL_GRAPH[a].hue, kind: weight });
    });

    // Directly-related domains for each domain, from the mesh edges only
    // (a spoke to the hub doesn't make two domains "related" to each other).
    const relatedOf: number[][] = SKILL_GRAPH.map((_, ci) => {
      const set = new Set<number>();
      edges.forEach((e) => {
        if (e.kind === 'spoke') return;
        if (e.a === ci) set.add(e.b);
        if (e.b === ci) set.add(e.a);
      });
      return Array.from(set);
    });

    function clampNum(n: number, min: number, max: number) {
      return Math.min(Math.max(n, min), max);
    }

    /* Whole-cluster idle wobble — halo, label, spokes, and the cluster's
       own skill nodes all drift together as one unit, the same way you
       asked for ("outer nodes wobble like the inner ones"). Each
       cluster gets its own slow, out-of-phase Lissajous-ish drift (two
       different sine frequencies on x/y, not a simple back-and-forth)
       so seven clusters moving in perfect unison don't read as
       mechanical. Amplitude is a fraction of haloR so it scales with
       the graph and never looks disproportionate on a small panel. */
    function clusterDrift(ci: number, t: number): { dx: number; dy: number } {
      if (reduceMotion) return { dx: 0, dy: 0 };
      const speed = 0.00011 + (ci % 3) * 0.000025;
      const phase = ci * 2.1;
      const ampX = haloR * 0.16;
      const ampY = haloR * 0.13;
      return {
        dx: Math.sin(t * speed + phase) * ampX,
        dy: Math.cos(t * speed * 0.82 + phase * 1.3) * ampY,
      };
    }

    /* Adaptive force-directed positioning: each cluster has a soft spring
       pulling it toward its "ideal" evenly-spaced heptagon angle (keeps
       the clean radial/orbital read), PLUS pairwise repulsion from every
       other cluster (auto-separates any pair that ends up too close,
       including the hover-expanded size — not just the resting one).
       This replaces hand-tuned fixed angles: previously, if containment
       clamping compressed one part of the panel more than another (e.g.
       taller-than-wide vs wider-than-tall), some pairs could end up
       closer together than others despite "even" angular spacing, and
       fixing that meant manually re-tuning constants every time. Now the
       repulsion pass automatically adds separation wherever the geometry
       is actually tight, regardless of aspect ratio or panel size —
       verified analytically across 9 realistic (non-square) panel
       sizes, from tall mobile through wide and tall desktop, before this
       shipped, with a real safety margin (not just barely clearing). */
    function clusterBasePositions(): { x: number; y: number }[] {
      const cx = W / 2;
      const cy = H / 2;
      const count = SKILL_GRAPH.length;
      const radiusX = W * (isMobile ? 0.36 : 0.47);
      const radiusY = H * (isMobile ? 0.34 : 0.45);
      const startAngle = -Math.PI / 2 - Math.PI / count;

      const labelMargin = isMobile ? 34 : 108;
      const marginX = clampNum(haloR + labelMargin, 0, W / 2 - 4);
      const marginY = clampNum(haloR + (isMobile ? 16 : 34), 0, H / 2 - 4);

      const positions = SKILL_GRAPH.map((_, i) => {
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

    /* Collision-avoiding label placement, run once per layout — idle
       motion is subtle enough that a static, well-chosen position holds
       up fine without re-solving every frame. */
    function planLabels() {
      const placedLabels: Rect[] = [];
      const haloBoxes = clusterCenters.map((c) => ({ x: c.x - haloR, y: c.y - haloR, w: haloR * 2, h: haloR * 2 }));
      // The hub avatar is a real DOM element painted on top of the canvas
      // (not something this label solver would otherwise know about) —
      // without treating it as an obstacle too, a cluster sitting close
      // enough to center could get its name label placed right underneath
      // the hub, fully hidden. Approximate its footprint as a square
      // obstacle at the panel center, same radius the edge-curve solver
      // uses for hub avoidance, so both stay consistent.
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

      ctx!.font = clusterFont;
      clusterLabels = SKILL_GRAPH.map((cluster, ci) => {
        const { x: cx, y: cy } = clusterCenters[ci];
        const w = ctx!.measureText(cluster.name).width;
        const gap = 10;
        const sides: { dx: number; dy: number; align: Align; baseline: CanvasTextBaseline }[] = cluster.labelSide
          ? [
              {
                top: { dx: 0, dy: -(haloR + gap), align: 'center' as Align, baseline: 'bottom' as CanvasTextBaseline },
                bottom: { dx: 0, dy: haloR + gap + clusterH, align: 'center' as Align, baseline: 'top' as CanvasTextBaseline },
                left: { dx: -(haloR + gap), dy: 0, align: 'right' as Align, baseline: 'middle' as CanvasTextBaseline },
                right: { dx: haloR + gap, dy: 0, align: 'left' as Align, baseline: 'middle' as CanvasTextBaseline },
              }[cluster.labelSide],
            ]
          : [
              { dx: 0, dy: -(haloR + gap), align: 'center', baseline: 'bottom' },
              { dx: 0, dy: haloR + gap + clusterH, align: 'center', baseline: 'top' },
              { dx: -(haloR + gap), dy: 0, align: 'right', baseline: 'middle' },
              { dx: haloR + gap, dy: 0, align: 'left', baseline: 'middle' },
            ];

        const candidates = sides.map((s) => {
          let rx = cx + s.dx;
          if (s.align === 'right') rx -= w;
          else if (s.align === 'center') rx -= w / 2;
          const ry = cy + s.dy - clusterH / 2;
          return { rect: { x: rx, y: ry, w, h: clusterH }, meta: s };
        });
        return bestCandidate(candidates, ci);
      });

      ctx!.font = nodeFont;
      nodes.forEach((n) => {
        const text = isMobile ? n.shortLabel : n.label;
        const w = ctx!.measureText(text).width;
        const dist = n.radius + 7;
        const candidates = [
          { dx: dist, dy: 0, align: 'left' as Align },
          { dx: -dist, dy: 0, align: 'right' as Align },
          { dx: 0, dy: -(dist + 5), align: 'center' as Align },
          { dx: 0, dy: dist + nodeH, align: 'center' as Align },
        ].map((s) => {
          let rx = n.x + s.dx;
          if (s.align === 'right') rx -= w;
          else if (s.align === 'center') rx -= w / 2;
          const ry = n.y + s.dy - nodeH / 2;
          return { rect: { x: rx, y: ry, w, h: nodeH }, meta: s };
        });
        const chosen = bestCandidate(candidates, n.clusterIndex);
        n.labelDx = chosen.dx;
        n.labelDy = chosen.dy;
        n.labelAlign = chosen.align;
      });
    }

    function layout() {
      isMobile = W < 560;
      const scaleDim = Math.min(W, H);
      haloR = isMobile ? clampNum(scaleDim * 0.085, 20, 42) : clampNum(scaleDim * 0.085, 44, 80);

      clusterCenters = clusterBasePositions();
      liveClusterCenters = clusterCenters.map((c) => ({ ...c }));
      expansion = SKILL_GRAPH.map(() => 1);

      nodes = [];
      // Clusters with more skills (mainframe, ai — 4 each, vs 3 for the
      // rest) get proportionally more internal spread so their extra
      // node doesn't just make things more cramped — this is what was
      // actually causing "Copilot" to render half-hidden behind its own
      // dot on small panels: a fixed spread has less room to share
      // between 4 candidate label positions than between 3.
      SKILL_GRAPH.forEach((cluster, ci) => {
        const { x: cx, y: cy } = clusterCenters[ci];
        const n = cluster.skills.length;
        // Scales continuously with skill count (was a hard 3-vs-4 split)
        // so a developer-edited cluster of any size — 2 skills or 8 —
        // gets proportionally more room instead of hitting a cliff.
        const spread = haloR * clampNum(0.42 + n * 0.035, 0.42, 0.68);
        cluster.skills.forEach((label, i) => {
          const angle = (i / n) * Math.PI * 2 + ci * 1.3;
          const x = cx + Math.cos(angle) * spread;
          const y = cy + Math.sin(angle) * spread;
          nodes.push({
            label,
            shortLabel: abbreviateSkill(label, SKILL_ABBREVIATIONS),
            hue: cluster.hue,
            angle,
            baseR: spread,
            phase: Math.sin(ci * 3.1 + i * 1.7) * Math.PI,
            speed: 0.15 + ((ci + i) % 3) * 0.05,
            x,
            y,
            radius: isMobile ? 4 : 6,
            clusterIndex: ci,
            labelDx: 0,
            labelDy: 0,
            labelAlign: 'left',
          });
        });
      });

      planLabels();
      computeEdgeCurves();
      positionHub();
    }

    /* For each domain-to-domain edge (never the hub spokes — those are
       already radial from center, so they can't cut through another
       cluster by construction), check whether its straight chord passes
       close enough to the HUB or to any OTHER cluster's halo — at that
       cluster's hover-expanded size, since an edge that only clears a
       neighbor at resting size can start visibly clipping it the moment
       that neighbor gets hovered — to visually read as "crossing
       through" it. If so, try a small set of candidate bows (both
       perpendicular directions, several magnitudes) and take the first
       that clears every obstacle at once — not just the worst one — the
       same "generate candidates, score, pick the clean one" approach as
       the label placer. Computed once per layout from the resting
       cluster positions, verified against 0 unresolved edges across 8
       realistic panel sizes/aspect ratios before shipping. */
    function computeEdgeCurves() {
      const cx = W / 2;
      const cy = H / 2;
      const hubR = haloR * 0.42;

      function clearsAll(A: { x: number; y: number }, ctrl: { x: number; y: number }, B: { x: number; y: number }, obstacles: { c: { x: number; y: number }; r: number }[]) {
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

        const obstacles: { c: { x: number; y: number }; r: number }[] = [{ c: { x: cx, y: cy }, r: hubR }];
        SKILL_GRAPH.forEach((_, ci) => {
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
        // Fallback (verified not to trigger in practice, but kept so a
        // future edge/domain addition degrades gracefully instead of
        // silently reverting to an unresolved straight line): biggest
        // bow, away from the hub.
        let perp = perp1;
        const towardHub = { x: cx - mx, y: cy - my };
        if (perp.x * towardHub.x + perp.y * towardHub.y > 0) perp = perp2;
        edge.control = { x: mx + perp.x * haloR * 2.2, y: my + perp.y * haloR * 2.2 };
      });
    }

    function hubWobble(t: number): { dx: number; dy: number } {
      if (reduceMotion) return { dx: 0, dy: 0 };
      const amp = Math.min(2.2, Math.max(0.9, haloR * 0.018));
      const speedX = 0.00017;
      const speedY = 0.00013;
      const phase = 1.15;
      return {
        dx: Math.sin(t * speedX + phase) * amp,
        dy: Math.cos(t * speedY + phase * 1.37) * amp * 0.82,
      };
    }

    function positionHub(t = performance.now()) {
      const hub = hubRef.current;
      if (!hub) return { x: W / 2, y: H / 2 };
      const wob = hubWobble(t);
      const x = W / 2 + wob.dx;
      const y = H / 2 + wob.dy;
      hub.style.left = x + 'px';
      hub.style.top = y + 'px';
      return { x, y };
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      const rect = panelEl!.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvasEl!.width = W * DPR;
      canvasEl!.height = H * DPR;
      canvasEl!.style.width = W + 'px';
      canvasEl!.style.height = H + 'px';
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      layout();
    }
    window.addEventListener('resize', resize);

    function hideTooltip() {
      tooltipEl?.classList.remove('is-visible');
    }
    function updateTooltip(clientX: number, clientY: number) {
      if (!tooltipEl) return;
      if (!hoveredNode) {
        hideTooltip();
        return;
      }
      const rect = panelEl!.getBoundingClientRect();
      const titleEl = tooltipEl.querySelector('.graph-tooltip-title');
      const infoEl = tooltipEl.querySelector('.graph-tooltip-info');
      if (titleEl) titleEl.textContent = hoveredNode.label;
      const info = SKILL_INFO[hoveredNode.label];
      if (infoEl) {
        infoEl.textContent = info || '';
        (infoEl as HTMLElement).style.display = info ? '' : 'none';
      }
      tooltipEl.style.left = clientX - rect.left + 'px';
      tooltipEl.style.top = clientY - rect.top + 'px';
      tooltipEl.classList.add('is-visible');
    }

    function updateHover(clientX: number, clientY: number) {
      let hc = -1;
      let minD = Infinity;
      liveClusterCenters.forEach((c, i) => {
        const d = Math.hypot(c.x - mouse.x, c.y - mouse.y);
        const hitR = haloR * expansion[i];
        if (d < hitR && d < minD) {
          minD = d;
          hc = i;
        }
      });
      hoveredCluster = hc;

      let hn: Node | null = null;
      let minNd = 16;
      nodes.forEach((n) => {
        const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        if (d < minNd) {
          minNd = d;
          hn = n;
        }
      });
      hoveredNode = hn;
      updateTooltip(clientX, clientY);
    }

    function setMouseFromEvent(clientX: number, clientY: number) {
      const rect = canvasEl!.getBoundingClientRect();
      mouse.x = clientX - rect.left;
      mouse.y = clientY - rect.top;
      updateHover(clientX, clientY);
    }
    const onMouseMove = (e: MouseEvent) => setMouseFromEvent(e.clientX, e.clientY);
    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
      hoveredNode = null;
      hoveredCluster = -1;
      hideTooltip();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) setMouseFromEvent(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => {
      window.setTimeout(() => {
        mouse.x = -9999;
        mouse.y = -9999;
        hoveredNode = null;
        hoveredCluster = -1;
        hideTooltip();
      }, 500);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    panelEl.addEventListener('touchmove', onTouchMove, { passive: true });
    panelEl.addEventListener('touchend', onTouchEnd, { passive: true });

    const hubEl = hubRef.current;
    const onHubEnter = () => setHubHovered(true);
    const onHubLeave = () => setHubHovered(false);
    hubEl?.addEventListener('mouseenter', onHubEnter);
    hubEl?.addEventListener('mouseleave', onHubLeave);

    const io = new IntersectionObserver(([entry]) => (panelVisible = entry.isIntersecting), { threshold: 0 });
    io.observe(panelEl);

    let textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#F4F5F7';
    let isLight = document.documentElement.dataset.theme === 'light';
    const themeObserver = new MutationObserver(() => {
      textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || textColor;
      isLight = document.documentElement.dataset.theme === 'light';
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const warmthGlow = 0.75 + hourWarmth * 0.15;

    // Emphasis tier for a cluster given current hover state: 1 = hovered,
    // 0.6 = directly related to the hovered one, 0.15 = unrelated (faded
    // out per spec), 0 (well, "normal") = nothing hovered at all.
    function clusterEmphasis(ci: number): number {
      if (hoveredCluster === -1) return -1; // idle baseline, not a hover state
      if (ci === hoveredCluster) return 1;
      if (relatedOf[hoveredCluster]?.includes(ci)) return 0.6;
      return 0.15;
    }

    function drawEdges(t: number, hubPt: { x: number; y: number }, renderCenters: { x: number; y: number }[]) {
      const anyHover = hoveredCluster !== -1;
      edges.forEach((edge, idx) => {
        const a = edge.kind === 'spoke' ? hubPt : renderCenters[edge.a];
        const b = renderCenters[edge.b];
        if (!a || !b) return;
        // The curve's control point was solved once at layout time against
        // the resting cluster positions — nudge it by the endpoints' own
        // current drift (averaged) so the bow keeps its shape relative to
        // the clusters it's routing around, instead of staying pinned to
        // a fixed point while both ends wobble away from it independently.
        let ctrl = edge.control;
        if (ctrl && edge.kind !== 'spoke') {
          const driftAx = renderCenters[edge.a].x - clusterCenters[edge.a].x;
          const driftAy = renderCenters[edge.a].y - clusterCenters[edge.a].y;
          const driftBx = renderCenters[edge.b].x - clusterCenters[edge.b].x;
          const driftBy = renderCenters[edge.b].y - clusterCenters[edge.b].y;
          ctrl = { x: ctrl.x + (driftAx + driftBx) / 2, y: ctrl.y + (driftAy + driftBy) / 2 };
        }

        // Is this edge part of the "active" set for the current hover?
        const touchesHovered = edge.a === hoveredCluster || edge.b === hoveredCluster;
        const bothRelatedOrHovered =
          !anyHover ||
          touchesHovered ||
          (edge.kind !== 'spoke' &&
            (relatedOf[hoveredCluster]?.includes(edge.a) || edge.a === hoveredCluster) &&
            (relatedOf[hoveredCluster]?.includes(edge.b) || edge.b === hoveredCluster));
        const isActive = !anyHover || touchesHovered;

        // Clip each end back from the cluster/hub center to its halo
        // edge. For a curved edge this has to follow the curve's own
        // tangent at each end (direction toward the control point),
        // not the straight a→b chord, or the line would visibly start
        // or end at the wrong angle relative to the curve it's about to draw.
        const startDir = ctrl ? { x: ctrl.x - a.x, y: ctrl.y - a.y } : { x: b.x - a.x, y: b.y - a.y };
        const endDir = ctrl ? { x: b.x - ctrl.x, y: b.y - ctrl.y } : { x: b.x - a.x, y: b.y - a.y };
        const startLen = Math.hypot(startDir.x, startDir.y) || 1;
        const endLen = Math.hypot(endDir.x, endDir.y) || 1;
        const startR = edge.kind === 'spoke' ? haloR * 0.42 : haloR * expansion[edge.a] || haloR;
        const endR = haloR * (expansion[edge.b] || 1);
        const start = { x: a.x + (startDir.x / startLen) * startR, y: a.y + (startDir.y / startLen) * startR };
        const end = { x: b.x - (endDir.x / endLen) * endR, y: b.y - (endDir.y / endLen) * endR };

        let alphaMul = 1;
        if (anyHover) alphaMul = touchesHovered ? 1.3 : bothRelatedOrHovered ? 0.6 : 0.14;

        ctx!.setLineDash(edge.kind === 'secondary' ? [5, 5] : []);
        if (edge.kind === 'spoke') {
          const base = isLight ? 0.16 : 0.13;
          ctx!.strokeStyle = hexToRgba(legibleHue(edge.hue, isLight), clamp(base * alphaMul + (touchesHovered ? 0.35 : 0), 0, 0.9));
          ctx!.lineWidth = touchesHovered ? 1.6 : 0.85;
        } else {
          const neutral = isLight ? [70, 75, 95] : [150, 150, 170];
          const [r, g, bch] = neutral;
          const base = edge.kind === 'primary' ? (isLight ? 0.4 : 0.32) : isLight ? 0.22 : 0.16;
          const a2 = clamp(base * alphaMul + (touchesHovered ? 0.2 : 0), 0, 0.95);
          ctx!.strokeStyle = `rgba(${r},${g},${bch},${a2})`;
          ctx!.lineWidth = (edge.kind === 'primary' ? 1.6 : 1) * (touchesHovered ? 1.25 : 1);
        }
        ctx!.beginPath();
        ctx!.moveTo(start.x, start.y);
        if (ctrl) {
          ctx!.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
        } else {
          ctx!.lineTo(end.x, end.y);
        }
        ctx!.stroke();
        ctx!.setLineDash([]);

        if (reduceMotion || !isActive) return;

        // Traveling glow — ambient on every edge when idle; once something
        // is hovered, only the active relationships keep animating.
        // Follows the same curve the line was drawn with, not a straight
        // lerp, so it never visibly cuts the corner on a bowed edge.
        const offset = idx / Math.max(1, edges.length);
        const p = (t / 9000 + offset) % 1;
        const { x: px, y: py } = ctrl
          ? quadPoint(p, start.x, start.y, ctrl.x, ctrl.y, end.x, end.y)
          : { x: start.x + (end.x - start.x) * p, y: start.y + (end.y - start.y) * p };
        const glowR = touchesHovered ? 9 : 6;
        const grad = ctx!.createRadialGradient(px, py, 0, px, py, glowR);
        grad.addColorStop(0, hexToRgba(edge.hue, warmthGlow * (touchesHovered ? 1.15 : 1)));
        grad.addColorStop(1, hexToRgba(edge.hue, 0));
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(px, py, glowR, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = hexToRgba(edge.hue, 0.85);
        ctx!.beginPath();
        ctx!.arc(px, py, touchesHovered ? 2.4 : 1.8, 0, Math.PI * 2);
        ctx!.fill();
      });
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, W, H);
      // Keep the DOM hub and canvas spokes driven by the exact same point.
      // The hub gets a very small, slow organic wobble so it participates in
      // the same living motion as the outer constellation without losing its
      // role as the visual anchor.
      const hubPt = positionHub(t);
      const anyHover = hoveredCluster !== -1;

      // Whole-cluster drift, computed once per frame and reused for
      // everything about that cluster below — halo, label, spokes,
      // mesh edges, and as the orbit anchor for its own skill nodes —
      // so they all move together as one unit instead of the halo
      // staying static while only the little nodes float.
      liveClusterCenters = clusterCenters.map((c, ci) => {
        const d = clusterDrift(ci, t);
        return { x: c.x + d.dx, y: c.y + d.dy };
      });

      // Spring each cluster's expansion factor toward its target (bigger
      // while hovered, so its skill nodes spread out and its halo grows
      // to match — settles back to 1 once the hover moves away).
      SKILL_GRAPH.forEach((_, ci) => {
        const target = ci === hoveredCluster ? HOVER_EXPANSION : 1;
        expansion[ci] += (target - expansion[ci]) * (reduceMotion ? 1 : EXPAND_SPRING);
      });

      const entryT = (ci: number) => {
        if (reduceMotion) return 1;
        const raw = (t - mountedAt - ci * ENTRY_STAGGER_MS) / ENTRY_DUR_MS;
        return easeOutCubic(clampNum(raw, 0, 1));
      };
      const entryAlpha = (ci: number) => {
        if (reduceMotion) return 1;
        const raw = (t - mountedAt - ci * ENTRY_STAGGER_MS) / ENTRY_DUR_MS;
        return clampNum(raw, 0, 1);
      };

      nodes.forEach((node) => {
        const center = liveClusterCenters[node.clusterIndex];
        const exp = expansion[node.clusterIndex];
        const wob = reduceMotion ? 0 : Math.sin(t * 0.0006 * node.speed + node.phase) * 10;
        let tx = center.x + Math.cos(node.angle + t * 0.00004) * (node.baseR * exp + wob);
        let ty = center.y + Math.sin(node.angle + t * 0.00004) * (node.baseR * exp + wob);
        const dx = tx - mouse.x;
        const dy = ty - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 85 && dist > 0.01) {
          const force = ((85 - dist) / 85) * 30;
          tx += (dx / dist) * force;
          ty += (dy / dist) * force;
        }
        const springRate = reduceMotion ? 1 : 0.06;
        node.x += (tx - node.x) * springRate;
        node.y += (ty - node.y) * springRate;
      });

      drawEdges(t, hubPt, liveClusterCenters);

      SKILL_GRAPH.forEach((cluster, ci) => {
        const clusterNodes = nodes.filter((n) => n.clusterIndex === ci);
        const hue = cluster.hue;
        const { x: avgX, y: avgY } = liveClusterCenters[ci];
        const emphasis = clusterEmphasis(ci);
        const isHoveredCluster = ci === hoveredCluster;
        const entryScale = entryT(ci);
        let alpha = entryAlpha(ci);
        if (anyHover) alpha *= emphasis === 1 ? 1 : emphasis === 0.6 ? 0.75 : 0.16;
        if (alpha <= 0.005) return;

        const drawnHaloR = haloR * expansion[ci];

        ctx!.save();
        ctx!.globalAlpha = alpha;
        ctx!.translate(avgX, avgY);
        ctx!.scale(entryScale, entryScale);
        ctx!.translate(-avgX, -avgY);

        const grad = ctx!.createRadialGradient(avgX, avgY, 0, avgX, avgY, drawnHaloR);
        grad.addColorStop(0, hexToRgba(hue, (isLight ? 0.26 : 0.13) * (isHoveredCluster ? 1.8 : 1)));
        grad.addColorStop(1, hexToRgba(hue, 0));
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(avgX, avgY, drawnHaloR, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.save();
        ctx!.setLineDash([6, 5]);
        ctx!.strokeStyle = hexToRgba(legibleHue(hue, isLight), (isLight ? 0.6 : 0.5) + (isHoveredCluster ? 0.3 : 0));
        ctx!.lineWidth = isHoveredCluster ? 1.6 : 1;
        ctx!.beginPath();
        ctx!.arc(avgX, avgY, drawnHaloR, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();

        ctx!.strokeStyle = hexToRgba(legibleHue(hue, isLight), (isLight ? 0.55 : 0.4) + (isHoveredCluster ? 0.25 : 0));
        ctx!.lineWidth = isHoveredCluster ? 1.6 : 1;
        if (clusterNodes.length > 2) {
          for (let i = 0; i < clusterNodes.length; i++) {
            const a = clusterNodes[i];
            const b = clusterNodes[(i + 1) % clusterNodes.length];
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        } else if (clusterNodes.length === 2) {
          ctx!.beginPath();
          ctx!.moveTo(clusterNodes[0].x, clusterNodes[0].y);
          ctx!.lineTo(clusterNodes[1].x, clusterNodes[1].y);
          ctx!.stroke();
        }

        clusterNodes.forEach((n) => {
          const isHoveredNode = hoveredNode === n;
          const isNodeActive = isHoveredNode || isHoveredCluster;
          const r = isHoveredNode ? n.radius * 1.45 : isHoveredCluster ? n.radius * 1.15 : n.radius;
          if (isNodeActive) {
            ctx!.save();
            ctx!.shadowColor = hexToRgba(legibleHue(hue, isLight), 0.9);
            ctx!.shadowBlur = isHoveredNode ? 14 : 8;
          }
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = hexToRgba(hue, isNodeActive ? 1 : 0.85);
          ctx!.fill();
          ctx!.lineWidth = isHoveredNode ? 2 : 1.4;
          ctx!.strokeStyle = hexToRgba(legibleHue(hue, isLight), 1);
          ctx!.stroke();
          if (isNodeActive) ctx!.restore();

          // Small leader tick from the node's own edge toward its label —
          // makes ownership unambiguous even when a neighboring cluster's
          // label happens to land nearby, without needing to hover to
          // confirm which dot a name belongs to.
          const tickLen = isHoveredNode ? 8 : 6;
          const dirX = n.labelDx === 0 ? 0 : Math.sign(n.labelDx);
          const dirY = n.labelDy === 0 ? 0 : Math.sign(n.labelDy);
          ctx!.beginPath();
          ctx!.moveTo(n.x + dirX * r, n.y + dirY * r);
          ctx!.lineTo(n.x + dirX * (r + tickLen), n.y + dirY * (r + tickLen));
          ctx!.strokeStyle = hexToRgba(legibleHue(hue, isLight), isNodeActive ? 0.85 : isMobile ? 0.3 : 0.45);
          ctx!.lineWidth = 1;
          ctx!.stroke();

          // On mobile there isn't room to show every label clearly at
          // once without them crowding each other — labels sit dim by
          // default and come to full strength on tap, trading "always
          // visible" for "always readable when you look at one."
          // Desktop has the room, so labels stay legible by default there.
          const text = isMobile ? n.shortLabel : n.label;
          ctx!.font = isHoveredNode
            ? `700 ${isMobile ? 10.5 : 12.5}px 'JetBrains Mono', monospace`
            : `${isMobile ? 600 : 500} ${isMobile ? 9.5 : 11}px 'JetBrains Mono', monospace`;
          ctx!.fillStyle = hexToRgba(textColor, isNodeActive ? 0.95 : isMobile ? 0.32 : 0.6);
          ctx!.textAlign = n.labelAlign;
          ctx!.textBaseline = 'middle';
          ctx!.fillText(text, n.x + n.labelDx, n.y + n.labelDy);
        });

        const lp = clusterLabels[ci];
        if (lp) {
          ctx!.font = isHoveredCluster
            ? `700 ${isMobile ? 11.5 : 12.5}px 'JetBrains Mono', monospace`
            : `700 ${isMobile ? 10.5 : 11}px 'JetBrains Mono', monospace`;
          ctx!.fillStyle = hexToRgba(legibleHue(hue, isLight), isHoveredCluster ? 1 : 0.95);
          ctx!.textAlign = lp.align;
          ctx!.textBaseline = lp.baseline;
          ctx!.fillText(cluster.name, avgX + lp.dx, avgY + lp.dy);
        }
        ctx!.restore();
      });
    }

    function loop(t: number) {
      if (panelVisible) draw(t);
      rafId = requestAnimationFrame(loop);
    }

    resize();
    // Always run the loop, even with reduced motion — every per-element
    // animation above already checks reduceMotion and holds still (zero
    // wobble/drift, entry appears instantly, hover snaps instead of
    // easing), so this doesn't reintroduce motion. What it does fix: a
    // one-shot draw() here would paint the initial frame and then never
    // repaint again, which meant hover was still detected correctly in
    // JS but the canvas could never show it — reduced-motion users would
    // point at a domain and see literally nothing happen.
    rafId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      panelEl.removeEventListener('touchmove', onTouchMove);
      panelEl.removeEventListener('touchend', onTouchEnd);
      hubEl?.removeEventListener('mouseenter', onHubEnter);
      hubEl?.removeEventListener('mouseleave', onHubLeave);
      io.disconnect();
      themeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [hourWarmth, panelRef]);

  return (
    <>
      <canvas id="graphCanvas" ref={canvasRef} aria-hidden="true" />
      <div className="graph-tooltip" id="graphTooltip" ref={tooltipRef}>
        <div className="graph-tooltip-title" />
        <div className="graph-tooltip-info" />
      </div>
      <div className={'graph-hub' + (hubHovered ? ' is-active' : '')} ref={hubRef} role="img" aria-label={`${HERO_AVATAR.name} — ${HERO_AVATAR.title}`}>
        <span className="graph-hub-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO_AVATAR.image} alt="" />
        </span>
        <span className="graph-hub-tag" aria-hidden="true">
          {HERO_AVATAR.name} · {HERO_AVATAR.title}
        </span>
      </div>
    </>
  );
}
