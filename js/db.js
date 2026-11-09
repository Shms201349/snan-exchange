// طبقة البيانات: Supabase (فعلي) أو المتصفح (تجريبي) بنفس الواجهة
import { SEED } from './seed.js';
import { uid, blobToDataURL, ssGet, ssSet } from './util.js';

const C = window.APP_CONFIG || {};
const wantsCloud = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
export const mode = wantsCloud ? (window.supabase ? 'cloud' : 'error') : 'local';

const KEYS = { settings: 'key', coupons: 'code', game_sources: 'game_id' };
const keyOf = (t) => KEYS[t] || 'id';

// ===================== Supabase =====================
function cloudDB() {
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  return {
    async list(t, { order = 'created_at', asc = false, eq, limit } = {}) {
      let q = sb.from(t).select('*');
      if (eq) for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
      if (order) q = q.order(order, { ascending: asc });
      if (limit) q = q.limit(limit);
      return chk(await q);
    },
    async insert(t, row) { return chk(await sb.from(t).insert(row).select().single()); },
    async update(t, id, patch) { return chk(await sb.from(t).update(patch).eq(keyOf(t), id).select().single()); },
    async upsert(t, row) { return chk(await sb.from(t).upsert(row).select().single()); },
    async remove(t, id) { chk(await sb.from(t).delete().eq(keyOf(t), id)); return true; },
    async rpc(n, a) { return chk(await sb.rpc(n, a)); },
    async upload(blob, ext) {
      const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('images').upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
      if (error) throw new Error(error.message.includes('row-level') ? 'لا تملك صلاحية الرفع — سجّل الدخول من جديد' : error.message);
      return sb.storage.from('images').getPublicUrl(path).data.publicUrl;
    },
    async signIn(user, pass) {
      const email = user.includes('@') ? user : (user.trim().toLowerCase() === 'admin' ? C.ADMIN_EMAIL : `${user}@local`);
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error('اسم المستخدم أو كلمة السر غير صحيحة');
      const ok = await this.isAdmin();
      if (!ok) { await sb.auth.signOut(); throw new Error('هذا الحساب ليس مديراً'); }
      return true;
    },
    async isAdmin() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return false;
      try { return !!(await this.rpc('is_admin', {})); } catch { return false; }
    },
    async signOut() { await sb.auth.signOut(); },
    async changePassword(p) { const { error } = await sb.auth.updateUser({ password: p }); if (error) throw new Error(error.message); },
  };
}

