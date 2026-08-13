import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { PROFILE } from '@/lib/content';
import { ThemeProvider, THEME_BLOCKING_SCRIPT } from '@/components/ThemeProvider';
import Header from '@/components/Header';
import FloatingNav from '@/components/FloatingNav';
import Footer from '@/components/Footer';

import './styles/tokens.css';
import './styles/theme.css';
import './styles/layout.css';
import './styles/hero.css';
import './styles/journey.css';
import './styles/cards.css';
import './styles/navigation.css';
import './styles/animations.css';
import './styles/pipeline.css';

/* Self-hosted (next/font/local) rather than next/font/google: Turbopack
   fetches Google fonts at build time, so a build fails outright on any
   network/proxy that can't reach fonts.gstatic.com. These are the exact
   same four families/weights, just vendored into app/fonts/ once —
   zero runtime or build-time network dependency, and next/font/local
   still generates the CSS variable + font-display:swap + preload the
   same way next/font/google did, so nothing downstream changes. */
const spaceGrotesk = localFont({
  src: [
    { path: './fonts/space-grotesk/space-grotesk-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/space-grotesk/space-grotesk-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/space-grotesk/space-grotesk-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-display-family',
  display: 'swap',
});
const inter = localFont({
  src: [
    { path: './fonts/inter/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-body-family',
  display: 'swap',
});
const jetbrainsMono = localFont({
  src: [
    { path: './fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/jetbrains-mono/jetbrains-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/jetbrains-mono/jetbrains-mono-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-mono-family',
  display: 'swap',
});
const caveat = localFont({
  src: [
    { path: './fonts/caveat/caveat-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/caveat/caveat-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-hand-family',
  display: 'swap',
});

const SITE_URL = 'https://phanindra-uppalapati.vercel.app'; // TODO: update once the Vercel domain is known
const TITLE = `${PROFILE.name} — ${PROFILE.title}`;
const DESCRIPTION = `${PROFILE.name} — ${PROFILE.title}. ${PROFILE.tagline}`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Not locking maximumScale keeps pinch-to-zoom available for accessibility.
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: PROFILE.name }],
  creator: PROFILE.name,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: PROFILE.name,
    images: [{ url: PROFILE.avatar, width: 800, height: 800, alt: PROFILE.name }],
    type: 'profile',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: [PROFILE.avatar],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Set theme before first paint to avoid a flash of the wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BLOCKING_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <Header />
          <FloatingNav />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
