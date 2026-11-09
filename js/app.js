import { db, mode } from './db.js';
import {
  state, loadAll, onChange, emit, gameById, productById, cartIds, inCart, addToCart, removeFromCart, clearCart,
  cartCount, cartTotals, autoDiscount, myVote, vote, iRequested, requestGame, statusLabel, refreshNotifications,
  findGameByTitle, requestCustomGame, iRequestedCustom, catNorm,
} from './store.js';
import { initChat, openChat, setChatVisible } from './chat.js';
import { $, $$, esc, money, num, lsGet, lsSet, ssGet, ssSet, timeAgo, artImage, toast, modal, openWhatsApp } from './util.js';
import { icon, crownSVG, shapesSVG } from './icons.js';

const app = $('#app');

// ================= الصور =================
export const gameCover = (g) => g.cover || artImage(g.title, { sub: g.platform });
export const gameWide = (g) => (g.screenshots && g.screenshots[0]) || artImage(g.title, { w: 1600, h: 900, sub: g.platform });
export const productImg = (p) => (p.images && p.images[0]) || artImage(p.name, { w: 800, h: 800, sub: p.category });
function bannerImage(b) {
  if (b.image) return b.image;
  if (b.link_type === 'game') { const g = gameById(b.link_id); if (g) return gameWide(g); }
  if (b.link_type === 'product') { const p = productById(b.link_id); if (p) return productImg(p); }
  return artImage(b.title || state.site.name, { w: 1600, h: 900 });
}
const bannerLink = (b) => (b.link_type === 'game' && gameById(b.link_id) ? `#/game/${b.link_id}` : b.link_type === 'product' && productById(b.link_id) ? `#/product/${b.link_id}` : null);

// ================= الهيدر =================
function renderBrand() {
  const s = state.site;
  $('#brand').innerHTML = `<div class="brand-mark">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : crownSVG()}</div>
    <div class="brand-text"><span class="brand-name">${esc(s.name)}</span><span class="brand-sub">${esc(s.sub)}</span></div>`;
  document.title = `${s.name} | ${s.sub}`;
  $('#footer').innerHTML = footerHTML();
  $('#fab-wa').href = `https://wa.me/${s.whatsapp}`;
}

function renderCounts() {
  const c = cartCount();
  const t = cartTotals('games');
  $('#cart-btn').innerHTML = `${icon('cart')}${c ? `<span class="count-badge">${c}</span>` : ''}${t.pct ? `<span class="disc-tag">-${t.pct}%</span>` : ''}`;
  const seen = lsGet('jx_seen', 0);
  const unread = state.notifications.slice(0, 6).filter((n) => new Date(n.created_at).getTime() > seen).length;
  $('#bell-btn').innerHTML = `${icon('bell')}${unread ? `<span class="count-badge blue">${unread}</span>` : ''}`;
}

