import { NOTE, SectionConfig } from '@/lib/content';

export default function NoteSection({ cfg }: { cfg: SectionConfig }) {
  return (
    <section id={cfg.id} className="section note-section" aria-labelledby={`${cfg.id}Title`}>
      <div className="card note-card reveal">
        <h2 className="note-heading" id={`${cfg.id}Title`}>
          {NOTE.heading}
        </h2>
        <blockquote className="note-quote">{NOTE.quote}</blockquote>
        {NOTE.paragraphs.map((p, i) => (
          <p className="note-body" key={i}>
            {p}
          </p>
        ))}
        <div className="note-divider" />
        <p className="note-signature">{NOTE.signature}</p>
        <p className="note-motto">{NOTE.motto}</p>
      </div>
    </section>
  );
}
