// Entry point for Cloudflare Workers. Sends /api/* and /uploads/* to the backend, everything else to the static website.
import { handle, serveUpload } from './lib/api.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/uploads/')) return serveUpload({ env, params: { id: path.split('/')[2] || '' } });
    if (path.startsWith('/api/')) return handle({ request, env, waitUntil: p => ctx.waitUntil(p) });
    return env.ASSETS.fetch(request);
  }
};