function notifItem(n, seen = Infinity) {
  const inner = `<div class="notif-ico">${esc(n.icon || '🔔')}</div>
    <div class="notif-body"><div class="notif-title">${esc(n.title)}</div><div class="notif-text">${esc(n.body || '')}</div><div class="notif-time">${timeAgo(n.created_at)}</div></div>`;
  const cls = `notif ${new Date(n.created_at).getTime() > seen ? 'unread' : ''}`;
  return n.link && n.link.startsWith('#/') ? `<a class="${cls}" href="${esc(n.link)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
}

function renderBell() {
  const seen = lsGet('jx_seen', 0);
  const list = state.notifications.slice(0, 6);
  $('#bell-dd').innerHTML = `<div class="dd-head"><b>🔔 جديدنا</b><a class="see-all" href="#/news">عرض الكل</a></div>
    <div class="notif-list">${list.length ? list.map((n) => notifItem(n, seen)).join('') : '<div class="empty" style="padding:24px">لا يوجد جديد حالياً</div>'}</div>`;
}

function toggleBell(force) {
  const dd = $('#bell-dd');
  const open = force ?? !dd.classList.contains('open');
  if (open) { renderBell(); lsSet('jx_seen', Date.now()); setTimeout(renderCounts, 50); }
  dd.classList.toggle('open', open);
}

// ================= البطاقات =================
function gameActions(g, size = 'sm') {
  if (g.status !== 'available') {
    if (iRequested(g.id)) return `<div class="installing" style="flex:1"><div class="lbl"><span>✅ تم الطلب — جاري التجهيز</span></div><div class="ps-bar"><i style="--p:${Math.min(92, 40 + (g.requests || 1) * 7)}%"></i></div></div>`;
    return `<button class="btn btn-blue btn-${size}" data-act="request" data-id="${g.id}">${icon('bell', 'ico-sm')} اطلب توفيرها</button>`;
  }
  if (inCart('games', g.id)) return `<button class="btn btn-ghost btn-${size}" data-act="cart-open" data-kind="games">${icon('check', 'ico-sm')} في السلة</button>`;
  return `<button class="btn btn-gold btn-${size}" data-act="cart-add" data-kind="games" data-id="${g.id}">${icon('cart', 'ico-sm')} أضف للسلة</button>`;
}

export function gameCard(g) {
  const un = g.status !== 'available';
  const lang = un ? '<span class="badge b-gray">غير متوفرة</span>' : g.language === 'ar' ? '<span class="badge b-green">عربي</span>' : '<span class="badge b-blue">غير عربي</span>';
  return `<article class="card ${un ? 'unavailable' : ''}">
    <a class="card-media" href="#/game/${g.id}" aria-label="${esc(g.title)}">
      <img loading="lazy" decoding="async" src="${esc(gameCover(g))}" alt="">
      <div class="card-badges"><div class="grp"><span class="badge b-solid">${esc(g.platform || 'PS4')}</span></div><div class="grp">${lang}</div></div>
      <div class="card-shade"></div>
      <div class="card-likes"><span>👍 ${num(g.likes)}</span>${un && g.requests ? `<span>🙋 ${num(g.requests)} طلب</span>` : ''}</div>
    </a>
    <div class="card-body">
      <h3 class="card-title"><a href="#/game/${g.id}">${esc(g.title)}</a></h3>
      <div class="card-meta"><span class="price">${money(g.price)}</span>${g.size ? `<small class="muted ltr">${esc(g.size)}</small>` : ''}</div>
      <div class="card-actions" data-g="${g.id}">${gameActions(g)}</div>
    </div>
  </article>`;
}

function productActions(p, size = 'sm') {
  if (p.in_stock === false) return `<button class="btn btn-ghost btn-${size}" data-act="ask-product" data-id="${p.id}">${icon('wa', 'ico-sm')} استفسر عن توفره</button>`;
  if (inCart('products', p.id)) return `<button class="btn btn-ghost btn-${size}" data-act="cart-open" data-kind="products">${icon('check', 'ico-sm')} في السلة</button>`;
  return `<button class="btn btn-gold btn-${size}" data-act="cart-add" data-kind="products" data-id="${p.id}">${icon('cart', 'ico-sm')} أضف للسلة</button>`;
}

export function productCard(p) {
  return `<article class="card">
    <a class="card-media" href="#/product/${p.id}" aria-label="${esc(p.name)}">
      <img loading="lazy" decoding="async" src="${esc(productImg(p))}" alt="">
      <div class="card-badges"><div class="grp">${p.condition === 'used' ? '<span class="badge b-gold">مستعمل</span>' : '<span class="badge b-green">جديد</span>'}</div>
      <div class="grp">${p.delivery ? '<span class="badge b-solid">🚚 توصيل</span>' : ''}${p.in_stock === false ? '<span class="badge b-gray">نفد</span>' : ''}</div></div>
    </a>
    <div class="card-body">
      <h3 class="card-title"><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
      <div class="card-meta"><span class="price">${money(p.price)}</span></div>
      <div class="card-actions" data-p="${p.id}">${productActions(p)}</div>
    </div>
  </article>`;
}

// تحديث الأزرار بدون إعادة رسم الصفحة
function refreshBits() {
  $$('.card-actions[data-g]').forEach((el) => { const g = gameById(el.dataset.g); if (g) el.innerHTML = gameActions(g); });
  $$('.card-actions[data-p]').forEach((el) => { const p = productById(el.dataset.p); if (p) el.innerHTML = productActions(p); });
  $$('.card-actions[data-c]').forEach((el) => {
    const t = el.dataset.c;
    const c = state.catalog.find((x) => x.title === t) || discoverList.find((x) => x.title === t) || { title: t };
    el.innerHTML = catActions(c);
  });
  const bb = $('#buy-box');
  if (bb) {
    if (bb.dataset.g) { const g = gameById(bb.dataset.g); if (g) bb.innerHTML = gameBuyBox(g); }
    if (bb.dataset.p) { const p = productById(bb.dataset.p); if (p) bb.innerHTML = productBuyBox(p); }
  }
  const vb = $('#votes');
  if (vb) { const g = gameById(vb.dataset.g); if (g) vb.innerHTML = votesHTML(g); }
}

// ================= البانر =================
function heroHTML() {
  const slides = state.banners.length ? state.banners : null;
  const sh = shapesSVG(90, '#fff');
  if (!slides) {
    return `<section class="hero"><div class="hero-track"><div class="hero-slide active">
      <div class="brand-hero"></div>
      <div class="ps-shapes"><span style="top:14%;right:8%">${sh.tri}</span><span style="top:30%;left:12%;animation-delay:-2s">${sh.cir}</span><span style="bottom:24%;right:30%;animation-delay:-4s">${sh.x}</span><span style="top:12%;left:40%;animation-delay:-6s">${sh.sq}</span></div>
      <div class="hero-content"><div class="container"><div class="inner">
        <div class="hero-kicker"><span class="badge b-gold">✦ قسم البلايستيشنات</span></div>
        <h1 class="hero-title">${esc(state.site.tagline)}</h1>
        <p class="hero-sub">${esc(state.site.tagline_sub)}</p>
        <div class="hero-actions"><a class="btn btn-gold btn-lg" href="#/games">${icon('gamepad')} تصفح الألعاب</a><a class="btn btn-outline btn-lg" style="color:#fff;border-color:rgba(255,255,255,.3)" href="#/contact">${icon('phone')} تواصل معنا</a></div>
      </div></div></div></div></div></section>`;
  }
  return `<section class="hero" id="hero">
    <div class="hero-track">${slides.map((b, i) => {
      const link = bannerLink(b);
      const g = b.link_type === 'game' ? gameById(b.link_id) : null;
      const p = b.link_type === 'product' ? productById(b.link_id) : null;
      const kick = g ? `<span class="badge b-solid">${esc(g.platform)}</span><span class="badge ${g.status === 'available' ? 'b-green' : 'b-gray'}">${statusLabel(g)}</span>`
        : p ? `<span class="badge b-solid">${esc(p.category || 'منتج')}</span><span class="badge ${p.condition === 'used' ? 'b-gold' : 'b-green'}">${p.condition === 'used' ? 'مستعمل' : 'جديد'}</span>` : '';
      const sub = b.subtitle || '';
      return `<div class="hero-slide ${i === 0 ? 'active' : ''}" data-link="${link || ''}" ${link ? 'style="cursor:pointer"' : ''}>
        <img class="hero-img" src="${esc(bannerImage(b))}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
        <div class="hero-fade-l"></div><div class="hero-fade-b"></div>
        <div class="hero-content"><div class="container"><div class="inner">
          ${kick ? `<div class="hero-kicker">${kick}</div>` : ''}
          ${b.title ? `<h2 class="hero-title">${esc(b.title)}</h2>` : ''}
          ${sub ? `<p class="hero-sub">${esc(sub.length > 130 ? sub.slice(0, 128) + '…' : sub)}</p>` : ''}
          ${link ? `<div class="hero-actions"><a class="btn btn-gold" href="${link}">${icon('eye', 'ico-sm')} عرض التفاصيل</a>${g && g.status === 'available' ? `<button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)" data-act="cart-add" data-kind="games" data-id="${g.id}">${icon('cart', 'ico-sm')} أضف للسلة</button>` : ''}</div>` : ''}
        </div></div></div>
      </div>`;
    }).join('')}</div>
    ${slides.length > 1 ? `<div class="hero-nav prev"><button data-hero="prev" aria-label="السابق">${icon('chevR')}</button></div><div class="hero-nav next"><button data-hero="next" aria-label="التالي">${icon('chevL')}</button></div>
    <div class="hero-thumbs"><div class="container"><div class="inner">${slides.map((b, i) => `<button class="hero-thumb ${i === 0 ? 'active' : ''}" data-hero="${i}" aria-label="شريحة ${i + 1}"><img src="${esc(bannerImage(b))}" alt="" loading="lazy"><span class="hero-progress"></span></button>`).join('')}</div></div></div>` : ''}
  </section>`;
}

function mountHero() {
  const hero = $('#hero');
  if (!hero) return;
  const slides = $$('.hero-slide', hero), thumbs = $$('.hero-thumb', hero);
  if (slides.length < 2) return;
  const DUR = 6500;
  hero.style.setProperty('--dur', DUR + 'ms');
  let i = 0, timer = null, paused = false;
  const go = (n, back = false) => {
    n = (n + slides.length) % slides.length;
    if (n === i) return;
    slides.forEach((s) => s.classList.remove('leaving', 'back'));
    const cur = slides[i], nxt = slides[n];
    if (back) { nxt.classList.add('back'); cur.classList.add('back'); }
    void nxt.offsetWidth;
    cur.classList.remove('active'); cur.classList.add('leaving');
    nxt.classList.add('active');
    thumbs.forEach((t, k) => t.classList.toggle('active', k === n));
    const r = hero.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) {
      const box = thumbs[n].parentElement, t = thumbs[n];
      const center = t.offsetLeft - box.clientWidth / 2 + t.clientWidth / 2;
      box.scrollTo({ left: center, behavior: 'smooth' });
    }
    i = n; restart();
  };
  const restart = () => { clearTimeout(timer); if (!paused) timer = setTimeout(() => go(i + 1), DUR); };
  hero.addEventListener('click', (e) => {
    const h = e.target.closest('[data-hero]');
    if (h) { e.stopPropagation(); const v = h.dataset.hero; if (v === 'next') go(i + 1); else if (v === 'prev') go(i - 1, true); else go(+v, +v < i); return; }
    if (e.target.closest('a,button')) return;
    const s = e.target.closest('.hero-slide');
    if (s && s.dataset.link && !moved) location.hash = s.dataset.link;
  });
  let x0 = null, moved = false;
  hero.addEventListener('pointerdown', (e) => { x0 = e.clientX; moved = false; });
  hero.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { moved = true; dx < 0 ? go(i + 1) : go(i - 1, true); setTimeout(() => (moved = false), 50); }
  });
  hero.addEventListener('mouseenter', () => { paused = true; hero.classList.add('paused'); clearTimeout(timer); });
  hero.addEventListener('mouseleave', () => { paused = false; hero.classList.remove('paused'); restart(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else restart(); }, { once: false });
  restart();
  return () => clearTimeout(timer);
}

// ================= الصفحات =================
const sectionHead = (title, sub, link, linkText = 'عرض الكل') => `<div class="section-head"><div><h2 class="section-title"><span class="bar"></span>${title}</h2>${sub ? `<p class="section-sub">${sub}</p>` : ''}</div>${link ? `<a class="see-all" href="${link}">${linkText} ${icon('chevL', 'ico-sm')}</a>` : ''}</div>`;

function sortGames(list, tab) {
  const by = (f) => [...list].sort(f);
  const newest = (a, b) => (a.created_at < b.created_at ? 1 : -1);
  switch (tab) {
    case 'available': return by(newest).filter((g) => g.status === 'available');
    case 'liked': return by((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
    case 'ar': return by(newest).filter((g) => g.language === 'ar' && g.status === 'available');
    case 'unavailable': return by((a, b) => (b.requests || 0) - (a.requests || 0)).filter((g) => g.status !== 'available');
    case 'all': return by((a, b) => (a.status === b.status ? newest(a, b) : a.status === 'available' ? -1 : 1));
    default: return by(newest);
  }
}
const GAME_TABS = [['new', 'الأحدث'], ['available', 'المتوفر'], ['liked', 'الأكثر إعجاباً'], ['ar', 'العربي'], ['unavailable', 'اطلب توفيرها'], ['all', 'الكل']];

const svcColors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const svcCard = (s, i, compact) => `<div class="svc"><div class="svc-ico ${svcColors[i % 8]}">${esc(s.emoji)}</div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>
  ${compact ? '' : `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/${state.site.whatsapp}?text=${encodeURIComponent('استفسار عن خدمة: ' + s.title)}">${icon('wa', 'ico-sm')} استفسر الآن</a>`}</div>`;

function contactBlock(withMap) {
  const s = state.site;
  return `<div class="contact-grid">
    <div class="contact-card">
      <div class="muted" style="font-weight:800">للتواصل والاستفسار</div>
      <div class="phone-big">${esc(s.phone)}</div>
      <div class="contact-actions">
        <a class="btn btn-blue btn-lg" href="tel:+${esc(s.whatsapp)}">${icon('phone')} اتصال مباشر</a>
        <a class="btn btn-green btn-lg" target="_blank" rel="noopener" href="https://wa.me/${esc(s.whatsapp)}">${icon('wa')} واتساب</a>
      </div>
      <div class="addr">${icon('pin', 'gold')}<div><b>${esc(s.address_title)}</b><div class="muted">${esc(s.address)}</div>${s.hours ? `<div class="muted" style="font-size:.85rem;margin-top:4px">🕘 ${esc(s.hours)}</div>` : ''}</div></div>
    </div>
    ${withMap ? `<div class="map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="الموقع على الخريطة" src="https://www.google.com/maps?q=${encodeURIComponent(s.map_query || s.address_title)}&output=embed"></iframe></div>`
      : `<div class="contact-card" style="display:flex;flex-direction:column;justify-content:center;gap:12px">
        <h3 style="margin:0;font-size:1.3rem">زورونا في المحل 👑</h3><p class="muted" style="margin:0">${esc(s.address_title)} — ${esc(s.address)}</p>
        <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.map_query || s.address_title)}">${icon('pin', 'ico-sm')} افتح في الخرائط</a></div>`}
  </div>`;
}

function pageHome() {
  const s = state.site;
  const blocks = {
    games: () => `<section class="section"><div class="container">${sectionHead('الألعاب', 'أحدث الألعاب وأكثرها طلباً', '#/games')}
      <div class="tabs" id="home-tabs" style="margin-bottom:16px">${GAME_TABS.slice(0, 4).map(([k, l], i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="grid" id="home-games"></div>
      <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:20px"><a class="btn btn-outline" href="#/games">${icon('gamepad', 'ico-sm')} كل الألعاب (${state.games.length})</a><a class="btn btn-blue" href="#/discover">${icon('compass', 'ico-sm')} ما لقيت لعبتك؟ اكتشف واطلب</a></div></div></section>`,
    products: () => state.products.length ? `<section class="section"><div class="container">${sectionHead('المنتجات', 'أجهزة ويدات وإكسسوارات — جديد ومستعمل', '#/products')}
      <div class="grid products">${[...state.products].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 4).map(productCard).join('')}</div></div></section>` : '',
    services: () => `<section class="section"><div class="container">${sectionHead('خدماتنا', 'كل ما يحتاجه جهازك في مكان واحد', '#/services', 'تفاصيل الخدمات')}
      <div class="svc-grid compact">${s.services.slice(0, 8).map((x, i) => svcCard(x, i, true)).join('')}</div></div></section>`,
    why: () => `<section class="section"><div class="container">${sectionHead('لماذا نحن', '', '#/why', 'اعرف أكثر')}
      <div class="svc-grid compact">${s.why.slice(0, 4).map((x, i) => svcCard(x, i + 2, true)).join('')}</div></div></section>`,
    contact: () => `<section class="section"><div class="container">${sectionHead('تواصل معنا', '', '#/contact', 'صفحة التواصل')}${contactBlock(false)}</div></section>`,
  };
  const html = heroHTML() + s.sections.filter((x) => x.on && blocks[x.id]).map((x) => blocks[x.id]()).join('');
  return {
    html,
    mount() {
      const stop = mountHero();
      const grid = $('#home-games');
      if (grid) {
        const draw = (tab) => {
          const list = sortGames(state.games, tab).slice(0, 10);
          grid.innerHTML = list.length ? list.map(gameCard).join('') : '<div class="empty">لا توجد ألعاب بعد</div>';
        };
        draw('new');
        $('#home-tabs').addEventListener('click', (e) => {
          const b = e.target.closest('[data-tab]'); if (!b) return;
          $$('#home-tabs .tab').forEach((t) => t.classList.toggle('active', t === b)); draw(b.dataset.tab);
        });
      }
      return stop;
    },
  };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function pageGames(_, q) {
  let tab = q.get('tab') || 'new', plat = 'all', term = q.get('q') || '', page = 1;
  const PER = 24;
  const html = `<div class="page-head"><div class="container"><div class="crumbs"><a href="#/">الرئيسية</a> / <span>الألعاب</span></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap"><div><h1>🎮 مكتبة الألعاب</h1><p>ابحث عن لعبتك، وإذا ما لقيتها اطلب توفيرها وبنجهزها لك</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-gold" href="#/discover">${icon('compass', 'ico-sm')} اكتشف ألعاب غير موجودة</a><button class="btn btn-blue" data-act="request-missing">${icon('bell', 'ico-sm')} اطلب لعبة بالاسم</button></div></div></div></div>
    <div class="container" style="padding-bottom:30px"><div class="toolbar">
      <label class="search">${icon('search')}<input id="g-search" type="search" placeholder="ابحث باسم اللعبة… مثل FC أو سبايدرمان" value="${esc(term)}" autocomplete="off"></label>
      <div class="tabs" id="g-tabs">${GAME_TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="chips" id="g-plat">${[['all', 'كل الأجهزة'], ['PS4', 'PS4'], ['PS5', 'PS5']].map(([k, l]) => `<button class="chip ${k === plat ? 'active' : ''}" data-p="${k}">${l}</button>`).join('')}</div>
        <span class="result-info" id="g-info"></span></div>
    </div><div class="grid" id="g-grid"></div><div class="pager" id="g-pager"></div></div>`;
  return {
    html,
    mount() {
      const grid = $('#g-grid'), pager = $('#g-pager');
      const draw = (scroll) => {
        let list = sortGames(state.games, tab);
        if (plat !== 'all') list = list.filter((g) => (g.platform || '').includes(plat));
        if (term.trim()) { const t = norm(term); list = list.filter((g) => norm(g.title).includes(t) || norm(g.description).includes(t)); }
        const pages = Math.max(1, Math.ceil(list.length / PER));
        page = Math.min(page, pages);
        const slice = list.slice((page - 1) * PER, page * PER);
        grid.innerHTML = slice.length ? slice.map(gameCard).join('') : `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div>ما لقينا لعبة بهذا الاسم.<br>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px"><a class="btn btn-gold" href="#/discover?q=${encodeURIComponent(term)}">${icon('compass', 'ico-sm')} ابحث في ألعاب غير موجودة</a><button class="btn btn-blue" data-act="request-missing" data-term="${esc(term)}">${icon('bell', 'ico-sm')} اطلب توفيرها${term ? ` «${esc(term)}»` : ''}</button></div></div>`;
        $('#g-info').textContent = `${list.length} لعبة`;
        pager.innerHTML = pages > 1 ? `<button data-pg="${page - 1}" ${page === 1 ? 'disabled' : ''}>${icon('chevR', 'ico-sm')}</button>` +
          Array.from({ length: pages }, (_, k) => k + 1).filter((k) => k === 1 || k === pages || Math.abs(k - page) <= 1).map((k, idx, arr) => (idx && k - arr[idx - 1] > 1 ? '<button disabled>…</button>' : '') + `<button data-pg="${k}" class="${k === page ? 'active' : ''}">${k}</button>`).join('') +
          `<button data-pg="${page + 1}" ${page === pages ? 'disabled' : ''}>${icon('chevL', 'ico-sm')}</button>` : '';
        if (scroll) $('.toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      draw();
      let t;
      $('#g-search').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { term = e.target.value; page = 1; draw(); }, 180); });
      $('#g-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; page = 1; $$('#g-tabs .tab').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
      $('#g-plat').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; plat = b.dataset.p; page = 1; $$('#g-plat .chip').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
      pager.addEventListener('click', (e) => { const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; page = +b.dataset.pg; draw(true); });
    },
  };
}

// ===== اكتشف ألعاب (غير موجودة في الموقع) =====
const catalogVisible = () => {
  const have = new Set(state.games.map((g) => catNorm(g.title)));
  return state.catalog.filter((c) => !have.has(catNorm(c.title)));
};
function catActions(c) {
  if (iRequestedCustom(c.title)) return `<div class="installing" style="flex:1"><div class="lbl"><span>✅ تم الطلب — جاري التجهيز</span></div><div class="ps-bar"><i style="--p:${Math.min(92, 40 + (c.requests || 1) * 7)}%"></i></div></div>`;
  return `<button class="btn btn-blue btn-sm" data-act="request-cat" data-title="${esc(c.title)}" data-plat="${esc(c.platform || 'PS4/PS5')}" data-cover="${esc(c.cover || '')}">${icon('bell', 'ico-sm')} اطلب توفيرها</button>`;
}
function catCard(c, i) {
  return `<article class="card cat-card">
    <a class="card-media" href="#" data-act="cat-view" data-i="${i}" aria-label="${esc(c.title)}">
      <img loading="lazy" decoding="async" src="${esc(c.cover || artImage(c.title, { sub: c.platform }))}" alt="">
      <div class="card-badges"><div class="grp"><span class="badge b-solid">${esc(c.platform || 'PS4/PS5')}</span></div><div class="grp"><span class="badge b-gold">غير موجودة</span></div></div>
      <div class="card-shade"></div>
      ${c.requests ? `<div class="card-likes"><span>🙋 ${num(c.requests)} طلب</span></div>` : ''}
    </a>
    <div class="card-body"><h3 class="card-title">${esc(c.title)}</h3>
      <div class="card-actions" data-c="${esc(c.title)}">${catActions(c)}</div></div>
  </article>`;
}
let discoverList = [];
function pageDiscover(_, q) {
  let term = q.get('q') || '', plat = 'all';
  const hasKey = !!(window.APP_CONFIG || {}).RAWG_API_KEY;
  return {
    html: `<div class="page-head"><div class="container"><div class="crumbs"><a href="#/">الرئيسية</a> / <a href="#/games">الألعاب</a> / <span>اكتشف</span></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap"><div><h1>🧭 اكتشف ألعاب</h1><p>ألعاب مش موجودة في الموقع حالياً — اطلب توفير اللي يعجبك، وكل ما زادت الطلبات وفرناها أسرع</p></div>
      <button class="btn btn-ghost" data-act="request-missing">${icon('plus', 'ico-sm')} لعبة مش في القائمة؟</button></div></div></div>
      <div class="container" style="padding-bottom:30px"><div class="toolbar">
        <label class="search">${icon('search')}<input id="d-search" type="search" placeholder="ابحث في الألعاب…" value="${esc(term)}" autocomplete="off"></label>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div class="chips" id="d-plat">${[['all', 'كل الأجهزة'], ['PS4', 'PS4'], ['PS5', 'PS5']].map(([k, l]) => `<button class="chip ${k === plat ? 'active' : ''}" data-p="${k}">${l}</button>`).join('')}</div>
          <span class="result-info" id="d-info"></span></div>
      </div><div class="grid" id="d-grid"></div><div id="d-world"></div></div>`,
    mount() {
      const draw = () => {
        let list = catalogVisible().sort((a, b) => (b.requests || 0) - (a.requests || 0) || (a.created_at < b.created_at ? 1 : -1));
        if (plat !== 'all') list = list.filter((c) => (c.platform || '').includes(plat));
        if (term.trim()) { const t = norm(term); list = list.filter((c) => norm(c.title).includes(t)); }
        discoverList = list;
        $('#d-info').textContent = `${list.length} لعبة`;
        $('#d-grid').innerHTML = list.length ? list.map(catCard).join('') : `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div>ما لقيناها في القائمة<br><button class="btn btn-blue" style="margin-top:12px" data-act="request-missing" data-term="${esc(term)}">${icon('bell', 'ico-sm')} اطلبها بالاسم${term ? ` «${esc(term)}»` : ''}</button></div>`;
        $('#d-world').innerHTML = hasKey && term.trim().length >= 3 ? `<div style="text-align:center;margin-top:20px"><button class="btn btn-outline" id="d-rawg">${icon('globe', 'ico-sm')} ابحث عن «${esc(term)}» في كل الألعاب العالمية</button></div><div class="grid" id="d-rgrid" style="margin-top:16px"></div>` : '';
        $('#d-rawg')?.addEventListener('click', async (e) => {
          e.currentTarget.disabled = true;
          try {
            const rawg = await import('./rawg.js');
            const res = (await rawg.search(term)).filter((r) => !findGameByTitle(r.title));
            const base = discoverList.length;
            discoverList = [...discoverList, ...res];
            $('#d-rgrid').innerHTML = res.length ? res.map((r, k) => catCard(r, base + k)).join('') : '<div class="empty" style="grid-column:1/-1">ما لقينا نتائج</div>';
          } catch (x) { toast('تعذّر البحث', { text: x.message, emoji: '⚠️', kind: 'bad' }); }
        });
      };
      draw();
      let t;
      $('#d-search').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { term = e.target.value; draw(); }, 200); });
      $('#d-plat').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; plat = b.dataset.p; $$('#d-plat .chip').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
    },
  };
}
function catView(c) {
  const imgs = [...(c.screenshots || []), c.cover].filter(Boolean);
  modal({
    title: esc(c.title), wide: true,
    body: `${imgs.length ? gallery(imgs) : ''}<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 8px"><span class="badge b-solid">${esc(c.platform || '')}</span><span class="badge b-gold">غير موجودة في الموقع حالياً</span>${c.requests ? `<span class="req-count">🙋 ${num(c.requests)} طلب</span>` : ''}</div>
      ${c.description ? `<p class="desc">${esc(c.description)}</p>` : ''}<div class="card-actions" data-c="${esc(c.title)}" style="display:flex">${catActions(c)}</div>`,
    onMount: () => mountGallery(),
  });
}

