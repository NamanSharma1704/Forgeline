import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Barlow, Barlow_Semi_Condensed } from 'next/font/google';
import { HeaderSearch } from '@/components/HeaderSearch';
import { SearchShortcut } from '@/components/SearchShortcut';
import { ServiceWorkerManager } from '@/components/ServiceWorkerManager';
import { ThemeToggle } from '@/components/ThemeToggle';
import { THEME_SCRIPT } from '@/components/theme';
import { weaponIndex } from '@/data/weapons';
import './globals.css';

// Self-hosted at build time by next/font, so no request leaves for a font service at runtime.
const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowSemiCondensed = Barlow_Semi_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-barlow-sc',
  display: 'swap',
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
  themeColor: '#0c0c0e',
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
      className={`${barlow.variable} ${barlowSemiCondensed.variable}`}
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
              Forgeline
            </Link>
            <HeaderSearch />
            <nav className="site-nav" aria-label="Main">
              <Link href="/arsenal/">Arsenal</Link>
              <Link href="/sweep/">Sweep</Link>
              <Link href="/plan/">Plan</Link>
              <Link href="/ingredients/">Ingredients</Link>
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
