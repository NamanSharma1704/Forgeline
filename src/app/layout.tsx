import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { weaponIndex } from '@/data/weapons';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Forgeline',
    template: '%s | Forgeline',
  },
  description:
    'See what every Warframe weapon becomes before you sell it: what it builds, how many copies the recipe needs, and whether you can let it go.',
  applicationName: 'Forgeline',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0c',
};

function Footer() {
  const refreshed = new Date(weaponIndex.generatedAt);
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          Data from <code>@wfcd/items</code> {weaponIndex.sourceVersion}, built{' '}
          <time dateTime={weaponIndex.generatedAt}>
            {refreshed.toISOString().slice(0, 10)}
          </time>
          . Newest weapon in this data: {weaponIndex.newestWeaponUpdate}. Refreshed monthly.
        </p>
        <p>
          Weapon data and art come from the{' '}
          <a href="https://github.com/wfcd/warframe-items">Warframe Community Developers</a>.
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
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container site-header__inner">
            <Link href="/" className="wordmark">
              Forgeline
            </Link>
            <span className="wordmark__tag">See what every weapon becomes before you sell it</span>
            <nav className="site-nav" aria-label="Main">
              <Link href="/ingredients">Ingredients</Link>
              <Link href="/about">About the data</Link>
            </nav>
          </div>
        </header>
        <main>
          <div className="container">{children}</div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