function votesHTML(g) {
  const v = myVote(g.id);
  const total = (g.likes || 0) + (g.dislikes || 0);
  const pct = total ? Math.round(((g.likes || 0) / total) * 100) : 0;
  return `<button class="vote-btn up ${v === 1 ? 'on' : ''}" data-act="vote" data-id="${g.id}" data-v="1">${icon('up', 'ico-sm')} ${num(g.likes)}</button>
    <button class="vote-btn down ${v === -1 ? 'on' : ''}" data-act="vote" data-id="${g.id}" data-v="-1">${icon('down', 'ico-sm')} ${num(g.dislikes)}</button>
    ${total ? `<div class="rating-bar" title="${pct}% أعجبتهم"><i style="width:${pct}%"></i></div><small class="muted">${pct}% أعجبتهم</small>` : '<small class="muted">كن أول من يقيّم</small>'}`;
}

function gameBuyBox(g) {
  if (g.status !== 'available') {
    const req = iRequested(g.id);
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="badge b-gray" style="font-size:.85rem">⏳ غير متوفرة حالياً</span>
      <span class="req-count">🙋 ${num(g.requests || 0)} ${(g.requests || 0) === 1 ? 'شخص طلبها' : 'شخص طلبوها'}</span></div>
      ${req ? `<div class="installing"><div class="lbl"><span>✅ تم الطلب — جاري التجهيز</span><span class="muted">سيظهر لك إشعار عند توفرها</span></div><div class="ps-bar"><i style="--p:${Math.min(92, 40 + (g.requests || 1) * 7)}%"></i></div></div>`
        : `<button class="btn btn-blue btn-lg btn-block" data-act="request" data-id="${g.id}">${icon('bell')} اطلب توفير اللعبة</button>
           <small class="muted">طلبك يوصل للمحل مباشرة، وكل ما زاد عدد الطلبات وفرناها أسرع.</small>`}`;
  }
  const ad = autoDiscount(cartIds('games').length + (inCart('games', g.id) ? 0 : 1));
  const d = state.discount;
  return `<div style="display:flex;justify-content:space-between;align-items:center"><span class="price" style="font-size:1.6rem">${money(g.price)}</span><span class="badge ${g.language === 'ar' ? 'b-green' : 'b-blue'}">${statusLabel(g)}</span></div>
    <div class="buy-row">
      ${inCart('games', g.id) ? `<button class="btn btn-ghost btn-lg" data-act="cart-open" data-kind="games">${icon('check')} في السلة — عرض السلة</button>` : `<button class="btn btn-gold btn-lg" data-act="cart-add" data-kind="games" data-id="${g.id}">${icon('cart')} أضف للسلة</button>`}
      <button class="btn btn-green btn-lg" data-act="order-now" data-kind="games" data-id="${g.id}">${icon('wa')} اطلبها الآن</button>
    </div>
    ${d.enabled && d.percent ? `<div class="hint ${ad.pct ? 'ok' : ''}">${ad.pct ? `🎉 مع هذي اللعبة يتفعّل خصم ${d.percent}% على السلة` : `🔥 اطلب ${ad.min} ألعاب أو أكثر واحصل على خصم ${d.percent}%`}</div>` : ''}`;
}

function gallery(images, coverPortrait) {
  return `<div class="media-main" id="media-main"><img class="bg" id="mm-bg" src="${esc(images[0])}" alt=""><img class="fg" id="mm-img" src="${esc(images[0])}" alt="">
    ${coverPortrait ? `<div class="media-cover-float"><img src="${esc(coverPortrait)}" alt=""></div>` : ''}</div>
    ${images.length > 1 ? `<div class="thumbs" id="thumbs">${images.map((src, i) => `<button class="thumb ${i === 0 ? 'active' : ''}" data-src="${esc(src)}"><img loading="lazy" src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}`;
}
function mountGallery() {
  const box = $('#thumbs'); if (!box) return;
  const show = (t) => {
    if (!t || t.classList.contains('active')) return;
    $$('.thumb', box).forEach((x) => x.classList.toggle('active', x === t));
    const img = $('#mm-img'), bg = $('#mm-bg');
    img.classList.add('swap');
    const n = new Image(); n.src = t.dataset.src;
    const apply = () => { img.src = t.dataset.src; bg.src = t.dataset.src; img.classList.remove('swap'); };
    n.decode ? n.decode().then(apply, apply) : (n.onload = apply);
  };
  box.addEventListener('mouseover', (e) => show(e.target.closest('.thumb')));
  box.addEventListener('click', (e) => show(e.target.closest('.thumb')));
}

function pageGame([id]) {
  const g = gameById(id);
  if (!g) return { html: `<div class="container"><div class="empty"><div class="big">🎮</div>اللعبة غير موجودة<br><a class="btn btn-gold" style="margin-top:12px" href="#/games">كل الألعاب</a></div></div>` };
  const shots = (g.screenshots || []).filter(Boolean);
  const images = shots.length ? [...shots, gameCover(g)] : [gameCover(g)];
  const related = state.games.filter((x) => x.id !== g.id && x.status === 'available' && (x.platform || '').split('/').some((p) => (g.platform || '').includes(p))).slice(0, 6);
  return {
    html: `<div class="container">
      <div class="crumbs" style="padding-top:18px"><a href="#/">الرئيسية</a> / <a href="#/games">الألعاب</a> / <span>${esc(g.title)}</span></div>
      <div class="detail">
        <div>${gallery(images, shots.length ? gameCover(g) : null)}</div>
        <div class="info">
          <h1>${esc(g.title)}</h1>
          <div class="badges"><span class="badge b-solid">${esc(g.platform)}</span>${g.status === 'available' ? `<span class="badge b-green">متوفرة</span><span class="badge ${g.language === 'ar' ? 'b-green' : 'b-blue'}">${g.language === 'ar' ? '🇸🇦 عربي' : '🌐 غير عربي'}</span>` : '<span class="badge b-gray">غير متوفرة حالياً</span>'}</div>
          <div class="votes" id="votes" data-g="${g.id}">${votesHTML(g)}</div>
          <div class="facts">
            <div class="fact"><div class="k">${icon('tag', 'ico-sm')} السعر</div><div class="v price">${money(g.price)}</div></div>
            ${g.size ? `<div class="fact"><div class="k">${icon('hdd', 'ico-sm')} الحجم</div><div class="v"><span class="ltr">${esc(g.size)}</span></div></div>` : ''}
            <div class="fact"><div class="k">${icon('gamepad', 'ico-sm')} الجهاز</div><div class="v">${esc(g.platform)}</div></div>
          </div>
          <div class="buy-box" id="buy-box" data-g="${g.id}">${gameBuyBox(g)}</div>
          ${g.description ? `<h3 style="margin:22px 0 6px">نبذة عن اللعبة</h3><p class="desc">${esc(g.description)}</p>` : ''}
        </div>
      </div>
      ${related.length ? `<section class="section tight">${sectionHead('ألعاب قد تعجبك', '', '#/games')}<div class="grid">${related.map(gameCard).join('')}</div></section>` : ''}
    </div>`,
    mount: mountGallery,
  };
}

function pageProducts(_, q) {
  let cat = 'all', cond = q.get('c') || 'all';
  const cats = [...new Set(state.products.map((p) => p.category).filter(Boolean))];
  return {
    html: `<div class="page-head"><div class="container"><div class="crumbs"><a href="#/">الرئيسية</a> / <span>المنتجات</span></div>
      <h1>📦 المنتجات</h1><p>أجهزة بلايستيشن، يدات، سماعات وإكسسوارات — بضمان</p></div></div>
      <div class="container" style="padding-bottom:30px"><div class="toolbar">
        <div class="tabs" id="p-cond">${[['all', 'الكل'], ['new', 'جديد'], ['used', 'مستعمل']].map(([k, l]) => `<button class="tab ${k === cond ? 'active' : ''}" data-c="${k}">${l}</button>`).join('')}</div>
        ${cats.length > 1 ? `<div class="chips" id="p-cat"><button class="chip active" data-cat="all">كل الأقسام</button>${cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
      </div><div class="grid products" id="p-grid"></div></div>`,
    mount() {
      const draw = () => {
        let list = [...state.products].sort((a, b) => (a.in_stock === b.in_stock ? (a.created_at < b.created_at ? 1 : -1) : a.in_stock === false ? 1 : -1));
        if (cond !== 'all') list = list.filter((p) => p.condition === cond);
        if (cat !== 'all') list = list.filter((p) => p.category === cat);
        $('#p-grid').innerHTML = list.length ? list.map(productCard).join('') : '<div class="empty" style="grid-column:1/-1"><div class="big">📦</div>لا توجد منتجات هنا حالياً</div>';
      };
      draw();
      $('#p-cond').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cond = b.dataset.c; $$('#p-cond .tab').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
      $('#p-cat')?.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; $$('#p-cat .chip').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
    },
  };
}

function productBuyBox(p) {
  return `<div style="display:flex;justify-content:space-between;align-items:center"><span class="price" style="font-size:1.6rem">${money(p.price)}</span>${p.in_stock === false ? '<span class="badge b-gray">نفدت الكمية</span>' : '<span class="badge b-green">متوفر</span>'}</div>
    <div class="buy-row">${p.in_stock === false ? `<button class="btn btn-green btn-lg" data-act="ask-product" data-id="${p.id}">${icon('wa')} استفسر عن توفره</button>` : `
      ${inCart('products', p.id) ? `<button class="btn btn-ghost btn-lg" data-act="cart-open" data-kind="products">${icon('check')} في السلة</button>` : `<button class="btn btn-gold btn-lg" data-act="cart-add" data-kind="products" data-id="${p.id}">${icon('cart')} أضف للسلة</button>`}
      <button class="btn btn-green btn-lg" data-act="order-now" data-kind="products" data-id="${p.id}">${icon('wa')} اطلبه الآن</button>`}</div>`;
}

function pageProduct([id]) {
  const p = productById(id);
  if (!p) return { html: `<div class="container"><div class="empty"><div class="big">📦</div>المنتج غير موجود<br><a class="btn btn-gold" style="margin-top:12px" href="#/products">كل المنتجات</a></div></div>` };
  const imgs = (p.images || []).filter(Boolean);
  return {
    html: `<div class="container">
      <div class="crumbs" style="padding-top:18px"><a href="#/">الرئيسية</a> / <a href="#/products">المنتجات</a> / <span>${esc(p.name)}</span></div>
      <div class="detail"><div>${gallery(imgs.length ? imgs : [productImg(p)])}</div>
        <div class="info"><h1>${esc(p.name)}</h1>
          <div class="badges">${p.condition === 'used' ? '<span class="badge b-gold">مستعمل</span>' : '<span class="badge b-green">جديد</span>'}${p.category ? `<span class="badge b-solid">${esc(p.category)}</span>` : ''}</div>
          <div class="facts">
            <div class="fact"><div class="k">${icon('box', 'ico-sm')} الحالة</div><div class="v">${p.condition === 'used' ? 'مستعمل' : 'جديد'}</div></div>
            <div class="fact"><div class="k">${icon('truck', 'ico-sm')} التوصيل</div><div class="v">${p.delivery ? 'متوفر ✓' : 'استلام من المحل'}</div></div>
            <div class="fact" style="grid-column:1/-1"><div class="k">${icon('shield', 'ico-sm')} الضمان</div><div class="v">${esc(p.warranty || 'ضمان 3 أشهر ضد أي خلل مصنعي')}</div></div>
          </div>
          <div class="buy-box" id="buy-box" data-p="${p.id}">${productBuyBox(p)}</div>
          ${p.description ? `<h3 style="margin:22px 0 6px">الوصف</h3><p class="desc">${esc(p.description)}</p>` : ''}
        </div></div></div>`,
    mount: mountGallery,
  };
}

const simplePage = (emoji, title, sub, body) => `<div class="page-head"><div class="container"><div class="crumbs"><a href="#/">الرئيسية</a> / <span>${title}</span></div><h1>${emoji} ${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div><div class="container" style="padding-bottom:40px">${body}</div>`;

const pageServices = () => ({ html: simplePage('🛠️', 'خدماتنا', 'كل ما يحتاجه جهازك وجوالك في مكان واحد', `<div class="svc-grid">${state.site.services.map((s, i) => svcCard(s, i)).join('')}</div>`) });
const pageWhy = () => ({ html: simplePage('👑', 'لماذا نحن', 'ليش الزباين يختارون ' + esc(state.site.name), `<div class="svc-grid">${state.site.why.map((s, i) => svcCard(s, i + 2, true).replace('<p>', '<p style="display:block">')).join('')}</div>
  <div style="margin-top:26px">${contactBlock(false)}</div>`) });
const pageContact = () => ({ html: simplePage('📞', 'تواصل معنا', 'اتصل أو راسلنا واتساب أو زورنا في المحل', contactBlock(true)) });
const pageNews = () => ({
  html: simplePage('🔔', 'جديدنا', 'ملخص كل ما يحدث في المحل والموقع أول بأول', state.notifications.length
    ? `<div class="panel" style="max-width:760px"><div class="notif-list">${state.notifications.map((n) => notifItem(n)).join('')}</div></div>`
    : '<div class="empty"><div class="big">🔔</div>لا يوجد جديد حالياً</div>'),
  mount() { lsSet('jx_seen', Date.now()); renderCounts(); },
});

// ================= السلة =================
let cartKind = 'games';
function openCart(kind) {
  if (kind) cartKind = kind;
  closeCart();
  const ov = document.createElement('div'); ov.className = 'drawer-overlay'; ov.id = 'drawer-ov';
  const dr = document.createElement('aside'); dr.className = 'drawer'; dr.id = 'drawer';
  document.body.append(ov, dr);
  document.body.classList.add('no-scroll');
  ov.onclick = closeCart;
  renderCart();
}
function closeCart() {
  $('#drawer')?.remove(); $('#drawer-ov')?.remove();
  if (!$('.overlay')) document.body.classList.remove('no-scroll');
}
function renderCart() {
  const dr = $('#drawer'); if (!dr) return;
  const t = cartTotals(cartKind);
  const gN = cartIds('games').length, pN = cartIds('products').length;
  const d = state.discount;
  const prevName = $('#c-name')?.value ?? lsGet('jx_name', '');
  const prevCoupon = $('#c-coupon')?.value ?? '';
  dr.innerHTML = `<div class="drawer-head"><b style="font-size:1.1rem">🛒 السلة</b><button class="icon-btn" id="c-close" aria-label="إغلاق">${icon('x')}</button></div>
    <div class="drawer-body">
      <div class="seg"><button class="${cartKind === 'games' ? 'active' : ''}" data-k="games">🎮 سلة الألعاب <span class="n">${gN}</span></button><button class="${cartKind === 'products' ? 'active' : ''}" data-k="products">📦 سلة المنتجات <span class="n">${pN}</span></button></div>
      ${t.rows.length ? t.rows.map((r) => `<div class="cart-item"><img src="${esc(cartKind === 'games' ? gameCover(r) : productImg(r))}" alt="">
        <div class="grow"><div class="t">${esc(r.title || r.name)}</div><div class="muted" style="font-size:.8rem">${esc(r.platform || (r.condition === 'used' ? 'مستعمل' : 'جديد'))}</div><div class="price">${money(r.price)}</div></div>
        <button class="icon-btn" data-rm="${r.id}" aria-label="حذف">${icon('trash', 'ico-sm')}</button></div>`).join('')
        : `<div class="empty"><div class="big">${cartKind === 'games' ? '🎮' : '📦'}</div>السلة فاضية<br><a class="btn btn-gold btn-sm" style="margin-top:12px" href="${cartKind === 'games' ? '#/games' : '#/products'}">تصفح ${cartKind === 'games' ? 'الألعاب' : 'المنتجات'}</a></div>`}
      ${cartKind === 'games' && d.enabled && d.percent && t.rows.length ? `<div class="hint ${t.pct ? 'ok' : ''}" style="margin-top:6px">${t.pct ? `🎉 تم تفعيل خصم ${t.pct}% على طلبك` : `🔥 أضف ${t.missing} ${t.missing === 1 ? 'لعبة' : 'ألعاب'} وتحصل على خصم ${d.percent}%`}</div>` : ''}
      ${cartKind === 'products' && t.rows.length ? '<div class="muted" style="font-size:.82rem;margin-top:6px">الخصم على المنتجات بكود الخصم فقط.</div>' : ''}
    </div>
    ${t.rows.length ? `<div class="drawer-foot">
      <div class="sum-row"><span>المجموع</span><span>${money(t.subtotal)}</span></div>
      ${t.pct ? `<div class="sum-row disc"><span>الخصم (${t.pct}%)</span><span>-${money(t.discount)}</span></div>` : ''}
      <div class="sum-row total"><span>الإجمالي</span><span class="price">${money(t.total)}</span></div>
      <input class="input" id="c-name" placeholder="اكتب اسمك *" value="${esc(prevName)}" autocomplete="name">
      <input class="input" id="c-coupon" placeholder="كود الخصم (إن وجد)" value="${esc(prevCoupon)}" autocomplete="off" style="text-transform:uppercase">
      <button class="btn btn-green btn-lg btn-block" id="c-send">${icon('wa')} إرسال الطلب عبر واتساب</button>
    </div>` : ''}`;
  $('#c-close').onclick = closeCart;
  dr.querySelector('.seg').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { cartKind = b.dataset.k; renderCart(); } };
  dr.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) removeFromCart(cartKind, b.dataset.rm); };
  const send = $('#c-send');
  if (send) send.onclick = async () => {
    const name = $('#c-name').value.trim();
    if (name.length < 2) { $('#c-name').classList.add('err'); $('#c-name').focus(); toast('اكتب اسمك أولاً', { emoji: '✍️', kind: 'bad' }); return; }
    send.disabled = true;
    const ok = await placeOrder(cartKind, t.rows.map((r) => r.id), name, $('#c-coupon').value);
    send.disabled = false;
    if (ok) { clearCart(cartKind); closeCart(); }
  };
}

