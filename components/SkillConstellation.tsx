'use client';

/* ==========================================================
   SKILL CONSTELLATION — SVG + Framer Motion renderer.

   Replaces the earlier canvas implementation. Same visual language,
   same layout engine (lib/skillConstellationEngine.ts, ported near-
   verbatim from the canvas closures) — what changed is the rendering
   target and a few things that come free with real SVG/DOM elements:

   - Labels are real <text> — selectable, screen-reader reachable,
     crawlable by search/recruiter tooling. This was the main reason
     for the migration.
   - Hover uses native pointer events on real hit-target elements
     instead of a manual per-frame "distance from mouse to every node"
     loop. (This does mean the canvas version's cursor-repel force
     field — nodes physically nudging away from the pointer within an
     85px radius — is not reproduced; it was a canvas-specific flourish
     tightly coupled to raw pixel math, and native hit-testing is a
     more robust trade for it.)
   - Theme (dark/light) is plain CSS via var(--...) custom properties
     and color-mix(), so it reacts instantly with zero JS — no more
     MutationObserver polling document.documentElement for data-theme.

   Continuous motion (idle wobble, hover spring, the traveling edge
   glow, entry stagger, and the new text-overlap fade) is still driven
   by a single requestAnimationFrame loop, same as the canvas version —
   this is a real-time simulation, not a discrete UI state, so it's
   applied imperatively via refs (bypassing React re-renders) rather
   than through Framer Motion's declarative variants. Framer Motion IS
   used for the parts that are genuinely discrete state transitions:
   hover micro-interactions (whileHover spring pop) and mount entry.
   ========================================================== */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { CONSTELLATION_DATA, CONSTELLATION_INFO } from '@/lib/heroConstellation';
import { HERO_AVATAR } from '@/lib/heroAvatar';
import { prefersReducedMotion } from '@/lib/utils';
import {
  computeLayout,
  clusterDrift,
  hubWobble,
  quadPoint,
  clampNum,
  easeOutCubic,
  ENTRY_STAGGER_MS,
  ENTRY_DUR_MS,
  EXPAND_SPRING,
  HOVER_EXPANSION,
  RELATED_OF,
  type ConstellationLayout,
  type ConstellationNode,
} from '@/lib/skillConstellationEngine';

/* How wide the fade transition band is (px, in panel-local units) —
   a node/label starts dimming this far before it would actually start
   sliding under the text block, and reaches its floor opacity right at
   the text edge. Widened slightly beyond a hard cutoff so it reads as
   a fade, not a switch. */
const TEXT_FADE_BAND = 76;
const TEXT_FADE_FEATHER_Y = 42;
const TEXT_FADE_FLOOR = 0.08;

