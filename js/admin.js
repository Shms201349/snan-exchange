// ===================== لوحة التحكم =====================
import { db, mode } from './db.js';
import { state, loadAll, notify, notifyGameAdded, saveSetting, statusLabel, refreshNotifications } from './store.js';
import { $, $$, esc, money, num, lsGet, lsSet, ssGet, ssSet, timeAgo, fmtDate, toast, modal, confirmBox, compressImage, withTimeout, uid } from './util.js';
import { icon, crownSVG } from './icons.js';
import { gameCover, productImg, appApi } from './app.js';
import { PLATFORMS, PRODUCT_CATS, DEFAULT_WARRANTY, DEFAULT_GAME_PRICE, DEFAULT_SITE } from './defaults.js';
import * as rawg from './rawg.js';

let root;
const TABS = [
  ['status', 'الحالة', 'chart'], ['games', 'الألعاب', 'gamepad'], ['products', 'المنتجات', 'box'], ['banners', 'صور البانر', 'image'],
  ['requests', 'طلبات التوفير', 'users'], ['chats', 'المحادثات', 'chat'], ['orders', 'الطلبات', 'list'], ['discounts', 'الخصومات', 'tag'], ['sync', 'المزامنة', 'sync'],
  ['page', 'الصفحة', 'layout'], ['settings', 'الإعدادات', 'cog'],
];

export async function renderAdmin(el) {
  root = el;
  document.title = 'لوحة التحكم — ' + state.site.name;
  if (!(await db.isAdmin())) return renderLogin();
  renderShell();
}

// ---------- الدخول ----------
function renderLogin() {
  root.innerHTML = `<div class="container"><form class="login" id="login">
    <div class="crown">${crownSVG()}</div>
    <h1>لوحة التحكم</h1><p class="muted" style="text-align:center;margin:0 0 18px">${esc(state.site.name)}</p>
    ${mode === 'local' ? '<div class="mode-note">الوضع التجريبي: المستخدم <b>admin</b> وكلمة السر <b>admin123</b> — غيّرها من الإعدادات.</div>' : ''}
    <div class="field"><label>اسم المستخدم</label><input class="input" name="u" value="admin" autocomplete="username" required></div>
    <div class="field"><label>كلمة السر</label><input class="input" name="p" type="password" autocomplete="current-password" required></div>
    <div class="up-err" id="lerr"></div>
    <button class="btn btn-gold btn-lg btn-block" type="submit">${icon('lock')} دخول</button>
  </form></div>`;
  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    btn.disabled = true; $('#lerr').textContent = '';
    try { await db.signIn(f.u.value, f.p.value); renderShell(); } catch (err) { $('#lerr').textContent = err.message; } finally { btn.disabled = false; }
  };
}

// ---------- الهيكل ----------
let current = ssGet('jx_cp_tab', 'status');
let shellUnread = 0;
let chatTimer = null;
async function countUnread() {
  try { shellUnread = (await db.list('support_threads', { order: 'last_at' })).reduce((n, t) => n + (t.unread_admin || 0), 0); } catch { shellUnread = 0; }
}
function renderShell() {
  if (!renderShell.counted) { renderShell.counted = true; countUnread().then(() => { if (shellUnread) renderShell(); }); }
  const pending = state.games.filter((g) => g.status !== 'available' && g.requests > 0).length;
  const unreadChats = shellUnread;
  root.innerHTML = `<div class="container"><div class="cp">
    <aside class="cp-side" id="cp-side">
      <div class="cp-user">👑 مرحباً، <b>admin</b><br><small>${mode === 'cloud' ? '🟢 متصل بقاعدة البيانات' : '🟠 وضع تجريبي'}</small></div>
      ${TABS.map(([k, l, ic]) => `<button class="cp-tab ${k === current ? 'active' : ''}" data-tab="${k}">${icon(ic, 'ico-sm')} ${l}${k === 'requests' && pending ? `<span class="n">${pending}</span>` : ''}${k === 'chats' && unreadChats ? `<span class="n">${unreadChats}</span>` : ''}</button>`).join('')}
      <button class="cp-tab" id="cp-out">${icon('logout', 'ico-sm')} خروج</button>
    </aside>
    <section id="cp-main"></section>
  </div></div>`;
  $('#cp-side').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    current = b.dataset.tab; ssSet('jx_cp_tab', current);
    $$('.cp-tab').forEach((x) => x.classList.toggle('active', x === b));
    show();
  };
  $('#cp-out').onclick = async () => { await db.signOut(); location.hash = '#/'; };
  show();
  autoSync();
}

async function show() {
  clearInterval(chatTimer); chatTimer = null;
  const old = $('#cp-main');
  if (!old) return;
  const main = old.cloneNode(false);
  old.replaceWith(main);
  main.innerHTML = '<div class="panel"><div class="skel" style="height:200px"></div></div>';
  try { await (VIEWS[current] || VIEWS.status)(main); } catch (e) { main.innerHTML = `<div class="panel"><div class="empty">⚠️ ${esc(e.message)}</div></div>`; }
}
const reload = async () => { await loadAll(); show(); };

// ---------- أداة رفع الصور ----------
function imageField(el, { multiple = false, images = [], max = 1600, wide = false, label } = {}) {
  let list = images.filter(Boolean);
  let busy = null, err = '';
  const draw = () => {
    el.innerHTML = `<div class="uploader">${list.map((src, i) => `<div class="up-item ${wide ? 'wide' : ''}"><img src="${esc(src)}" alt=""><button type="button" class="rm" data-rm="${i}" aria-label="حذف">${icon('x', 'ico-sm')}</button>${multiple && i === 0 && list.length > 1 ? '<span class="badge b-gold main-tag">الأولى</span>' : ''}</div>`).join('')}
      ${busy ? `<div class="up-item ${wide ? 'wide' : ''}"><div class="up-busy"><div><div class="spinner"></div>${busy}</div></div></div>` : ''}
      ${!busy && (multiple || !list.length) ? `<label class="up-add ${wide ? 'wide' : ''}">${icon('upload')}<span>${label || (multiple ? 'أضف صور' : 'اختر صورة')}</span><input type="file" accept="image/*" ${multiple ? 'multiple' : ''}></label>
        <button type="button" class="up-add ${wide ? 'wide' : ''}" data-url style="border-style:dotted">${icon('link')}<span>رابط صورة</span></button>` : ''}</div>
      ${err ? `<div class="up-err">⚠️ ${esc(err)}</div>` : ''}`;
  };
  el.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { list.splice(+rm.dataset.rm, 1); draw(); return; }
    if (e.target.closest('[data-url]')) {
      const u = prompt('ضع رابط الصورة (يبدأ بـ https)');
      if (u && /^https?:\/\//.test(u.trim())) { list.push(u.trim()); if (!multiple) list = list.slice(-1); draw(); }
    }
  });
  el.addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    err = '';
    for (let i = 0; i < files.length; i++) {
      busy = `جاري الرفع ${files.length > 1 ? `${i + 1}/${files.length}` : '…'}`; draw();
      try {
        const { blob, ext } = await withTimeout(compressImage(files[i], { max }), 30000, 'استغرق تجهيز الصورة وقتاً طويلاً');
        const url = await withTimeout(db.upload(blob, ext), 90000, 'انتهت مهلة الرفع — تأكد من الإنترنت وحاول مرة أخرى');
        list.push(url);
        if (!multiple) list = list.slice(-1);
      } catch (x) { err = `${files[i].name}: ${x.message}`; }
    }
    busy = null; draw();
  });
  draw();
  return { get: () => list, isBusy: () => !!busy };
}

// ---------- سؤال البانر عند الحفظ ----------
async function askBanner(type, item) {
  if (state.banners.some((b) => b.link_type === type && b.link_id === item.id)) return;
  const name = item.title || item.name;
  const yes = await confirmBox('إضافة إلى صور البانر؟', `هل تريد إضافة نسخة من <b>«${esc(name)}»</b> إلى صور البانر في واجهة الموقع الرئيسية؟<br><small class="muted">الضغط على الصورة في البانر يفتح صفحتها مباشرة.</small>`, 'نعم، أضفها للبانر', 'لا');
  if (!yes) return;
  const minSort = Math.min(0, ...state.banners.map((b) => b.sort || 0));
  await db.insert('banners', { image: '', title: name, subtitle: (item.description || '').slice(0, 140), link_type: type, link_id: item.id, sort: minSort - 1 });
  toast('أُضيفت إلى البانر ✅', { emoji: '🖼️', kind: 'ok' });
}

