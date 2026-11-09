// الحالة العامة + السلة + الخصومات + الإشعارات
import { db } from './db.js';
import { lsGet, lsSet, deviceId } from './util.js';
import { DEFAULT_SITE, DEFAULT_DISCOUNT } from './defaults.js';

export const state = {
  games: [], products: [], banners: [], notifications: [],
  settings: {}, site: { ...DEFAULT_SITE }, discount: { ...DEFAULT_DISCOUNT },
  loaded: false,
};

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((f) => f());

export async function loadAll() {
  const [games, products, banners, notifications, settings] = await Promise.all([
    db.list('games'), db.list('products'), db.list('banners', { order: 'sort', asc: true }),
    db.list('notifications', { limit: 40 }), db.list('settings', { order: null }),
  ]);
  Object.assign(state, { games, products, banners, notifications, loaded: true });
  state.settings = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const site = state.settings.site || {};
  state.site = { ...DEFAULT_SITE, ...site };
  // إضافة أي قسم جديد افتراضي غير موجود في الإعدادات المحفوظة
  const ids = new Set(state.site.sections.map((s) => s.id));
  DEFAULT_SITE.sections.forEach((s) => { if (!ids.has(s.id)) state.site.sections.push({ ...s }); });
  state.discount = { ...DEFAULT_DISCOUNT, ...(state.settings.discount || {}) };
  emit();
}

export async function refreshNotifications() {
  state.notifications = await db.list('notifications', { limit: 40 });
  emit();
}

export const gameById = (id) => state.games.find((g) => g.id === id);
export const productById = (id) => state.products.find((p) => p.id === id);

// ===== السلة (سلتين منفصلتين) =====
const CK = { games: 'jx_cart_games', products: 'jx_cart_products' };
export function cartIds(kind) {
  const ids = lsGet(CK[kind], []);
  const src = kind === 'games' ? state.games : state.products;
  if (!state.loaded) return ids;
  return ids.filter((id) => {
    const r = src.find((x) => x.id === id);
    return r && (kind === 'games' ? r.status === 'available' : r.in_stock !== false);
  });
}
export function inCart(kind, id) { return lsGet(CK[kind], []).includes(id); }
export function addToCart(kind, id) {
  const ids = lsGet(CK[kind], []);
  if (ids.includes(id)) return false;
  ids.push(id); lsSet(CK[kind], ids); emit(); return true;
}
export function removeFromCart(kind, id) { lsSet(CK[kind], lsGet(CK[kind], []).filter((x) => x !== id)); emit(); }
export function clearCart(kind) { lsSet(CK[kind], []); emit(); }
export const cartCount = () => cartIds('games').length + cartIds('products').length;

// حساب الخصم التلقائي (الألعاب فقط، ولا يشمل لعبة واحدة أبداً)
export function autoDiscount(count) {
  const d = state.discount;
  const min = Math.max(2, Number(d.min_count) || 3);
  if (!d.enabled || !d.percent) return { pct: 0, min, missing: null };
  if (count >= min) return { pct: Number(d.percent), min, missing: 0 };
  return { pct: 0, min, missing: min - count };
}
export function cartTotals(kind) {
  const ids = cartIds(kind);
  const rows = ids.map((id) => (kind === 'games' ? gameById(id) : productById(id))).filter(Boolean);
  const subtotal = rows.reduce((s, r) => s + (Number(r.price) || 0), 0);
  const ad = kind === 'games' ? autoDiscount(rows.length) : { pct: 0, missing: null };
  const discount = Math.round((subtotal * ad.pct) / 100);
  return { rows, subtotal, pct: ad.pct, discount, total: subtotal - discount, missing: ad.missing, min: ad.min };
}

// ===== الإعجاب وطلب التوفير =====
export const myVote = (id) => lsGet('jx_votes', {})[id] || 0;
export async function vote(id, v) {
  const cur = myVote(id);
  const next = cur === v ? 0 : v;
  const res = await db.rpc('vote_game', { p_game: id, p_device: deviceId(), p_vote: next });
  const votes = lsGet('jx_votes', {}); votes[id] = next; lsSet('jx_votes', votes);
  const g = gameById(id); if (g && res) { g.likes = res.likes; g.dislikes = res.dislikes; }
  emit();
  return next;
}
export const iRequested = (id) => !!lsGet('jx_requested', {})[id];
export async function requestGame(id) {
  const n = await db.rpc('request_game', { p_game: id, p_device: deviceId() });
  const r = lsGet('jx_requested', {}); r[id] = Date.now(); lsSet('jx_requested', r);
  const g = gameById(id); if (g && typeof n === 'number') g.requests = n;
  refreshNotifications().catch(() => {});
  emit();
  return n;
}

// ===== الإشعارات (إنشاء من لوحة التحكم) =====
export async function notify({ type, icon, title, body, link = null, ref = null }) {
  return db.insert('notifications', { type, icon, title, body, link, ref, meta: {} });
}

// تجميع إضافة عدة ألعاب في إشعار واحد
export async function notifyGameAdded(game) {
  const recent = (await db.list('notifications', { eq: { ref: 'games_added' }, limit: 1 }))[0];
  const fresh = recent && Date.now() - new Date(recent.created_at).getTime() < 30 * 60e3;
  if (fresh) {
    const titles = [...(recent.meta?.titles || []), game.title];
    const n = titles.length;
    const shown = titles.slice(-3).reverse().map((t) => `«${t}»`).join('، ');
    return db.update('notifications', recent.id, {
      title: `تمت إضافة ${n} ألعاب جديدة`,
      body: `${shown}${n > 3 ? ` و${n - 3} غيرها` : ''} — متوفرة الآن في الموقع`,
      link: '#/games?tab=new', meta: { titles }, created_at: new Date().toISOString(),
    });
  }
  return db.insert('notifications', {
    type: 'game_added', icon: '🎮', title: 'لعبة جديدة في الموقع',
    body: `تمت إضافة لعبة «${game.title}»${game.status === 'available' ? (game.language === 'ar' ? ' بالنسخة العربية' : '') + ' — متوفرة الآن' : ' — اطلب توفيرها'}`,
    link: '#/game/' + game.id, ref: 'games_added', meta: { titles: [game.title] },
  });
}

export async function saveSetting(key, value) {
  await db.upsert('settings', { key, value });
  state.settings[key] = value;
  if (key === 'site') state.site = { ...DEFAULT_SITE, ...value };
  if (key === 'discount') state.discount = { ...DEFAULT_DISCOUNT, ...value };
  emit();
}

export const statusLabel = (g) => (g.status === 'available' ? (g.language === 'ar' ? 'متوفرة • عربي' : 'متوفرة • غير عربي') : 'غير متوفرة حالياً');
