'use client';

/* ==========================================================
   ENGINEERING JOURNEY
   - Desktop/tablet: winding SVG trail. Each segment is always
     drawn (never depends on scroll math to become visible),
     plus a slow continuous animated "flow" overlay for life.
   - Hovering a milestone brightens the segment leaving it.
   - Under 900px: a vertical dashed fallback.
   - Compass label is always visible, not hover-only.
   ========================================================== */

import { useEffect, useRef } from 'react';
import { JOURNEY, SectionConfig } from '@/lib/content';
import { debounce } from '@/lib/utils';

const BREAKPOINT = 1100; // below this, use the vertical fallback — the SVG wave only has room on wide desktop
const SVG_NS = 'http://www.w3.org/2000/svg';

function computeWavePoints(count: number, width: number, height: number) {
  const marginX = width * 0.06;
  const usableWidth = width - marginX * 2;
  const amp = height * 0.28;
  const midY = height * 0.5;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = marginX + (usableWidth * i) / (count - 1);
    const y = midY + (i % 2 === 0 ? -amp : amp) * (i === 0 ? 0.5 : 1);
    points.push({ x, y });
  }
  return points;
}

function segmentD(p0: { x: number; y: number }, p1: { x: number; y: number }) {
  const midX = (p0.x + p1.x) / 2;
  return `M ${p0.x} ${p0.y} C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function buildChip(m: (typeof JOURNEY)[number]): HTMLDivElement {
  const chip = el('div', {
    class: 'milestone-chip',
    tabindex: '0',
    role: 'button',
    'aria-expanded': 'false',
    'aria-label': `${m.role} at ${m.company}, ${m.period}. Press enter for details.`,
  });
  const period = el('p', { class: 'milestone-period', style: `color:${m.hue}` }, [m.period]);
  const role = el('h3', { class: 'milestone-role' }, [m.role]);
  const meta = el('p', { class: 'milestone-meta' }, [`${m.company} · ${m.client} · 📍 ${m.location}`]);
  const tech = el('p', { class: 'milestone-tech' }, [m.tech.join(' · ')]);
  const details = el(
    'div',
    { class: 'milestone-details' },
    m.notes.map((n) => el('p', {}, [n]))
  );
  chip.append(period, role, meta, tech, details);
  const toggle = () => {
    const open = chip.classList.toggle('is-open');
    chip.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  chip.addEventListener('click', toggle);
  chip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  return chip;
}

function buildMilestoneNode(m: (typeof JOURNEY)[number], isFirst: boolean, positionStyle: string | null) {
  const children: HTMLElement[] = [];
  if (isFirst) children.push(el('span', { class: 'milestone-tag' }, ['START']));
  children.push(el('span', { class: 'milestone-dot', style: `--hue:${m.hue}` }));
  children.push(buildChip(m));
  const style = `${positionStyle || ''} --hue:${m.hue};`;
  const node = el('div', { class: 'milestone' + (m.current ? ' is-current' : ''), style });
  children.forEach((c) => node.appendChild(c));
  return node;
}

function buildCompassNode(positionStyle: string | null) {
  const compass = el('div', { class: 'compass' }, ['🧭']);
  const label = el('p', { class: 'compass-label' }, ['The journey continues...']);
  const node = el('div', { class: 'milestone compass-wrap', style: positionStyle || '' });
  node.append(compass, label);
  return node;
}

function renderWave(container: HTMLElement, journeyData: typeof JOURNEY) {
  const width = container.clientWidth || 1000;
  const height = Math.max(320, width * 0.32);
  const wrap = el('div', { class: 'journey-wave', style: `height:${height}px;` });
  const total = journeyData.length + 1; // + compass
  const points = computeWavePoints(total, width, height);
  const hues = [...journeyData.map((m) => m.hue), 'var(--accent)'];

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'presentation');

  const segmentGroups: SVGGElement[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = segmentD(points[i], points[i + 1]);
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'journey-segment-group');
    g.style.setProperty('--seg-hue', hues[i]);
    g.style.setProperty('--seg-delay', `${(i * 1.4).toFixed(1)}s`);

    const base = document.createElementNS(SVG_NS, 'path');
    base.setAttribute('d', d);
    base.setAttribute('class', 'journey-segment-base');
    const flow = document.createElementNS(SVG_NS, 'path');
    flow.setAttribute('d', d);
    flow.setAttribute('class', 'journey-segment-flow');

    g.appendChild(base);
    g.appendChild(flow);
    svg.appendChild(g);
    segmentGroups.push(g);
  }
  wrap.appendChild(svg);

  const layer = el('div', { class: 'journey-milestones', style: `height:${height}px;` });
  journeyData.forEach((m, i) => {
    const pt = points[i];
    const style = `left:${(pt.x / width) * 100}%; top:${(pt.y / height) * 100}%;`;
    const nodeEl = buildMilestoneNode(m, i === 0, style);
    layer.appendChild(nodeEl);

    const group = segmentGroups[i];
    if (group) {
      nodeEl.addEventListener('mouseenter', () => group.classList.add('is-active'));
      nodeEl.addEventListener('mouseleave', () => group.classList.remove('is-active'));
    }
  });
  const compassPt = points[points.length - 1];
  layer.appendChild(buildCompassNode(`left:${(compassPt.x / width) * 100}%; top:${(compassPt.y / height) * 100}%;`));

  wrap.appendChild(layer);
  container.appendChild(wrap);
}

function renderVertical(container: HTMLElement, journeyData: typeof JOURNEY) {
  const wrap = el('div', { class: 'journey-vertical' });
  journeyData.forEach((m, i) => wrap.appendChild(buildMilestoneNode(m, i === 0, null)));
  wrap.appendChild(buildCompassNode(null));
  container.appendChild(wrap);
}

export default function JourneySection({ cfg }: { cfg: SectionConfig }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;
    let mode: 'wave' | 'vertical' | null = null;

    function render() {
      const nextMode: 'wave' | 'vertical' = window.innerWidth < BREAKPOINT ? 'vertical' : 'wave';
      if (nextMode === mode || !container) return;
      mode = nextMode;
      container.innerHTML = '';
      if (mode === 'wave') renderWave(container, JOURNEY);
      else renderVertical(container, JOURNEY);
    }

    render();
    const onResize = debounce(render, 200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <section id={cfg.id} className="section" aria-labelledby={`${cfg.id}Title`}>
      <div className="section-head reveal">
        <p className="section-eyebrow">{cfg.eyebrow}</p>
        <h2 className="section-title" id={`${cfg.id}Title`}>
          {cfg.title}
        </h2>
      </div>
      <div className="journey-root reveal" id="journeyRoot" ref={rootRef} />
    </section>
  );
}