function orderMessage(o) {
  const s = state.site;
  const L = [`مرحباً ${s.name} 👑`, `طلب جديد رقم #${o.no}`, `الاسم: ${o.customer_name}`, '', o.kind === 'games' ? '🎮 الألعاب:' : '📦 المنتجات:'];
  o.items.forEach((it, i) => L.push(`${i + 1}. ${it.title}${it.platform ? ` (${it.platform})` : ''} — ${money(it.price)}`));
  L.push('', `المجموع: ${money(o.subtotal)}`);
  if (o.percent > 0) L.push(`الخصم ${o.percent}%${o.coupon ? ` (كود ${o.coupon})` : ''}: -${money(o.discount)}`);
  L.push(`الإجمالي: ${money(o.total)}`, '', 'تم الإرسال من موقع المحل');
  return L.join('\n');
}

async function placeOrder(kind, ids, name, coupon) {
  lsSet('jx_name', name);
  const pre = window.open('', '_blank');
  try {
    const o = await db.rpc('place_order', { p_name: name, p_kind: kind, p_items: ids, p_coupon: (coupon || '').trim() || null });
    openWhatsApp(state.site.whatsapp, orderMessage(o), pre);
    toast('تم تجهيز طلبك ✅', { text: o.coupon ? `تم تطبيق كود الخصم ${o.percent}% 🎉` : 'أكمل الإرسال في واتساب', emoji: '📨', kind: 'ok' });
    refreshNotifications().catch(() => {});
    return true;
  } catch (e) {
    if (pre) pre.close();
    toast('تعذّر إرسال الطلب', { text: e.message, emoji: '⚠️', kind: 'bad' });
    return false;
  }
}

