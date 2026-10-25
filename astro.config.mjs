import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { unified } from '@astrojs/markdown-remark';
import { remarkCallouts, remarkMermaid, rehypeSite } from './src/plugins/markdown.ts';

const base = process.env.BASE_PATH || '/';
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkCallouts, remarkMermaid, remarkMath],
      rehypePlugins: [rehypeRaw, [rehypeSite, { base }], rehypeKatex],
      shikiConfig: { theme: 'github-light' },
    }),
  },
});
