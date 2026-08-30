import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const configuredSite = process.env.PUBLIC_SITE_URL
  || (process.env.CF_PAGES_BRANCH === 'main' ? process.env.CF_PAGES_URL : undefined);

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
