import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

export const config = { path: '/api/*' };

/* ---------- Réglages ---------- */
const PASS = () => process.env.ADMIN_PASSWORD || 'yaya2026'; // définir ADMIN_PASSWORD dans Netlify
const SECRET = () => process.env.SESSION_SECRET || 'yaya-session:' + PASS();
const store = () => getStore({ name: 'yaya', consistency: 'strong' });

const SEED = [
  { id: 'p1', name: 'Bague Étoile', price: 350, sizes: 'Taille 50, Taille 52, Taille 54, Taille 56', img: '', createdAt: 1 },
  { id: 'p2', name: 'Collier Perle', price: 520, sizes: '40 cm, 45 cm, 50 cm', img: '', createdAt: 2 },
  { id: 'p3', name: 'Bracelet Rosé', price: 280, sizes: 'S, M, L', img: '', createdAt: 3 },
  { id: 'p4', name: 'Boucles Lune', price: 190, sizes: 'Taille unique', img: '', createdAt: 4 },
];

/* ---------- Utilitaires ---------- */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const clean = (s, max = 200) => String(s ?? '').trim().slice(0, max);
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const sign = exp => crypto.createHmac('sha256', SECRET()).update(String(exp)).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function isAdmin(req) {
  const m = /(?:^|; )yaya_admin=([^;]*)/.exec(req.headers.get('cookie') || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function all(s, prefix) {
  const { blobs } = await s.list({ prefix });
  return (await Promise.all(blobs.map(b => s.get(b.key, { type: 'json' })))).filter(Boolean);
}
async function products(s) {
  if (!(await s.get('seeded'))) {
    await Promise.all(SEED.map(p => s.setJSON('product:' + p.id, p)));
    await s.set('seeded', '1');
  }
  return (await all(s, 'product:')).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
function parseProduct(b) {
  const name = clean(b.name, 80), sizes = clean(b.sizes, 200), price = Number(b.price);
  if (!name || !sizes || !Number.isFinite(price) || price < 0) return null;
  return { name, sizes, price };
}
async function saveImage(s, id, dataUrl) {
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl || '') || dataUrl.length > 4_000_000) return null;
  await s.set('img:' + id, dataUrl);
  return '/api/img/' + id + '?v=' + Date.now();
}

/* ---------- Routes ---------- */
export default async (req) => {
  const s = store();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '');
  const method = req.method;
  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await req.json().catch(() => ({})) : {};
  let m;

  try {
    /* --- Public --- */
    if (method === 'GET' && path === '/products') return json(await products(s));

    if (method === 'GET' && (m = /^\/img\/([\w-]+)$/.exec(path))) {
      const d = await s.get('img:' + m[1]);
      const x = d && /^data:(image\/\w+);base64,(.+)$/.exec(d);
      if (!x) return new Response('Not found', { status: 404 });
      return new Response(Buffer.from(x[2], 'base64'), { headers: { 'content-type': x[1], 'cache-control': 'public, max-age=31536000, immutable' } });
    }

    if (method === 'POST' && path === '/orders') {
      const { name, phone, addr, items } = body;
      if (!clean(name) || !clean(phone, 30) || !clean(addr, 300) || !Array.isArray(items) || !items.length)
        return json({ error: 'Informations manquantes' }, 400);
      const catalog = await products(s), lines = [];
      for (const it of items.slice(0, 50)) {
        const p = catalog.find(x => x.id === it.id), qty = Math.floor(Number(it.qty));
        if (!p || !(qty > 0 && qty <= 99)) return json({ error: 'Article invalide' }, 400);
        lines.push({ name: p.name, size: clean(it.size, 40), qty, price: p.price }); // prix pris côté serveur
      }
      const id = crypto.randomUUID();
      const order = {
        id, num: 'BY-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
        name: clean(name), phone: clean(phone, 30), addr: clean(addr, 300),
        items: lines, total: lines.reduce((t, l) => t + l.price * l.qty, 0), status: 'new', createdAt: Date.now(),
      };
      await s.setJSON('order:' + id, order);
      return json(order);
    }

    /* --- Admin : connexion --- */
    if (method === 'POST' && path === '/admin/login') {
      if (crypto.timingSafeEqual(sha(body.password), sha(PASS()))) {
        const exp = Date.now() + 12 * 3600 * 1000;
        return json({ ok: true }, 200, { 'set-cookie': `yaya_admin=${exp}.${sign(exp)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200` });
      }
      await sleep(700);
      return json({ error: 'Mot de passe incorrect' }, 401);
    }
    if (method === 'POST' && path === '/admin/logout')
      return json({ ok: true }, 200, { 'set-cookie': 'yaya_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });
    if (method === 'GET' && path === '/admin/me') return json({ admin: isAdmin(req) });

    /* --- Admin : protégé --- */
    if (path.startsWith('/admin/')) {
      if (!isAdmin(req)) return json({ error: 'Non autorisé' }, 401);

      if (method === 'GET' && path === '/admin/orders')
        return json((await all(s, 'order:')).sort((a, b) => b.createdAt - a.createdAt));

      if (method === 'POST' && path === '/admin/products') {
        const d = parseProduct(body);
        if (!d) return json({ error: 'Nom, prix et tailles obligatoires' }, 400);
        const id = 'p' + Date.now().toString(36);
        const p = { id, ...d, img: '', createdAt: Date.now() };
        if (body.image) p.img = (await saveImage(s, id, body.image)) || '';
        await s.setJSON('product:' + id, p);
        return json(p);
      }
      if ((m = /^\/admin\/products\/([\w-]+)$/.exec(path))) {
        const p = await s.get('product:' + m[1], { type: 'json' });
        if (!p) return json({ error: 'Introuvable' }, 404);
        if (method === 'PUT') {
          const d = parseProduct(body);
          if (!d) return json({ error: 'Nom, prix et tailles obligatoires' }, 400);
          Object.assign(p, d);
          if (body.image) p.img = (await saveImage(s, p.id, body.image)) || p.img;
          await s.setJSON('product:' + p.id, p);
          return json(p);
        }
        if (method === 'DELETE') {
          await s.delete('product:' + p.id); await s.delete('img:' + p.id);
          return json({ ok: true });
        }
      }
      if ((m = /^\/admin\/orders\/([\w-]+)$/.exec(path))) {
        const o = await s.get('order:' + m[1], { type: 'json' });
        if (!o) return json({ error: 'Introuvable' }, 404);
        if (method === 'PATCH') { o.status = body.status === 'done' ? 'done' : 'new'; await s.setJSON('order:' + o.id, o); return json(o); }
        if (method === 'DELETE') { await s.delete('order:' + o.id); return json({ ok: true }); }
      }
    }
    return json({ error: 'Introuvable' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: 'Erreur serveur' }, 500);
  }
};
