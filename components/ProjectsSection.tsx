'use client';

/* ==========================================================
   PROJECTS SECTION — a mixed row of project and article cards.

   - One card shape, body swaps by `kind` (WorkItem in lib/content.ts):
     projects keep the full treatment (stats, diagram, links); articles
     get a lighter teaser (excerpt, read time, a single external link).
   - Cards with a flow/pipeline diagram or image get a wider "feature"
     slot; lighter cards (most articles, simple projects) run narrower
     so two comfortably sit side by side — see .is-feature below.
   - Desktop: a horizontally snapping row showing ~2 cards plus a peek
     of the next one, with prev/next arrows and dot nav. Mobile: the
     same markup naturally becomes a plain vertical stack (CSS only,
     see cards.css) — no swipe gesture to fight with on a phone.
   - A trailing "More on GitHub" tile closes out the row instead of a
     hardcoded placeholder project.
   - `live` on a project is reserved for future streamed evidence (e.g.
     build/run logs) — the card already renders its placeholder panel;
     wiring a real source is a separate follow-up.
   ========================================================== */

import { useEffect, useRef, useState } from 'react';
import { FLOWS, PIPELINES, PROFILE, WORK_ITEMS, WorkItem, SectionConfig } from '@/lib/content';
import { prefersReducedMotion } from '@/lib/utils';
import FlowDiagram from './FlowDiagram';
import MigrationPipeline from './MigrationPipeline';

const GAP_PX = 20;

function StatIcon({ kind }: { kind?: 'repo' | 'clock' | 'sparkle' }) {
  if (kind === 'repo') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3v18M6 3a3 3 0 0 1 3 3v12M18 8v10a2 2 0 0 1-2 2H9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="18" cy="5" r="2.4" />
      </svg>
    );
  }
  if (kind === 'clock') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'sparkle') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 4l1.6 4.7L18 10.3l-4.4 1.6L12 16.6l-1.6-4.7L6 10.3l4.4-1.6L12 4z" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

