/**
 * The site's own identity for the page head: its address, the share card, and the copyright year.
 */

import type { Metadata } from 'next';

export const SITE_NAME = 'Forgeline';

/**
 * The live address, which share cards need as absolute URLs. Vercel sets the production domain at
 * build time, so the cards follow a custom domain if one is added; local builds use today's.
 */
export const SITE_URL = new URL(
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://forgeline-arsenal.vercel.app'
);

/** The year of the build, for the copyright line. Every data refresh rebuilds the site. */
export const COPYRIGHT_YEAR = new Date().getFullYear();

/** public/og-image.png: the card every shared link shows. */
const SHARE_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'The Forgeline crest beside the question "Can I sell this weapon?" and the three verdicts: safe to sell, check recipes, keep for build.',
};

/**
 * Open Graph and X card tags for one page. A page that sets these replaces the layout's whole set
 * (Next merges metadata shallowly), so every page with its own title passes all of it, and a link
 * to a weapon shares as that weapon rather than as the home page.
 */
export function shareMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  /** The page's own path, with the trailing slash the site uses. */
  path: string;
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SHARE_IMAGE],
    },
  };
}
