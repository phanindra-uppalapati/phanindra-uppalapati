'use client';

/* ==========================================================
   MIGRATION PIPELINE — a two-lane workflow story, not a flowchart.
   Visually this borrows directly from FlowDiagram: small circle
   nodes with an icon and a label underneath, smooth S-curve edges,
   a single narrated caption below the diagram, and the exact same
   flow-edge/flow-node/flow-caption CSS classes — so it reads as
   part of the same design system instead of a separate exercise.

   The main path (analyze → migrate → validate → approve → checks →
   promote → live) sits on one straight line — lane color still marks
   Approve as the one step a human drives, but nothing dips down for
   it anymore. What *does* live below the line is Fix: the failure-
   remediation loop. It's laid out directly under Approve, connected
   by a branch edge in from Checks and a loop edge back out to
   Validate — the same branch/loop edge language FlowDiagram uses for
   its own conditional paths.

   A single walking pointer advances step by step and alternates
   full passes: one clean run straight through, then one run that
   detours through the failure loop (Checks → Fix → Validate →
   Approve → Checks again) before continuing on to Promote/Live —
   so the loop actually plays out periodically instead of just
   sitting there as decoration.
   ========================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PipelineData, PipelineStep } from '@/lib/content';
import { prefersReducedMotion } from '@/lib/utils';

const VB_W = 460;
const VB_H = 210;
const MAIN_Y = 66; // the single straight line: analyze…live, including approve
const LOOP_Y = 156; // Fix sits below, centered under Approve
const CYCLE_MS = 1500; // per-step timing (a full failure pass is 11 steps)
const R = 16; // node radius — same as FlowDiagram

type LaidOutStep = PipelineStep & { x: number; y: number };

function layout(steps: PipelineStep[]): LaidOutStep[] {
  const mainSteps = steps.filter((s) => s.role !== 'branch');
  const n = mainSteps.length;
  const x0 = 42;
  const x1 = 418;
  const mainLaidOut: LaidOutStep[] = mainSteps.map((s, i) => ({
    ...s,
    x: n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : x0,
    y: MAIN_Y,
  }));
  const approveX = mainLaidOut.find((s) => s.id === 'approve')?.x ?? (x0 + x1) / 2;
  const branchLaidOut: LaidOutStep[] = steps
    .filter((s) => s.role === 'branch')
    .map((s) => ({ ...s, x: approveX, y: LOOP_Y }));
  return [...mainLaidOut, ...branchLaidOut];
}

// Identical formula to FlowDiagram's edgePath — the same smooth S-curve.
function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
}

type Edge = { id: string; from: string; to: string; kind: 'main' | 'branch' | 'loop' };

export default function MigrationPipeline({ pipeline }: { pipeline: PipelineData }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const nodes = useMemo(() => layout(pipeline.steps), [pipeline.steps]);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const mainNodes = useMemo(() => nodes.filter((n) => n.role !== 'branch'), [nodes]);
  const fixNode = useMemo(() => nodes.find((n) => n.role === 'branch') ?? null, [nodes]);

  // Two full-pass paths the walking pointer alternates between.
  const happyPath = useMemo(() => mainNodes.map((n) => n.id), [mainNodes]);
  const failurePath = useMemo(() => {
    if (!fixNode) return happyPath;
    const iValidate = mainNodes.findIndex((n) => n.id === 'validate');
    const iChecks = mainNodes.findIndex((n) => n.id === 'checks');
    if (iValidate < 0 || iChecks < 0) return happyPath;
    const before = mainNodes.slice(0, iChecks + 1).map((n) => n.id); // …validate, approve, checks
    const retry = mainNodes.slice(iValidate, iChecks + 1).map((n) => n.id); // validate, approve, checks
    const after = mainNodes.slice(iChecks + 1).map((n) => n.id); // promote, live
    return [...before, fixNode.id, ...retry, ...after];
  }, [mainNodes, fixNode, happyPath]);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    for (let i = 0; i < mainNodes.length - 1; i++) {
      list.push({ id: `${mainNodes[i].id}-${mainNodes[i + 1].id}`, from: mainNodes[i].id, to: mainNodes[i + 1].id, kind: 'main' });
    }
    if (fixNode) {
      list.push({ id: 'checks-fix', from: 'checks', to: fixNode.id, kind: 'branch' });
      list.push({ id: 'fix-validate', from: fixNode.id, to: 'validate', kind: 'loop' });
    }
    return list;
  }, [mainNodes, fixNode]);

  // play.parity 0 = happy pass, 1 = failure pass; play.index = position within that pass's path.
  const [play, setPlay] = useState<{ parity: 0 | 1; index: number }>({ parity: 0, index: 0 });
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || reduced || happyPath.length < 2) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer)
        timer = setInterval(() => {
          setPlay((prev) => {
            const path = prev.parity === 0 ? happyPath : failurePath;
            const nextIndex = prev.index + 1;
            if (nextIndex >= path.length) {
              return { parity: prev.parity === 0 ? 1 : 0, index: 0 };
            }
            return { ...prev, index: nextIndex };
          });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, happyPath, failurePath]);

  const currentPath = play.parity === 0 ? happyPath : failurePath;
  const activeId = reduced ? 'approve' : currentPath[play.index] ?? currentPath[0];
  const prevId = reduced ? 'validate' : play.index > 0 ? currentPath[play.index - 1] : null;
  const activeStep = nodesById.get(activeId) ?? mainNodes[0];
  const hue = activeStep?.lane === 'developer' ? 'var(--accent-2)' : 'var(--accent)';
  const openStep = openId ? nodesById.get(openId) : null;
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="pipeline-mount" ref={mountRef}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="pipeline-svg2" role="img" aria-label={pipeline.ariaLabel}>
        {/* Edges */}
        {edges.map((e) => {
          const a = nodesById.get(e.from);
          const b = nodesById.get(e.to);
          if (!a || !b) return null;
          const d = edgePath(a, b);
          const active = prevId === e.from && activeId === e.to;
          const edgeClass =
            e.kind === 'main'
              ? 'pipeline-step-edge'
              : e.kind === 'branch'
              ? 'pipeline-step-edge pipeline-branch-edge'
              : 'pipeline-step-edge pipeline-loop-edge';
          const strokeHue = b.lane === 'developer' ? 'var(--accent-2)' : 'var(--accent)';
          return (
            <g key={e.id} className={edgeClass + (active ? ' is-active' : '')}>
              <path d={d} className="flow-edge-base" stroke={strokeHue} />
              {!reduced && <path d={d} className="flow-edge-flow" stroke={strokeHue} />}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const active = n.id === activeId;
          const open = openId === n.id;
          const nodeHue = n.lane === 'developer' ? 'var(--accent-2)' : 'var(--accent)';
          const clickable = Boolean(n.detail);
          return (
            <g
              key={n.id}
              className={
                'flow-node flow-node-outcome pipeline-step-node' +
                (n.role === 'branch' ? ' pipeline-branch-node' : '') +
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

      <p key={activeId + play.index} className="flow-caption pipeline-caption flash" style={{ '--flow-hue': hue } as React.CSSProperties}>
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