// ===================== الحالة =====================
const VIEWS = {};
VIEWS.status = async (main) => {
  const orders = await db.list('orders', { limit: 500 }).catch(() => []);
  const g = state.games;
  const top = (arr, f, n = 5) => [...arr].sort((a, b) => f(b) - f(a)).filter((x) => f(x) > 0).slice(0, n);
  const stat = (ic, c, v, k) => `<div class="stat"><div class="si ${c}">${icon(ic)}</div><div><div class="sv">${v}</div><div class="sk">${k}</div></div></div>`;
  main.innerHTML = `<div class="stats">
      ${stat('gamepad', 'c1', g.length, 'لعبة في الموقع')}${stat('check', 'c4', g.filter((x) => x.status === 'available').length, 'متوفرة')}
      ${stat('users', 'c8', g.reduce((s, x) => s + (x.requests || 0), 0), 'طلب توفير')}${stat('list', 'c6', orders.length, 'طلب واتساب')}
      ${stat('up', 'c3', g.reduce((s, x) => s + (x.likes || 0), 0), 'إعجاب')}${stat('box', 'c5', state.products.length, 'منتج')}
    </div>
    <div class="row2">
      <div class="panel"><div class="panel-head"><h3>🙋 الأكثر طلباً للتوفير</h3></div><div class="list">${top(g.filter((x) => x.status !== 'available'), (x) => x.requests || 0).map((x) => `<div class="li"><img src="${esc(gameCover(x))}"><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">${num(x.requests)} طلب</div></div></div>`).join('') || '<div class="muted">لا توجد طلبات</div>'}</div></div>
      <div class="panel"><div class="panel-head"><h3>👍 الأكثر إعجاباً</h3></div><div class="list">${top(g, (x) => x.likes || 0).map((x) => `<div class="li"><img src="${esc(gameCover(x))}"><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">👍 ${num(x.likes)} • 👎 ${num(x.dislikes)}</div></div></div>`).join('') || '<div class="muted">لا يوجد</div>'}</div></div>
    </div>
    <div class="panel"><div class="panel-head"><h2>🔔 الإشعارات (جديدنا)</h2><button class="btn btn-gold btn-sm" id="n-add">${icon('plus', 'ico-sm')} إشعار يدوي</button></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">الإشعارات تُنشأ تلقائياً عند: إضافة لعبة أو منتج، توفر لعبة، تحويلها للعربي، طلب توفير، تشغيل/إيقاف الخصم، أو خصم 30% فأكثر. الزوار يشوفون آخر 6 في الجرس، والباقي في صفحة "جديدنا".</p>
      <div class="list" id="n-list">${state.notifications.map((n) => `<div class="li"><div class="notif-ico">${esc(n.icon || '🔔')}</div><div class="grow"><div class="t">${esc(n.title)}</div><div class="s">${esc(n.body || '')} • ${timeAgo(n.created_at)}</div></div><div class="acts"><button class="btn btn-danger btn-xs" data-del="${n.id}">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="muted">لا توجد إشعارات بعد</div>'}</div>
    </div>`;
  $('#n-list').onclick = async (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    await db.remove('notifications', b.dataset.del); await refreshNotifications(); show();
  };
  $('#n-add').onclick = manualNotification;
};

function manualNotification() {
  const T = [
    ['🔓', 'تهكير جديد', 'نزل تهكير جديد لبلايستيشن 4 إصدار '],
    ['🔓', 'تهكير جديد', 'نزل تهكير جديد لبلايستيشن 5 إصدار '],
    ['🕹️', 'وصل جديد', 'تمت إضافة يدات بلايستيشن وكالة'],
    ['🛒', 'للبيع', 'تم عرض بلايستيشن 4 للبيع'],
    ['🔥', 'عرض خاص', 'خصم على '],
    ['📢', 'إعلان', ''],
  ];
  modal({
    title: 'إشعار يدوي جديد', wide: false,
    body: `<div class="field"><span class="lbl">قوالب جاهزة</span><div class="chips" id="tpl">${T.map((t, i) => `<button type="button" class="chip" data-t="${i}">${t[0]} ${esc(t[2] || t[1])}</button>`).join('')}</div></div>
      <div class="row-top" style="display:flex;gap:8px"><div class="field"><label>رمز</label><input class="input emoji-input" id="m-ic" value="📢"></div><div class="field" style="flex:1"><label>العنوان</label><input class="input" id="m-t" value="إعلان"></div></div>
      <div class="field"><label>النص</label><textarea class="textarea" id="m-b" style="min-height:80px"></textarea></div>`,
    actions: [{ label: 'نشر الإشعار', cls: 'btn-gold', onClick: async () => {
      const body = $('#m-b').value.trim(); if (!body) { $('#m-b').classList.add('err'); return false; }
      await notify({ type: 'manual', icon: $('#m-ic').value.trim() || '📢', title: $('#m-t').value.trim() || 'إعلان', body });
      await refreshNotifications(); toast('تم نشر الإشعار ✅', { emoji: '🔔', kind: 'ok' }); show();
    } }, { label: 'إلغاء' }],
    onMount({ el }) {
      el.querySelector('#tpl').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; const t = T[+b.dataset.t]; $('#m-ic').value = t[0]; $('#m-t').value = t[1]; $('#m-b').value = t[2]; $('#m-b').focus(); };
    },
  });
}

// ===================== الألعاب =====================
VIEWS.games = async (main) => {
  let term = '';
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🎮 الألعاب (${state.games.length})</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-gold btn-sm" id="g-new">${icon('plus', 'ico-sm')} إضافة لعبة يدوياً</button><button class="btn btn-ghost btn-sm" id="g-sync">${icon('sync', 'ico-sm')} إضافة تلقائية</button></div></div>
    <label class="search" style="height:44px;margin-bottom:12px">${icon('search')}<input id="g-q" placeholder="ابحث في الألعاب"></label>
    <div class="list" id="g-list"></div></div>`;
  const draw = () => {
    const t = term.toLowerCase();
    const list = [...state.games].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).filter((g) => !t || g.title.toLowerCase().includes(t));
    $('#g-list').innerHTML = list.map((g) => `<div class="li"><img src="${esc(gameCover(g))}"><div class="grow"><div class="t">${esc(g.title)}</div>
      <div class="s"><span class="badge ${g.status === 'available' ? (g.language === 'ar' ? 'b-green' : 'b-blue') : 'b-gray'}">${statusLabel(g)}</span><span>${esc(g.platform)}</span><span>${money(g.price)}</span><span>👍 ${num(g.likes)}</span>${g.requests ? `<span>🙋 ${num(g.requests)}</span>` : ''}</div></div>
      <div class="acts"><a class="btn btn-ghost btn-xs" href="#/game/${g.id}" target="_blank">${icon('eye', 'ico-sm')}</a><button class="btn btn-ghost btn-xs" data-edit="${g.id}">${icon('edit', 'ico-sm')} تعديل</button><button class="btn btn-danger btn-xs" data-del="${g.id}">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="empty">لا توجد ألعاب</div>';
  };
  draw();
  $('#g-q').oninput = (e) => { term = e.target.value; draw(); };
  $('#g-new').onclick = () => gameForm(null);
  $('#g-sync').onclick = () => { current = 'sync'; ssSet('jx_cp_tab', current); renderShell(); };
  $('#g-list').onclick = async (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) gameForm(state.games.find((g) => g.id === ed.dataset.edit));
    if (del) {
      const g = state.games.find((x) => x.id === del.dataset.del);
      if (await confirmBox('حذف اللعبة', `هل تريد حذف «${esc(g.title)}» نهائياً؟`, 'حذف', 'إلغاء', 'btn-danger')) {
        await db.remove('games', g.id);
        for (const b of state.banners.filter((b) => b.link_type === 'game' && b.link_id === g.id)) await db.remove('banners', b.id);
        toast('تم الحذف', { emoji: '🗑️' }); reload();
      }
    }
  };
};