// طلب منتج/لعبة واحدة مباشرة (يسأل عن كود الخصم)
function orderNow(kind, id) {
  const r = kind === 'games' ? gameById(id) : productById(id);
  if (!r) return;
  const title = r.title || r.name;
  modal({
    title: `طلب «${esc(title)}»`,
    body: `<div class="cart-item" style="margin-bottom:14px"><img src="${esc(kind === 'games' ? gameCover(r) : productImg(r))}" alt=""><div class="grow"><div class="t">${esc(title)}</div><div class="price">${money(r.price)}</div></div></div>
      <div class="field"><label>اسمك <span class="req">*</span></label><input class="input" id="o-name" value="${esc(lsGet('jx_name', ''))}" placeholder="اكتب اسمك" autocomplete="name"></div>
      <div class="field"><span class="lbl">هل لديك كود خصم؟</span><div class="radios"><label class="radio"><input type="radio" name="hc" value="0" checked> لا</label><label class="radio"><input type="radio" name="hc" value="1"> نعم</label></div></div>
      <div class="field hidden" id="o-cwrap"><input class="input" id="o-coupon" placeholder="اكتب كود الخصم" style="text-transform:uppercase" autocomplete="off"></div>`,
    actions: [{ label: `${icon('wa')} إرسال عبر واتساب`, cls: 'btn-green', onClick: async () => {
      const name = $('#o-name').value.trim();
      if (name.length < 2) { $('#o-name').classList.add('err'); $('#o-name').focus(); return false; }
      const ok = await placeOrder(kind, [id], name, $('#o-cwrap').classList.contains('hidden') ? '' : $('#o-coupon').value);
      return ok ? true : false;
    } }, { label: 'إلغاء', value: null }],
    onMount({ el }) {
      el.querySelectorAll('input[name=hc]').forEach((x) => x.addEventListener('change', () => {
        const yes = el.querySelector('input[name=hc]:checked').value === '1';
        $('#o-cwrap').classList.toggle('hidden', !yes); if (yes) $('#o-coupon').focus();
      }));
    },
  });
}

