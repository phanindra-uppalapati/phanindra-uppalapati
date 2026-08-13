'use client';

/* ==========================================================
   MIGRATION PIPELINE — a two-lane workflow story, not a flowchart.
   Visually this borrows directly from FlowDiagram: small circle
   nodes with an icon and a label underneath, smooth S-curve edges,
   a single narrated caption below the diagram, and the exact same
   flow-edge/flow-node/flow-caption CSS classes — so it reads as
   part of the same design system instead of a separate exercise.

   The story is sequential (not a spine-into-branches like
   FlowDiagram's other use), so a small "walking pointer" advances
   node by node: the current node glows, the edge that led into it
   marches, then it moves on. Two lanes (agent / developer) make it
   obvious at a glance who is driving each step — the path dips into
   the developer lane exactly once, for approval, which is the whole
   point of this diagram.
   ========================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PipelineData, PipelineStep } from '@/lib/content';
import { prefersReducedMotion } from '@/lib/utils';

const VB_W = 460;
const VB_H = 210;
const AGENT_Y = 66;
const DEV_Y = 156;
const CYCLE_MS = 2200;
const R = 16; // node radius — same as FlowDiagram

type LaidOutStep = PipelineStep & { x: number; y: number };

function layout(steps: PipelineStep[]): LaidOutStep[] {
  const n = steps.length;
  const x0 = 42;
  const x1 = 418;
  return steps.map((s, i) => ({
    ...s,
    x: n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : x0,
    y: s.lane === 'developer' ? DEV_Y : AGENT_Y,
  }));
}

// Identical formula to FlowDiagram's edgePath — the same smooth S-curve,
// which happens to also read perfectly as a lane change when a.y !== b.y.
function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
}

export default function MigrationPipeline({ pipeline }: { pipeline: PipelineData }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const nodes = useMemo(() => layout(pipeline.steps), [pipeline.steps]);
  const approveIndex = useMemo(() => Math.max(0, nodes.findIndex((n) => n.id === 'approve')), [nodes]);

  const [activeIndex, setActiveIndex] = useState(() => (prefersReducedMotion() ? approveIndex : 0));
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || reduced || nodes.length < 2) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => setActiveIndex((i) => (i + 1) % nodes.length), CYCLE_MS);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeStep = nodes[activeIndex];
  const hue = activeStep?.lane === 'developer' ? 'var(--accent-2)' : 'var(--accent)';
  const openStep = openId ? nodes.find((n) => n.id === openId) : null;
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="pipeline-mount" ref={mountRef}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="pipeline-svg2" role="img" aria-label={pipeline.ariaLabel}>
        {/* Edges — one per consecutive pair; edge i lights up once we've arrived at node i+1 */}
        {nodes.slice(0, -1).map((n, i) => {
          const next = nodes[i + 1];
          const d = edgePath(n, next);
          const active = activeIndex === i + 1;
          return (
            <g key={`${n.id}-${next.id}`} className={'flow-edge pipeline-step-edge' + (active ? ' is-active' : '')}>
              <path d={d} className="flow-edge-base" stroke={next.lane === 'developer' ? 'var(--accent-2)' : 'var(--accent)'} />
              {!reduced && <path d={d} className="flow-edge-flow" stroke={next.lane === 'developer' ? 'var(--accent-2)' : 'var(--accent)'} />}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const active = i === activeIndex;
          const open = openId === n.id;
          const nodeHue = n.lane === 'developer' ? 'var(--accent-2)' : 'var(--accent)';
          const clickable = Boolean(n.detail);
          return (
            <g
              key={n.id}
              className={
                'flow-node flow-node-outcome pipeline-step-node' +
                (active ? ' is-active' : '') +
                (open ? ' is-open' : '') +
                (clickable ? ' is-clickable' : '')
              }
              transform={`translate(${n.x},${n.y})`}
              style={{ '--node-hue': nodeHue } as React.CSSProperties}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-expanded={clickable ? open : undefined}
              aria-label={clickable ? `${n.label} — click for details` : n.label}
              onClick={clickable ? () => toggle(n.id) : undefined}
              onKeyDown={
                clickable
                  ? (ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        toggle(n.id);
                      }
                    }
                  : undefined
              }
            >
              <circle r={R} fill="var(--surface)" stroke={nodeHue} strokeWidth={active || open ? 2.4 : 1.6} />
              <text textAnchor="middle" dy="5" fontSize="15">{n.icon}</text>
              <text textAnchor="middle" y={30} fontSize="9.5" className="pipeline-step-label">{n.label}</text>
            </g>
          );
        })}
      </svg>

      <p key={activeIndex} className="flow-caption pipeline-caption flash" style={{ '--flow-hue': hue } as React.CSSProperties}>
        {activeStep?.caption}
      </p>

      <div className="pipeline-legend">
        <span className="pipeline-legend-dot" style={{ background: 'var(--accent)' }} />
        {pipeline.legend.agent}
        <span className="pipeline-legend-dot" style={{ background: 'var(--accent-2)' }} />
        {pipeline.legend.developer}
      </div>

      {openStep?.detail && (
        <div className="pipeline-detail" role="region" aria-label={`${openStep.label} details`}>
          <p><strong>{openStep.label} — </strong>{openStep.detail}</p>
        </div>
      )}
    </div>
  );
}
