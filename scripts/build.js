// Runs on every deploy. Reads public/brand.js and writes lib/defaults.js (first-start menu and settings for the database).
const fs = require('fs'), vm = require('vm'), path = require('path');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'brand.js'), 'utf8'), sb, { timeout: 1000 });
const B = sb.window.BRAND || {}, D = B.defaults || {};
const settings = Object.assign({ shopName: B.name || 'My Coffee Bar', logoText: B.logoText || '', address: '', phone: '', whatsapp: '', hours: '', instagram: '', tiktok: '', currency: 'Rs',
  pickupEnabled: true, deliveryEnabled: false, deliveryFee: 0, freeDeliveryOver: 0, minOrder: 0, deliveryNote: '', onlineEnabled: false, payInstructions: '', metaPixelId: '', currencyCode: 'PKR', ogImage: B.ogImage || '', storyImage: (B.story && B.story.image) || '' }, D.settings || {});
fs.mkdirSync(path.join(__dirname, '..', 'lib'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'lib', 'defaults.js'), 'export default ' + JSON.stringify({ settings, products: D.products || [] }, null, 1) + ';\n');
console.log('defaults.js written (' + (D.products || []).length + ' products)');

// Put the SEO tags and the share image straight into index.html (WhatsApp and Google do not run JavaScript).
const idx = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(idx, 'utf8');
const esc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = u => !u ? '' : /^https?:\/\//i.test(u) ? u : String(B.siteUrl || '').replace(/\/+$/, '') + (String(u).startsWith('/') ? u : '/' + u);
const setMeta = (re, val) => { if (val) html = html.replace(re, (m, a, b) => a + esc(val) + b); };
setMeta(/(<meta property="og:image" content=")[^"]*(")/, abs(B.ogImage));
setMeta(/(<meta name="twitter:image" content=")[^"]*(")/, abs(B.ogImage));
setMeta(/(<meta name="description" content=")[^"]*(")/, B.description);
setMeta(/(<meta property="og:description" content=")[^"]*(")/, B.description);
setMeta(/(<meta property="og:title" content=")[^"]*(")/, B.title);
if (B.title) html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(B.title) + '</title>');
fs.writeFileSync(idx, html);
console.log('index.html meta tags updated');

// Favicon (browser tab icon), drawn from the brand colours: a coffee cup seen from above.
const zlib = require('zlib');
const hexRgb = (h, d) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const v = parseInt(m ? m[1] : d, 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const BG = hexRgb((B.colors || {}).bg, '0A0806'), AC = hexRgb((B.colors || {}).accent, 'D4A24C');
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xFFFFFFFF; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
function drawIcon(size, rounded) {
  const raw = Buffer.alloc((size * 4 + 1) * size), SS = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let a = 0, r = 0, g = 0, bl = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const u = (x + (sx + .5) / SS) * 64 / size, v = (y + (sy + .5) / SS) * 64 / size;
        let inside = true;
        if (rounded) { const cx = Math.min(Math.max(u, 14), 50), cy = Math.min(Math.max(v, 14), 50); inside = Math.hypot(u - cx, v - cy) <= 14; }
        if (!inside) continue;
        const d = Math.hypot(u - 32, v - 32), c = (d <= 22 && d >= 16) || d <= 7 ? AC : BG;
        a++; r += c[0]; g += c[1]; bl += c[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (a) { raw[o] = Math.round(r / a); raw[o + 1] = Math.round(g / a); raw[o + 2] = Math.round(bl / a); raw[o + 3] = Math.round(255 * a / (SS * SS)); }
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hx = c => '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');
const pub = p => path.join(__dirname, '..', 'public', p);
fs.writeFileSync(pub('favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="' + hx(BG) + '"/><circle cx="32" cy="32" r="19" fill="none" stroke="' + hx(AC) + '" stroke-width="6"/><circle cx="32" cy="32" r="7" fill="' + hx(AC) + '"/></svg>\n');
fs.writeFileSync(pub('favicon-32.png'), drawIcon(32, true));
fs.writeFileSync(pub('apple-touch-icon.png'), drawIcon(180, false));
console.log('favicon files written');