// طلب توفير لعبة غير موجودة في الموقع
function requestMissing(term = '') {
  modal({
    title: '🙋 اطلب توفير لعبة',
    body: `<p class="muted" style="margin:0 0 14px">ما لقيت اللعبة اللي تبغاها؟ اكتب اسمها ويوصل طلبك للمحل مباشرة، وكل ما زاد عدد الطلبات وفرناها أسرع. بيوصلك إشعار 🔔 أول ما تتوفر.</p>
      <div class="field"><label for="rq-title">اسم اللعبة <span class="req">*</span></label><input class="input" id="rq-title" value="${esc(term)}" placeholder="مثال: Gran Turismo 7" autocomplete="off"></div>
      <div class="field"><span class="lbl">الجهاز</span><div class="radios">${[['PS4', 'PS4'], ['PS5', 'PS5'], ['PS4/PS5', 'الاثنين']].map(([v, l], i) => `<label class="radio"><input type="radio" name="rq-plat" value="${v}" ${i === 2 ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
      <div id="rq-match"></div>`,
    actions: [{ label: `${icon('bell')} أرسل الطلب`, cls: 'btn-blue', onClick: async ({ el }) => {
      const title = $('#rq-title').value.trim();
      if (title.length < 2) { $('#rq-title').classList.add('err'); $('#rq-title').focus(); return false; }
      const found = findGameByTitle(title);
      if (found) { location.hash = '#/game/' + found.id; toast('اللعبة موجودة في الموقع 🎮', { text: found.title, emoji: '✅', kind: 'ok' }); return true; }
      try {
        const n = await requestCustomGame(title, el.querySelector('input[name=rq-plat]:checked').value);
        toast('تم الطلب — جاري التجهيز ✅', { text: `${n > 1 ? `أنت و${n - 1} غيرك طلبتوا` : 'أنت أول من طلب'} «${title}» — بيوصلك إشعار عند توفرها`, emoji: '🎮', kind: 'ok', timeout: 6000 });
        return true;
      } catch (e) { toast('تعذّر إرسال الطلب', { text: e.message, emoji: '⚠️', kind: 'bad' }); return false; }
    } }, { label: 'إلغاء' }],
    onMount({ el }) {
      const inp = $('#rq-title'); inp.focus();
      const check = () => {
        const g = findGameByTitle(inp.value) || (inp.value.trim().length > 2 ? state.games.find((x) => x.title.toLowerCase().includes(inp.value.trim().toLowerCase())) : null);
        $('#rq-match').innerHTML = g ? `<a class="hint ok" style="display:block" href="#/game/${g.id}">🎮 لقينا «${esc(g.title)}» في الموقع — اضغط لفتحها</a>` : '';
      };
      inp.addEventListener('input', check); check();
      el.addEventListener('click', (e) => { if (e.target.closest('#rq-match a')) el.querySelector('[data-close]')?.click(); });
    },
  });
}

// ================= الأحداث العامة =================
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) {
    if (!e.target.closest('.bell-wrap')) $('#bell-dd')?.classList.remove('open');
    return;
  }
  const { act, id, kind } = b.dataset;
  e.preventDefault();
  try {
    if (act === 'cart-add') {
      if (addToCart(kind, id)) {
        const r = kind === 'games' ? gameById(id) : productById(id);
        const t = cartTotals(kind);
        toast('أُضيفت إلى السلة 🛒', { text: `${r.title || r.name}${kind === 'games' && t.pct ? ` — خصم ${t.pct}% مفعّل 🎉` : kind === 'games' && t.missing ? ` — باقي ${t.missing} للخصم` : ''}`, emoji: '✅', kind: 'ok', timeout: 2800 });
        $('#cart-btn').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 400 });
      } else toast('اللعبة موجودة في السلة مسبقاً', { emoji: '🛒', timeout: 2500 });
    } else if (act === 'cart-open') openCart(kind);
    else if (act === 'order-now') orderNow(kind, id);
    else if (act === 'request-missing') requestMissing(b.dataset.term || '');
    else if (act === 'cat-view') { const c = discoverList[+b.dataset.i]; if (c) catView(c); }
    else if (act === 'open-chat') { $('#nav').classList.remove('open'); openChat(b.dataset.tab); }
    else if (act === 'request-cat') {
      b.disabled = true;
      const n = await requestCustomGame(b.dataset.title, b.dataset.plat, b.dataset.cover || null);
      toast('تم الطلب — جاري التجهيز ✅', { text: `${n > 1 ? `أنت و${n - 1} غيرك طلبتوا` : 'أنت أول من طلب'} «${b.dataset.title}» — بيوصلك إشعار عند توفرها`, emoji: '🎮', kind: 'ok', timeout: 6000 });
    }
    else if (act === 'ask-product') { const p = productById(id); window.open(`https://wa.me/${state.site.whatsapp}?text=${encodeURIComponent('استفسار عن توفر: ' + p.name)}`, '_blank'); }
    else if (act === 'request') {
      b.disabled = true;
      const n = await requestGame(id);
      toast('تم الطلب — جاري التجهيز ✅', { text: `${n > 1 ? `أنت و${n - 1} غيرك طلبتوا` : 'أنت أول من طلب'} «${gameById(id).title}» — بيوصلك إشعار عند توفرها`, emoji: '🎮', kind: 'ok' });
    } else if (act === 'vote') {
      await vote(id, +b.dataset.v);
      const nb = $(`#votes [data-v="${b.dataset.v}"]`); nb?.classList.add('pop');
    }
  } catch (err) {
    b.disabled = false;
    toast('حدث خطأ', { text: err.message, emoji: '⚠️', kind: 'bad' });
  }
});

$('#bell-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleBell(); });
$('#cart-btn').addEventListener('click', () => openCart());
$('#menu-btn').addEventListener('click', () => $('#nav').classList.toggle('open'));
$('#theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  lsSet('jx_theme', next);
  $('meta[name=theme-color]').content = next === 'light' ? '#f2f5fb' : '#060b18';
});

function footerHTML() {
  const s = state.site;
  return `<div class="container"><div class="footer-grid">
    <div><div class="brand" style="margin-bottom:10px"><div class="brand-mark">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : crownSVG()}</div><div class="brand-text" style="display:flex"><span class="brand-name">${esc(s.name)}</span><span class="brand-sub">${esc(s.sub)}</span></div></div>
      <p class="muted" style="margin:0">${esc(s.tagline)} — ${esc(s.tagline_sub)}</p></div>
    <div><h4>روابط سريعة</h4><a href="#/games">الألعاب</a><a href="#/discover">اكتشف ألعاب</a><a href="#/products">المنتجات</a><a href="#/services">خدماتنا</a><a href="#/why">لماذا نحن</a><a href="#/news">جديدنا</a></div>
    <div><h4>تواصل معنا</h4><a href="tel:+${esc(s.whatsapp)}" style="direction:ltr;text-align:right">📞 ${esc(s.phone)}</a><a target="_blank" rel="noopener" href="https://wa.me/${esc(s.whatsapp)}">💬 واتساب</a><a href="#" data-act="open-chat" data-tab="support">🎧 تواصل معنا هنا</a><a href="#/contact">📍 ${esc(s.address_title)}</a></div>
  </div><div class="copy">© ${new Date().getFullYear()} ${esc(s.name)} — جميع الحقوق محفوظة</div></div>`;
}

// ================= الموجّه =================
const routes = [
  [/^\/?$/, pageHome, 'home'], [/^\/games$/, pageGames, 'games'], [/^\/game\/(.+)$/, pageGame, 'games'],
  [/^\/products$/, pageProducts, 'products'], [/^\/product\/(.+)$/, pageProduct, 'products'],
  [/^\/services$/, pageServices, 'services'], [/^\/why$/, pageWhy, 'why'], [/^\/contact$/, pageContact, 'contact'],
  [/^\/news$/, pageNews, 'news'], [/^\/discover$/, pageDiscover, 'discover'], [/^\/cp$/, null, 'cp'],
];
let cleanup = null;
async function route() {
  let raw = decodeURIComponent(location.hash.slice(1) || '/');
  if (!raw.startsWith('/')) raw = '/' + raw; // يدعم الروابط البسيطة مثل #cp
  const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '');
  $('#nav').classList.remove('open');
  $('#bell-dd').classList.remove('open');
  closeCart();
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  let m, page, key;
  for (const [re, fn, k] of routes) { m = path.match(re); if (m) { page = fn; key = k; break; } }
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.k === key));
  setChatVisible(key !== 'cp');
  $('#fab-wa').classList.toggle('hidden', key === 'cp');
  window.scrollTo(0, 0);
  if (key === 'cp') {
    const { renderAdmin } = await import('./admin.js');
    app.innerHTML = '<div class="page" id="cp-root"></div>';
    cleanup = await renderAdmin($('#cp-root'), q);
    return;
  }
  if (!page) { app.innerHTML = `<div class="page container"><div class="empty"><div class="big">🧭</div>الصفحة غير موجودة<br><a class="btn btn-gold" style="margin-top:12px" href="#/">الرئيسية</a></div></div>`; return; }
  const r = page(m.slice(1), q);
  app.innerHTML = `<div class="page">${r.html}</div>`;
  cleanup = r.mount ? r.mount() : null;
}

