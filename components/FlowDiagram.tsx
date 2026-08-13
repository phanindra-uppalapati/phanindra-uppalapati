'use client';

/* ==========================================================
   FLOW DIAGRAM
   A generic renderer for "pipeline → confidence router → outcomes"
   style diagrams. Layout is computed from data (spine step count,
   outcome count) — nothing here is hand-placed per project.
   Animation is a single setInterval swapping which outcome/loop
   group has the `.is-active` class.
   ========================================================== */

import { useEffect, useRef } from 'react';
import type { Flow } from '@/lib/content';
import { prefersReducedMotion } from '@/lib/utils';

const VB_W = 400;
const VB_H = 200;
const SVG_NS = 'http://www.w3.org/2000/svg';
const CYCLE_MS = 4500;

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | undefined> = {}
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  Object.entries(attrs).forEach(([k, v]) => {
    if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  });
  return e;
}

type Pt = { x: number; y: number };

function edgePath(a: Pt, b: Pt) {
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
}

function loopPath(from: Pt, to: Pt) {
  const dipY = VB_H - 10;
  return `M ${from.x} ${from.y} C ${from.x} ${dipY}, ${to.x} ${dipY}, ${to.x} ${to.y}`;
}

function computeLayout(flow: Flow) {
  const n = flow.spine.length;
  const x0 = 34;
  const x1 = 200;
  const spineNodes = flow.spine.map((node, i) => ({
    ...node,
    x: n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : x0,
    y: 100,
  }));
  const oc = flow.outcomes.length;
  const outcomeNodes = flow.outcomes.map((node, i) => ({
    ...node,
    x: 362,
    y: oc > 1 ? 36 + (128 * i) / (oc - 1) : 100,
  }));
  return { spineNodes, outcomeNodes };
}

function buildNode(n: { x: number; y: number; icon?: string; label: string; hue?: string }, kind: 'spine' | 'router' | 'outcome') {
  const g = svgEl('g', {
    class: 'flow-node' + (kind === 'outcome' ? ' flow-node-outcome' : kind === 'router' ? ' flow-node-router' : ''),
    transform: `translate(${n.x},${n.y})`,
  });
  if (n.hue) g.style.setProperty('--node-hue', n.hue);
  const circle = svgEl('circle', { r: 16, fill: 'var(--surface)', stroke: n.hue || 'var(--accent)', 'stroke-width': 1.6 });
  g.appendChild(circle);
  const icon = svgEl('text', { 'text-anchor': 'middle', dy: '5', 'font-size': '15' });
  icon.textContent = n.icon || '';
  g.appendChild(icon);
  const label = svgEl('text', {
    'text-anchor': 'middle',
    y: 30,
    'font-size': '9',
    'font-family': "'JetBrains Mono', monospace",
    fill: 'var(--text-secondary)',
  });
  label.textContent = n.label;
  g.appendChild(label);
  return g;
}

function buildEdge(d: string, hue: string | undefined, extraClass: string) {
  const g = svgEl('g', { class: 'flow-edge' + (extraClass ? ' ' + extraClass : '') });
  g.appendChild(svgEl('path', { d, class: 'flow-edge-base', stroke: hue || 'var(--border-strong)' }));
  g.appendChild(svgEl('path', { d, class: 'flow-edge-flow', stroke: hue || 'var(--accent)' }));
  return g;
}

export default function FlowDiagram({ flow }: { flow: Flow }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.innerHTML = '';

    const { spineNodes, outcomeNodes } = computeLayout(flow);
    const svg = svgEl('svg', { viewBox: `0 0 ${VB_W} ${VB_H}`, role: 'img', 'aria-label': flow.ariaLabel || 'Animated workflow diagram' });

    for (let i = 0; i < spineNodes.length - 1; i++) {
      svg.appendChild(buildEdge(edgePath(spineNodes[i], spineNodes[i + 1]), undefined, 'flow-edge-spine'));
    }

    const router = spineNodes[spineNodes.length - 1];
    const outcomeEdgeEls: Record<string, SVGGElement> = {};
    flow.outcomes.forEach((o, i) => {
      const g = buildEdge(edgePath(router, outcomeNodes[i]), o.hue, 'flow-edge-branch');
      svg.appendChild(g);
      outcomeEdgeEls[o.id] = g;
    });

    const loopEdgeEls: Record<string, SVGGElement> = {};
    flow.outcomes.forEach((o, i) => {
      if (!o.loopsTo) return;
      const target = spineNodes.find((s) => s.id === o.loopsTo);
      if (!target) return;
      const g = buildEdge(loopPath(outcomeNodes[i], target), o.hue, 'flow-edge-loop');
      svg.appendChild(g);
      loopEdgeEls[o.id] = g;
    });

    spineNodes.forEach((n, i) => svg.appendChild(buildNode(n, i === spineNodes.length - 1 ? 'router' : 'spine')));
    const outcomeNodeEls: Record<string, SVGGElement> = {};
    outcomeNodes.forEach((n, i) => {
      const g = buildNode(n, 'outcome');
      svg.appendChild(g);
      outcomeNodeEls[flow.outcomes[i].id] = g;
    });

    mount.appendChild(svg);

    const caption = document.createElement('p');
    caption.className = 'flow-caption';
    mount.appendChild(caption);

    function showState(state: { outcome: string; label: string }) {
      const outcomeData = flow.outcomes.find((o) => o.id === state.outcome);
      Object.entries(outcomeEdgeEls).forEach(([id, g]) => g.classList.toggle('is-active', id === state.outcome));
      Object.entries(outcomeNodeEls).forEach(([id, g]) => g.classList.toggle('is-active', id === state.outcome));
      Object.entries(loopEdgeEls).forEach(([id, g]) => g.classList.toggle('is-active', id === state.outcome));
      caption.style.setProperty('--flow-hue', outcomeData ? outcomeData.hue : 'var(--accent)');
      caption.textContent = state.label;
      caption.classList.remove('flash');
      void caption.offsetWidth; // restart the fade-in transition
      caption.classList.add('flash');
    }

    if (!flow.demoStates || !flow.demoStates.length) return;
    let idx = 0;
    showState(flow.demoStates[0]);
    if (flow.demoStates.length < 2 || prefersReducedMotion()) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer)
        timer = setInterval(() => {
          idx = (idx + 1) % flow.demoStates.length;
          showState(flow.demoStates[idx]);
        }, CYCLE_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { threshold: 0.2 });
    io.observe(mount);

    return () => {
      stop();
      io.disconnect();
    };
  }, [flow]);

  return <div className="flow-mount" aria-hidden="true" ref={mountRef} />;
}
