import { SKILL_GRAPH, SectionConfig } from '@/lib/content';

export default function SkillsSection({ cfg }: { cfg: SectionConfig }) {
  return (
    <section id={cfg.id} className="section" aria-labelledby={`${cfg.id}Title`}>
      <div className="section-head reveal">
        <p className="section-eyebrow">{cfg.eyebrow}</p>
        <h2 className="section-title" id={`${cfg.id}Title`}>
          {cfg.title}
        </h2>
      </div>
      <div className="skills-grid reveal">
        {SKILL_GRAPH.map((c) => {
          const label = c.name.charAt(0) + c.name.slice(1).toLowerCase();
          return (
            <div className="card skill-card" style={{ ['--hue' as any]: c.hue }} key={c.name}>
              <h3>{label}</h3>
              <p>{c.skills.join(' · ')}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