// ================= التشغيل =================
function welcome() {
  if ((location.hash || '').startsWith('#/cp')) return;
  const s = state.site;
  if (!ssGet('jx_welcomed', false)) {
    ssSet('jx_welcomed', true);
    toast(s.welcome_title, { text: s.welcome_text, emoji: '👑', kind: 'gold', timeout: 6000 });
  }
  setTimeout(() => {
    const d = state.discount;
    if (d.enabled && d.percent) toast(`🔥 خصم ${d.percent}% متوفر الآن`, { text: `عند طلب ${Math.max(2, d.min_count)} ألعاب أو أكثر`, emoji: '🏷️', kind: 'gold', timeout: 6000 });
    else toast('لا يتوفر خصم حالياً', { text: 'تابع الجرس 🔔 وبنعلن لك أول ما ينزل خصم', emoji: '🏷️', timeout: 4500 });
  }, 1300);
}

let knownIds = new Set();
async function poll() {
  try {
    await refreshNotifications();
    const fresh = state.notifications.filter((n) => !knownIds.has(n.id));
    if (fresh.length && knownIds.size) {
      const n = fresh[0];
      toast(n.title, { text: n.body, emoji: n.icon || '🔔' });
      $('#bell-btn').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-18deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(0)' }], { duration: 600 });
    }
    knownIds = new Set(state.notifications.map((n) => n.id));
  } catch { /* تجاهل */ }
}

