'use client';

/* ==========================================================
   AWARDS — a responsive card grid with a Selected/All toggle.
   Awards sharing the same name are grouped into a single card
   with a ×N badge; expanding a card reveals each individual date.
   Everything here — sort order, counts, which rows show by
   default — is derived from lib/awards-data.ts; nothing is
   hard-coded, so editing that one file is the only thing ever
   needed to add, edit, or remove an award.
   ========================================================== */

import { useMemo, useState } from 'react';
import { AWARDS_DATA, AwardRecord } from '@/lib/awards-data';
import { SectionConfig } from '@/lib/content';
import { formatIsoDate } from '@/lib/utils';

type ViewMode = 'selected' | 'all';

type AwardGroup = {
  key: string;
  name: string;
  employer: string;
  records: AwardRecord[];
  latestDate: string;
};

function groupAwards(records: AwardRecord[]): AwardGroup[] {
  const map = new Map<string, AwardGroup>();
  for (const r of records) {
    const key = `${r.name}__${r.employer}`;
    const existing = map.get(key);
    if (existing) {
      existing.records.push(r);
      if (r.date > existing.latestDate) existing.latestDate = r.date;
    } else {
      map.set(key, { key, name: r.name, employer: r.employer, records: [r], latestDate: r.date });
    }
  }
  return [...map.values()].sort((a, b) => (a.latestDate < b.latestDate ? 1 : a.latestDate > b.latestDate ? -1 : 0));
}

export default function AwardsSection({ cfg }: { cfg: SectionConfig }) {
  const [view, setView] = useState<ViewMode>('selected');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sortedDesc = useMemo(() => [...AWARDS_DATA].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), []);
  const selected = useMemo(() => sortedDesc.filter((a) => a.selected), [sortedDesc]);
  const visibleRecords = view === 'selected' ? selected : sortedDesc;
  const visible = useMemo(() => groupAwards(visibleRecords), [visibleRecords]);
  const employer = AWARDS_DATA[0]?.employer;

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section id={cfg.id} className="section" aria-labelledby={`${cfg.id}Title`}>
      <div className="section-head reveal">
        <p className="section-eyebrow">{cfg.eyebrow}</p>
        <h2 className="section-title" id={`${cfg.id}Title`}>
          {cfg.title}
        </h2>
        {employer && <p className="award-employer-sub">at {employer}</p>}
      </div>

      <div className="award-toggle reveal" role="group" aria-label="Filter awards">
        <button
          type="button"
          aria-pressed={view === 'selected'}
          aria-controls="awardsList"
          className={'award-toggle-btn' + (view === 'selected' ? ' is-active' : '')}
          onClick={() => setView('selected')}
        >
          Selected <span className="award-toggle-count">({selected.length})</span>
        </button>
        <button
          type="button"
          aria-pressed={view === 'all'}
          aria-controls="awardsList"
          className={'award-toggle-btn' + (view === 'all' ? ' is-active' : '')}
          onClick={() => setView('all')}
        >
          All <span className="award-toggle-count">({sortedDesc.length})</span>
        </button>
      </div>

      <ul className="award-grid reveal" id="awardsList">
        {visible.map((g) => {
          const isGroup = g.records.length > 1;
          const isOpen = expanded.has(g.key);
          const datesDesc = [...g.records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
          return (
            <li className={'award-card card' + (isGroup ? ' is-group' : '')} key={g.key}>
              <div
                className="award-card-inner"
                role={isGroup ? 'button' : undefined}
                tabIndex={isGroup ? 0 : undefined}
                aria-expanded={isGroup ? isOpen : undefined}
                onClick={isGroup ? () => toggleExpanded(g.key) : undefined}
                onKeyDown={
                  isGroup
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpanded(g.key);
                        }
                      }
                    : undefined
                }
              >
                <div className="award-card-top">
                  <span className="award-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 3l2.47 5.11 5.53.81-4 4.02.94 5.56L12 15.9l-4.94 2.6.94-5.56-4-4.02 5.53-.81z" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {isGroup && (
                    <span className="award-count-badge">
                      ×{g.records.length}
                      <svg
                        className={'award-chevron' + (isOpen ? ' is-open' : '')}
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <span className="award-name">{g.name}</span>
                <span className="award-org">{g.employer}</span>
                {!isGroup && <span className="award-date">{formatIsoDate(g.records[0].date)}</span>}
                {isGroup && (
                  <span className="award-date">
                    {isOpen ? 'Latest' : ''} {formatIsoDate(g.latestDate)}
                  </span>
                )}
                {isGroup && isOpen && (
                  <ul className="award-date-list">
                    {datesDesc.map((r) => (
                      <li key={r.id}>{formatIsoDate(r.date)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