// ===================== المتصفح (تجريبي) =====================
function localDB() {
  const LS = 'jaafar_db_v2';
  let D;
  try { D = JSON.parse(localStorage.getItem(LS)); } catch { D = null; }
  if (!D || !D.games) D = SEED();
  const save = () => {
    try { localStorage.setItem(LS, JSON.stringify(D)); } catch {
      throw new Error('امتلأت مساحة التخزين التجريبية في المتصفح. بعد ربط Supabase تُحفظ الصور بلا حدود.');
    }
  };
  save();
  const now = () => new Date().toISOString();
  const tbl = (t) => (D[t] ||= []);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const find = (t, id) => tbl(t).find((r) => r[keyOf(t)] === id);

  function notifyLocal(n) {
    tbl('notifications').push({ id: uid(), created_at: now(), meta: {}, link: null, ref: null, ...n });
  }
  function discountSettings() { return (find('settings', 'discount') || {}).value || {}; }
  function couponPct(code) {
    if (!code) return 0;
    const c = tbl('coupons').find((x) => x.code.toUpperCase() === String(code).trim().toUpperCase());
    if (!c || !c.active) return 0;
    if (c.expires_at && new Date(c.expires_at) < new Date()) return 0;
    if (c.max_uses && c.uses >= c.max_uses) return 0;
    return c.percent;
  }

  const RPC = {
    is_admin: () => !!ssGet('jx_admin', false),
    request_game({ p_game, p_device }) {
      const g = find('games', p_game);
      if (!g) throw new Error('اللعبة غير موجودة');
      if (!tbl('game_requests').some((r) => r.game_id === p_game && r.device_id === p_device)) {
        tbl('game_requests').push({ game_id: p_game, device_id: p_device, created_at: now() });
        g.requests = (g.requests || 0) + 1;
        const ref = 'req:' + p_game;
        const ex = tbl('notifications').find((n) => n.ref === ref && Date.now() - new Date(n.created_at) < 6 * 36e5);
        const body = g.requests > 1 ? `${g.requests} أشخاص طلبوا توفير لعبة «${g.title}» — جاري تجهيزها في المحل` : `لاعب طلب توفير لعبة «${g.title}» — جاري تجهيزها في المحل`;
        if (ex) Object.assign(ex, { body, created_at: now() });
        else notifyLocal({ type: 'request', icon: '🙋', title: 'طلب توفير لعبة', body, link: '#/game/' + p_game, ref });
        save();
      }
      return g.requests;
    },
    request_custom_game({ p_title, p_platform, p_device }) {
      const title = String(p_title || '').trim().slice(0, 80);
      if (title.length < 2) throw new Error('اكتب اسم اللعبة');
      const norm = title.toLowerCase().replace(/\s+/g, ' ');
      let r = tbl('custom_requests').find((x) => x.norm === norm);
      if (!r) { r = { id: uid(), title, norm, platform: p_platform || 'PS4/PS5', count: 0, status: 'open', created_at: now() }; tbl('custom_requests').push(r); }
      r.status = 'open';
      if (!tbl('custom_request_devices').some((d) => d.req_id === r.id && d.device_id === p_device)) {
        tbl('custom_request_devices').push({ req_id: r.id, device_id: p_device, created_at: now() });
        r.count += 1;
        const ref = 'creq:' + r.id;
        const body = r.count > 1 ? `${r.count} أشخاص طلبوا توفير لعبة «${r.title}» — جاري تجهيزها في المحل` : `لاعب طلب توفير لعبة «${r.title}» — جاري تجهيزها في المحل`;
        const ex = tbl('notifications').find((n) => n.ref === ref && Date.now() - new Date(n.created_at) < 6 * 36e5);
        if (ex) Object.assign(ex, { body, created_at: now() });
        else notifyLocal({ type: 'request', icon: '🙋', title: 'طلب توفير لعبة', body, link: '#/games', ref });
        save();
      }
      return r.count;
    },
    vote_game({ p_game, p_device, p_vote }) {
      const g = find('games', p_game);
      const votes = tbl('game_votes');
      const ex = votes.find((v) => v.game_id === p_game && v.device_id === p_device);
      const old = ex ? ex.vote : 0;
      if (old !== p_vote) {
        g.likes = (g.likes || 0) + (p_vote === 1) - (old === 1);
        g.dislikes = (g.dislikes || 0) + (p_vote === -1) - (old === -1);
        if (p_vote === 0) D.game_votes = votes.filter((v) => v !== ex);
        else if (ex) ex.vote = p_vote;
        else votes.push({ game_id: p_game, device_id: p_device, vote: p_vote });
        save();
      }
      return { likes: g.likes, dislikes: g.dislikes };
    },
    check_coupon({ p_code }) { return couponPct(p_code); },
    place_order({ p_name, p_kind, p_items, p_coupon }) {
      const src = p_kind === 'games' ? tbl('games') : tbl('products');
      const rows = src.filter((r) => p_items.includes(r.id));
      const items = rows.map((r) => ({ id: r.id, title: r.title || r.name, price: r.price, platform: r.platform || null }));
      const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
      let auto = 0;
      const d = discountSettings();
      if (p_kind === 'games' && d.enabled && items.length >= Math.max(2, d.min_count || 3)) auto = d.percent || 0;
      const cp = couponPct(p_coupon);
      const percent = Math.max(auto, cp);
      const discount = Math.round((subtotal * percent) / 100);
      const usedCoupon = cp > 0 && cp >= auto ? String(p_coupon).trim().toUpperCase() : null;
      if (usedCoupon) { const c = tbl('coupons').find((x) => x.code.toUpperCase() === usedCoupon); c.uses = (c.uses || 0) + 1; }
      const no = ++D._order_no;
      const order = { id: uid(), no, customer_name: String(p_name).slice(0, 80), kind: p_kind, items, subtotal, percent, discount, total: subtotal - discount, coupon: usedCoupon, created_at: now() };
      tbl('orders').push(order);
      if (percent >= 30) notifyLocal({ type: 'discount_win', icon: '💰', title: 'خصم كبير!', body: `زبون حصل على خصم ${percent}% على طلبه 🎉` });
      save();
      return order;
    },
  };

  return {
    async list(t, { order = 'created_at', asc = false, eq, limit } = {}) {
      let rows = clone(tbl(t));
      if (eq) rows = rows.filter((r) => Object.entries(eq).every(([k, v]) => r[k] === v));
      if (order) rows.sort((a, b) => (a[order] > b[order] ? 1 : a[order] < b[order] ? -1 : 0) * (asc ? 1 : -1));
      if (limit) rows = rows.slice(0, limit);
      return rows;
    },
    async insert(t, row) {
      const r = { created_at: now(), ...row };
      if (keyOf(t) === 'id' && !r.id) r.id = uid();
      tbl(t).push(r); save(); return clone(r);
    },
    async update(t, id, patch) {
      const r = find(t, id); if (!r) throw new Error('غير موجود');
      Object.assign(r, patch); save(); return clone(r);
    },
    async upsert(t, row) {
      const r = find(t, row[keyOf(t)]);
      if (r) Object.assign(r, row); else tbl(t).push({ created_at: now(), ...row });
      save(); return clone(find(t, row[keyOf(t)]));
    },
    async remove(t, id) { D[t] = tbl(t).filter((r) => r[keyOf(t)] !== id); save(); return true; },
    async rpc(n, a) { if (!RPC[n]) throw new Error('rpc ' + n); return clone(RPC[n](a || {}) ?? null); },
    async upload(blob) { return blobToDataURL(blob); },
    async signIn(user, pass) {
      const pw = (find('settings', 'admin_password') || {}).value || 'admin123';
      if (user.trim().toLowerCase() !== 'admin' || pass !== pw) throw new Error('اسم المستخدم أو كلمة السر غير صحيحة');
      ssSet('jx_admin', true); return true;
    },
    async isAdmin() { return !!ssGet('jx_admin', false); },
    async signOut() { ssSet('jx_admin', false); },
    async changePassword(p) { const s = find('settings', 'admin_password'); if (s) s.value = p; else tbl('settings').push({ key: 'admin_password', value: p }); save(); },
    resetDemo() { localStorage.removeItem(LS); },
  };
}

export const db = mode === 'cloud' ? cloudDB() : localDB();
