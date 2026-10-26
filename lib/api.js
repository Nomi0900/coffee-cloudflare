// Coffee bar backend for Cloudflare Pages Functions + D1 (SQLite). No servers, no npm packages.
import DEFAULTS from './defaults.js';

const J = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
const bad = (m, s = 400) => J({ error: m }, s);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const urlOk = v => { v = str(v, 500); return /^(https?:\/\/|\/)/i.test(v) ? v : ''; };
const clean = v => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim();
const enc = new TextEncoder();

/* ---------- database ---------- */
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT)',
  'CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, descr TEXT, price INTEGER, category TEXT, tag TEXT, image TEXT, available INTEGER, grp TEXT DEFAULT \'\')',
  'CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, text TEXT, stars INTEGER, visible INTEGER, status TEXT DEFAULT \'approved\', created_at TEXT)',
  'CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, name TEXT, phone TEXT, note TEXT, type TEXT, address TEXT, pay_method TEXT, pay_ref TEXT, pay_status TEXT, items TEXT, subtotal INTEGER, fee INTEGER, total INTEGER, status TEXT)',
  'CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, mime TEXT, data TEXT, created_at TEXT)',
  'CREATE TABLE IF NOT EXISTS hits(k TEXT, t INTEGER)'
];
let ready = false;
async function init(DB) {
  if (ready) return;
  await DB.batch(SCHEMA.map(s => DB.prepare(s)));
  const cols = (await DB.prepare('PRAGMA table_info(products)').all()).results.map(r => r.name);      // upgrade older databases
  if (!cols.includes('grp')) {
    await DB.prepare("ALTER TABLE products ADD COLUMN grp TEXT DEFAULT ''").run();
    const fill = DEFAULTS.products.filter(p => p.grp).map(p => DB.prepare("UPDATE products SET grp=? WHERE name=? AND (grp IS NULL OR grp='')").bind(p.grp, p.name));
    if (fill.length) await DB.batch(fill);
  }
  const rcols = (await DB.prepare('PRAGMA table_info(reviews)').all()).results.map(r => r.name);      // upgrade older databases
  if (!rcols.includes('status')) await DB.prepare("ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'approved'").run();
  if (!rcols.includes('created_at')) await DB.prepare('ALTER TABLE reviews ADD COLUMN created_at TEXT').run();
  // add any default setting that is missing (never overwrites a value the owner already saved)
  await DB.batch(Object.entries(DEFAULTS.settings).map(([k, v]) => DB.prepare('INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)').bind(k, JSON.stringify(v))));
  const done = await DB.prepare("SELECT v FROM settings WHERE k='_seeded'").first();
  if (!done) {
    if (DEFAULTS.products.length) await DB.batch(DEFAULTS.products.map(p => DB.prepare('INSERT INTO products(name,descr,price,category,tag,image,grp,available) VALUES(?,?,?,?,?,?,?,1)').bind(p.name, p.desc || '', p.price, p.category === 'product' ? 'product' : 'drink', p.tag || '', p.image || '', p.grp || '')));
    await DB.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES('_seeded','true')").run();
  }
  ready = true;
}
const getSettings = async DB => { const o = {}; (await DB.prepare("SELECT k,v FROM settings WHERE substr(k,1,1) <> '_'").all()).results.forEach(r => { try { o[r.k] = JSON.parse(r.v); } catch (e) { o[r.k] = r.v; } }); return o; };
const setSetting = (DB, k, v) => DB.prepare('INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)').bind(k, JSON.stringify(v));
const prod = r => ({ id: r.id, name: r.name, desc: r.descr, price: r.price, category: r.category, tag: r.tag, image: r.image, grp: r.grp || '', available: !!r.available });
const rev = r => ({ id: r.id, name: r.name, text: r.text, stars: r.stars, visible: !!r.visible, status: r.status || 'approved', createdAt: r.created_at || '' });
const ord = r => ({ id: r.id, createdAt: r.created_at, name: r.name, phone: r.phone, note: r.note, type: r.type, address: r.address, payMethod: r.pay_method, payRef: r.pay_ref, payStatus: r.pay_status, items: JSON.parse(r.items), subtotal: r.subtotal, fee: r.fee, total: r.total, status: r.status });

async function limited(DB, key, max, ms) {
  const now = Date.now();
  await DB.prepare('DELETE FROM hits WHERE t<?').bind(now - 3600e3).run();
  await DB.prepare('INSERT INTO hits(k,t) VALUES(?,?)').bind(key, now).run();
  const r = await DB.prepare('SELECT COUNT(*) AS n FROM hits WHERE k=? AND t>?').bind(key, now - ms).first();
  return r.n > max;
}

