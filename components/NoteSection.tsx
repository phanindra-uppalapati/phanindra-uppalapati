import { NOTE, PROFILE, SectionConfig } from '@/lib/content';
import SignatureAnimation from './SignatureAnimation';
import CopyEmailButton from './CopyEmailButton';

export default function NoteSection({ cfg }: { cfg: SectionConfig }) {
  const email = PROFILE.links.email.replace('mailto:', '');
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
        <SignatureAnimation />
        {/* Sign-off contact line: reads as part of the letter itself
            (how a real letter ends — signature, then how to reach the
            sender) rather than a bolted-on CTA banner. Same mailto +
            copy pattern as the hero, for anyone who reaches the end of
            the letter and is convinced without scrolling back up. */}
        <p className="note-signoff">
          Reach me anytime at{' '}
          <a href={PROFILE.links.email}>{email}</a>
          <CopyEmailButton email={email} className="note-signoff-copy" />
        </p>
      </div>
    </section>
  );
}
