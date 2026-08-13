'use client';

/* ==========================================================
   SKILL GRAPH — an organic constellation of skill clusters,
   connected to each other (no center hub / avatar in this design).

   - Cluster positions are NOT stored in data: they're scattered
     deterministically (a seeded spiral, not Math.random — stable
     across reloads) then relaxed apart with a light repulsion pass
     so no two halos ever overlap and nothing clips the panel edge,
     at any width or cluster count. Add/remove/reorder a cluster in
     lib/content.ts and this just re-settles around it.
   - Every label (cluster name + each skill node) is placed by a
     small collision solver: it tries a few candidate positions
     around its anchor and picks whichever collides least with
     other labels and with neighboring clusters' halos — this is
     what keeps things like "OpenAI Codex" and "Claude Code" from
     ever landing on top of each other.
   - Cross-cluster connections (SKILL_CONNECTIONS in content.ts)
     draw between the two clusters' outer edges, with a subtle
     traveling glow on every line, brighter on hover.
   - Hover (mouse or touch) pops the cluster/node, glows its lines,
     and — on mobile, where labels are abbreviated — shows the full
     name in a small tooltip.
   ========================================================== */

import { useEffect, useRef } from 'react';
import { SKILL_ABBREVIATIONS, SKILL_CONNECTIONS, SKILL_GRAPH } from '@/lib/content';
import { abbreviateSkill, clamp, hexToRgba, legibleHue, prefersReducedMotion } from '@/lib/utils';

const ENTRY_STAGGER_MS = 80;
const ENTRY_DUR_MS = 560;

type Align = 'left' | 'right' | 'center';

