import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Barlow, Chakra_Petch, JetBrains_Mono } from 'next/font/google';
import { ServiceWorkerManager } from '@/components/ServiceWorkerManager';
import { ActionDock } from '@/components/shell/ActionDock';
import { BottomBar } from '@/components/shell/BottomBar';
import { OrbiterBar } from '@/components/shell/OrbiterBar';
import { SearchOverlay } from '@/components/shell/SearchOverlay';
import { THEME_SCRIPT } from '@/components/theme';
import { allWeapons, weaponIndex } from '@/data/weapons';
import './globals.css';

// Self-hosted at build time by next/font, so no request leaves for a font service at runtime.
// Three roles (docs/design-plan.md, section 3): body, display, telemetry.
const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

// Display: its letters have cut corners, the same chamfer as the panels.
const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-chakra',
  display: 'swap',
});

// Telemetry: small data tags only (MR, copies, hours). Not preloaded, so it never holds up the
// first paint; on a slow first visit the tags keep the fallback monospace.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  // Design plan 10.4: optional, so a slow connection keeps the fallback rather than reflowing.
  display: 'optional',
  preload: false,
  // The generated fallback is metric-matched Arial, which turns telemetry into a sans on a first
  // visit. A real monospace keeps the figures aligned until the font is cached.
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});

export const metadata: Metadata = {
  title: {
    default: 'Forgeline',
    template: '%s | Forgeline',
  },
  description:
    'See what every Warframe weapon becomes before you sell it: what it builds, how many copies the recipe needs, and whether you can let it go.',
  applicationName: 'Forgeline',
  appleWebApp: { title: 'Forgeline', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090b0e',
};

/**
 * The status strip (design plan 4.5): one low line, like the game's menu bar. The data version, the
 * fan-made notice as readable text, and About, which carries the full attribution.
 */
function StatusStrip() {
  return (
    <footer className="status-strip">
      <div className="container status-strip__inner">
        <span>
          Data <code>@wfcd/items</code> {weaponIndex.sourceVersion},{' '}
          <time dateTime={weaponIndex.generatedAt}>{weaponIndex.generatedAt.slice(0, 10)}</time>
        </span>
        <span>Fan-made, not affiliated with Digital Extremes</span>
        <Link href="/about/">About</Link>
      </div>
    </footer>
  );
}

const weaponCount = allWeapons().length;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      // Smooth scrolling is for in-page jumps; this has Next make route changes jump to the top at once.
      data-scroll-behavior="smooth"
      className={`${barlow.variable} ${chakraPetch.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <OrbiterBar weaponCount={weaponCount} />
        <main>
          <div className="container">{children}</div>
        </main>
        <StatusStrip />
        <ActionDock />
        <BottomBar />
        <SearchOverlay weaponCount={weaponCount} />
        <ServiceWorkerManager />
      </body>
    </html>
  );
}
