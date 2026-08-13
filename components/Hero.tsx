'use client';

import { useEffect, useRef, useState } from 'react';
import { PROFILE } from '@/lib/content';
import { useHourTint } from '@/lib/useHourTint';
import SkillGraphCanvas from './SkillGraphCanvas';

function ResumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 2.5h8l4 4V21H6z" strokeLinejoin="round" />
      <path d="M14 2.5v4h4" strokeLinejoin="round" />
      <path d="M9 13h6M9 16.5h6" strokeLinecap="round" />
    </svg>
  );
}
function ProfileLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.4 2.5-6 5.5-6s5.5 2.6 5.5 6" strokeLinecap="round" />
      <path d="M16 9.5c1.7.4 3 1.9 3 3.7M15.5 4.6c1.9.4 3.5 2 4 4" strokeLinecap="round" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M9 6L3.5 12 9 18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6l5.5 6-5.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 6.5l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Hero() {
  const graphPanelRef = useRef<HTMLDivElement>(null);
  const firstName = PROFILE.name.split(' ')[0];
  const tint = useHourTint();

  const [graphStarted, setGraphStarted] = useState(false);
  useEffect(() => {
    const panel = graphPanelRef.current;
    if (!panel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setGraphStarted(true);
            observer.unobserve(panel);
          }
        });
      },
      { threshold: 0 }
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="hero"
      className="hero"
      aria-label="Introduction"
      style={{ ['--tint-rgb' as string]: tint.rgb } as React.CSSProperties}
    >
      <div className="hero-tint" aria-hidden="true" />
      <div className="hero-grid">
        <div className="hero-content reveal">
          <p className="hero-eyebrow">Hey there, I&rsquo;m</p>
          <h1 className="hero-name">
            {firstName}
            <span className="hero-name-dot">.</span>
          </h1>
          <p className="hero-tagline">{PROFILE.tagline}</p>
          <p className="hero-bio">{PROFILE.bio}</p>
          <div className="hero-actions">
            <a className="btn primary" href={PROFILE.ctas.primary.href}>
              <ArrowIcon /> {PROFILE.ctas.primary.label}
            </a>
            <a className="btn outline" href={PROFILE.ctas.secondary.href}>
              {PROFILE.ctas.secondary.label} <ArrowIcon />
            </a>
          </div>
          <div className="hero-links">
            <a href={PROFILE.resume} target="_blank" rel="noopener">
              <ResumeIcon /> Resume
            </a>
            <a href={PROFILE.links.linkedin} target="_blank" rel="noopener">
              <ProfileLinkIcon /> LinkedIn
            </a>
            <a href={PROFILE.links.github} target="_blank" rel="noopener">
              <CodeIcon /> GitHub
            </a>
            <a href={PROFILE.links.email}>
              <EnvelopeIcon /> Email
            </a>
          </div>
        </div>

        <div className="hero-graph-panel reveal" ref={graphPanelRef}>
          {false && graphStarted && <SkillGraphCanvas panelRef={graphPanelRef} hourWarmth={tint.warmth} />}
        </div>
      </div>
    </section>
  );
}
