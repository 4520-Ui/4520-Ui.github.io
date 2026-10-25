import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const sitemap = new URL(`${base.replace(/\/$/, '')}/sitemap-index.xml`, site || 'http://localhost:4321');
  const text = site?.hostname === 'localhost' ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
