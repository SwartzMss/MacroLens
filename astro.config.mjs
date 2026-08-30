import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const configuredSite = process.env.PUBLIC_SITE_URL;
const isProductionPages = process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH === 'main';

if (isProductionPages && !configuredSite) {
  throw new Error('PUBLIC_SITE_URL is required for production Cloudflare Pages builds');
}

let site;
if (configuredSite) {
  const parsed = new URL(configuredSite);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('PUBLIC_SITE_URL must use http or https');
  site = parsed.origin;
}

export default defineConfig({
  site,
  output: 'static',
  integrations: site ? [sitemap()] : [],
});
