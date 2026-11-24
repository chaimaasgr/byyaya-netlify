/* Site client : catalogue, panier, commande */
let P = [], cart = [], view = 'shop', lastOrder = null;
try { cart = JSON.parse(localStorage.getItem('byyaya_cart') || '[]'); } catch (e) {}
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n).toLocaleString('fr-FR') + ' DH';
const sizesOf = p => String(p.sizes || '').split(',').map(s => s.trim()).filter(Boolean);
const pic = p => p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}">` : '💎';
const prod = id => P.find(x => x.id === id);
const saveCart = () => { try { localStorage.setItem('byyaya_cart', JSON.stringify(cart)); } catch (e) {} };

async function init() {
  try { P = await (await fetch('/api/products')).json(); } catch (e) { P = null; }
  render();
}
function go(v) { view = v; render(); window.scrollTo(0, 0); }
function render() {
  ['shop', 'cart'].forEach(n => $('#n-' + n).classList.toggle('on', view === n || (view === 'confirm' && n === 'cart')));
  $('#cc').textContent = cart.reduce((t, i) => t + i.qty, 0);
  $('#app').innerHTML = view === 'shop' ? shop() : view === 'cart' ? cartV() : confirmV();
}

function shop() {
  if (P === null) return '<div class="note">Impossible de charger le catalogue. Réessayez plus tard.</div>';
  if (!P.length) return '<h2>Nos bijoux</h2><div class="note">Aucun article pour le moment. Revenez bientôt 💗</div>';
  return '<h2>Nos bijoux</h2><div class="grid">' + P.map(p => `
    <div class="card"><div class="ph">${pic(p)}</div><div class="in">
      <div class="nm">${esc(p.name)}</div><div class="pr">${money(p.price)}</div>
      <select id="sz${p.id}" aria-label="Taille">${sizesOf(p).map(s => `<option>${esc(s)}</option>`).join('')}</select>
      <button class="btn" onclick="add('${p.id}')">Ajouter au panier</button>
    </div></div>`).join('') + '</div>';
}
function add(id) {
  const size = $('#sz' + id).value, f = cart.find(i => i.id === id && i.size === size);
  f ? f.qty++ : cart.push({ id, size, qty: 1 });
  saveCart(); render();
}
const total = () => cart.reduce((t, i) => { const p = prod(i.id); return t + (p ? p.price * i.qty : 0); }, 0);
function qty(k, d) { cart[k].qty += d; if (cart[k].qty <= 0) cart.splice(k, 1); saveCart(); render(); }

function cartV() {
  cart = cart.filter(i => prod(i.id));
  if (!cart.length) return '<h2>Mon panier</h2><div class="note">Votre panier est vide.<br><br><button class="btn" onclick="go(\'shop\')">Voir le catalogue</button></div>';
  const rows = cart.map((i, k) => { const p = prod(i.id); return `
    <div class="row"><div class="thumb">${pic(p)}</div>
      <div class="sp"><div>${esc(p.name)}</div><div class="mu">Taille : ${esc(i.size)} · ${money(p.price)}</div></div>
      <button class="btn sec sm" onclick="qty(${k},-1)">−</button><b>${i.qty}</b><button class="btn sec sm" onclick="qty(${k},1)">+</button>
      <b style="min-width:84px;text-align:right">${money(p.price * i.qty)}</b>
      <button class="btn dg sm" onclick="qty(${k},-99)" aria-label="Retirer">✕</button></div>`; }).join('');
  return `<h2>Mon panier</h2><div class="box">${rows}<div class="tot">Total : ${money(total())}</div></div>
  <div class="box"><h3>Vos informations</h3>
    <div class="two"><div><label>Nom complet</label><input id="cn"></div><div><label>Téléphone</label><input id="ct" type="tel"></div></div>
    <label>Adresse de livraison</label><input id="ca"><div id="err" class="err"></div>
    <button class="btn" id="ob" style="width:100%;padding:14px" onclick="order()">Confirmer la commande</button></div>`;
}
async function order() {
  const name = $('#cn').value.trim(), phone = $('#ct').value.trim(), addr = $('#ca').value.trim(), e = $('#err');
  if (!name || !phone || !addr) { e.textContent = 'Merci de remplir tous les champs.'; return; }
  $('#ob').disabled = true; e.textContent = 'Envoi en cours…';
  try {
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, addr, items: cart.map(({ id, size, qty }) => ({ id, size, qty })) }) });
    if (!r.ok) throw 0;
    lastOrder = await r.json(); cart = []; saveCart(); go('confirm');
  } catch (x) { e.textContent = 'La commande n’a pas pu être envoyée. Réessayez.'; $('#ob').disabled = false; }
}
function confirmV() {
  const o = lastOrder; if (!o) return '';
  return `<div class="ok"><div class="big">✓</div><h2 style="margin-bottom:6px">Commande confirmée !</h2>
    <p>Merci ${esc(o.name)} 💗<br>Votre commande <b>${esc(o.num)}</b> a bien été enregistrée.</p></div>
  <div class="box">${o.items.map(i => `<div class="row"><div class="sp">${esc(i.name)} <span class="mu">· ${esc(i.size)} × ${i.qty}</span></div><b>${money(i.price * i.qty)}</b></div>`).join('')}
    <div class="tot">Total : ${money(o.total)}</div>
    <div class="mu">Livraison : ${esc(o.addr)} · Tél : ${esc(o.phone)}</div></div>
  <div style="text-align:center"><button class="btn" onclick="go('shop')">Continuer mes achats</button></div>`;
}
init();
