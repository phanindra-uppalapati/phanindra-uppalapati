'use client';

import { useEffect, useRef } from 'react';
import { SECTIONS } from '@/lib/content';

export default function FloatingNav() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.floating-nav-item'));
    const sectionEls = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (!sectionEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const match = items.find((i) => i.dataset.section === entry.target.id);
          if (!match) return;
          items.forEach((i) => i.classList.remove('is-active'));
          match.classList.add('is-active');
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );
    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="floating-nav" id="floatingNav" aria-label="Section navigation" ref={navRef}>
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          className="floating-nav-item"
          href={`#${s.id}`}
          aria-label={`Go to ${s.label}`}
          data-section={s.id}
        >
          <span className="floating-nav-label" aria-hidden="true">
            {s.label}
          </span>
          <span className="floating-nav-dot" />
        </a>
      ))}
    </nav>
  );
}
