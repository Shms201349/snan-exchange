// جلب بيانات الألعاب من قاعدة RAWG (مصدر رسمي ومجاني)
import { lsGet } from './util.js';

const BASE = 'https://api.rawg.io/api';
const PLATS = '187,18'; // PS5, PS4

export const rawgKey = () => lsGet('jx_rawg_key', '') || (window.APP_CONFIG || {}).RAWG_API_KEY || '';

async function get(path, params = {}) {
  const key = rawgKey();
  if (!key) throw new Error('ضع مفتاح RAWG أولاً من تبويب المزامنة');
  const u = new URL(BASE + path);
  u.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (r.status === 401) throw new Error('مفتاح RAWG غير صحيح');
  if (!r.ok) throw new Error('تعذّر الاتصال بقاعدة الألعاب (' + r.status + ')');
  return r.json();
}

// سلاسل معروفة بوجود نسخ عربية — تُعطى أولوية في المزامنة
const AR_HINTS = ['fc ', 'fifa', 'spider-man', 'god of war', 'uncharted', "assassin's creed", 'call of duty', 'horizon', 'the last of us', 'ghost of tsushima', 'gran turismo', 'resident evil', 'tekken', 'mortal kombat', 'battlefield', 'need for speed', 'far cry', 'ratchet', 'days gone', 'death stranding', 'crash', 'pes', 'efootball', 'wwe', 'nba', 'f1', 'prince of persia', 'watch dogs', 'just cause', 'astro bot', 'stellar blade', 'returnal', 'final fantasy', 'street fighter', 'dying light', 'the crew', 'rainbow six', 'cyberpunk'];
export const likelyArabic = (title) => AR_HINTS.some((h) => (title.toLowerCase() + ' ').includes(h));

export function platformOf(platforms = []) {
  const names = platforms.map((p) => (p.platform ? p.platform.slug : p.slug) || '');
  const p4 = names.includes('playstation4'), p5 = names.includes('playstation5');
  return p4 && p5 ? 'PS4/PS5' : p5 ? 'PS5' : 'PS4';
}

export async function search(term) {
  const d = await get('/games', { search: term, platforms: PLATS, page_size: 6, search_precise: true });
  return d.results.map((g) => ({ rawg_id: g.id, title: g.name, cover: g.background_image, released: g.released, platform: platformOf(g.platforms || []), rating: g.rating }));
}

export async function details(id) {
  const [g, s] = await Promise.all([get('/games/' + id), get(`/games/${id}/screenshots`, { page_size: 8 })]);
  const shots = (s.results || []).map((x) => x.image).filter(Boolean);
  return {
    title: g.name,
    platform: platformOf(g.platforms || []),
    description: (g.description_raw || '').trim().slice(0, 1200),
    cover: g.background_image || '',
    screenshots: shots.filter((x) => x !== g.background_image).slice(0, 6),
    language: likelyArabic(g.name) ? 'ar' : 'en',
  };
}

// يجلب أشهر الألعاب الجديدة (الأولوية للعربي والأكثر شهرة)
export async function discover(excludeTitles, count = 10) {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const [a, b] = await Promise.all([
    get('/games', { platforms: PLATS, ordering: '-added', dates: `${from},${today}`, page_size: 40 }),
    get('/games', { platforms: PLATS, ordering: '-added', page_size: 40 }),
  ]);
  const ex = new Set(excludeTitles.map((t) => t.toLowerCase().trim()));
  const seen = new Set();
  const all = [...a.results, ...b.results].filter((g) => {
    const k = g.name.toLowerCase().trim();
    if (ex.has(k) || seen.has(g.id)) return false;
    seen.add(g.id); return true;
  });
  all.sort((x, y) => (likelyArabic(y.name) - likelyArabic(x.name)) || (y.added - x.added));
  return all.slice(0, count).map((g) => ({ rawg_id: g.id, title: g.name, cover: g.background_image, platform: platformOf(g.platforms || []), arabic: likelyArabic(g.name), added: g.added }));
}

// استخراج اسم اللعبة من رابط (pspkg / dlpsgame / أي موقع)
export function nameFromLink(link) {
  let s = link.trim();
  try { const u = new URL(s); s = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || ''); } catch { return s; }
  return s.replace(/\.(html?|php)$/i, '').replace(/[-_+]+/g, ' ')
    .replace(/\b(ps[345]|pkg|fpkg|download|free|full|game|games|iso|update|dlc|cusa\d+|ppsa\d+|eur|usa|asia|v\d+(\.\d+)*|fw\s?\d+|\d{1,2}\.\d{2}|backport|multi\d*|english|arabic)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}