function WorkCard({ item }: { item: WorkItem }) {
  const isArticle = item.kind === 'article';
  const flow = item.flow ? FLOWS[item.flow] : null;
  const pipeline = item.pipeline ? PIPELINES[item.pipeline] : null;
  const hasMedia = !!(flow || pipeline || item.image);
  const hasMore = !!item.description && item.description.trim() !== item.summary.trim();
  const [expanded, setExpanded] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Scrollbar should only ever appear when content truly exceeds the fixed
  // (desktop) card height — never as a permanent affordance. On mobile the
  // card height is auto, so this check naturally becomes a no-op there.
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const check = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!el) return;
          setHasOverflow(el.scrollHeight - el.clientHeight > 1);
        });
      });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  return (
    <div
      ref={innerRef}
      className={
        'card wi-inner' +
        (flow ? ' has-media' : '') +
        (pipeline ? ' has-pipeline' : '') +
        (hasOverflow ? ' has-overflow' : '') +
        (isArticle ? ' is-article' : '')
      }
    >
      {flow && (
        <div className="wi-media">
          <FlowDiagram flow={flow} />
          {flow.strapline && <p className="wi-strapline">&ldquo;{flow.strapline}&rdquo;</p>}
        </div>
      )}
      {!flow && item.image && (
        <div className="wi-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" className="wi-image" />
        </div>
      )}

      <div className="wi-body">
        <div className="wi-eyebrow-row">
          {isArticle && <span className="badge wi-badge wi-badge-article">Article</span>}
          {!isArticle && item.badge && <span className="badge wi-badge">{item.badge}</span>}
          {!isArticle && item.live && (
            <span className="live-chip" title={item.live.note || 'Live evidence — streaming coming soon'}>
              <span className="live-dot" aria-hidden="true" />
              Live
            </span>
          )}
        </div>

        <h3 className="wi-title">{item.title}</h3>
        {item.subtitle && <p className="wi-subtitle">{item.subtitle}</p>}

        {isArticle && (item.readTime || item.publishedDate) && (
          <p className="wi-meta">{[item.publishedDate, item.readTime].filter(Boolean).join(' · ')}</p>
        )}

        {!isArticle && item.stats && (
          <div className="wi-stats">
            {item.stats.map((s) => (
              <div className="wi-stat" key={s.label}>
                <span className="wi-stat-value">
                  {s.icon && (
                    <span className="wi-stat-icon" aria-hidden="true">
                      <StatIcon kind={s.icon} />
                    </span>
                  )}
                  {s.value}
                </span>
                <span className="wi-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        <p className="wi-summary">{item.summary}</p>

        {hasMore && (
          <div className={'wi-expand' + (expanded ? ' is-open' : '')}>
            <div>
              <p className="wi-description">{item.description}</p>
            </div>
          </div>
        )}
        {hasMore && (
          <button type="button" className="wi-readmore" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? 'Show less' : 'Read more'}
            <span className={'wi-readmore-chevron' + (expanded ? ' is-open' : '')} aria-hidden="true">
              ⌄
            </span>
          </button>
        )}

        {!isArticle && item.live && (
          <div className="live-panel" aria-hidden="true">
            <span className="live-panel-dot" />
            <span className="live-panel-text">{item.live.note || 'Live evidence — streaming coming soon'}</span>
          </div>
        )}

        {flow?.disclaimer && <p className="wi-disclaimer">{flow.disclaimer}</p>}

        <div className="tags tags-center">
          {item.tags.map((t, i) => (
            <span key={`${t}-${i}`}>{t}</span>
          ))}
        </div>

        {isArticle ? (
          item.articleUrl && (
            <div className="project-links project-links-center">
              <a className="is-primary" href={item.articleUrl} target="_blank" rel="noopener">
                Read Article <span aria-hidden="true">↗</span>
              </a>
            </div>
          )
        ) : (
          (item.repoUrl || item.demoUrl) && (
            <div className="project-links project-links-center">
              {item.repoUrl && (
                <a className="is-secondary" href={item.repoUrl} target="_blank" rel="noopener">
                  GitHub <span aria-hidden="true">↗</span>
                </a>
              )}
              {item.demoUrl && (
                <a className="is-primary" href={item.demoUrl} target="_blank" rel="noopener">
                  Live Demo <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          )
        )}
      </div>

      {pipeline && (
        <div className="wi-pipeline">
          <MigrationPipeline pipeline={pipeline} />
        </div>
      )}
    </div>
  );
}

function GithubCtaCard() {
  return (
    <div className="card wi-inner wi-cta">
      <div className="wi-cta-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path
            d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.93.84.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="wi-cta-title">More on GitHub</p>
      <p className="wi-cta-body">More projects, experiments, and in-progress work live on my GitHub — this section only features a curated few.</p>
      <div className="project-links project-links-center">
        <a className="is-primary" href={PROFILE.links.github} target="_blank" rel="noopener">
          Explore GitHub <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}

export default function ProjectsSection({ cfg }: { cfg: SectionConfig }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const total = WORK_ITEMS.length;
  const slideCount = total + 1; // + trailing GitHub CTA tile
  const [active, setActive] = useState(0);

  function stepWidth(track: HTMLDivElement) {
    const first = track.children[0] as HTMLElement | undefined;
    return (first?.clientWidth || track.clientWidth) + GAP_PX;
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      const step = stepWidth(track);
      const idx = Math.round(track.scrollLeft / Math.max(1, step));
      const clamped = Math.min(slideCount - 1, Math.max(0, idx));
      setActive(clamped);
    };

    const onScroll = () => requestAnimationFrame(update);
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    requestAnimationFrame(update);
    return () => {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [slideCount]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.min(slideCount - 1, Math.max(0, index));
    const step = stepWidth(track);
    track.scrollTo({ left: clamped * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const prevLabel = active > 0 ? (active - 1 < total ? WORK_ITEMS[active - 1].title : 'GitHub') : null;
  const nextLabel = active < slideCount - 1 ? (active + 1 < total ? WORK_ITEMS[active + 1].title : 'GitHub') : null;

  return (
    <section id={cfg.id} className="section" aria-labelledby={`${cfg.id}Title`}>
      <div className="section-head reveal">
        <p className="section-eyebrow">{cfg.eyebrow}</p>
        <h2 className="section-title" id={`${cfg.id}Title`}>
          {cfg.title}
        </h2>
      </div>

      <div
        className="carousel"
        tabIndex={0}
        aria-roledescription="carousel"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goTo(active - 1);
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            goTo(active + 1);
          }
        }}
      >
        <div className="carousel-meta">
          <span className="carousel-counter">
            {String(active + 1).padStart(2, '0')} / {String(slideCount).padStart(2, '0')}
          </span>
        </div>

        <div className="carousel-viewport">
          <button
            className="carousel-nav prev"
            type="button"
            aria-label={prevLabel ? `Previous: ${prevLabel}` : 'No previous item'}
            disabled={!prevLabel}
            onClick={() => goTo(active - 1)}
          >
            ‹
          </button>
          <div className="carousel-track reveal" role="list" aria-label="Projects and articles" ref={trackRef}>
            {WORK_ITEMS.map((item, i) => {
              const hasMedia = !!(item.flow || item.pipeline || item.image);
              return (
                <div className={'carousel-slide wi-slide' + (hasMedia ? ' is-feature' : '')} role="listitem" key={i}>
                  <WorkCard item={item} />
                </div>
              );
            })}
            <div className="carousel-slide wi-slide" role="listitem">
              <GithubCtaCard />
            </div>
          </div>
          <button
            className="carousel-nav next"
            type="button"
            aria-label={nextLabel ? `Next: ${nextLabel}` : 'No next item'}
            disabled={!nextLabel}
            onClick={() => goTo(active + 1)}
          >
            ›
          </button>
        </div>

        <div className="carousel-dots">
          {WORK_ITEMS.map((item, i) => (
            <button
              key={i}
              className={'dot' + (i === active ? ' is-active' : '')}
              type="button"
              aria-label={`Go to ${item.title}`}
              onClick={() => goTo(i)}
            />
          ))}
          <button
            className={'dot' + (active === total ? ' is-active' : '')}
            type="button"
            aria-label="Go to more on GitHub"
            onClick={() => goTo(total)}
          />
        </div>
      </div>
    </section>
  );
}
