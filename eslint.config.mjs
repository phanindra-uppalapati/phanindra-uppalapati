import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/* Imported directly rather than via FlatCompat().extends('next/core-web-vitals', ...):
   eslint-config-next ships native flat-config arrays (see its package.json exports),
   and resolving them through FlatCompat's legacy shareable-config lookup instead
   crashes ESLint 9+ with a "Converting circular structure to JSON" error — the
   modern plugin objects these configs pull in (eslint-plugin-react etc.) are
   self-referencing in a way FlatCompat's older validator can't handle. Importing
   the flat-config arrays directly sidesteps that layer entirely. */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**'],
  },
];

export default eslintConfig;