function gameForm(game, { draft = null, source = null, onSaved = null } = {}) {
  const g = game || { title: '', platform: 'PS4/PS5', status: null, language: 'en', price: DEFAULT_GAME_PRICE, size: '', description: '', cover: '', screenshots: [], ...(draft || {}) };
  if (draft && !game) g.status = null; // لازم يجاوب على سؤال التوفر
  let cover, shots;
  return modal({
    title: game ? `تعديل «${esc(game.title)}»` : '➕ إضافة لعبة', wide: true,
    body: `<form id="gf" autocomplete="off">
      <div class="field"><label>اسم اللعبة <span class="req">*</span></label>
        <div style="display:flex;gap:8px"><input class="input" name="title" value="${esc(g.title)}" required>${rawg.rawgKey() ? `<button type="button" class="btn btn-ghost" id="gf-fetch" title="يجلب النبذة والصور تلقائياً">${icon('sparkles', 'ico-sm')} جلب تلقائي</button>` : ''}</div>
        <span class="help">${rawg.rawgKey() ? 'اكتب الاسم بالإنجليزي واضغط "جلب تلقائي" لتعبئة النبذة والصور.' : 'لتعبئة البيانات تلقائياً ضع مفتاح RAWG من تبويب المزامنة.'}</span></div>
      <div class="field"><span class="lbl">هل اللعبة متوفرة عندك في المحل؟ <span class="req">*</span></span>
        <div class="radios ${g.status ? '' : 'need'}" id="gf-status"><label class="radio"><input type="radio" name="status" value="available" ${g.status === 'available' ? 'checked' : ''}> ✅ نعم، متوفرة</label><label class="radio"><input type="radio" name="status" value="unavailable" ${g.status === 'unavailable' ? 'checked' : ''}> ⏳ لا، غير متوفرة حالياً</label></div></div>
      <div class="row3">
        <div class="field"><label>اللغة</label><select class="select" name="language"><option value="ar" ${g.language === 'ar' ? 'selected' : ''}>🇸🇦 عربي</option><option value="en" ${g.language !== 'ar' ? 'selected' : ''}>🌐 غير عربي</option></select></div>
        <div class="field"><label>الجهاز</label><select class="select" name="platform">${PLATFORMS.map((p) => `<option ${p === g.platform ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><label>السعر (ريال) <span class="req">*</span></label><input class="input" name="price" type="number" min="0" step="50" value="${esc(g.price ?? DEFAULT_GAME_PRICE)}" required></div>
      </div>
      <div class="field"><label>حجم اللعبة</label><input class="input" name="size" value="${esc(g.size || '')}" placeholder="مثال: 45 GB"></div>
      <div class="field"><label>نبذة عن اللعبة</label><textarea class="textarea" name="description">${esc(g.description || '')}</textarea></div>
      <div class="field"><span class="lbl">صورة الغلاف</span><div id="gf-cover"></div><span class="help">تُضغط الصورة تلقائياً قبل الرفع — أي صيغة (JPG / PNG / WEBP).</span></div>
      <div class="field"><span class="lbl">صور من داخل اللعبة (Gameplay)</span><div id="gf-shots"></div><span class="help">تظهر تحت الصورة الكبيرة في صفحة اللعبة، وتتكبر عند تمرير الماوس.</span></div>
    </form>`,
    actions: [{ label: `${icon('check')} حفظ`, cls: 'btn-gold', onClick: async ({ el }) => {
      const f = el.querySelector('#gf');
      const status = f.querySelector('input[name=status]:checked')?.value;
      if (!f.title.value.trim()) { f.title.classList.add('err'); f.title.focus(); return false; }
      if (!status) { $('#gf-status').classList.add('need'); $('#gf-status').scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('جاوب على سؤال: هل اللعبة متوفرة عندك في المحل؟', { emoji: '❗', kind: 'bad' }); return false; }
      if (f.price.value === '' || Number(f.price.value) < 0) { f.price.classList.add('err'); return false; }
      if (cover.isBusy() || shots.isBusy()) { toast('انتظر حتى يكتمل رفع الصور', { emoji: '⏳' }); return false; }
      const data = {
        title: f.title.value.trim(), status, language: f.language.value, platform: f.platform.value,
        price: Number(f.price.value), size: f.size.value.trim(), description: f.description.value.trim(),
        cover: cover.get()[0] || '', screenshots: shots.get(),
      };
      try {
        const saved = await saveGame(game, data, source);
        onSaved && (await onSaved(saved));
        return true;
      } catch (e) { toast('تعذّر الحفظ', { text: e.message, emoji: '⚠️', kind: 'bad' }); return false; }
    } }, { label: 'إلغاء' }],
    onMount({ el }) {
      cover = imageField(el.querySelector('#gf-cover'), { images: [g.cover], max: 1200, label: 'صورة الغلاف' });
      shots = imageField(el.querySelector('#gf-shots'), { multiple: true, images: g.screenshots || [], max: 1600, wide: true });
      el.querySelectorAll('input[name=status]').forEach((r) => r.addEventListener('change', () => $('#gf-status').classList.remove('need')));
      const fb = el.querySelector('#gf-fetch');
      if (fb) fb.onclick = async () => {
        const f = el.querySelector('#gf');
        const t = f.title.value.trim(); if (!t) return f.title.focus();
        fb.disabled = true; fb.innerHTML = '<div class="spinner" style="margin:0;width:16px;height:16px"></div>';
        try {
          const res = await rawg.search(t);
          if (!res.length) throw new Error('ما لقينا اللعبة، جرّب اسم إنجليزي أدق');
          const pick = res.length === 1 ? res[0] : await pickCandidate(res);
          if (!pick) return;
          const d = await rawg.details(pick.rawg_id);
          f.title.value = d.title; f.platform.value = d.platform;
          if (!f.description.value.trim()) f.description.value = d.description;
          const fresh = (sel) => { const o = el.querySelector(sel); const n = o.cloneNode(false); o.replaceWith(n); return n; };
          if (!cover.get().length && d.cover) cover = imageField(fresh('#gf-cover'), { images: [d.cover], max: 1200 });
          if (!shots.get().length && d.screenshots.length) shots = imageField(fresh('#gf-shots'), { multiple: true, images: d.screenshots, wide: true });
          toast('تم جلب البيانات ✅', { text: 'راجعها وعدّل ما تريد', emoji: '✨', kind: 'ok' });
        } catch (e) { toast('تعذّر الجلب', { text: e.message, emoji: '⚠️', kind: 'bad' }); }
        finally { fb.disabled = false; fb.innerHTML = `${icon('sparkles', 'ico-sm')} جلب تلقائي`; }
      };
    },
  });
}

function pickCandidate(list) {
  return modal({
    title: 'اختر اللعبة الصحيحة',
    body: `<div class="list">${list.map((c, i) => `<button type="button" class="li" data-i="${i}" style="text-align:start;cursor:pointer"><img class="wide" src="${esc(c.cover || '')}" alt=""><div class="grow"><div class="t">${esc(c.title)}</div><div class="s">${esc(c.platform)} • ${esc(c.released || '')}</div></div></button>`).join('')}</div>`,
    onMount({ el, close }) { el.querySelector('.list').onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) close(list[+b.dataset.i]); }; },
  });
}

async function saveGame(old, data, source) {
  let g;
  if (old) g = await db.update('games', old.id, data);
  else g = await db.insert('games', { ...data, likes: 0, dislikes: 0, requests: 0 });
  if (!old) await notifyGameAdded(g);
  else await availabilityNotifications(old, g);
  if (source) await db.upsert('game_sources', { game_id: g.id, url: source }).catch(() => {});
  await loadAll();
  await askBanner('game', g);
  await loadAll();
  toast(old ? 'تم حفظ التعديلات ✅' : 'تمت إضافة اللعبة ✅', { emoji: '🎮', kind: 'ok' });
  if (current === 'games' || current === 'requests' || current === 'sync') show();
  return g;
}

async function availabilityNotifications(old, g) {
  const link = '#/game/' + g.id;
  if (old.status !== 'available' && g.status === 'available') {
    await notify({ type: 'available', icon: '✅', title: 'لعبة أصبحت متوفرة', body: `لعبة «${g.title}» أصبحت متوفرة الآن${g.language === 'ar' ? ' بالنسخة العربية' : ''}${old.requests ? ` — ${old.requests} ${old.requests === 1 ? 'شخص كان طالبها' : 'أشخاص كانوا طالبينها'} 🎉` : ''}`, link });
  } else if (g.status === 'available' && old.language !== 'ar' && g.language === 'ar') {
    await notify({ type: 'arabic', icon: '🇸🇦', title: 'نسخة عربية جديدة', body: `تمت إضافة لعبة «${g.title}» بالنسخة العربية`, link });
  }
}

// ===================== المنتجات =====================
VIEWS.products = async (main) => {
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>📦 المنتجات (${state.products.length})</h2><button class="btn btn-gold btn-sm" id="p-new">${icon('plus', 'ico-sm')} إضافة منتج</button></div>
    <p class="muted" style="margin-top:-6px;font-size:.88rem">المنتجات لها سلة منفصلة عن الألعاب، ولا يطبق عليها الخصم التلقائي — الخصم عليها بكود الخصم فقط.</p>
    <div class="list" id="p-list">${[...state.products].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((p) => `<div class="li"><img src="${esc(productImg(p))}"><div class="grow"><div class="t">${esc(p.name)}</div>
      <div class="s"><span class="badge ${p.condition === 'used' ? 'b-gold' : 'b-green'}">${p.condition === 'used' ? 'مستعمل' : 'جديد'}</span>${p.in_stock === false ? '<span class="badge b-gray">نفد</span>' : ''}${p.delivery ? '<span>🚚 توصيل</span>' : ''}<span>${money(p.price)}</span></div></div>
      <div class="acts"><button class="btn btn-ghost btn-xs" data-edit="${p.id}">${icon('edit', 'ico-sm')} تعديل</button><button class="btn btn-danger btn-xs" data-del="${p.id}">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="empty">لا توجد منتجات</div>'}</div></div>`;
  $('#p-new').onclick = () => productForm(null);
  $('#p-list').onclick = async (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) productForm(state.products.find((p) => p.id === ed.dataset.edit));
    if (del) {
      const p = state.products.find((x) => x.id === del.dataset.del);
      if (await confirmBox('حذف المنتج', `حذف «${esc(p.name)}» نهائياً؟`, 'حذف', 'إلغاء', 'btn-danger')) {
        await db.remove('products', p.id);
        for (const b of state.banners.filter((b) => b.link_type === 'product' && b.link_id === p.id)) await db.remove('banners', b.id);
        reload();
      }
    }
  };
};

function productForm(prod) {
  const p = prod || { name: '', category: PRODUCT_CATS[0], condition: 'new', delivery: true, warranty: DEFAULT_WARRANTY, price: '', description: '', images: [], in_stock: null };
  let imgs;
  modal({
    title: prod ? `تعديل «${esc(prod.name)}»` : '➕ إضافة منتج', wide: true,
    body: `<form id="pf" autocomplete="off">
      <div class="field"><label>اسم المنتج <span class="req">*</span></label><input class="input" name="name" value="${esc(p.name)}" required placeholder="مثال: يد DualSense وكالة"></div>
      <div class="field"><span class="lbl">هل المنتج متوفر عندك في المحل؟ <span class="req">*</span></span><div class="radios ${p.in_stock === null ? 'need' : ''}" id="pf-stock"><label class="radio"><input type="radio" name="stock" value="1" ${p.in_stock === true ? 'checked' : ''}> ✅ متوفر</label><label class="radio"><input type="radio" name="stock" value="0" ${p.in_stock === false ? 'checked' : ''}> ⏳ غير متوفر</label></div></div>
      <div class="row3">
        <div class="field"><label>القسم</label><select class="select" name="category">${PRODUCT_CATS.map((c) => `<option ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><span class="lbl">الحالة</span><div class="radios"><label class="radio"><input type="radio" name="condition" value="new" ${p.condition !== 'used' ? 'checked' : ''}> جديد</label><label class="radio"><input type="radio" name="condition" value="used" ${p.condition === 'used' ? 'checked' : ''}> مستعمل</label></div></div>
        <div class="field"><label>السعر (ريال)</label><input class="input" name="price" type="number" min="0" value="${esc(p.price ?? '')}" placeholder="فارغ = عند التواصل"></div>
      </div>
      <div class="toggle-row"><div><b>🚚 التوصيل متوفر</b><div class="muted" style="font-size:.82rem">يظهر للزبون أن التوصيل متاح لهذا المنتج</div></div><label class="switch"><input type="checkbox" name="delivery" ${p.delivery ? 'checked' : ''}><span></span></label></div>
      <div class="field"><label>الضمان</label><input class="input" name="warranty" value="${esc(p.warranty || DEFAULT_WARRANTY)}"><span class="help">افتراضياً: ضمان 3 أشهر ضد أي خلل مصنعي — عدّله حسب المنتج.</span></div>
      <div class="field"><label>الوصف</label><textarea class="textarea" name="description">${esc(p.description || '')}</textarea></div>
      <div class="field"><span class="lbl">صور المنتج</span><div id="pf-imgs"></div><span class="help">الصورة الأولى هي الرئيسية.</span></div>
    </form>`,
    actions: [{ label: `${icon('check')} حفظ`, cls: 'btn-gold', onClick: async ({ el }) => {
      const f = el.querySelector('#pf');
      const stock = f.querySelector('input[name=stock]:checked')?.value;
      if (!f.name.value.trim()) { f.name.classList.add('err'); f.name.focus(); return false; }
      if (stock === undefined) { $('#pf-stock').classList.add('need'); toast('حدد هل المنتج متوفر عندك في المحل', { emoji: '❗', kind: 'bad' }); return false; }
      if (imgs.isBusy()) { toast('انتظر حتى يكتمل رفع الصور', { emoji: '⏳' }); return false; }
      const data = {
        name: f.name.value.trim(), category: f.category.value, condition: f.querySelector('input[name=condition]:checked').value,
        price: f.price.value === '' ? null : Number(f.price.value), delivery: f.delivery.checked, warranty: f.warranty.value.trim(),
        description: f.description.value.trim(), images: imgs.get(), in_stock: stock === '1',
      };
      try {
        let saved;
        if (prod) saved = await db.update('products', prod.id, data);
        else saved = await db.insert('products', data);
        const link = '#/product/' + saved.id;
        if (!prod) await notify({ type: 'product', icon: data.category === 'يدات' ? '🕹️' : '📦', title: 'منتج جديد', body: `تم عرض «${saved.name}»${saved.condition === 'used' ? ' (مستعمل)' : ''} للبيع${saved.in_stock ? '' : ' — قريباً'}`, link });
        else if (prod.in_stock === false && saved.in_stock) await notify({ type: 'product', icon: '📦', title: 'رجع متوفر', body: `«${saved.name}» صار متوفر في المحل`, link });
        await loadAll();
        await askBanner('product', saved);
        await loadAll();
        toast('تم الحفظ ✅', { emoji: '📦', kind: 'ok' });
        if (current === 'products') show();
        return true;
      } catch (e) { toast('تعذّر الحفظ', { text: e.message, emoji: '⚠️', kind: 'bad' }); return false; }
    } }, { label: 'إلغاء' }],
    onMount({ el }) {
      imgs = imageField(el.querySelector('#pf-imgs'), { multiple: true, images: p.images || [], max: 1400 });
      el.querySelectorAll('input[name=stock]').forEach((r) => r.addEventListener('change', () => $('#pf-stock').classList.remove('need')));
    },
  });
}

// ===================== البانر =====================
VIEWS.banners = async (main) => {
  const bs = state.banners;
  const linkName = (b) => {
    if (b.link_type === 'game') { const g = state.games.find((x) => x.id === b.link_id); return g ? `🎮 ${g.title}` : '⚠️ لعبة محذوفة'; }
    if (b.link_type === 'product') { const p = state.products.find((x) => x.id === b.link_id); return p ? `📦 ${p.name}` : '⚠️ منتج محذوف'; }
    return 'بدون رابط';
  };
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🖼️ صور البانر (${bs.length})</h2><button class="btn btn-gold btn-sm" id="b-new">${icon('plus', 'ico-sm')} إضافة صورة</button></div>
    <p class="muted" style="margin-top:-6px;font-size:.88rem">الصور تتنقل في واجهة الموقع بأسلوب البلايستيشن. إذا كانت الصورة مربوطة بلعبة أو منتج، الضغط عليها يفتح صفحته. بدون صور يظهر بانر المحل الافتراضي.</p>
    <div class="list" id="b-list">${bs.map((b, i) => `<div class="li"><img class="wide" src="${esc(bannerThumb(b))}"><div class="grow"><div class="t">${esc(b.title || 'بدون عنوان')}</div><div class="s">${esc(linkName(b))}</div></div>
      <div class="acts"><button class="btn btn-ghost btn-xs" data-up="${i}" ${i === 0 ? 'disabled' : ''}>${icon('chevUp', 'ico-sm')}</button><button class="btn btn-ghost btn-xs" data-down="${i}" ${i === bs.length - 1 ? 'disabled' : ''}>${icon('chevDown', 'ico-sm')}</button>
      <button class="btn btn-ghost btn-xs" data-edit="${b.id}">${icon('edit', 'ico-sm')}</button><button class="btn btn-danger btn-xs" data-del="${b.id}">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="empty">لا توجد صور — يظهر البانر الافتراضي</div>'}</div></div>`;
  $('#b-new').onclick = () => bannerForm(null);
  $('#b-list').onclick = async (e) => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.dataset.edit) return bannerForm(bs.find((b) => b.id === t.dataset.edit));
    if (t.dataset.del) { if (await confirmBox('حذف الصورة', 'حذف هذه الصورة من البانر؟', 'حذف', 'إلغاء', 'btn-danger')) { await db.remove('banners', t.dataset.del); reload(); } return; }
    const i = +(t.dataset.up ?? t.dataset.down), j = t.dataset.up !== undefined ? i - 1 : i + 1;
    const order = [...bs]; [order[i], order[j]] = [order[j], order[i]];
    await Promise.all(order.map((b, k) => db.update('banners', b.id, { sort: k })));
    reload();
  };
};
function bannerThumb(b) {
  if (b.image) return b.image;
  const g = b.link_type === 'game' && state.games.find((x) => x.id === b.link_id);
  if (g) return (g.screenshots && g.screenshots[0]) || gameCover(g);
  const p = b.link_type === 'product' && state.products.find((x) => x.id === b.link_id);
  return p ? productImg(p) : '';
}
function bannerForm(b) {
  const v = b || { image: '', title: '', subtitle: '', link_type: '', link_id: '' };
  let img;
  modal({
    title: b ? 'تعديل صورة البانر' : '➕ صورة بانر جديدة', wide: true,
    body: `<div class="field"><span class="lbl">الصورة (عريضة، يفضل 1920×1080)</span><div id="bf-img"></div><span class="help">إذا تركتها فارغة وربطتها بلعبة، تُستخدم صورة اللعبة تلقائياً.</span></div>
      <div class="field"><label>العنوان</label><input class="input" id="bf-t" value="${esc(v.title || '')}"></div>
      <div class="field"><label>النص الفرعي</label><input class="input" id="bf-s" value="${esc(v.subtitle || '')}"></div>
      <div class="row2"><div class="field"><label>الربط</label><select class="select" id="bf-lt"><option value="">بدون رابط</option><option value="game" ${v.link_type === 'game' ? 'selected' : ''}>لعبة</option><option value="product" ${v.link_type === 'product' ? 'selected' : ''}>منتج</option></select></div>
      <div class="field"><label>العنصر</label><select class="select" id="bf-li"></select></div></div>`,
    actions: [{ label: `${icon('check')} حفظ`, cls: 'btn-gold', onClick: async () => {
      if (img.isBusy()) return false;
      const lt = $('#bf-lt').value;
      const data = { image: img.get()[0] || '', title: $('#bf-t').value.trim(), subtitle: $('#bf-s').value.trim(), link_type: lt || null, link_id: lt ? $('#bf-li').value : null };
      if (!data.image && !data.link_id) { toast('اختر صورة أو اربطها بلعبة/منتج', { emoji: '❗', kind: 'bad' }); return false; }
      if (b) await db.update('banners', b.id, data);
      else await db.insert('banners', { ...data, sort: Math.min(0, ...state.banners.map((x) => x.sort || 0)) - 1 });
      toast('تم الحفظ ✅', { emoji: '🖼️', kind: 'ok' }); reload();
    } }, { label: 'إلغاء' }],
    onMount({ el }) {
      img = imageField(el.querySelector('#bf-img'), { images: [v.image], max: 1920, wide: true });
      const fill = () => {
        const lt = $('#bf-lt').value;
        const src = lt === 'game' ? state.games.map((g) => [g.id, g.title]) : lt === 'product' ? state.products.map((p) => [p.id, p.name]) : [];
        $('#bf-li').innerHTML = src.map(([id, n]) => `<option value="${id}" ${id === v.link_id ? 'selected' : ''}>${esc(n)}</option>`).join('');
        $('#bf-li').disabled = !lt;
      };
      $('#bf-lt').onchange = () => {
        fill();
        const lt = $('#bf-lt').value, id = $('#bf-li').value;
        if (lt && !$('#bf-t').value) { const it = lt === 'game' ? state.games.find((g) => g.id === id) : state.products.find((p) => p.id === id); if (it) $('#bf-t').value = it.title || it.name; }
      };
      fill();
    },
  });
}

// ===================== طلبات التوفير =====================
VIEWS.requests = async (main) => {
  const list = state.games.filter((g) => g.status !== 'available').sort((a, b) => (b.requests || 0) - (a.requests || 0));
  const custom = (await db.list('custom_requests', { limit: 300 }).catch(() => [])).filter((r) => r.status === 'open').sort((a, b) => b.count - a.count);
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🆕 ألعاب طلبها الزباين وغير موجودة في الموقع (${custom.length})</h2></div>
    <p class="muted" style="margin-top:-6px;font-size:.88rem">الزبون كتب اسم لعبة ما لقاها. اضغط "أضفها للموقع" وبيتعبأ الاسم تلقائياً — وإذا حفظتها كغير متوفرة ينتقل عدد الطلبات لها.</p>
    <div class="list" id="cr-list">${custom.map((r) => `<div class="li"><div class="notif-ico">🙋</div><div class="grow"><div class="t">${esc(r.title)}</div><div class="s"><span class="req-count">🙋 ${num(r.count)} طلب</span><span>${esc(r.platform || '')}</span><span>${timeAgo(r.updated_at || r.created_at)}</span></div></div>
      <div class="acts"><button class="btn btn-gold btn-xs" data-add="${r.id}">${icon('plus', 'ico-sm')} أضفها للموقع</button><button class="btn btn-danger btn-xs" data-dismiss="${r.id}">${icon('x', 'ico-sm')}</button></div></div>`).join('') || '<div class="muted">لا توجد طلبات جديدة</div>'}</div></div>
  <div class="panel"><div class="panel-head"><h2>🙋 طلبات توفير الألعاب</h2></div>
    <p class="muted" style="margin-top:-6px;font-size:.88rem">كل شخص (جهاز) يُحسب طلب واحد فقط. لما توفّر اللعبة اضغط "صارت متوفرة" وبيطلع إشعار للزباين تلقائياً.</p>
    <div class="list" id="r-list">${list.map((g) => `<div class="li"><img src="${esc(gameCover(g))}"><div class="grow"><div class="t">${esc(g.title)}</div><div class="s"><span class="req-count">🙋 ${num(g.requests || 0)} طلب</span><span>${esc(g.platform)}</span></div></div>
      <div class="acts"><button class="btn btn-green btn-xs" data-ok="${g.id}">${icon('check', 'ico-sm')} صارت متوفرة</button><button class="btn btn-ghost btn-xs" data-edit="${g.id}">${icon('edit', 'ico-sm')}</button></div></div>`).join('') || '<div class="empty">🎉 لا توجد ألعاب غير متوفرة</div>'}</div></div>`;
  $('#cr-list').onclick = async (e) => {
    const add = e.target.closest('[data-add]'), dis = e.target.closest('[data-dismiss]');
    if (dis) { if (await confirmBox('حذف الطلب', 'حذف هذا الطلب من القائمة؟', 'حذف', 'إلغاء', 'btn-danger')) { await db.update('custom_requests', dis.dataset.dismiss, { status: 'done' }); show(); } return; }
    if (!add) return;
    const r = custom.find((x) => x.id === add.dataset.add);
    gameForm(null, {
      draft: { title: r.title, platform: r.platform || 'PS4/PS5', price: DEFAULT_GAME_PRICE, ...catalogDraft(r.title, r.cover) },
      onSaved: async (g) => {
        await db.update('custom_requests', r.id, { status: 'done' });
        if (g.status !== 'available') await db.update('games', g.id, { requests: r.count });
        else await notify({ type: 'available', icon: '✅', title: 'طلبكم صار جاهز', body: `لعبة «${g.title}» اللي طلبها ${r.count} ${r.count === 1 ? 'شخص' : 'أشخاص'} صارت متوفرة الآن 🎉`, link: '#/game/' + g.id });
        await loadAll(); show();
      },
    });
  };
  $('#r-list').onclick = async (e) => {
    const ok = e.target.closest('[data-ok]'), ed = e.target.closest('[data-edit]');
    if (ed) return gameForm(state.games.find((g) => g.id === ed.dataset.edit));
    if (!ok) return;
    const g = state.games.find((x) => x.id === ok.dataset.ok);
    const lang = await modal({ title: `«${esc(g.title)}» صارت متوفرة`, body: '<p style="margin:0">بأي نسخة؟</p>', sheet: false,
      actions: [{ label: '🇸🇦 عربي', value: 'ar', cls: 'btn-green' }, { label: '🌐 غير عربي', value: 'en', cls: 'btn-blue' }, { label: 'إلغاء', value: null }] });
    if (!lang) return;
    const upd = await db.update('games', g.id, { status: 'available', language: lang });
    await availabilityNotifications(g, upd);
    toast('تم التحديث وأُرسل إشعار للزباين ✅', { emoji: '🔔', kind: 'ok' });
    reload();
  };
};

// ===================== الطلبات =====================
VIEWS.orders = async (main) => {
  const orders = await db.list('orders', { limit: 300 });
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🧾 الطلبات (${orders.length})</h2></div>
    <p class="muted" style="margin-top:-6px;font-size:.88rem">كل طلب يرسله الزبون عبر واتساب ينحفظ هنا أيضاً.</p>
    <div class="list" id="o-list">${orders.map((o) => `<div class="li" style="align-items:flex-start"><div class="notif-ico">${o.kind === 'games' ? '🎮' : '📦'}</div><div class="grow">
      <div class="t">#${o.no} — ${esc(o.customer_name)}</div>
      <div class="s"><span>${fmtDate(o.created_at)}</span><span class="price">${money(o.total)}</span>${o.percent ? `<span class="badge b-green">خصم ${o.percent}%${o.coupon ? ' • ' + esc(o.coupon) : ''}</span>` : ''}</div>
      <ul class="order-items">${(o.items || []).map((i) => `<li>${esc(i.title)}${i.platform ? ` (${esc(i.platform)})` : ''} — ${money(i.price)}</li>`).join('')}</ul></div>
      <div class="acts"><button class="btn btn-danger btn-xs" data-del="${o.id}">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="empty">لا توجد طلبات بعد</div>'}</div></div>`;
  $('#o-list').onclick = async (e) => {
    const d = e.target.closest('[data-del]');
    if (d && (await confirmBox('حذف الطلب', 'حذف هذا الطلب من السجل؟', 'حذف', 'إلغاء', 'btn-danger'))) { await db.remove('orders', d.dataset.del); show(); }
  };
};

// ===================== الخصومات =====================
VIEWS.discounts = async (main) => {
  const d = state.discount;
  const coupons = await db.list('coupons');
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🔥 الخصم التلقائي على الألعاب</h2></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">يتفعّل تلقائياً في السلة عند طلب عدد معيّن من الألعاب. <b>لا يشمل لعبة واحدة أبداً</b> ولا يشمل المنتجات. عند تشغيله أو إيقافه يطلع إشعار للزباين.</p>
      <div class="toggle-row"><b>تشغيل الخصم</b><label class="switch"><input type="checkbox" id="d-on" ${d.enabled ? 'checked' : ''}><span></span></label></div>
      <div class="row2"><div class="field"><label>نسبة الخصم %</label><input class="input" id="d-pct" type="number" min="1" max="90" value="${esc(d.percent)}"></div>
      <div class="field"><label>يتفعّل عند طلب</label><select class="select" id="d-min">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === Number(d.min_count) ? 'selected' : ''}>${n} ألعاب أو أكثر</option>`).join('')}</select></div></div>
      <button class="btn btn-gold" id="d-save">${icon('check', 'ico-sm')} حفظ الخصم</button></div>
    <div class="panel"><div class="panel-head"><h2>🎟️ أكواد الخصم</h2></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">الكود يشتغل على الألعاب (حتى لعبة واحدة) وعلى المنتجات. إذا كتب الزبون كود خطأ، ما يظهر له خطأ — يكمل الطلب بالسعر الكامل. إذا اجتمع خصم تلقائي وكود، يُطبق الأكبر.</p>
      <form id="c-form" class="row3" style="align-items:end">
        <div class="field"><label>الكود <span class="req">*</span></label><input class="input" name="code" placeholder="مثال: JAAFAR20" style="text-transform:uppercase" required></div>
        <div class="field"><label>نسبة الخصم % <span class="req">*</span></label><input class="input" name="percent" type="number" min="1" max="90" placeholder="مثال: 20" required></div>
        <div class="field"><label>حد الاستخدام</label><input class="input" name="max" type="number" min="1" placeholder="بدون حد"></div>
        <div class="field" style="grid-column:1/-1;margin:0"><button class="btn btn-gold" type="submit">${icon('plus', 'ico-sm')} إضافة الكود</button></div>
      </form>
      <div class="list" id="c-list" style="margin-top:14px">${coupons.map((c) => `<div class="li"><div class="notif-ico">🎟️</div><div class="grow"><div class="t" style="direction:ltr;text-align:right">${esc(c.code)}</div><div class="s"><span class="badge b-green">${c.percent}%</span><span>استُخدم ${num(c.uses || 0)}${c.max_uses ? ` / ${c.max_uses}` : ''} مرة</span></div></div>
        <div class="acts"><label class="switch" title="تفعيل"><input type="checkbox" data-tg="${esc(c.code)}" ${c.active ? 'checked' : ''}><span></span></label><button class="btn btn-danger btn-xs" data-del="${esc(c.code)}">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="muted">لا توجد أكواد</div>'}</div></div>`;

  $('#d-save').onclick = async () => {
    const nd = { enabled: $('#d-on').checked, percent: Math.max(1, Math.min(90, Number($('#d-pct').value) || 0)), min_count: Number($('#d-min').value) };
    const od = { ...state.discount };
    await saveSetting('discount', nd);
    if (!od.enabled && nd.enabled) await notify({ type: 'discount', icon: '🔥', title: 'خصم جديد!', body: `خصم ${nd.percent}% عند طلب ${nd.min_count} ألعاب أو أكثر — لفترة محدودة`, link: '#/games' });
    else if (od.enabled && !nd.enabled) await notify({ type: 'discount', icon: '🏷️', title: 'انتهى الخصم', body: `انتهى عرض خصم ${od.percent}% — تابعونا للعروض القادمة` });
    else if (nd.enabled && (od.percent !== nd.percent || Number(od.min_count) !== nd.min_count)) await notify({ type: 'discount', icon: '🔥', title: 'تحديث الخصم', body: `الخصم الآن ${nd.percent}% عند طلب ${nd.min_count} ألعاب أو أكثر`, link: '#/games' });
    await refreshNotifications();
    toast('تم حفظ الخصم ✅', { emoji: '🔥', kind: 'ok' }); show();
  };
  $('#c-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const code = f.code.value.trim().toUpperCase().replace(/\s+/g, '');
    const percent = Number(f.percent.value);
    if (!code || !(percent > 0 && percent <= 90)) return toast('اكتب الكود ونسبة صحيحة (1–90)', { emoji: '❗', kind: 'bad' });
    if (coupons.some((c) => c.code.toUpperCase() === code)) return toast('الكود موجود مسبقاً', { emoji: '❗', kind: 'bad' });
    await db.insert('coupons', { code, percent, active: true, max_uses: f.max.value ? Number(f.max.value) : null, uses: 0 });
    toast('تمت إضافة الكود ✅', { emoji: '🎟️', kind: 'ok' }); show();
  };
  $('#c-list').onchange = async (e) => { const t = e.target.closest('[data-tg]'); if (t) { await db.update('coupons', t.dataset.tg, { active: t.checked }); toast(t.checked ? 'تم التفعيل' : 'تم الإيقاف', { emoji: '🎟️', timeout: 2000 }); } };
  $('#c-list').onclick = async (e) => { const d = e.target.closest('[data-del]'); if (d && (await confirmBox('حذف الكود', `حذف ${esc(d.dataset.del)}؟`, 'حذف', 'إلغاء', 'btn-danger'))) { await db.remove('coupons', d.dataset.del); show(); } };
};

// ===================== المزامنة =====================
async function autoSync() {
  if (!rawg.rawgKey()) return;
  const today = new Date().toISOString().slice(0, 10);
  if (lsGet('jx_sync_day', '') === today) return;
  lsSet('jx_sync_day', today);
  try { const n = await fetchDaily(); if (n) toast(`وصلت ${n} ألعاب جديدة للمراجعة`, { text: 'من تبويب المزامنة — وافق أو ارفض', emoji: '🔄' }); } catch { /* تجاهل */ }
}
async function fetchDaily() {
  const queue = await db.list('sync_queue', { limit: 500 });
  const exclude = [...state.games.map((g) => g.title), ...queue.map((q) => q.title)];
  const found = await rawg.discover(exclude, 10);
  const inCat = new Set(state.catalog.map((c) => c.norm));
  for (const f of found) {
    await db.insert('sync_queue', { rawg_id: f.rawg_id, title: f.title, payload: f, status: 'pending' });
    const norm = f.title.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!inCat.has(norm)) await db.insert('catalog', { title: f.title, norm, platform: f.platform, cover: f.cover || '', screenshots: [], description: '', rawg_id: f.rawg_id, requests: 0 }).catch(() => {});
  }
  await loadAll();
  return found.length;
}

