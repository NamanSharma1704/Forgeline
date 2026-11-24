import type { NextConfig } from 'next';

/**
 * Forgeline is a static site: every page is pre-rendered at build time and served from a CDN with
 * no server behind it. See docs/build-plan.md section 0.
 *
 * `output: 'export'` is what keeps that promise honest. It fails the build if a page ever reaches
 * for a request-time feature, which is exactly the guard we want while the site stays static.
 *
 * Images are pre-converted to WebP in two sizes by scripts/fetch-images.mjs, so Next's image
 * optimiser has nothing to add and is turned off.
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
