'use client';

/* ==========================================================
   HOUR TINT — a subtle, non-textual stand-in for the old
   "good morning/evening" greeting. Buckets the visitor's local
   hour into four moods and exposes a translucent tint color
   (used at very low opacity) plus a -1..1 "warmth" value for
   nudging the skill graph's glow color. Both are designed to
   read fine against either theme, since they're applied as a
   faint overlay/blend on top of existing theme colors, never
   as a replacement for them.
   ========================================================== */

import { useEffect, useState } from 'react';

export type HourBucket = 'morning' | 'day' | 'evening' | 'night';

const TINTS: Record<HourBucket, { rgb: string; warmth: number }> = {
  morning: { rgb: '255,183,94', warmth: 0.7 }, // soft amber
  day: { rgb: '120,170,255', warmth: 0 }, // neutral, faint sky blue
  evening: { rgb: '255,120,140', warmth: 0.5 }, // soft coral
  night: { rgb: '110,110,255', warmth: -0.7 }, // cool indigo
};

function bucketForHour(hour: number): HourBucket {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export type HourTint = { bucket: HourBucket; rgb: string; warmth: number };

const FALLBACK: HourTint = { bucket: 'day', ...TINTS.day };

/** Stable fallback on first (server) render, swapped for the visitor's
 *  real local-time bucket after mount — same hydration-safe pattern as
 *  the old greeting hook. */
export function useHourTint(): HourTint {
  const [tint, setTint] = useState<HourTint>(FALLBACK);
  useEffect(() => {
    const bucket = bucketForHour(new Date().getHours());
    setTint({ bucket, ...TINTS[bucket] });
  }, []);
  return tint;
}
