import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Barlow, Chakra_Petch, JetBrains_Mono } from 'next/font/google';
import { HeaderSearch } from '@/components/HeaderSearch';
import { NavLinks } from '@/components/NavLinks';
import { SearchShortcut } from '@/components/SearchShortcut';
import { ServiceWorkerManager } from '@/components/ServiceWorkerManager';
import { ThemeToggle } from '@/components/ThemeToggle';
import { THEME_SCRIPT } from '@/components/theme';
import { weaponIndex } from '@/data/weapons';
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

/** The emblem: the app icon's glyph, two ingredients joining into what they build. */
function Emblem() {
  return (
    <svg className="wordmark__emblem" width="20" height="20" viewBox="128 144 256 224" aria-hidden="true">
      <rect x="128" y="144" width="72" height="72" fill="currentColor" />
      <rect x="128" y="296" width="72" height="72" fill="currentColor" />
      <path d="M200 180 H244 V332 H200 M244 256 H290" fill="none" stroke="currentColor" strokeWidth="16" />
      <polygon points="314,206 384,206 384,282 360,306 290,306 290,230" fill="currentColor" />
    </svg>
  );
}

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
  themeColor: '#0a0b0e',
};

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          Data from <code>@wfcd/items</code> {weaponIndex.sourceVersion}, built{' '}
          <time dateTime={weaponIndex.generatedAt}>{weaponIndex.generatedAt.slice(0, 10)}</time>.
          Newest weapon in this data: {weaponIndex.newestWeaponUpdate}. Refreshed monthly.
        </p>
        <p>
          Weapon data and pictures come from the{' '}
          <a href="https://github.com/wfcd/warframe-items">Warframe Community Developers</a>.{' '}
          <Link href="/about/">About the data, and how to report a mistake</Link>.
        </p>
        <p>
          Forgeline is a fan-made tool and is not affiliated with or endorsed by Digital Extremes.
          Warframe is a trademark of Digital Extremes Ltd.
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${barlow.variable} ${chakraPetch.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SearchShortcut />
        <header className="site-header">
          <div className="container site-header__inner">
            <Link href="/" className="wordmark">
              <Emblem />
              Forgeline
            </Link>
            <HeaderSearch />
            <nav className="site-nav" aria-label="Main">
              <NavLinks />
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main>
          <div className="container">{children}</div>
        </main>
        <Footer />
        <ServiceWorkerManager />
      </body>
    </html>
  );
}
