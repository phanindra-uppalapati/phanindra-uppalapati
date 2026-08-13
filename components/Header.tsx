'use client';

import { useEffect, useRef } from 'react';
import { PROFILE, SECTIONS } from '@/lib/content';
import { useTheme } from './ThemeProvider';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const headerRef = useRef<HTMLElement>(null);
  const firstName = PROFILE.name.split(' ')[0];

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

  const navLinks = SECTIONS.filter((s) => s.topNav);

  return (
    <header className="topbar" ref={headerRef}>
      <a className="mark" id="brandSignature" href="#hero" aria-label="Go to top">
        {firstName}
      </a>
      <nav className="top-links" aria-label="Page sections">
        <span id="topNavLinks" style={{ display: 'contents' }}>
          {navLinks.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </span>
        <span className="nav-divider" />
        <a id="resumeLink" href={PROFILE.resume} target="_blank" rel="noopener">
          Resume
        </a>
        <a id="linkedinLink" href={PROFILE.links.linkedin} target="_blank" rel="noopener">
          LinkedIn
        </a>
        <a id="githubLink" href={PROFILE.links.github} target="_blank" rel="noopener">
          GitHub
        </a>
      </nav>
      <button
        id="themeToggle"
        className="theme-toggle"
        type="button"
        aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        onClick={toggleTheme}
      >
        {theme === 'light' ? '☀️' : '🌙'}
      </button>
    </header>
  );
}