VIEWS.sync = async (main) => {
  const key = rawg.rawgKey();
  const queue = key ? (await db.list('sync_queue', { limit: 200 })).filter((q) => q.status === 'pending') : [];
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🔄 المزامنة — إضافة ألعاب تلقائياً</h2></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">النظام يجلب يومياً حتى <b>10 ألعاب جديدة</b> (الأشهر والعربي أولاً) وتنزل هنا للمراجعة. أنت توافق ✅ أو ترفض ❌. البيانات (الاسم، الغلاف، صور اللعب، النبذة) تُجلب من قاعدة RAWG الرسمية للألعاب. <b>السعر يتعبأ تلقائياً 1500</b>، و<b>ما يتم الحفظ إلا بعد ما تجاوب: هل اللعبة متوفرة عندك في المحل؟</b></p>
      <div class="field"><label>مفتاح RAWG (مجاني)</label><div style="display:flex;gap:8px"><input class="input" id="k" value="${esc(key)}" placeholder="الصق المفتاح هنا" style="direction:ltr"><button class="btn btn-ghost" id="k-save">حفظ</button></div>
      <span class="help">احصل عليه مجاناً خلال دقيقة من <a class="gold" href="https://rawg.io/apidocs" target="_blank" rel="noopener">rawg.io/apidocs</a> (سجّل ثم انسخ API Key). يُحفظ في هذا المتصفح فقط.</span></div>
    </div>
    <div class="panel ${key ? '' : 'hidden'}"><div class="panel-head"><h3>🔗 إضافة من رابط أو اسم</h3></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">الصق رابط اللعبة من أي موقع (مثل pspkg أو dlpsgame) أو اكتب اسمها — النظام يتعرف على اللعبة ويعبّي الباقي. الرابط يُحفظ مخفياً للوحة التحكم فقط ولا يظهر للزوار أو في الإشعارات أبداً.</p>
      <div style="display:flex;gap:8px"><input class="input" id="lnk" placeholder="https://… أو اسم اللعبة" style="direction:ltr"><button class="btn btn-gold" id="lnk-go">${icon('sparkles', 'ico-sm')} جلب</button></div>
    </div>
    <div class="panel ${key ? '' : 'hidden'}"><div class="panel-head"><h3>📥 بانتظار المراجعة (${queue.length})</h3><button class="btn btn-ghost btn-sm" id="q-fetch">${icon('sync', 'ico-sm')} جلب ألعاب اليوم</button></div>
      <div class="list" id="q-list">${queue.map((q) => `<div class="li"><img class="wide" src="${esc(q.payload?.cover || '')}" alt=""><div class="grow"><div class="t">${esc(q.title)}</div><div class="s"><span>${esc(q.payload?.platform || '')}</span>${q.payload?.arabic ? '<span class="badge b-green">غالباً عربي</span>' : ''}</div></div>
        <div class="acts"><button class="btn btn-green btn-xs" data-ok="${q.id}">${icon('check', 'ico-sm')} مراجعة وإضافة</button><button class="btn btn-danger btn-xs" data-no="${q.id}">${icon('x', 'ico-sm')} رفض</button></div></div>`).join('') || '<div class="muted">لا توجد ألعاب بانتظار المراجعة — اضغط "جلب ألعاب اليوم"</div>'}</div>
    </div>
    <div class="panel"><div class="panel-head"><h3>🧭 قائمة "اكتشف ألعاب" (${state.catalog.length})</h3><button class="btn btn-ghost btn-sm" id="cat-add">${icon('plus', 'ico-sm')} أضف لعبة للقائمة</button></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">ألعاب تظهر للزباين في صفحة "اكتشف" ويقدرون يطلبون توفيرها. الجلب اليومي يضيف لها تلقائياً. أي لعبة تضيفها للموقع تختفي من هذي القائمة.</p>
      <div class="list" id="cat-list">${[...state.catalog].sort((a, b) => (b.requests || 0) - (a.requests || 0)).map((c) => `<div class="li"><img src="${esc(c.cover || '')}" alt=""><div class="grow"><div class="t">${esc(c.title)}</div><div class="s"><span>${esc(c.platform || '')}</span>${c.requests ? `<span class="req-count">🙋 ${num(c.requests)} طلب</span>` : ''}${state.games.some((g) => g.title.trim().toLowerCase() === c.norm) ? '<span class="badge b-green">موجودة في الموقع</span>' : ''}</div></div>
        <div class="acts"><button class="btn btn-gold btn-xs" data-cadd="${c.id}">${icon('plus', 'ico-sm')} أضفها للموقع</button><button class="btn btn-danger btn-xs" data-cdel="${c.id}">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="muted">القائمة فاضية</div>'}</div>
    </div>`;
  $('#cat-list').onclick = async (e) => {
    const a = e.target.closest('[data-cadd]'), d = e.target.closest('[data-cdel]');
    if (d) { await db.remove('catalog', d.dataset.cdel); await loadAll(); show(); return; }
    if (!a) return;
    const c = state.catalog.find((x) => x.id === a.dataset.cadd);
    gameForm(null, { draft: { title: c.title, platform: c.platform || 'PS4/PS5', price: DEFAULT_GAME_PRICE, description: c.description || '', cover: c.cover || '', screenshots: c.screenshots || [] } });
  };
  $('#cat-add').onclick = () => catalogForm();
  $('#k-save').onclick = () => { lsSet('jx_rawg_key', $('#k').value.trim()); toast('تم حفظ المفتاح ✅', { emoji: '🔑', kind: 'ok' }); show(); };
  if (!key) return;
  $('#q-fetch').onclick = async (e) => {
    e.target.disabled = true;
    try { const n = await fetchDaily(); toast(n ? `تم جلب ${n} ألعاب ✅` : 'لا توجد ألعاب جديدة حالياً', { emoji: '🔄', kind: 'ok' }); show(); } catch (x) { toast('تعذّر الجلب', { text: x.message, emoji: '⚠️', kind: 'bad' }); e.target.disabled = false; }
  };
  $('#lnk-go').onclick = async (e) => {
    const raw = $('#lnk').value.trim(); if (!raw) return;
    const isLink = /^https?:\/\//i.test(raw);
    const term = isLink ? rawg.nameFromLink(raw) : raw;
    e.target.disabled = true;
    try {
      const res = await rawg.search(term);
      if (!res.length) throw new Error(`ما تعرفنا على «${term}» — جرّب كتابة الاسم يدوياً`);
      const pick = res.length === 1 ? res[0] : await pickCandidate(res);
      if (!pick) return;
      const d = await rawg.details(pick.rawg_id);
      gameForm(null, { draft: { ...d, price: DEFAULT_GAME_PRICE }, source: isLink ? raw : null });
    } catch (x) { toast('تعذّر الجلب', { text: x.message, emoji: '⚠️', kind: 'bad' }); } finally { e.target.disabled = false; }
  };
  $('#q-list').onclick = async (e) => {
    const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]');
    if (no) { await db.update('sync_queue', no.dataset.no, { status: 'rejected' }); show(); return; }
    if (!ok) return;
    const q = queue.find((x) => x.id === ok.dataset.ok);
    ok.disabled = true;
    try {
      const d = await rawg.details(q.rawg_id);
      gameForm(null, { draft: { ...d, price: DEFAULT_GAME_PRICE }, onSaved: () => db.update('sync_queue', q.id, { status: 'approved' }) });
    } catch (x) { toast('تعذّر الجلب', { text: x.message, emoji: '⚠️', kind: 'bad' }); } finally { ok.disabled = false; }
  };
};

// ===================== قائمة "اكتشف" =====================
function catalogDraft(title, cover) {
  const n = String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const c = state.catalog.find((x) => x.norm === n);
  return c ? { cover: c.cover || cover || '', screenshots: c.screenshots || [], description: c.description || '' } : { cover: cover || '' };
}

function catalogForm() {
  let cover;
  modal({
    title: '➕ لعبة لقائمة "اكتشف"',
    body: `<p class="muted" style="margin-top:0;font-size:.88rem">لعبة مش متوفرة عندك حالياً، تبغى الزباين يشوفونها ويطلبونها.</p>
      <div class="field"><label>اسم اللعبة <span class="req">*</span></label><input class="input" id="cf-t"></div>
      <div class="field"><label>الجهاز</label><select class="select" id="cf-p">${PLATFORMS.map((p) => `<option>${p}</option>`).join('')}</select></div>
      <div class="field"><label>نبذة</label><textarea class="textarea" id="cf-d" style="min-height:70px"></textarea></div>
      <div class="field"><span class="lbl">صورة الغلاف</span><div id="cf-c"></div></div>`,
    actions: [{ label: `${icon('check')} حفظ`, cls: 'btn-gold', onClick: async () => {
      const title = $('#cf-t').value.trim();
      if (title.length < 2) { $('#cf-t').classList.add('err'); return false; }
      if (cover.isBusy()) return false;
      const norm = title.toLowerCase().replace(/\s+/g, ' ');
      if (state.catalog.some((c) => c.norm === norm)) { toast('اللعبة موجودة في القائمة', { emoji: '❗', kind: 'bad' }); return false; }
      await db.insert('catalog', { title, norm, platform: $('#cf-p').value, description: $('#cf-d').value.trim(), cover: cover.get()[0] || '', screenshots: [], requests: 0 });
      await loadAll(); toast('أُضيفت لقائمة اكتشف ✅', { emoji: '🧭', kind: 'ok' }); show();
    } }, { label: 'إلغاء' }],
    onMount({ el }) { cover = imageField(el.querySelector('#cf-c'), { max: 800 }); },
  });
}

// ===================== المحادثات =====================
VIEWS.chats = async (main) => {
  const threads = await db.list('support_threads', { order: 'last_at' });
  const msgs = await db.list('chat_messages', { limit: 100 });
  const pub = state.settings.chat?.public !== false;
  shellUnread = threads.reduce((n, t) => n + (t.unread_admin || 0), 0);
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🎧 رسائل الزباين (تواصل مع المحل)</h2><button class="btn btn-ghost btn-sm" id="th-refresh">${icon('sync', 'ico-sm')} تحديث</button></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">كل زبون له محادثة خاصة ما يشوفها غيره. اضغط على المحادثة للرد — الرد يوصله داخل الموقع.</p>
      <div class="list" id="th-list">${threads.map((t) => `<button class="li" data-th="${t.id}" style="text-align:start;cursor:pointer;width:100%"><div class="notif-ico">👤</div><div class="grow"><div class="t">${esc(t.name || 'زبون')}</div><div class="s"><span>${esc(t.last_body || '')}</span><span>• ${timeAgo(t.last_at || t.created_at)}</span></div></div>
        ${t.unread_admin ? `<span class="badge b-red">${t.unread_admin} جديدة</span>` : ''}</button>`).join('') || '<div class="muted">لا توجد رسائل بعد</div>'}</div></div>
    <div class="panel"><div class="panel-head"><h2>👥 الدردشة العامة</h2></div>
      <div class="toggle-row"><div><b>تشغيل الدردشة العامة</b><div class="muted" style="font-size:.82rem">إذا أوقفتها تختفي من الموقع ويبقى فقط "تواصل مع المحل"</div></div><label class="switch"><input type="checkbox" id="pub-on" ${pub ? 'checked' : ''}><span></span></label></div>
      <form id="pub-form" style="display:flex;gap:8px;margin-bottom:14px"><input class="input" id="pub-text" placeholder="اكتب رسالة باسم المحل 👑" maxlength="300"><button class="btn btn-gold" type="submit">${icon('send', 'ico-sm')} إرسال</button></form>
      <div class="list" id="pub-list">${msgs.map((m) => `<div class="li"><div class="notif-ico">${m.is_admin ? '👑' : '💬'}</div><div class="grow"><div class="t">${esc(m.name)}</div><div class="s" style="white-space:normal">${esc(m.body)} • ${timeAgo(m.created_at)}</div></div>
        <div class="acts"><button class="btn btn-danger btn-xs" data-mdel="${m.id}" title="حذف">${icon('trash', 'ico-sm')}</button></div></div>`).join('') || '<div class="muted">لا توجد رسائل</div>'}</div></div>`;
  $('#th-refresh').onclick = () => show();
  $('#th-list').onclick = (e) => { const b = e.target.closest('[data-th]'); if (b) openThread(threads.find((t) => t.id === b.dataset.th)); };
  $('#pub-on').onchange = async (e) => { await saveSetting('chat', { ...(state.settings.chat || {}), public: e.target.checked }); toast(e.target.checked ? 'الدردشة العامة شغالة' : 'تم إيقاف الدردشة العامة', { emoji: '👥' }); };
  $('#pub-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = $('#pub-text').value.trim(); if (!body) return;
    await db.insert('chat_messages', { name: `${state.site.name} 👑`, body, is_admin: true });
    show();
  };
  $('#pub-list').onclick = async (e) => { const d = e.target.closest('[data-mdel]'); if (d) { await db.remove('chat_messages', d.dataset.mdel); show(); } };
  chatTimer = setInterval(async () => {
    const t2 = await db.list('support_threads', { order: 'last_at' }).catch(() => null);
    if (t2 && t2.reduce((n, t) => n + (t.unread_admin || 0), 0) !== shellUnread && !document.querySelector('.overlay')) show();
  }, 15000);
};

function openThread(t) {
  let poll;
  const drawMsgs = async (box) => {
    const list = await db.list('support_messages', { eq: { thread_id: t.id }, order: 'created_at', asc: true });
    const sig = list.length + (list.at(-1)?.id || '');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = list.map((m) => `<div class="msg ${m.from_admin ? 'mine shop' : ''}"><div class="msg-name">${m.from_admin ? 'أنت (المحل)' : esc(t.name || 'زبون')}</div><div class="msg-body">${esc(m.body)}</div><div class="msg-time">${timeAgo(m.created_at)}</div></div>`).join('');
    box.scrollTop = box.scrollHeight;
  };
  modal({
    title: `💬 ${esc(t.name || 'زبون')}`, wide: true,
    body: `<div class="chat-body" id="th-box" style="height:min(50vh,420px);border-radius:14px;border:1px solid var(--border)"></div>
      <form id="th-form" style="display:flex;gap:8px;margin-top:10px"><input class="input" id="th-text" placeholder="اكتب ردك…" maxlength="1000" autocomplete="off"><button class="btn btn-gold" type="submit">${icon('send', 'ico-sm')} رد</button></form>
      <div class="chips" style="margin-top:8px">${['أهلاً بك 👋 كيف نقدر نخدمك؟', 'متوفرة ✅ تقدر تمر المحل أو تطلبها من الموقع', 'غير متوفرة حالياً، بنوفرها لك قريباً إن شاء الله', 'تفضل كلمنا واتساب على الرقم ' + state.site.phone].map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`,
    onMount({ el }) {
      const box = el.querySelector('#th-box');
      drawMsgs(box);
      db.update('support_threads', t.id, { unread_admin: 0 }).then(() => { shellUnread = Math.max(0, shellUnread - (t.unread_admin || 0)); t.unread_admin = 0; });
      poll = setInterval(() => { if (!document.body.contains(box)) return clearInterval(poll); drawMsgs(box); }, 5000);
      el.querySelector('.chips').onclick = (e) => { const q = e.target.closest('[data-q]'); if (q) { el.querySelector('#th-text').value = q.dataset.q; el.querySelector('#th-text').focus(); } };
      el.querySelector('#th-form').onsubmit = async (e) => {
        e.preventDefault();
        const inp = el.querySelector('#th-text'); const body = inp.value.trim(); if (!body) return;
        await db.insert('support_messages', { thread_id: t.id, from_admin: true, body });
        await db.update('support_threads', t.id, { unread_user: (t.unread_user || 0) + 1, last_body: '👑 ' + body.slice(0, 110), last_at: new Date().toISOString() });
        t.unread_user = (t.unread_user || 0) + 1;
        inp.value = ''; drawMsgs(box);
      };
    },
  }).then(() => { clearInterval(poll); if (current === 'chats') show(); });
}

// ===================== الصفحة (التحكم بمحتوى الموقع) =====================
const SEC_NAMES = { games: '🎮 الألعاب', products: '📦 المنتجات', services: '🛠️ خدماتنا', why: '👑 لماذا نحن', contact: '📞 تواصل معنا' };
VIEWS.page = async (main) => {
  const s = JSON.parse(JSON.stringify(state.site));
  let logo;
  const listEditor = (key) => `<div id="ed-${key}">${s[key].map((it, i) => `<div class="editable-item"><div class="row-top"><input class="input emoji-input" data-k="${key}" data-i="${i}" data-f="emoji" value="${esc(it.emoji)}"><input class="input" data-k="${key}" data-i="${i}" data-f="title" value="${esc(it.title)}" placeholder="العنوان">
      <button type="button" class="btn btn-ghost btn-xs" data-mv="${key}:${i}:-1" ${i === 0 ? 'disabled' : ''}>${icon('chevUp', 'ico-sm')}</button><button type="button" class="btn btn-ghost btn-xs" data-mv="${key}:${i}:1" ${i === s[key].length - 1 ? 'disabled' : ''}>${icon('chevDown', 'ico-sm')}</button><button type="button" class="btn btn-danger btn-xs" data-rmi="${key}:${i}">${icon('trash', 'ico-sm')}</button></div>
      <textarea class="textarea" style="min-height:60px" data-k="${key}" data-i="${i}" data-f="text" placeholder="الوصف">${esc(it.text)}</textarea></div>`).join('')}
    <button type="button" class="btn btn-ghost btn-sm" data-addi="${key}">${icon('plus', 'ico-sm')} إضافة عنصر</button></div>`;
  const draw = () => {
    main.innerHTML = `<div class="panel"><div class="panel-head"><h2>🧩 التحكم بالصفحة</h2><button class="btn btn-gold" id="pg-save">${icon('check', 'ico-sm')} حفظ كل التغييرات</button></div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">عدّل نصوص الموقع وترتيب أقسام الصفحة الرئيسية بدون برمجة.</p></div>
    <div class="panel"><div class="panel-head"><h3>👑 الهوية</h3></div>
      <div class="row2"><div class="field"><label>اسم المحل</label><input class="input" data-s="name" value="${esc(s.name)}"></div><div class="field"><label>الوصف تحت الاسم</label><input class="input" data-s="sub" value="${esc(s.sub)}"></div></div>
      <div class="row2"><div class="field"><label>العبارة الرئيسية</label><input class="input" data-s="tagline" value="${esc(s.tagline)}"></div><div class="field"><label>العبارة الفرعية</label><input class="input" data-s="tagline_sub" value="${esc(s.tagline_sub)}"></div></div>
      <div class="field"><span class="lbl">الشعار (اختياري)</span><div id="pg-logo"></div><span class="help">صورة مربعة بخلفية شفافة (PNG). بدونه يظهر التاج الذهبي. في الجوال يظهر الشعار فقط بدون الاسم.</span></div>
    </div>
    <div class="panel"><div class="panel-head"><h3>🏠 أقسام الصفحة الرئيسية</h3></div><p class="muted" style="margin-top:-6px;font-size:.88rem">رتّب الأقسام وأظهر أو أخفِ أي قسم. (البانر دائماً في الأعلى)</p>
      <div id="pg-secs">${s.sections.map((x, i) => `<div class="sec-row"><span class="grow">${SEC_NAMES[x.id] || x.id}</span>
        <button type="button" class="btn btn-ghost btn-xs" data-smv="${i}:-1" ${i === 0 ? 'disabled' : ''}>${icon('chevUp', 'ico-sm')}</button><button type="button" class="btn btn-ghost btn-xs" data-smv="${i}:1" ${i === s.sections.length - 1 ? 'disabled' : ''}>${icon('chevDown', 'ico-sm')}</button>
        <label class="switch"><input type="checkbox" data-son="${i}" ${x.on ? 'checked' : ''}><span></span></label></div>`).join('')}</div></div>
    <div class="panel"><div class="panel-head"><h3>👋 رسالة الترحيب</h3></div><p class="muted" style="margin-top:-6px;font-size:.88rem">تظهر للزائر أول ما يفتح الموقع.</p>
      <div class="field"><label>العنوان</label><input class="input" data-s="welcome_title" value="${esc(s.welcome_title)}"></div>
      <div class="field"><label>النص</label><input class="input" data-s="welcome_text" value="${esc(s.welcome_text)}"></div></div>
    <div class="panel"><div class="panel-head"><h3>📞 بيانات التواصل</h3></div>
      <div class="row2"><div class="field"><label>رقم الهاتف (يظهر للزوار)</label><input class="input" data-s="phone" value="${esc(s.phone)}" style="direction:ltr"></div>
      <div class="field"><label>رقم الواتساب الدولي</label><input class="input" data-s="whatsapp" value="${esc(s.whatsapp)}" style="direction:ltr"><span class="help">بدون + أو أصفار — مثال: 967738120204</span></div></div>
      <div class="row2"><div class="field"><label>العنوان المختصر</label><input class="input" data-s="address_title" value="${esc(s.address_title)}"></div><div class="field"><label>العنوان التفصيلي</label><input class="input" data-s="address" value="${esc(s.address)}"></div></div>
      <div class="row2"><div class="field"><label>بحث الخريطة</label><input class="input" data-s="map_query" value="${esc(s.map_query)}"><span class="help">النص الذي يُبحث عنه في خرائط جوجل، أو إحداثيات مثل 14.79,42.95</span></div><div class="field"><label>أوقات الدوام</label><input class="input" data-s="hours" value="${esc(s.hours || '')}"></div></div></div>
    <div class="panel"><div class="panel-head"><h3>🛠️ خدماتنا</h3></div>${listEditor('services')}</div>
    <div class="panel"><div class="panel-head"><h3>👑 لماذا نحن</h3></div>${listEditor('why')}</div>
    <div class="panel"><button class="btn btn-gold btn-lg btn-block" id="pg-save2">${icon('check')} حفظ كل التغييرات</button>
      <button class="btn btn-ghost btn-sm" id="pg-reset" style="margin-top:10px">استرجاع المحتوى الافتراضي</button></div>`;
    logo = imageField($('#pg-logo'), { images: [s.logo], max: 512, label: 'الشعار' });
  };
  const collect = () => {
    $$('[data-s]', main).forEach((el) => { s[el.dataset.s] = el.value.trim(); });
    $$('[data-k]', main).forEach((el) => { s[el.dataset.k][+el.dataset.i][el.dataset.f] = el.value.trim(); });
    $$('[data-son]', main).forEach((el) => { s.sections[+el.dataset.son].on = el.checked; });
    s.logo = logo.get()[0] || '';
    s.whatsapp = s.whatsapp.replace(/\D/g, '');
  };
  draw();
  main.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.id === 'pg-save' || t.id === 'pg-save2') {
      if (logo.isBusy()) return toast('انتظر رفع الشعار', { emoji: '⏳' });
      collect();
      await saveSetting('site', s);
      appApi.renderBrand();
      toast('تم حفظ الصفحة ✅', { text: 'التغييرات ظاهرة للزوار الآن', emoji: '🧩', kind: 'ok' });
      return;
    }
    if (t.id === 'pg-reset') {
      if (await confirmBox('استرجاع الافتراضي', 'سيتم استبدال نصوص الصفحة بالمحتوى الافتراضي. متأكد؟', 'نعم', 'لا', 'btn-danger')) { Object.assign(s, JSON.parse(JSON.stringify(DEFAULT_SITE))); draw(); }
      return;
    }
    collect();
    if (t.dataset.smv) { const [i, d] = t.dataset.smv.split(':').map(Number); [s.sections[i], s.sections[i + d]] = [s.sections[i + d], s.sections[i]]; }
    else if (t.dataset.mv) { const [k, i, d] = t.dataset.mv.split(':'); const a = s[k], n = +i, m = n + +d; [a[n], a[m]] = [a[m], a[n]]; }
    else if (t.dataset.rmi) { const [k, i] = t.dataset.rmi.split(':'); s[k].splice(+i, 1); }
    else if (t.dataset.addi) s[t.dataset.addi].push({ emoji: '⭐', title: '', text: '' });
    else return;
    draw();
  });
};

// ===================== الإعدادات =====================
VIEWS.settings = async (main) => {
  main.innerHTML = `<div class="panel"><div class="panel-head"><h2>⚙️ الإعدادات</h2></div>
      <div class="mode-note" style="${mode === 'cloud' ? 'background:color-mix(in srgb,var(--green) 12%,transparent);color:var(--green);border-color:color-mix(in srgb,var(--green) 35%,transparent)' : ''}">
        ${mode === 'cloud' ? '🟢 الموقع متصل بقاعدة بيانات Supabase — كل البيانات محفوظة ومشتركة لكل الزوار.' : '🟠 الوضع التجريبي: البيانات محفوظة في هذا المتصفح فقط. لتشغيل الموقع فعلياً اربطه بـ Supabase (راجع ملف README).'}</div>
      <form id="pw"><div class="panel-head"><h3>🔒 تغيير كلمة السر</h3></div>
        <div class="row2"><div class="field"><label>كلمة السر الجديدة</label><input class="input" name="p1" type="password" minlength="8" autocomplete="new-password" required></div>
        <div class="field"><label>تأكيدها</label><input class="input" name="p2" type="password" minlength="8" autocomplete="new-password" required></div></div>
        <button class="btn btn-gold" type="submit">${icon('lock', 'ico-sm')} تغيير</button></form>
    </div>
    <div class="panel"><div class="panel-head"><h3>🔗 رابط لوحة التحكم</h3></div><p class="muted" style="margin:0">الرابط مخفي ولا يظهر في القائمة: <b style="direction:ltr;display:inline-block">${esc(location.origin + location.pathname)}#/cp</b> — احفظه في المفضلة.</p></div>
    ${mode === 'local' ? `<div class="panel"><div class="panel-head"><h3>🧪 البيانات التجريبية</h3></div><button class="btn btn-danger btn-sm" id="reset">إعادة ضبط البيانات التجريبية</button></div>` : ''}`;
  $('#pw').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.p1.value !== f.p2.value) return toast('كلمتا السر غير متطابقتين', { emoji: '❗', kind: 'bad' });
    try { await db.changePassword(f.p1.value); f.reset(); toast('تم تغيير كلمة السر ✅', { emoji: '🔒', kind: 'ok' }); } catch (x) { toast('تعذّر التغيير', { text: x.message, emoji: '⚠️', kind: 'bad' }); }
  };
  $('#reset')?.addEventListener('click', async () => {
    if (await confirmBox('إعادة الضبط', 'سيتم حذف كل البيانات التجريبية والرجوع للبداية.', 'نعم', 'لا', 'btn-danger')) { db.resetDemo(); location.reload(); }
  });
};
