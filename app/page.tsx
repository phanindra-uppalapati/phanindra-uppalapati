'use client';

import { Fragment } from 'react';
import Hero from '@/components/Hero';
import JourneySection from '@/components/JourneySection';
import AwardsSection from '@/components/AwardsSection';
import SkillsSection from '@/components/SkillsSection';
import ProjectsSection from '@/components/ProjectsSection';
import NoteSection from '@/components/NoteSection';
import { SECTIONS, SectionConfig } from '@/lib/content';
import { useRevealAnimations } from '@/lib/useRevealAnimations';

const RENDERERS: Record<string, (cfg: SectionConfig) => React.ReactNode> = {
  hero: () => <Hero />,
  journey: (cfg) => <JourneySection cfg={cfg} />,
  awards: (cfg) => <AwardsSection cfg={cfg} />,
  skills: (cfg) => <SkillsSection cfg={cfg} />,
  projects: (cfg) => <ProjectsSection cfg={cfg} />,
  note: (cfg) => <NoteSection cfg={cfg} />,
};

export default function Home() {
  useRevealAnimations();

  return (
    <main id="app">
      {SECTIONS.map((cfg) => {
        const render = RENDERERS[cfg.kind];
        return render ? <Fragment key={cfg.id}>{render(cfg)}</Fragment> : null;
      })}
    </main>
  );
}
