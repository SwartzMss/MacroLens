import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://macrolens.example',
  output: 'static',
  integrations: [sitemap()],
});