async function start() {
  if (mode === 'error') {
    app.innerHTML = '<div class="container"><div class="empty"><div class="big">⚠️</div>تعذّر تحميل مكتبة قاعدة البيانات. تأكد من الاتصال بالإنترنت ثم حدّث الصفحة.</div></div>';
    return;
  }
  app.innerHTML = `<div class="hero skel" style="border-radius:0"></div><div class="container section"><div class="grid">${'<div class="skel" style="aspect-ratio:3/4.6"></div>'.repeat(5)}</div></div>`;
  try {
    await loadAll();
  } catch (e) {
    app.innerHTML = `<div class="container"><div class="empty"><div class="big">📡</div>تعذّر الاتصال بالخادم<br><small>${esc(e.message)}</small><br><button class="btn btn-gold" style="margin-top:12px" onclick="location.reload()">إعادة المحاولة</button></div></div>`;
    return;
  }
  knownIds = new Set(state.notifications.map((n) => n.id));
  renderBrand(); renderCounts();
  onChange(() => { renderBrand(); renderCounts(); refreshBits(); renderCart(); if ($('#bell-dd').classList.contains('open')) renderBell(); });
  window.addEventListener('hashchange', route);
  initChat();
  await route();
  welcome();
  setInterval(poll, 60000);
}

export const appApi = { route, renderBrand };
start();
