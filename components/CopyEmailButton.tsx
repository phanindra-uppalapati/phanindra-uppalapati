'use client';

import { useRef, useState } from 'react';

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Separate, explicit affordance from the `mailto:` link next to it — the
 * two intentionally don't share a click target. The mailto link keeps its
 * standard behavior for anyone with a mail client configured; this button
 * is the escape hatch for anyone who doesn't (common on locked-down work
 * laptops), where clicking mailto silently fails. One icon, one job each.
 *
 * Confirmation is both a same-icon swap (checkmark, ~1.6s) AND a small
 * tooltip label — covers people who notice icon-level micro-feedback and
 * people who look for text confirmation, without needing a toast system.
 */
export default function CopyEmailButton({ email, className = '' }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard API can fail (older Safari, insecure context, permissions).
      // Fails silently rather than throwing — the mailto link next to this
      // button still works as the fallback path either way.
      return;
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      className={`copy-email-btn ${copied ? 'is-copied' : ''} ${className}`}
      onClick={handleCopy}
      aria-label={copied ? 'Email address copied' : 'Copy email address'}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="copy-email-tooltip" role="status" aria-live="polite">
        {copied ? 'Copied!' : 'Copy email'}
      </span>
    </button>
  );
}