type Node = {
  label: string;
  shortLabel: string;
  hue: string;
  cx: number;
  cy: number;
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
type Edge = { a: number; b: number; hue: string };
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

export default function SkillGraphCanvas({
  panelRef,
  hourWarmth = 0,
}: {
  panelRef: React.RefObject<HTMLElement | null>;
  hourWarmth?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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
    let clusterLabels: ClusterLabelPlan[] = [];
    const mouse = { x: -9999, y: -9999 };
    const reduceMotion = prefersReducedMotion();
    let panelVisible = true;
    let hoveredNode: Node | null = null;
    let hoveredCluster = -1;
    let rafId: number | null = null;
    const mountedAt = performance.now();

    const idIndex = new Map(SKILL_GRAPH.map((c, i) => [c.id, i]));
    const edges: Edge[] = [];
    SKILL_CONNECTIONS.forEach(([fromId, toId]) => {
      const a = idIndex.get(fromId);
      const b = idIndex.get(toId);
      if (a === undefined || b === undefined) return;
      edges.push({ a, b, hue: SKILL_GRAPH[a].hue });
    });

    function clampNum(n: number, min: number, max: number) {
      return Math.min(Math.max(n, min), max);
    }

    /* Deterministic organic scatter: a golden-angle spiral seed (never
       a perfect ring, never a grid) relaxed apart with simple pairwise
       repulsion + edge containment until nothing overlaps or clips. */
    function computeOrganicPositions(): { x: number; y: number }[] {
      const count = SKILL_GRAPH.length;
      const cx = W / 2;
      const cy = H / 2;
      const golden = Math.PI * (3 - Math.sqrt(5));
      const seedR = Math.min(W, H) * 0.3;
      const positions = SKILL_GRAPH.map((_, i) => {
        const t = (i + 0.5) / count;
        const r = Math.sqrt(t) * seedR;
        const theta = i * golden + Math.sin(i * 1.9) * 0.35;
        return { x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r * 0.9 };
      });

      const gapPx = isMobile ? 10 : 20;
      const minSep = haloR * 2 + gapPx;
      const labelRoom = isMobile ? 34 : 88;
      const marginX = clampNum(haloR + labelRoom, 0, W / 2 - 4);
      const marginY = clampNum(haloR + (isMobile ? 20 : 40), 0, H / 2 - 4);

      for (let iter = 0; iter < 90; iter++) {
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const dx = positions[j].x - positions[i].x;
            const dy = positions[j].y - positions[i].y;
            let dist = Math.hypot(dx, dy);
            if (dist < 0.001) dist = 0.001;
            if (dist < minSep) {
              const push = (minSep - dist) / 2;
              const ux = dx / dist;
              const uy = dy / dist;
              positions[i].x -= ux * push;
              positions[i].y -= uy * push;
              positions[j].x += ux * push;
              positions[j].y += uy * push;
            }
          }
        }
        positions.forEach((p) => {
          p.x = clampNum(p.x, marginX, Math.max(marginX, W - marginX));
          p.y = clampNum(p.y, marginY, Math.max(marginY, H - marginY));
        });
      }
      return positions;
    }

    /* Collision-avoiding label placement, run once per layout (not every
       frame — idle motion is subtle enough that a static, well-chosen
       position holds up fine, and re-solving every frame would make
       labels jitter between candidates for no visual benefit). */
    function planLabels() {
      const placedLabels: Rect[] = [];
      const haloBoxes = clusterCenters.map((c) => ({ x: c.x - haloR, y: c.y - haloR, w: haloR * 2, h: haloR * 2 }));

      function bestCandidate(
        candidates: { rect: Rect; meta: any }[],
        excludeHaloIndex: number
      ): any {
        let best = candidates[0].meta;
        let bestScore = Infinity;
        for (const { rect, meta } of candidates) {
          let score = 0;
          haloBoxes.forEach((box, hi) => {
            if (hi === excludeHaloIndex) return;
            score += rectsOverlapArea(rect, box);
          });
          placedLabels.forEach((r) => (score += rectsOverlapArea(rect, r) * 3));
          const oob =
            Math.max(0, -rect.x) + Math.max(0, -rect.y) + Math.max(0, rect.x + rect.w - W) + Math.max(0, rect.y + rect.h - H);
          score += oob * 60;
          if (score < bestScore) {
            bestScore = score;
            best = meta;
            best.__rect = rect;
          }
          if (score === 0) break;
        }
        placedLabels.push(best.__rect);
        return best;
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
        const sides: { dx: number; dy: number; align: Align; baseline: CanvasTextBaseline }[] =
          cluster.labelSide
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
        return bestCandidate(candidates, ci) as ClusterLabelPlan;
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
      // No hub competing for center space in this design, so halos can
      // claim a bit more of the panel than the old hub-centric version.
      haloR = isMobile ? clampNum(W * 0.1, 20, 44) : clampNum(W * 0.115, 48, 92);

      clusterCenters = computeOrganicPositions();

      nodes = [];
      const spread = haloR * 0.5;
      SKILL_GRAPH.forEach((cluster, ci) => {
        const { x: cx, y: cy } = clusterCenters[ci];
        const n = cluster.skills.length;
        cluster.skills.forEach((label, i) => {
          const angle = (i / n) * Math.PI * 2 + ci * 1.3;
          const x = cx + Math.cos(angle) * spread;
          const y = cy + Math.sin(angle) * spread;
          nodes.push({
            label,
            shortLabel: abbreviateSkill(label, SKILL_ABBREVIATIONS),
            hue: cluster.hue,
            cx,
            cy,
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
      if (!isMobile || !hoveredNode) {
        hideTooltip();
        return;
      }
      const rect = panelEl!.getBoundingClientRect();
      tooltipEl.textContent = hoveredNode.label;
      tooltipEl.style.left = clientX - rect.left + 'px';
      tooltipEl.style.top = clientY - rect.top + 'px';
      tooltipEl.classList.add('is-visible');
    }

    function updateHover(clientX: number, clientY: number) {
      let hc = -1;
      let minD = Infinity;
      clusterCenters.forEach((c, i) => {
        const d = Math.hypot(c.x - mouse.x, c.y - mouse.y);
        if (d < haloR && d < minD) {
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

    const io = new IntersectionObserver(
      ([entry]) => {
        panelVisible = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(panelEl);

    let textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#F4F5F7';
    let isLight = document.documentElement.dataset.theme === 'light';
    const themeObserver = new MutationObserver(() => {
      textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || textColor;
      isLight = document.documentElement.dataset.theme === 'light';
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Warmth nudges only the traveling pulse glow's alpha, never the
    // cluster hues themselves — subtle by design, legible in both themes.
    const warmthGlow = 0.75 + hourWarmth * 0.15;

    function drawEdges(t: number, renderCenters: { x: number; y: number }[]) {
      edges.forEach((edge, idx) => {
        const a = renderCenters[edge.a];
        const b = renderCenters[edge.b];
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const start = { x: a.x + ux * haloR, y: a.y + uy * haloR };
        const end = { x: b.x - ux * haloR, y: b.y - uy * haloR };

        const isActive = edge.a === hoveredCluster || edge.b === hoveredCluster;

        ctx!.strokeStyle = isActive
          ? hexToRgba(legibleHue(edge.hue, isLight), isLight ? 0.85 : 0.75)
          : isLight
            ? 'rgba(70,75,95,0.22)'
            : 'rgba(150,150,170,0.10)';
        ctx!.lineWidth = isActive ? 2 : 1;
        ctx!.beginPath();
        ctx!.moveTo(start.x, start.y);
        ctx!.lineTo(end.x, end.y);
        ctx!.stroke();

        if (reduceMotion) return;

        // Ambient traveling glow — subtle on every line, brighter + a
        // touch bigger while the line's cluster is hovered.
        const offset = idx / Math.max(1, edges.length);
        const p = (t / 9000 + offset) % 1;
        const px = start.x + (end.x - start.x) * p;
        const py = start.y + (end.y - start.y) * p;
        const glowHue = edge.hue;
        const glowR = isActive ? 9 : 6;

        const grad = ctx!.createRadialGradient(px, py, 0, px, py, glowR);
        grad.addColorStop(0, hexToRgba(glowHue, warmthGlow * (isActive ? 1.15 : 1)));
        grad.addColorStop(1, hexToRgba(glowHue, 0));
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(px, py, glowR, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = hexToRgba(glowHue, 0.85);
        ctx!.beginPath();
        ctx!.arc(px, py, isActive ? 2.4 : 1.8, 0, Math.PI * 2);
        ctx!.fill();
      });
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, W, H);

      // Entry: each cluster fades + scales in, in place, staggered.
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
        const wob = reduceMotion ? 0 : Math.sin(t * 0.0006 * node.speed + node.phase) * 10;
        let tx = node.cx + Math.cos(node.angle + t * 0.00004) * (node.baseR + wob);
        let ty = node.cy + Math.sin(node.angle + t * 0.00004) * (node.baseR + wob);
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

      drawEdges(t, clusterCenters);

      SKILL_GRAPH.forEach((cluster, ci) => {
        const clusterNodes = nodes.filter((n) => n.clusterIndex === ci);
        const hue = cluster.hue;
        const { x: avgX, y: avgY } = clusterCenters[ci];
        const isActive = ci === hoveredCluster;
        const scale = entryT(ci);
        const alpha = entryAlpha(ci);
        if (alpha <= 0.001) return;

        ctx!.save();
        ctx!.globalAlpha = alpha;
        ctx!.translate(avgX, avgY);
        ctx!.scale(scale, scale);
        ctx!.translate(-avgX, -avgY);

        const grad = ctx!.createRadialGradient(avgX, avgY, 0, avgX, avgY, haloR);
        grad.addColorStop(0, hexToRgba(hue, (isLight ? 0.26 : 0.13) * (isActive ? 1.8 : 1)));
        grad.addColorStop(1, hexToRgba(hue, 0));
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(avgX, avgY, haloR, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.save();
        ctx!.setLineDash([6, 5]);
        ctx!.strokeStyle = hexToRgba(legibleHue(hue, isLight), (isLight ? 0.6 : 0.5) + (isActive ? 0.3 : 0));
        ctx!.lineWidth = isActive ? 1.6 : 1;
        ctx!.beginPath();
        ctx!.arc(avgX, avgY, haloR, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();

        ctx!.strokeStyle = hexToRgba(legibleHue(hue, isLight), (isLight ? 0.55 : 0.4) + (isActive ? 0.25 : 0));
        ctx!.lineWidth = isActive ? 1.6 : 1;
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
          const isHovered = hoveredNode === n;
          const isNodeActive = isHovered || isActive;
          const r = isHovered ? n.radius * 1.45 : isActive ? n.radius * 1.15 : n.radius;
          if (isNodeActive) {
            ctx!.save();
            ctx!.shadowColor = hexToRgba(legibleHue(hue, isLight), 0.9);
            ctx!.shadowBlur = isHovered ? 14 : 8;
          }
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = hexToRgba(hue, isNodeActive ? 1 : 0.85);
          ctx!.fill();
          ctx!.lineWidth = isHovered ? 2 : 1.4;
          ctx!.strokeStyle = hexToRgba(legibleHue(hue, isLight), 1);
          ctx!.stroke();
          if (isNodeActive) ctx!.restore();

          const text = isMobile ? n.shortLabel : n.label;
          ctx!.font = isHovered
            ? `700 ${isMobile ? 10.5 : 12.5}px 'JetBrains Mono', monospace`
            : `${isMobile ? 600 : 500} ${isMobile ? 9.5 : 11}px 'JetBrains Mono', monospace`;
          ctx!.fillStyle = hexToRgba(textColor, isNodeActive ? 0.95 : isMobile ? 0.7 : 0.6);
          ctx!.textAlign = n.labelAlign;
          ctx!.textBaseline = 'middle';
          ctx!.fillText(text, n.x + n.labelDx, n.y + n.labelDy);
        });

        const lp = clusterLabels[ci];
        if (lp) {
          ctx!.font = isActive
            ? `700 ${isMobile ? 11.5 : 12.5}px 'JetBrains Mono', monospace`
            : `700 ${isMobile ? 10.5 : 11}px 'JetBrains Mono', monospace`;
          ctx!.fillStyle = hexToRgba(legibleHue(hue, isLight), isActive ? 1 : 0.95);
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
    if (reduceMotion) {
      draw(mountedAt);
    } else {
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      panelEl.removeEventListener('touchmove', onTouchMove);
      panelEl.removeEventListener('touchend', onTouchEnd);
      io.disconnect();
      themeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [hourWarmth, panelRef]);

  return (
    <>
      <canvas id="graphCanvas" ref={canvasRef} aria-hidden="true" />
      <div className="graph-tooltip" id="graphTooltip" ref={tooltipRef} />
    </>
  );
}