/* ---------- login ---------- */
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, msg) { const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg))); }
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const secretOf = env => (env.SESSION_SECRET || '') + '|' + (env.ADMIN_PASSWORD || '');
async function authed(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.get('Cookie') || ''); if (!m) return false;
  const [exp, sig] = m[1].split('.'); if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await hmac(secretOf(env), exp));
}

/* ---------- alerts ---------- */
const info = env => ({ email: !!(env.NOTIFY_EMAIL && env.RESEND_API_KEY), whatsapp: !!(env.WHATSAPP_PHONE && env.CALLMEBOT_KEY), telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID), push: !!env.NTFY_TOPIC, discord: !!env.DISCORD_WEBHOOK_URL, slack: !!env.SLACK_WEBHOOK_URL });
const TZN = env => env.SHOP_TZ || 'Asia/Karachi';
const money = (S, n) => (S.currency || 'Rs') + ' ' + Number(n).toLocaleString('en-US');
const when = (env, iso) => new Date(iso).toLocaleString('en-GB', { timeZone: TZN(env), dateStyle: 'medium', timeStyle: 'short' });
const dayOf = (env, iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZN(env) });
function orderText(env, S, o) {
  const t = o.type === 'delivery', pay = o.payMethod === 'online' ? 'PAID ONLINE? Transaction ID: ' + clean(o.payRef) + ' (please verify)' : (t ? 'Cash on delivery' : 'Pay at pickup');
  return ['NEW ' + (t ? 'DELIVERY' : 'PICKUP') + ' ORDER #' + o.id, clean(o.name) + ' · ' + clean(o.phone)].concat(t ? ['Address: ' + clean(o.address)] : [], [''],
    o.items.map(i => i.qty + ' x ' + clean(i.name)), [''], o.fee ? ['Delivery fee: ' + money(S, o.fee)] : [], ['Total: ' + money(S, o.total), pay], o.note ? ['Note: ' + clean(o.note)] : [], [when(env, o.createdAt)]).join('\n');
}
async function notify(env, subject, text, origin) {
  const out = {}, i = info(env);
  await Promise.all([
    ['email', async () => {
      if (!i.email) return 'not set up';
      const r = await fetch((env.RESEND_URL || 'https://api.resend.com/emails'), { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM || 'onboarding@resend.dev', to: [env.NOTIFY_EMAIL], subject: clean(subject), text }) });
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'sent';
    }],
    ['whatsapp', async () => {
      if (!i.whatsapp) return 'not set up';
      const u = (env.CALLMEBOT_URL || 'https://api.callmebot.com/whatsapp.php') + '?phone=' + encodeURIComponent(String(env.WHATSAPP_PHONE).replace(/\D/g, '')) + '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(env.CALLMEBOT_KEY);
      const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return 'sent';
    }],
    ['telegram', async () => {
      if (!i.telegram) return 'not set up';
      const r = await fetch((env.TELEGRAM_API || 'https://api.telegram.org') + '/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }) });
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'sent';
    }],
    ['push', async () => {
      if (!i.push) return 'not set up';
      const h = { Title: clean(subject).replace(/[^\x20-\x7E]/g, '') || 'New order', Priority: 'high', Tags: 'coffee' };
      if (origin) h.Click = origin + '/admin/';
      if (env.NTFY_TOKEN) h.Authorization = 'Bearer ' + env.NTFY_TOKEN;
      const r = await fetch((env.NTFY_SERVER || 'https://ntfy.sh') + '/' + encodeURIComponent(env.NTFY_TOPIC), { method: 'POST', headers: h, body: text });
      if (r.status >= 520 && r.status <= 530) throw new Error('ntfy.sh could not be reached from Cloudflare (HTTP ' + r.status + '). Use Telegram or Discord instead');
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'sent';
    }],
    ['discord', async () => {
      if (!i.discord) return 'not set up';
      const r = await fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900) }) });
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'sent';
    }],
    ['slack', async () => {
      if (!i.slack) return 'not set up';
      const r = await fetch(env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'sent';
    }]
  ].map(async ([k, fn]) => { try { out[k] = await fn(); } catch (e) { out[k] = 'failed: ' + clean(e.message).slice(0, 120); } }));
  return out;
}
const csvCell = v => { let s = String(v == null ? '' : v); if (/^(=|@|\t|\r)|^[+\-](?![\d\s()\-]+$)/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

/* ---------- validation ---------- */
const prodIn = b => { const name = str(b.name, 80), price = int(b.price, 0, 1e6); if (!name || price === null) return null; return { name, desc: str(b.desc, 160), price, category: b.category === 'product' ? 'product' : 'drink', tag: str(b.tag, 40), grp: str(b.grp, 24), image: urlOk(b.image), available: b.available !== false }; };
const revIn = b => { const text = str(b.text, 300), name = str(b.name, 60), stars = int(b.stars, 1, 5); if (!text || !name || stars === null) return null; return { name, text, stars, visible: b.visible !== false }; };

/* ---------- main handler ---------- */
export async function handle(c) {
  const { request: req, env } = c, url = new URL(req.url), p = url.pathname, m = req.method, DB = env.DB;
  if (!DB) return bad('The database is not connected yet. In Cloudflare, add a D1 binding named DB.', 500);
  await init(DB);
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  let body = {};
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    const ct = req.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) { if (Number(req.headers.get('Content-Length') || 0) > 60000) return bad('Request too large', 413); body = await req.json().catch(() => ({})); }
  }
  const S = await getSettings(DB);

  /* public */
  if (p === '/api/site' && m === 'GET') {
    const products = (await DB.prepare('SELECT * FROM products WHERE available=1 ORDER BY id').all()).results.map(prod);
    const reviews = (await DB.prepare('SELECT * FROM reviews WHERE visible=1 ORDER BY id').all()).results.map(rev);
    return J({ settings: { shopName: S.shopName, logoText: S.logoText, address: S.address, phone: S.phone, whatsapp: S.whatsapp, hours: S.hours, instagram: S.instagram, tiktok: S.tiktok, currency: S.currency,
      pickupEnabled: S.pickupEnabled !== false || !S.deliveryEnabled, deliveryEnabled: !!S.deliveryEnabled, deliveryFee: S.deliveryFee, freeDeliveryOver: S.freeDeliveryOver, minOrder: S.minOrder, deliveryNote: S.deliveryNote, onlineEnabled: !!S.onlineEnabled, payInstructions: S.payInstructions, metaPixelId: S.metaPixelId || '', currencyCode: S.currencyCode || 'PKR', storyImage: S.storyImage || '' }, products, reviews },
      200, { 'Cache-Control': 'no-cache' });
  }

  if (p === '/api/orders' && m === 'POST') {
    if (await limited(DB, 'o' + ip, 8, 10 * 60e3)) return bad('Too many orders, please try again later', 429);
    const b = body, name = str(b.name, 80), phone = str(b.phone, 25), note = str(b.note, 300);
    if (!name) return bad('Please enter your name');
    if (!/^[+\d][\d\s\-()]{6,}$/.test(phone)) return bad('Please enter a valid phone number');
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30) return bad('Your cart is empty');
    const type = b.type === 'delivery' ? 'delivery' : 'pickup', pm = b.payMethod === 'online' ? 'online' : 'cash';
    if (type === 'delivery' && !S.deliveryEnabled) return bad('Delivery is not available right now');
    if (type === 'pickup' && !(S.pickupEnabled !== false || !S.deliveryEnabled)) return bad('Pickup is not available right now');
    const address = str(b.address, 200);
    if (type === 'delivery' && address.length < 6) return bad('Please enter your full delivery address');
    const payRef = str(b.payRef, 60);
    if (pm === 'online' && !S.onlineEnabled) return bad('Online payment is not available right now');
    if (pm === 'online' && payRef.length < 4) return bad('Please enter your payment transaction ID');
    const rows = (await DB.prepare('SELECT * FROM products').all()).results.map(prod), lines = []; let subtotal = 0;
    for (const it of b.items) {
      const pr = rows.find(x => x.id === Number(it && it.id)), q = int(it && it.qty, 1, 20);
      if (!pr || !pr.available || q === null) return bad('An item in your cart is no longer available');
      lines.push({ id: pr.id, name: pr.name, price: pr.price, qty: q }); subtotal += pr.price * q;      // prices always come from the database
    }
    if (S.minOrder > 0 && subtotal < S.minOrder) return bad('The minimum order is ' + money(S, S.minOrder));
    const fee = type === 'delivery' ? ((S.freeDeliveryOver > 0 && subtotal >= S.freeDeliveryOver) ? 0 : (S.deliveryFee || 0)) : 0, total = subtotal + fee, createdAt = new Date().toISOString();
    const r = await DB.prepare('INSERT INTO orders(created_at,name,phone,note,type,address,pay_method,pay_ref,pay_status,items,subtotal,fee,total,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(createdAt, name, phone, note, type, type === 'delivery' ? address : '', pm, pm === 'online' ? payRef : '', pm === 'online' ? 'awaiting' : 'unpaid', JSON.stringify(lines), subtotal, fee, total, 'new').run();
    const order = { id: r.meta.last_row_id, createdAt, name, phone, note, type, address, payMethod: pm, payRef, items: lines, fee, total };
    const task = notify(env, 'New ' + type + ' order #' + order.id + ' (' + money(S, total) + ')', orderText(env, S, order), url.origin);
    if (c.waitUntil) c.waitUntil(task); else await task;
    return J({ id: order.id, total, fee, type, payMethod: pm });
  }

  if (p === '/api/reviews' && m === 'POST') {
    const b = body;
    if (b.website) return J({ ok: true });                                   // hidden field filled in = a bot; pretend it worked
    if (await limited(DB, 'r' + ip, 3, 3600e3)) return bad('You have sent several reviews already. Please try again later.', 429);
    const name = str(b.name, 60), text = str(b.text, 300), stars = int(b.stars, 1, 5);
    if (name.length < 2) return bad('Please enter your name');
    if (stars === null) return bad('Please choose a star rating');
    if (text.length < 10) return bad('Please write at least 10 characters');
    if (/https?:\/\/|www\./i.test(text) || /https?:\/\/|www\./i.test(name)) return bad('Please do not include links');
    const r = await DB.prepare("INSERT INTO reviews(name,text,stars,visible,status,created_at) VALUES(?,?,?,0,'pending',?)").bind(name, text, stars, new Date().toISOString()).run();
    const task = notify(env, 'New review waiting for approval (' + stars + ' stars)', 'NEW REVIEW (waiting for your approval)\n' + stars + ' stars · ' + clean(name) + '\n' + clean(text) + '\nApprove it in the admin panel: ' + url.origin + '/admin/', url.origin);
    if (c.waitUntil) c.waitUntil(task); else await task;
    return J({ ok: true, id: r.meta.last_row_id });
  }

  /* admin */
  if (p === '/api/admin/login' && m === 'POST') {
    if (!env.ADMIN_PASSWORD) return bad('ADMIN_PASSWORD is not set in Cloudflare yet', 500);
    if (await limited(DB, 'l' + ip, 6, 10 * 60e3)) return bad('Too many attempts, wait 10 minutes', 429);
    const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(s)))), a = await h(body.password), b2 = await h(env.ADMIN_PASSWORD);
    let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b2[i];
    if (d) return bad('Wrong password', 401);
    const exp = Date.now() + 12 * 3600e3, sid = exp + '.' + await hmac(secretOf(env), String(exp));
    return J({ ok: true }, 200, { 'Set-Cookie': 'sid=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200' + (url.protocol === 'https:' ? '; Secure' : '') });
  }
  if (p === '/api/admin/logout' && m === 'POST') return J({ ok: true }, 200, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  if (!p.startsWith('/api/admin/')) return bad('Not found', 404);
  if (!(await authed(req, env))) return bad('Please log in', 401);

  let mt;
  if (p === '/api/admin/data' && m === 'GET') {
    const [pr, rv, od] = await Promise.all([DB.prepare('SELECT * FROM products ORDER BY id').all(), DB.prepare('SELECT * FROM reviews ORDER BY id').all(), DB.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1000').all()]);
    return J({ settings: S, products: pr.results.map(prod), reviews: rv.results.map(rev), orders: od.results.map(ord), alerts: info(env) });
  }
  if (p === '/api/admin/orders-new' && m === 'GET') {        // tiny check used by the admin page to notice new orders
    const since = Number(url.searchParams.get('since')) || 0;
    const rows = (await DB.prepare('SELECT id,name,total,type FROM orders WHERE id>? ORDER BY id DESC LIMIT 5').bind(since).all()).results;
    return J({ count: rows.length, max: rows.length ? rows[0].id : since, latest: rows[0] || null });
  }
  if (p === '/api/admin/products' && m === 'POST') {
    const v = prodIn(body); if (!v) return bad('Name and a valid price are required');
    const r = await DB.prepare('INSERT INTO products(name,descr,price,category,tag,image,grp,available) VALUES(?,?,?,?,?,?,?,?)').bind(v.name, v.desc, v.price, v.category, v.tag, v.image, v.grp, v.available ? 1 : 0).run();
    return J({ id: r.meta.last_row_id, ...v });
  }
  if ((mt = p.match(/^\/api\/admin\/products\/(\d+)$/))) {
    if (m === 'PUT') { const v = prodIn(body); if (!v) return bad('Name and a valid price are required'); await DB.prepare('UPDATE products SET name=?,descr=?,price=?,category=?,tag=?,image=?,grp=?,available=? WHERE id=?').bind(v.name, v.desc, v.price, v.category, v.tag, v.image, v.grp, v.available ? 1 : 0, Number(mt[1])).run(); return J({ id: Number(mt[1]), ...v }); }
    if (m === 'DELETE') { await DB.prepare('DELETE FROM products WHERE id=?').bind(Number(mt[1])).run(); return J({ ok: true }); }
  }
  if (p === '/api/admin/reviews' && m === 'POST') {
    const v = revIn(body); if (!v) return bad('Name, text and 1-5 stars are required');
    const r = await DB.prepare("INSERT INTO reviews(name,text,stars,visible,status,created_at) VALUES(?,?,?,?,'approved',?)").bind(v.name, v.text, v.stars, v.visible ? 1 : 0, new Date().toISOString()).run();
    return J({ id: r.meta.last_row_id, ...v });
  }
  if ((mt = p.match(/^\/api\/admin\/reviews\/(\d+)$/))) {
    if (m === 'PUT') { const v = revIn(body); if (!v) return bad('Name, text and 1-5 stars are required'); await DB.prepare("UPDATE reviews SET name=?,text=?,stars=?,visible=?,status=CASE WHEN ?=1 THEN 'approved' ELSE status END WHERE id=?").bind(v.name, v.text, v.stars, v.visible ? 1 : 0, v.visible ? 1 : 0, Number(mt[1])).run(); return J({ id: Number(mt[1]), ...v }); }
    if (m === 'PATCH') { await DB.prepare("UPDATE reviews SET visible=1,status='approved' WHERE id=?").bind(Number(mt[1])).run(); return J({ ok: true }); }
    if (m === 'DELETE') { await DB.prepare('DELETE FROM reviews WHERE id=?').bind(Number(mt[1])).run(); return J({ ok: true }); }
  }
  if (p === '/api/admin/settings' && m === 'PUT') {
    const b = body, s = { ...S }, L = { shopName: 80, logoText: 20, address: 200, phone: 30, hours: 500, currency: 8 };
    for (const k in L) if (typeof b[k] === 'string') s[k] = str(b[k], L[k]);
    if (typeof b.whatsapp === 'string') s.whatsapp = b.whatsapp.replace(/\D/g, '').slice(0, 20);
    for (const k of ['instagram', 'tiktok']) if (typeof b[k] === 'string') s[k] = urlOk(b[k]);
    for (const k of ['pickupEnabled', 'deliveryEnabled', 'onlineEnabled']) if (typeof b[k] === 'boolean') s[k] = b[k];
    for (const k of ['deliveryFee', 'freeDeliveryOver', 'minOrder']) if (b[k] !== undefined) { const n = int(b[k], 0, 1e7); if (n !== null) s[k] = n; }
    for (const [k, mx] of [['deliveryNote', 300], ['payInstructions', 600]]) if (typeof b[k] === 'string') s[k] = str(b[k], mx);
    for (const k of ['storyImage', 'ogImage']) if (typeof b[k] === 'string') s[k] = urlOk(b[k]);
    if (typeof b.metaPixelId === 'string') s.metaPixelId = b.metaPixelId.replace(/\D/g, '').slice(0, 20);
    if (typeof b.currencyCode === 'string') s.currencyCode = b.currencyCode.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || s.currencyCode || 'PKR';
    if (!s.pickupEnabled && !s.deliveryEnabled) s.pickupEnabled = true;
    await DB.batch(Object.keys(s).map(k => setSetting(DB, k, s[k])));
    return J(s);
  }
  if ((mt = p.match(/^\/api\/admin\/orders\/(\d+)$/)) && m === 'PATCH') {
    const row = await DB.prepare('SELECT * FROM orders WHERE id=?').bind(Number(mt[1])).first(); if (!row) return bad('Not found', 404);
    if (body.status !== undefined) { if (!['new', 'preparing', 'ready', 'delivering', 'done', 'cancelled'].includes(body.status)) return bad('Bad status'); await DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(body.status, row.id).run(); }
    if (body.payStatus !== undefined) { if (!['unpaid', 'awaiting', 'paid'].includes(body.payStatus)) return bad('Bad payment status'); await DB.prepare('UPDATE orders SET pay_status=? WHERE id=?').bind(body.payStatus, row.id).run(); }
    return J(ord(await DB.prepare('SELECT * FROM orders WHERE id=?').bind(row.id).first()));
  }
  if (p === '/api/admin/test-notify' && m === 'POST') {
    if (await limited(DB, 't' + ip, 5, 10 * 60e3)) return bad('Too many tests, wait a few minutes', 429);
    return J(await notify(env, 'Test alert from your coffee site', 'TEST ALERT\nIf you can read this, order alerts work.\n' + when(env, new Date().toISOString()), url.origin));
  }
  if (p === '/api/admin/orders.csv' && m === 'GET') {
    const ok = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '', f = ok(url.searchParams.get('from')), t = ok(url.searchParams.get('to'));
    const rows = (await DB.prepare('SELECT * FROM orders ORDER BY id').all()).results.map(ord).filter(o => { const d = dayOf(env, o.createdAt); return (!f || d >= f) && (!t || d <= t); });
    const cur = S.currency, out = [['Order #', 'Date', 'Time', 'Customer', 'Phone', 'Type', 'Address', 'Items', 'Subtotal (' + cur + ')', 'Delivery fee', 'Total (' + cur + ')', 'Payment', 'Payment ref', 'Payment status', 'Order status', 'Note']]; let sum = 0;
    rows.forEach(o => { if (o.status !== 'cancelled') sum += o.total;
      out.push([o.id, dayOf(env, o.createdAt), new Date(o.createdAt).toLocaleTimeString('en-GB', { timeZone: TZN(env), hour: '2-digit', minute: '2-digit' }), o.name, o.phone, o.type, o.address, o.items.map(i => i.qty + ' x ' + i.name).join('; '),
        o.subtotal, o.fee, o.total, o.payMethod === 'online' ? 'Online' : (o.type === 'delivery' ? 'Cash on delivery' : 'Pay at pickup'), o.payRef, o.payStatus, o.status, o.note]); });
    out.push(['', '', '', '', '', '', '', 'TOTAL (cancelled orders excluded)', '', '', sum, '', '', '', '', '']);
    return new Response('\ufeff' + out.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="orders-' + dayOf(env, new Date().toISOString()) + '.csv"', 'Cache-Control': 'no-store' } });
  }
  if (p === '/api/admin/upload' && m === 'POST') {
    const type = (req.headers.get('Content-Type') || '').split(';')[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return bad('Please choose a JPG, PNG or WebP photo');
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length < 100) return bad('That file is not a valid photo');
    if (buf.length > 1400000) return bad('The photo is too big (max about 1 MB). Try a smaller photo.');
    const dec = a => String.fromCharCode(...a);
    let mime = null;
    if (buf[0] === 0xFF && buf[1] === 0xD8) mime = 'image/jpeg'; else if (dec(buf.slice(1, 4)) === 'PNG') mime = 'image/png'; else if (dec(buf.slice(0, 4)) === 'RIFF' && dec(buf.slice(8, 12)) === 'WEBP') mime = 'image/webp';
    if (!mime) return bad('That file is not a valid photo');
    let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    const id = hex(crypto.getRandomValues(new Uint8Array(8)));
    await DB.prepare('INSERT INTO uploads(id,mime,data,created_at) VALUES(?,?,?,?)').bind(id, mime, btoa(bin), new Date().toISOString()).run();
    return J({ url: '/uploads/' + id });
  }
  return bad('Not found', 404);
}

export async function publicMeta(env) {          // used by worker.js to put the share image into the page for WhatsApp and Google
  if (!env.DB) return {};
  await init(env.DB);
  const S = await getSettings(env.DB);
  return { ogImage: S.ogImage || '' };
}

export async function serveUpload(c) {
  const DB = c.env.DB; if (!DB) return new Response('Database not connected', { status: 500 });
  await init(DB);
  const id = String(c.params.id || '').replace(/[^a-f0-9]/g, '');
  const r = await DB.prepare('SELECT mime,data FROM uploads WHERE id=?').bind(id).first();
  if (!r) return new Response('Not found', { status: 404 });
  const bin = atob(r.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Response(u8, { headers: { 'Content-Type': r.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
