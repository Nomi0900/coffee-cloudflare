// Entry point for Cloudflare Workers. Sends /api/* and /uploads/* to the backend, everything else to the static website.
import { handle, serveUpload, publicMeta } from './lib/api.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/uploads/')) return serveUpload({ env, params: { id: path.split('/')[2] || '' } });
    if (path.startsWith('/api/')) return handle({ request, env, waitUntil: p => ctx.waitUntil(p) });
    const res = await env.ASSETS.fetch(request);
    if (path === '/' || path === '/index.html') {      // put the share image (set in the admin panel) into the page so WhatsApp and Google can see it
      try {
        const meta = await publicMeta(env);
        if (meta.ogImage) {
          const abs = new URL(meta.ogImage, request.url).href, set = { element(el) { el.setAttribute('content', abs); } };
          return new HTMLRewriter().on('meta[property="og:image"]', set).on('meta[name="twitter:image"]', set).transform(res);
        }
      } catch (e) { /* show the normal page */ }
    }
    return res;
  }
};
