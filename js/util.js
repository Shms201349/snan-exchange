import { icon } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf = new Intl.NumberFormat('en-US');
export const num = (n) => nf.format(Math.round(Number(n) || 0));
export const money = (n) => (n === null || n === undefined || n === '' ? 'السعر عند التواصل' : `${num(n)} ريال`);

// تخزين آمن في المتصفح
export function lsGet(k, def) {
  try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; }
}
export function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}
export function ssGet(k, def) {
  try { const v = sessionStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; }
}
export function ssSet(k, v) {
  try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ }
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// معرف الجهاز (يمنع تكرار الطلب أو الإعجاب من نفس الجهاز)
export function deviceId() {
  let id = lsGet('jx_device', null);
  if (!id) { id = uid(); lsSet('jx_device', id); }
  return id;
}

export function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'الآن';
  const m = Math.floor(d / 60);
  if (m < 60) return m === 1 ? 'منذ دقيقة' : m === 2 ? 'منذ دقيقتين' : m <= 10 ? `منذ ${m} دقائق` : `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? 'منذ ساعة' : h === 2 ? 'منذ ساعتين' : h <= 10 ? `منذ ${h} ساعات` : `منذ ${h} ساعة`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return dd === 1 ? 'أمس' : dd === 2 ? 'منذ يومين' : dd <= 10 ? `منذ ${dd} أيام` : `منذ ${dd} يوماً`;
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn');
}

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const xmlEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function wrap(title, max) {
  const words = String(title).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

// صورة فنية مولدة تُستخدم عند عدم وجود صورة
export function artImage(title, { w = 600, h = 800, sub = '' } = {}) {
  const k = hash(title);
  const h1 = k % 360, h2 = (h1 + 40 + (k % 80)) % 360;
  const landscape = w > h;
  const lines = landscape ? [] : wrap(title, 13);
  const fs = landscape ? Math.round(h / 9) : Math.round(w / 9.5);
  const startY = h * (landscape ? 0.5 : 0.62) - ((lines.length - 1) * fs * 1.15) / 2;
  const text = lines.map((l, i) => `<text x="50%" y="${startY + i * fs * 1.15}" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-weight="900" font-size="${fs}" fill="#fff">${xmlEsc(l)}</text>`).join('');
  const s = Math.min(w, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},72%,42%)"/><stop offset="1" stop-color="hsl(${h2},78%,10%)"/></linearGradient>
<radialGradient id="r" cx="80%" cy="15%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/>
<g fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="${s * 0.02}">
<path d="M${w * 0.18} ${h * 0.1} l${s * 0.14} ${s * 0.24} h${-s * 0.28}z"/><circle cx="${w * 0.82}" cy="${h * 0.24}" r="${s * 0.12}"/>
<path d="M${w * 0.1} ${h * 0.82} l${s * 0.18} ${s * 0.18} M${w * 0.1 + s * 0.18} ${h * 0.82} l${-s * 0.18} ${s * 0.18}"/>
<rect x="${w * 0.74}" y="${h * 0.78}" width="${s * 0.16}" height="${s * 0.16}"/></g>
${text}
${sub ? `<text x="50%" y="${h * 0.93}" text-anchor="middle" font-family="Cairo, Arial" font-weight="700" font-size="${fs * 0.42}" fill="#fff" fill-opacity=".8">${xmlEsc(sub)}</text>` : ''}
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ====== التنبيهات المنبثقة ======
export function toast(title, { text = '', emoji = '🔔', kind = '', timeout = 4500 } = {}) {
  const root = $('#toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="ti">${emoji}</div><div style="flex:1;min-width:0"><div class="tt">${esc(title)}</div>${text ? `<div class="ts">${esc(text)}</div>` : ''}</div>
  <button class="icon-btn" style="width:30px;height:30px;border-radius:9px" aria-label="إغلاق">${icon('x', 'ico-sm')}</button>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.querySelector('button').onclick = close;
  root.appendChild(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  if (timeout) setTimeout(close, timeout);
}

// ====== النوافذ ======
export function modal({ title, body = '', actions = [], wide = false, sheet = true, onMount, dismissable = true }) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = `overlay ${sheet ? 'sheet' : ''}`;
    ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${title}</h3>${dismissable ? `<button class="icon-btn" data-close aria-label="إغلاق">${icon('x')}</button>` : ''}</div>
      <div class="modal-body">${body}</div>
      ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.cls || 'btn-ghost'}" data-i="${i}">${a.label}</button>`).join('')}</div>` : ''}
    </div>`;
    document.body.appendChild(ov);
    document.body.classList.add('no-scroll');
    let done = false;
    const close = (v) => {
      if (done) return;
      done = true;
      ov.remove();
      if (!document.querySelector('.overlay, .drawer')) document.body.classList.remove('no-scroll');
      resolve(v);
    };
    const api = { el: ov, close };
    ov.addEventListener('click', async (e) => {
      if (dismissable && (e.target === ov || e.target.closest('[data-close]'))) return close(null);
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const a = actions[+b.dataset.i];
      if (a.onClick) {
        b.disabled = true;
        try {
          const r = await a.onClick(api);
          if (r !== false) close(r === undefined ? a.value : r);
        } finally { b.disabled = false; }
      } else close(a.value);
    });
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) { close(null); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    onMount && onMount(api);
  });
}

export const confirmBox = (title, text, yes = 'نعم', no = 'لا', yesCls = 'btn-gold') =>
  modal({ title, body: `<p style="margin:0">${text}</p>`, actions: [{ label: yes, value: true, cls: yesCls }, { label: no, value: false }], sheet: false });

// ====== ضغط الصور قبل الرفع ======
export async function compressImage(file, { max = 1600, quality = 0.84 } = {}) {
  if (!file) throw new Error('لم يتم اختيار صورة');
  if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name)) {
    throw new Error('الملف ليس صورة');
  }
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    bmp = await new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(/hei[cf]/i.test(file.name + file.type) ? 'صيغة HEIC غير مدعومة في هذا المتصفح — من إعدادات الكاميرا اختر "الأكثر توافقاً" أو أرسل الصورة لنفسك بالواتساب ثم ارفعها' : 'تعذّر قراءة الصورة، جرّب صورة أخرى')); };
      img.src = url;
    });
  }
  const w0 = bmp.width, h0 = bmp.height;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const toBlob = (type) => new Promise((r) => c.toBlob(r, type, quality));
  let blob = await toBlob('image/webp');
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await toBlob('image/jpeg'); ext = 'jpg'; }
  if (!blob) throw new Error('تعذّر تجهيز الصورة');
  return { blob, ext, w, h };
}

export const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error('تعذّر قراءة الصورة'));
  r.readAsDataURL(blob);
});

export function withTimeout(p, ms, msg) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

// فتح واتساب بطريقة لا يمنعها المتصفح
export function openWhatsApp(phone, text, preWin) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  if (preWin && !preWin.closed) { preWin.location.href = url; return; }
  const w = window.open(url, '_blank');
  if (!w) location.href = url;
}
