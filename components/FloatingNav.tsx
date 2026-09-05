'use client';

import { useEffect, useRef, useState } from 'react';
import { SECTIONS } from '@/lib/content';
import { scrollToSection } from '@/lib/utils';

function TopArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 19V6M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FloatingNav() {
  const navRef = useRef<HTMLElement>(null);
  // Back-to-top visibility: a plain scroll-position threshold instead of
  // an IntersectionObserver on the hero element. The observer approach
  // (rootMargin shrinking the root from the top) actually required
  // scrolling almost the hero's ENTIRE height before firing — on a hero
  // with a tall constellation graphic that meant the button didn't show
  // until well into the Journey section. A fixed pixel threshold tied to
  // viewport height is simple and predictable regardless of hero height.
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const THRESHOLD = () => window.innerHeight * 0.6;
    const onScroll = () => setPastHero(window.scrollY > THRESHOLD());
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

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
          onClick={(e) => {
            e.preventDefault();
            scrollToSection(s.id);
          }}
        >
          <span className="floating-nav-label" aria-hidden="true">
            {s.label}
          </span>
          <span className="floating-nav-dot" />
        </a>
      ))}
      {/* Back-to-top: same visual language as the section items (dot +
          label-on-hover) so it reads as part of the same rail rather than
          a separate floating element, per the earlier design discussion. */}
      <button
        type="button"
        className={`floating-nav-item floating-nav-top ${pastHero ? 'is-visible' : ''}`}
        aria-label="Back to top"
        aria-hidden={!pastHero}
        tabIndex={pastHero ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <span className="floating-nav-label" aria-hidden="true">
          Top
        </span>
        <span className="floating-nav-top-dot">
          <TopArrowIcon />
        </span>
      </button>
    </nav>
  );
}
