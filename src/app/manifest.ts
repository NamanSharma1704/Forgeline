import type { MetadataRoute } from 'next';

/** Spec 5.10: installable on a phone home screen. Served as /manifest.webmanifest. */

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Forgeline',
    short_name: 'Forgeline',
    description: 'See what every Warframe weapon becomes before you sell it.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#2c2e33',
    theme_color: '#0c0c0e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
