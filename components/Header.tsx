'use client';

import { useEffect, useRef, useState } from 'react';
import { PROFILE, SECTIONS } from '@/lib/content';
import { useTheme } from './ThemeProvider';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const headerRef = useRef<HTMLElement>(null);
  const firstName = PROFILE.name.split(' ')[0];
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const threshold = 12;
    const revealAt = header.offsetHeight;
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      ticking = false;
      const y = window.scrollY;
      const delta = y - lastY;
      if (!header) return;
      if (y <= revealAt) {
        header.classList.remove('topbar--hidden');
      } else if (delta > threshold) {
        header.classList.add('topbar--hidden');
      } else if (delta < -threshold) {
        header.classList.remove('topbar--hidden');
      }
      lastY = y;
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile panel on Escape, or automatically if the viewport
  // grows past the collapse breakpoint (e.g. rotating a tablet, or
  // resizing a desktop window back up) so it can never get stuck open
  // underneath the now-visible desktop nav.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const mq = window.matchMedia('(min-width:901px)');
    const onMq = () => {
      if (mq.matches) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onMq);
    };
  }, [menuOpen]);

  // Mirrors FloatingNav's approach: same IntersectionObserver pattern,
  // scoped to this header so both the desktop nav and the mobile panel
  // (which share the same navItems markup, rendered twice) pick up the
  // active state via a single query across the whole header.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const sectionEls = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (!sectionEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const links = Array.from(header.querySelectorAll<HTMLAnchorElement>('[data-section]'));
          links.forEach((a) => a.classList.toggle('is-active', a.dataset.section === entry.target.id));
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );
    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const navLinks = SECTIONS.filter((s) => s.topNav);
  const closeMenu = () => setMenuOpen(false);

  const navItems = (
    <>
      {navLinks.map((s) => (
        <a key={s.id} href={`#${s.id}`} data-section={s.id} onClick={closeMenu}>
          {s.label}
        </a>
      ))}
      <span className="nav-divider" />
      <a href={PROFILE.resume} target="_blank" rel="noopener" onClick={closeMenu}>
        Resume <span aria-hidden="true">↗</span>
      </a>
      <a href={PROFILE.links.linkedin} target="_blank" rel="noopener" onClick={closeMenu}>
        LinkedIn <span aria-hidden="true">↗</span>
      </a>
      <a href={PROFILE.links.github} target="_blank" rel="noopener" onClick={closeMenu}>
        GitHub <span aria-hidden="true">↗</span>
      </a>
    </>
  );

  return (
    <header className="topbar" ref={headerRef}>
      <a className="mark" id="brandSignature" href="#hero" aria-label="Go to top">
        {firstName}
      </a>

      <nav className="top-links" aria-label="Page sections">
        {navItems}
      </nav>

      <div className="topbar-right">
        <button
          className={'hamburger' + (menuOpen ? ' is-open' : '')}
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobileNavPanel"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <button
          id="themeToggle"
          className="theme-toggle"
          type="button"
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          onClick={toggleTheme}
        >
          {theme === 'light' ? '☀️' : '🌙'}
        </button>
      </div>

      <div className={'mobile-nav-panel' + (menuOpen ? ' is-open' : '')} id="mobileNavPanel">
        <div className="mobile-nav-panel-inner">
          <nav aria-label="Page sections (mobile)">{navItems}</nav>
        </div>
      </div>
    </header>
  );
}