export default function SkillConstellation({
  panelRef,
  textRef,
  hourWarmth = 0,
}: {
  panelRef: React.RefObject<HTMLElement | null>;
  /** Ref to the hero text block (.hero-content) — measured live so the
   *  fade zone tracks its real footprint, including when bio copy
   *  changes its height. */
  textRef: React.RefObject<HTMLElement | null>;
  /** 0–1 time-of-day warmth (see lib/useHourTint.ts) — nudges the
   *  traveling edge-glow dots' opacity, same touch the canvas version had. */
  hourWarmth?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const elRefs = useRef<Map<string, SVGElement>>(new Map());
  const setRef = (key: string) => (el: SVGElement | null) => {
    if (el) elRefs.current.set(key, el);
    else elRefs.current.delete(key);
  };

  const [layout, setLayout] = useState<ConstellationLayout | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState(-1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hubHovered, setHubHovered] = useState(false);

  const layoutRef = useRef<ConstellationLayout | null>(null);
  const hoveredClusterRef = useRef(-1);
  const hoveredNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    hoveredClusterRef.current = hoveredCluster;
  }, [hoveredCluster]);
  useEffect(() => {
    hoveredNodeIdRef.current = hoveredNodeId;
  }, [hoveredNodeId]);

  // Nodes grouped by cluster, stable for the component's lifetime
  // (skill counts don't change at runtime) — used purely to build JSX
  // structure once; live positions are written imperatively below.
  const nodesByCluster = useMemo(() => {
    if (!layout) return [];
    return CONSTELLATION_DATA.map((_, ci) => layout.nodes.filter((n) => n.clusterIndex === ci));
  }, [layout]);

  useEffect(() => {
    const panelEl = panelRef.current;
    const svgEl = svgRef.current;
    const hubEl = hubRef.current;
    const tooltipEl = tooltipRef.current;
    if (!panelEl || !svgEl) return;

    const reduceMotion = prefersReducedMotion();
    const warmthGlow = 0.75 + hourWarmth * 0.15;
    // Derived from the first rAF timestamp rather than a standalone
    // performance.now() call — same clock, but avoids an impure call
    // being evaluated outside the frame loop itself.
    let mountedAt: number | null = null;
    let panelVisible = true;
    let rafId: number | null = null;

    // Live simulation state — mutated every frame, independent of React.
    let expansion: number[] = [];
    let liveClusterCenters: { x: number; y: number }[] = [];
    let liveNodePos: Map<string, { x: number; y: number }> = new Map();

    // Text-overlap fade zone, in panel-local coordinates. Recomputed by
    // the ResizeObservers below, read every frame (cheap).
    let textRectLocal: { right: number; top: number; bottom: number } | null = null;

    function measureTextZone() {
      const textEl = textRef.current;
      if (!textEl || !panelEl) {
        textRectLocal = null;
        return;
      }
      const tRect = textEl.getBoundingClientRect();
      const pRect = panelEl.getBoundingClientRect();
      textRectLocal = {
        right: tRect.right - pRect.left,
        top: tRect.top - pRect.top,
        bottom: tRect.bottom - pRect.top,
      };
    }

    // Returns an opacity multiplier in [TEXT_FADE_FLOOR, 1] for a point
    // at (x,y) whose "whole unit" (dot + label) extends left to
    // leftEdgeX. Only fades where the element is BOTH vertically inside
    // the text block's band AND has started crossing its right edge —
    // an element far above/below the bio text stays fully visible even
    // if it happens to sit at a small x.
    function textOverlapFade(y: number, leftEdgeX: number): number {
      if (!textRectLocal) return 1;
      let vFactor = 0;
      if (y >= textRectLocal.top && y <= textRectLocal.bottom) vFactor = 1;
      else if (y < textRectLocal.top && y > textRectLocal.top - TEXT_FADE_FEATHER_Y) {
        vFactor = (y - (textRectLocal.top - TEXT_FADE_FEATHER_Y)) / TEXT_FADE_FEATHER_Y;
      } else if (y > textRectLocal.bottom && y < textRectLocal.bottom + TEXT_FADE_FEATHER_Y) {
        vFactor = ((textRectLocal.bottom + TEXT_FADE_FEATHER_Y) - y) / TEXT_FADE_FEATHER_Y;
      }
      if (vFactor <= 0) return 1;

      const overlapDepth = textRectLocal.right - leftEdgeX; // > 0 once crossing under the text
      const hFadeAmount = clampNum(overlapDepth / TEXT_FADE_BAND, 0, 1);
      const opacity = 1 - hFadeAmount * vFactor;
      return clampNum(opacity, TEXT_FADE_FLOOR, 1);
    }

    function nodeLeftEdge(n: ConstellationNode, x: number): number {
      if (n.labelAlign === 'right') return x + n.labelDx - n.labelWidth;
      if (n.labelAlign === 'left') return Math.min(x - n.radius, x + n.labelDx);
      return Math.min(x - n.radius, x + n.labelDx - n.labelWidth / 2);
    }

    function resize() {
      const rect = panelEl!.getBoundingClientRect();
      const W = Math.max(1, rect.width);
      const H = Math.max(1, rect.height);
      const next = computeLayout(W, H);
      layoutRef.current = next;
      expansion = CONSTELLATION_DATA.map(() => 1);
      liveClusterCenters = next.clusterCenters.map((c) => ({ ...c }));
      liveNodePos = new Map(next.nodes.map((n) => [n.id, { x: 0, y: 0 }]));
      next.nodes.forEach((n) => {
        const center = next.clusterCenters[n.clusterIndex];
        liveNodePos.set(n.id, {
          x: center.x + Math.cos(n.angle) * n.baseR,
          y: center.y + Math.sin(n.angle) * n.baseR,
        });
      });
      measureTextZone();
      setLayout(next);
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(panelEl);
    const textObserver = textRef.current ? new ResizeObserver(() => measureTextZone()) : null;
    if (textRef.current && textObserver) textObserver.observe(textRef.current);

    const io = new IntersectionObserver(([entry]) => (panelVisible = entry.isIntersecting), { threshold: 0 });
    io.observe(panelEl);

    const onHubEnter = () => setHubHovered(true);
    const onHubLeave = () => setHubHovered(false);
    hubEl?.addEventListener('mouseenter', onHubEnter);
    hubEl?.addEventListener('mouseleave', onHubLeave);

    function hideTooltip() {
      tooltipEl?.classList.remove('is-visible');
    }

    function frame(t: number) {
      rafId = requestAnimationFrame(frame);
      if (mountedAt === null) mountedAt = t;
      const startedAt = mountedAt;
      if (!panelVisible) return;
      const cur = layoutRef.current;
      if (!cur) return;

      const hoveredClusterIdx = hoveredClusterRef.current;
      const hoveredNodeId2 = hoveredNodeIdRef.current;
      const anyHover = hoveredClusterIdx !== -1;

      // Hub wobble + position (also drives the DOM avatar overlay).
      const hw = hubWobble(t, cur.haloR, reduceMotion);
      const hubX = cur.W / 2 + hw.x;
      const hubY = cur.H / 2 + hw.y;
      if (hubEl) {
        hubEl.style.left = hubX + 'px';
        hubEl.style.top = hubY + 'px';
      }

      // Cluster drift + expansion spring.
      liveClusterCenters = cur.clusterCenters.map((c, ci) => {
        const d = clusterDrift(ci, t, cur.haloR, reduceMotion);
        return { x: c.x + d.x, y: c.y + d.y };
      });
      CONSTELLATION_DATA.forEach((_, ci) => {
        const target = ci === hoveredClusterIdx ? HOVER_EXPANSION : 1;
        expansion[ci] += (target - expansion[ci]) * (reduceMotion ? 1 : EXPAND_SPRING);
      });

      const entryAlpha = (ci: number) => {
        if (reduceMotion) return 1;
        const raw = (t - startedAt - ci * ENTRY_STAGGER_MS) / ENTRY_DUR_MS;
        return clampNum(raw, 0, 1);
      };
      const entryScale = (ci: number) => easeOutCubic(entryAlpha(ci));

      // ---- Nodes: spring toward their live orbit target ----
      cur.nodes.forEach((n) => {
        const center = liveClusterCenters[n.clusterIndex];
        const exp = expansion[n.clusterIndex];
        const wob = reduceMotion ? 0 : Math.sin(t * 0.0006 * n.speed + n.phase) * 10;
        const tx = center.x + Math.cos(n.angle + t * 0.00004) * (n.baseR * exp + wob);
        const ty = center.y + Math.sin(n.angle + t * 0.00004) * (n.baseR * exp + wob);
        const live = liveNodePos.get(n.id)!;
        const springRate = reduceMotion ? 1 : 0.06;
        live.x += (tx - live.x) * springRate;
        live.y += (ty - live.y) * springRate;
      });

      // ---- Edges (spokes + mesh) ----
      cur.edges.forEach((edge, idx) => {
        const a = edge.kind === 'spoke' ? { x: hubX, y: hubY } : liveClusterCenters[edge.a];
        const b = liveClusterCenters[edge.b];
        if (!a || !b) return;
        let ctrl = edge.control;
        if (ctrl && edge.kind !== 'spoke') {
          const driftAx = liveClusterCenters[edge.a].x - cur.clusterCenters[edge.a].x;
          const driftAy = liveClusterCenters[edge.a].y - cur.clusterCenters[edge.a].y;
          const driftBx = liveClusterCenters[edge.b].x - cur.clusterCenters[edge.b].x;
          const driftBy = liveClusterCenters[edge.b].y - cur.clusterCenters[edge.b].y;
          ctrl = { x: ctrl.x + (driftAx + driftBx) / 2, y: ctrl.y + (driftAy + driftBy) / 2 };
        }

        const touchesHovered = edge.a === hoveredClusterIdx || edge.b === hoveredClusterIdx;
        const bothRelatedOrHovered =
          !anyHover ||
          touchesHovered ||
          (edge.kind !== 'spoke' &&
            (RELATED_OF[hoveredClusterIdx]?.includes(edge.a) || edge.a === hoveredClusterIdx) &&
            (RELATED_OF[hoveredClusterIdx]?.includes(edge.b) || edge.b === hoveredClusterIdx));
        const isActive = !anyHover || touchesHovered;

        const startDir = ctrl ? { x: ctrl.x - a.x, y: ctrl.y - a.y } : { x: b.x - a.x, y: b.y - a.y };
        const endDir = ctrl ? { x: b.x - ctrl.x, y: b.y - ctrl.y } : { x: b.x - a.x, y: b.y - a.y };
        const startLen = Math.hypot(startDir.x, startDir.y) || 1;
        const endLen = Math.hypot(endDir.x, endDir.y) || 1;
        const startR = edge.kind === 'spoke' ? cur.haloR * 0.42 : cur.haloR * (expansion[edge.a] || 1);
        const endR = cur.haloR * (expansion[edge.b] || 1);
        const start = { x: a.x + (startDir.x / startLen) * startR, y: a.y + (startDir.y / startLen) * startR };
        const end = { x: b.x - (endDir.x / endLen) * endR, y: b.y - (endDir.y / endLen) * endR };

        let alphaMul = 1;
        if (anyHover) alphaMul = touchesHovered ? 1.3 : bothRelatedOrHovered ? 0.6 : 0.14;
        const baseAlpha = edge.kind === 'spoke' ? 0.16 : edge.kind === 'primary' ? 0.36 : 0.2;
        const alpha = clampNum(baseAlpha * alphaMul + (touchesHovered ? 0.28 : 0), 0, 0.95);

        const path = elRefs.current.get(`edgePath:${idx}`) as SVGPathElement | undefined;
        if (path) {
          const d = ctrl
            ? `M${start.x},${start.y} Q${ctrl.x},${ctrl.y} ${end.x},${end.y}`
            : `M${start.x},${start.y} L${end.x},${end.y}`;
          path.setAttribute('d', d);
          path.setAttribute('stroke-width', String((edge.kind === 'primary' ? 1.6 : edge.kind === 'spoke' ? 0.85 : 1) * (touchesHovered ? 1.25 : 1)));
          path.setAttribute('opacity', String(alpha));
        }

        if (!reduceMotion && isActive) {
          const offset = idx / Math.max(1, cur.edges.length);
          const p = (t / 9000 + offset) % 1;
          const pt = ctrl
            ? quadPoint(p, start.x, start.y, ctrl.x, ctrl.y, end.x, end.y)
            : { x: start.x + (end.x - start.x) * p, y: start.y + (end.y - start.y) * p };
          const glow = elRefs.current.get(`edgeGlow:${idx}`) as SVGCircleElement | undefined;
          if (glow) {
            glow.setAttribute('cx', String(pt.x));
            glow.setAttribute('cy', String(pt.y));
            glow.setAttribute('r', String(touchesHovered ? 2.6 : 2));
            glow.setAttribute('opacity', String(clampNum((touchesHovered ? 1 : 0.85) * warmthGlow, 0, 1)));
            glow.setAttribute('display', '');
          }
        } else {
          const glow = elRefs.current.get(`edgeGlow:${idx}`);
          glow?.setAttribute('display', 'none');
        }
      });

      // ---- Clusters: halo, ring, outline, label, nodes ----
      CONSTELLATION_DATA.forEach((cluster, ci) => {
        const clusterNodes = cur.nodes.filter((n) => n.clusterIndex === ci);
        const center = liveClusterCenters[ci];
        const isHoveredCluster = ci === hoveredClusterIdx;
        const emphasis = !anyHover ? 1 : isHoveredCluster ? 1 : RELATED_OF[hoveredClusterIdx]?.includes(ci) ? 0.75 : 0.16;
        const alpha = entryAlpha(ci) * emphasis;
        const scale = entryScale(ci);
        const drawnHaloR = cur.haloR * expansion[ci];

        const group = elRefs.current.get(`clusterGroup:${ci}`) as SVGGElement | undefined;
        if (group) {
          group.style.opacity = alpha <= 0.006 ? '0' : String(alpha);
          group.style.transformOrigin = `${center.x}px ${center.y}px`;
          group.style.transform = `scale(${scale})`;
        }

        const halo = elRefs.current.get(`halo:${ci}`) as SVGCircleElement | undefined;
        if (halo) {
          halo.setAttribute('cx', String(center.x));
          halo.setAttribute('cy', String(center.y));
          halo.setAttribute('r', String(drawnHaloR));
          halo.setAttribute('opacity', String(isHoveredCluster ? 1.6 : 1));
        }
        const ring = elRefs.current.get(`ring:${ci}`) as SVGCircleElement | undefined;
        if (ring) {
          ring.setAttribute('cx', String(center.x));
          ring.setAttribute('cy', String(center.y));
          ring.setAttribute('r', String(drawnHaloR));
          ring.setAttribute('stroke-width', String(isHoveredCluster ? 1.6 : 1));
          ring.setAttribute('opacity', String(isHoveredCluster ? 1 : 0.7));
        }
        const hit = elRefs.current.get(`haloHit:${ci}`) as SVGCircleElement | undefined;
        if (hit) {
          hit.setAttribute('cx', String(center.x));
          hit.setAttribute('cy', String(center.y));
          hit.setAttribute('r', String(drawnHaloR));
        }

        const outline = elRefs.current.get(`outline:${ci}`) as SVGPolygonElement | undefined;
        if (outline) {
          if (clusterNodes.length >= 2) {
            const pts = clusterNodes.map((n) => {
              const p = liveNodePos.get(n.id)!;
              return `${p.x},${p.y}`;
            });
            outline.setAttribute('points', pts.join(' '));
            outline.setAttribute('stroke-width', String(isHoveredCluster ? 1.6 : 1));
            outline.setAttribute('opacity', String(isHoveredCluster ? 0.65 : 0.4));
          } else {
            outline.setAttribute('points', '');
          }
        }

        // Cluster name label — subject to the text-overlap fade.
        const lp = cur.clusterLabels[ci];
        const labelEl = elRefs.current.get(`clusterLabel:${ci}`) as SVGTextElement | undefined;
        if (lp && labelEl) {
          const lx = center.x + lp.dx;
          const ly = center.y + lp.dy;
          const leftEdge = lp.align === 'right' ? lx - lp.width : lp.align === 'center' ? lx - lp.width / 2 : lx;
          const textFade = textOverlapFade(ly, leftEdge);
          labelEl.setAttribute('x', String(lx));
          labelEl.setAttribute('y', String(ly));
          labelEl.setAttribute('text-anchor', lp.align === 'right' ? 'end' : lp.align === 'center' ? 'middle' : 'start');
          labelEl.setAttribute('dominant-baseline', lp.baseline === 'top' ? 'hanging' : lp.baseline === 'bottom' ? 'text-after-edge' : 'middle');
          labelEl.setAttribute('opacity', String((isHoveredCluster ? 1 : 0.95) * textFade));
        }

        clusterNodes.forEach((n) => {
          const p = liveNodePos.get(n.id)!;
          const isHoveredNode = hoveredNodeId2 === n.id;
          const isNodeActive = isHoveredNode || isHoveredCluster;
          const leftEdge = nodeLeftEdge(n, p.x);
          const textFade = textOverlapFade(p.y, leftEdge);

          const dot = elRefs.current.get(`nodeDot:${n.id}`) as SVGCircleElement | undefined;
          if (dot) {
            dot.setAttribute('cx', String(p.x));
            dot.setAttribute('cy', String(p.y));
            dot.setAttribute('r', String(isHoveredNode ? n.radius * 1.45 : isHoveredCluster ? n.radius * 1.15 : n.radius));
            dot.setAttribute('opacity', String((isNodeActive ? 1 : 0.85) * textFade));
          }
          const hitC = elRefs.current.get(`nodeHit:${n.id}`) as SVGCircleElement | undefined;
          if (hitC) {
            hitC.setAttribute('cx', String(p.x));
            hitC.setAttribute('cy', String(p.y));
          }
          const dirX = n.labelDx === 0 ? 0 : Math.sign(n.labelDx);
          const dirY = n.labelDy === 0 ? 0 : Math.sign(n.labelDy);
          const tickLen = isHoveredNode ? 8 : 6;
          const r = isHoveredNode ? n.radius * 1.45 : isHoveredCluster ? n.radius * 1.15 : n.radius;
          const tick = elRefs.current.get(`nodeTick:${n.id}`) as SVGLineElement | undefined;
          if (tick) {
            tick.setAttribute('x1', String(p.x + dirX * r));
            tick.setAttribute('y1', String(p.y + dirY * r));
            tick.setAttribute('x2', String(p.x + dirX * (r + tickLen)));
            tick.setAttribute('y2', String(p.y + dirY * (r + tickLen)));
            tick.setAttribute('opacity', String((isNodeActive ? 0.85 : cur.isMobile ? 0.3 : 0.45) * textFade));
          }
          const label = elRefs.current.get(`nodeLabel:${n.id}`) as SVGTextElement | undefined;
          if (label) {
            const lx = p.x + n.labelDx;
            const ly = p.y + n.labelDy;
            label.setAttribute('x', String(lx));
            label.setAttribute('y', String(ly));
            label.setAttribute('opacity', String((isNodeActive ? 0.95 : cur.isMobile ? 0.32 : 0.6) * textFade));
          }
        });
      });
    }

    resize();
    rafId = requestAnimationFrame(frame);

    return () => {
      resizeObserver.disconnect();
      textObserver?.disconnect();
      io.disconnect();
      hubEl?.removeEventListener('mouseenter', onHubEnter);
      hubEl?.removeEventListener('mouseleave', onHubLeave);
      if (rafId) cancelAnimationFrame(rafId);
      hideTooltip();
    };
  }, [panelRef, textRef, hourWarmth]);

  function showTooltip(e: React.MouseEvent, node: ConstellationNode, info?: string) {
    const tooltipEl = tooltipRef.current;
    const panelEl = panelRef.current;
    if (!tooltipEl || !panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    const titleEl = tooltipEl.querySelector('.graph-tooltip-title');
    const infoEl = tooltipEl.querySelector('.graph-tooltip-info') as HTMLElement | null;
    if (titleEl) titleEl.textContent = node.label;
    if (infoEl) {
      infoEl.textContent = info || '';
      infoEl.style.display = info ? '' : 'none';
    }
    tooltipEl.style.left = e.clientX - rect.left + 'px';
    tooltipEl.style.top = e.clientY - rect.top + 'px';
    tooltipEl.classList.add('is-visible');
  }
  function moveTooltip(e: React.MouseEvent) {
    const tooltipEl = tooltipRef.current;
    const panelEl = panelRef.current;
    if (!tooltipEl || !panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    tooltipEl.style.left = e.clientX - rect.left + 'px';
    tooltipEl.style.top = e.clientY - rect.top + 'px';
  }
  function hideTooltip() {
    tooltipRef.current?.classList.remove('is-visible');
  }

  const W = layout?.W ?? 0;
  const H = layout?.H ?? 0;

  return (
    <>
      <motion.svg
        ref={svgRef}
        className="constellation-svg"
        viewBox={`0 0 ${Math.max(1, W)} ${Math.max(1, H)}`}
        width="100%"
        height="100%"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: layout ? 1 : 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <defs>
          {CONSTELLATION_DATA.map((c) => (
            <radialGradient id={`halo-grad-${c.id}`} key={c.id}>
              <stop offset="0%" stopColor={c.hue} stopOpacity="0.22" />
              <stop offset="100%" stopColor={c.hue} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {layout?.edges.map((edge, idx) => (
          <g key={`edge-${idx}`}>
            <path
              ref={setRef(`edgePath:${idx}`)}
              className={'constellation-edge' + (edge.kind === 'spoke' ? ' is-spoke' : '') + (edge.kind === 'secondary' ? ' is-dashed' : '')}
              fill="none"
              style={{ '--hue': edge.hue } as CSSProperties}
            />
            <circle ref={setRef(`edgeGlow:${idx}`)} className="constellation-edge-glow" style={{ '--hue': edge.hue } as CSSProperties} />
          </g>
        ))}

        {CONSTELLATION_DATA.map((cluster, ci) => (
          <motion.g
            key={cluster.id}
            ref={setRef(`clusterGroup:${ci}`)}
            className="constellation-cluster"
            style={{ '--hue': cluster.hue } as CSSProperties}
            onMouseEnter={() => setHoveredCluster(ci)}
            onMouseLeave={() => setHoveredCluster((c) => (c === ci ? -1 : c))}
          >
            <circle ref={setRef(`haloHit:${ci}`)} className="constellation-halo-hit" fill="transparent" />
            <circle ref={setRef(`halo:${ci}`)} className="constellation-halo" fill={`url(#halo-grad-${cluster.id})`} />
            <circle ref={setRef(`ring:${ci}`)} className="constellation-ring" fill="none" />
            <polygon ref={setRef(`outline:${ci}`)} className="constellation-outline" fill="none" />
            <text ref={setRef(`clusterLabel:${ci}`)} className="constellation-cluster-label">
              {cluster.name}
            </text>

            {nodesByCluster[ci]?.map((node) => {
              return (
                <motion.g
                  key={node.id}
                  className="constellation-node"
                  whileHover={{ scale: 1.08 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  onMouseEnter={(e) => {
                    setHoveredNodeId(node.id);
                    showTooltip(e, node, CONSTELLATION_INFO[node.label]);
                  }}
                  onMouseMove={moveTooltip}
                  onMouseLeave={() => {
                    setHoveredNodeId((id) => (id === node.id ? null : id));
                    hideTooltip();
                  }}
                >
                  <circle ref={setRef(`nodeHit:${node.id}`)} className="constellation-node-hit" fill="transparent" r={16} />
                  <line ref={setRef(`nodeTick:${node.id}`)} className="constellation-node-tick" />
                  <circle ref={setRef(`nodeDot:${node.id}`)} className="constellation-node-dot" />
                  <text ref={setRef(`nodeLabel:${node.id}`)} className="constellation-node-label" textAnchor={node.labelAlign === 'right' ? 'end' : node.labelAlign === 'center' ? 'middle' : 'start'} dominantBaseline="middle">
                    {layout?.isMobile ? node.shortLabel : node.label}
                  </text>
                </motion.g>
              );
            })}
          </motion.g>
        ))}
      </motion.svg>

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
