'use client';

import { useEffect } from 'react';
import { prefersReducedMotion } from './utils';

/** Observes all .reveal elements currently in the DOM and fades them in
 *  as they scroll into view. Call once from a top-level client component
 *  after all sections have mounted. */
export function useRevealAnimations() {
  useEffect(() => {
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (prefersReducedMotion()) {
      revealEls.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
