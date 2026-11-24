/* Espace admin : accessible uniquement après connexion */
let P = [], O = [], editId = null, tmpImg = '';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n).toLocaleString('fr-FR') + ' DH';
const pic = p => p.img ? `<img src="${esc(p.img)}" alt="">` : '💎';
const api = (url, method = 'GET', body) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

async function start() {
  const { admin } = await (await api('/api/admin/me')).json();
  if (!admin) return loginView();
  $('#nav').style.display = '';
  await refresh();
}
function loginView() {
  $('#nav').style.display = 'none';
  $('#app').innerHTML = `<h2>Connexion administrateur</h2><div class="box" style="max-width:380px;margin:auto">
    <label>Mot de passe</label><input id="pw" type="password" autofocus>
    <div id="err" class="err"></div><button class="btn" id="lb" style="width:100%">Se connecter</button></div>`;
  const go = async () => {
    const r = await api('/api/admin/login', 'POST', { password: $('#pw').value });
    if (r.ok) start(); else $('#err').textContent = (await r.json()).error || 'Erreur';
  };
  $('#lb').onclick = go; $('#pw').onkeydown = e => { if (e.key === 'Enter') go(); };
}
async function logout() { await api('/api/admin/logout', 'POST'); editId = null; loginView(); }
async function refresh() {
  const [p, o] = await Promise.all([api('/api/products'), api('/api/admin/orders')]);
  if (o.status === 401) return loginView();
  P = await p.json(); O = await o.json(); draw();
}

function draw() {
  const p = editId ? P.find(x => x.id === editId) : null;
  const form = `<div class="box"><h3>${p ? 'Modifier l’article' : 'Ajouter un article'}</h3>
    <div class="two"><div><label>Nom</label><input id="an" value="${p ? esc(p.name) : ''}"></div>
    <div><label>Prix (DH)</label><input id="ap" type="number" min="0" value="${p ? esc(p.price) : ''}"></div></div>
    <label>Tailles (séparées par des virgules)</label><input id="as" placeholder="S, M, L" value="${p ? esc(p.sizes) : ''}">
    <label>Photo</label><input type="file" accept="image/*" onchange="pickImg(this)">
    <div class="thumb" id="prev" style="margin-top:8px">${tmpImg ? `<img src="${tmpImg}" alt="">` : p ? pic(p) : '📷'}</div>
    <div id="err" class="err"></div>
    <button class="btn" onclick="saveP()">${p ? 'Enregistrer' : 'Ajouter'}</button>
    ${p ? '<button class="btn sec" onclick="editId=null;tmpImg=\'\';draw()">Annuler</button>' : ''}</div>`;
  const list = `<div class="box"><h3>Articles (${P.length})</h3>${P.length ? P.map(x => `
    <div class="row"><div class="thumb">${pic(x)}</div>
      <div class="sp"><div>${esc(x.name)}</div><div class="mu">${money(x.price)} · ${esc(x.sizes)}</div></div>
      <button class="btn sec sm" onclick="editId='${x.id}';tmpImg='';draw();scrollTo(0,0)">Modifier</button>
      <button class="btn dg sm" onclick="delP('${x.id}')">Supprimer</button></div>`).join('') : '<div class="mu">Aucun article.</div>'}</div>`;
  const ords = `<div class="box"><h3>Commandes reçues (${O.length})</h3>${O.length ? O.map(o => { const d = o.status === 'done'; return `
    <div class="row"><div class="sp"><b>${esc(o.num)}</b> <span class="mu">${new Date(o.createdAt).toLocaleString('fr-FR')}</span>
      <span class="tag${d ? ' d' : ''}">${d ? 'Traitée' : 'Nouvelle'}</span>
      <div>${esc(o.name)} · ${esc(o.phone)}</div><div class="mu">${esc(o.addr)}</div>
      <div class="mu">${o.items.map(i => `${esc(i.name)} (${esc(i.size)}) ×${i.qty}`).join(', ')}</div></div>
      <b>${money(o.total)}</b>
      <button class="btn sec sm" onclick="setSt('${o.id}','${d ? 'new' : 'done'}')">${d ? 'Rouvrir' : 'Marquer traitée'}</button>
      <button class="btn dg sm" onclick="delO('${o.id}')">✕</button></div>`; }).join('') : '<div class="mu">Aucune commande.</div>'}</div>`;
  $('#app').innerHTML = '<h2>Espace administrateur</h2>' + form + list + ords;
}
function pickImg(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => {
    const s = Math.min(1, 700 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    tmpImg = c.toDataURL('image/jpeg', .82); $('#prev').innerHTML = `<img src="${tmpImg}" alt="">`;
  }; im.src = r.result; };
  r.readAsDataURL(f);
}
async function saveP() {
  const body = { name: $('#an').value, price: $('#ap').value, sizes: $('#as').value, image: tmpImg || undefined };
  if (!body.name.trim() || body.price === '' || !body.sizes.trim()) { $('#err').textContent = 'Nom, prix et tailles sont obligatoires.'; return; }
  const r = editId ? await api('/api/admin/products/' + editId, 'PUT', body) : await api('/api/admin/products', 'POST', body);
  if (!r.ok) { $('#err').textContent = 'Échec de l’enregistrement.'; return; }
  editId = null; tmpImg = ''; refresh();
}
async function delP(id) { if (confirm('Supprimer cet article ?')) { await api('/api/admin/products/' + id, 'DELETE'); refresh(); } }
async function setSt(id, status) { await api('/api/admin/orders/' + id, 'PATCH', { status }); refresh(); }
async function delO(id) { if (confirm('Supprimer cette commande ?')) { await api('/api/admin/orders/' + id, 'DELETE'); refresh(); } }
start();
