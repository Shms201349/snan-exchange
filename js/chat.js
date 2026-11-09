// الدردشة: تواصل خاص مع المحل + دردشة عامة للزباين
import { db } from './db.js';
import { state, onChange } from './store.js';
import { $, esc, lsGet, lsSet, deviceId, timeAgo, toast } from './util.js';
import { icon } from './icons.js';

let tab = lsGet('jx_chat_tab', 'support');
let timer = null;
let lastSig = '';
const thread = () => lsGet('jx_thread', null);
const myMsgs = () => lsGet('jx_my_msgs', []);
const publicOn = () => state.settings.chat?.public !== false;

export function initChat() {
  const fab = document.createElement('button');
  fab.className = 'fab-chat'; fab.id = 'fab-chat'; fab.setAttribute('aria-label', 'الدردشة');
  fab.innerHTML = icon('chat', 'ico-lg');
  document.body.appendChild(fab);
  fab.onclick = () => ($('#chat-panel') ? closeChat() : openChat());
  checkUnread();
  setInterval(checkUnread, 30000);
  onChange(() => { if ($('#chat-panel') && !publicOn() && tab === 'public') { tab = 'support'; draw(true); } });
}

export function openChat(which) {
  if (which) tab = which;
  if (!publicOn()) tab = 'support';
  closeChat();
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const p = document.createElement('section');
  p.className = 'chat-panel'; p.id = 'chat-panel';
  p.innerHTML = `<div class="chat-head">
      <div class="seg" style="margin:0;flex:1">
        <button data-ct="support">${icon('headset', 'ico-sm')} تواصل مع المحل</button>
        ${publicOn() ? `<button data-ct="public">${icon('users', 'ico-sm')} الدردشة العامة</button>` : ''}
      </div>
      <button class="icon-btn" id="chat-x" aria-label="إغلاق">${icon('x')}</button></div>
    <div class="chat-sub" id="chat-sub"></div>
    <div class="chat-body" id="chat-body"></div>
    <form class="chat-form" id="chat-form" autocomplete="off">
      <input class="input" id="chat-name" placeholder="اكتب اسمك أولاً" maxlength="30" value="${esc(lsGet('jx_name', ''))}">
      <div class="chat-row"><input class="input" id="chat-input" placeholder="اكتب رسالتك…" maxlength="300">
      <button class="btn btn-gold" type="submit" aria-label="إرسال" id="chat-send">${icon('send')}</button></div>
    </form>`;
  document.body.appendChild(p);
  $('#chat-x').onclick = closeChat;
  p.querySelector('.seg').onclick = (e) => { const b = e.target.closest('[data-ct]'); if (b) { tab = b.dataset.ct; lsSet('jx_chat_tab', tab); draw(true); } };
  $('#chat-form').onsubmit = send;
  draw(true);
  timer = setInterval(() => draw(false), 4000);
}

export function setChatVisible(on) {
  const f = $('#fab-chat'); if (f) f.classList.toggle('hidden', !on);
  if (!on) closeChat();
}

export function closeChat() {
  clearInterval(timer); timer = null;
  $('#chat-panel')?.remove();
}

function bubble(m, mine, label) {
  return `<div class="msg ${mine ? 'mine' : ''} ${m.is_admin || m.from_admin ? 'shop' : ''}">
    ${label ? `<div class="msg-name">${esc(label)}</div>` : ''}
    <div class="msg-body">${esc(m.body)}</div><div class="msg-time">${timeAgo(m.created_at)}</div></div>`;
}

async function draw(force) {
  const body = $('#chat-body'); if (!body) return;
  document.querySelectorAll('#chat-panel [data-ct]').forEach((b) => b.classList.toggle('active', b.dataset.ct === tab));
  const nameIn = $('#chat-name');
  if (force) nameIn.classList.toggle('hidden', !!lsGet('jx_name', ''));
  let html = '', sig = '';
  try {
    if (tab === 'support') {
      $('#chat-sub').innerHTML = `💬 محادثة خاصة بينك وبين المحل — نرد عليك هنا. للرد الفوري: <a class="gold" target="_blank" rel="noopener" href="https://wa.me/${esc(state.site.whatsapp)}">واتساب</a>`;
      const t = thread();
      let msgs = [];
      if (t) { const r = await db.rpc('support_fetch', { p_thread: t.id, p_secret: t.secret, p_mark: true }); msgs = r.messages || []; setBadge(0); }
      sig = 'S' + msgs.length + (msgs.at(-1)?.id || '');
      html = bubble({ body: `أهلاً ${lsGet('jx_name', '') || 'بك'} 👋 كيف نقدر نخدمك؟ اسأل عن أي لعبة، جهاز، أو خدمة.`, created_at: new Date().toISOString(), from_admin: true }, false, state.site.name)
        + msgs.map((m) => bubble(m, !m.from_admin, m.from_admin ? state.site.name : '')).join('');
    } else {
      $('#chat-sub').innerHTML = '👥 دردشة عامة لكل زوار الموقع — احترم الجميع. للطلبات استخدم "تواصل مع المحل".';
      const list = (await db.list('chat_messages', { limit: 60 })).reverse();
      const mine = new Set(myMsgs());
      sig = 'P' + list.length + (list.at(-1)?.id || '');
      html = list.length ? list.map((m) => bubble(m, mine.has(m.id), m.is_admin ? `${m.name}` : m.name)).join('') : '<div class="empty">ابدأ أول رسالة 👋</div>';
    }
  } catch (e) {
    html = `<div class="empty">⚠️ ${esc(e.message)}</div>`;
  }
  if (!force && sig === lastSig) return;
  lastSig = sig;
  const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  body.innerHTML = html;
  if (force || atBottom) body.scrollTop = body.scrollHeight;
}

async function send(e) {
  e.preventDefault();
  const nameIn = $('#chat-name'), inp = $('#chat-input'), btn = $('#chat-send');
  const name = (nameIn.value || lsGet('jx_name', '')).trim();
  const text = inp.value.trim();
  if (name.length < 2) { nameIn.classList.remove('hidden'); nameIn.classList.add('err'); nameIn.focus(); return; }
  if (!text) return inp.focus();
  lsSet('jx_name', name);
  btn.disabled = true;
  try {
    if (tab === 'support') {
      const t = thread();
      const r = await db.rpc('support_send', { p_thread: t?.id || null, p_secret: t?.secret || null, p_name: name, p_body: text });
      lsSet('jx_thread', { id: r.thread_id, secret: r.secret });
    } else {
      const m = await db.rpc('chat_post', { p_name: name, p_body: text, p_device: deviceId() });
      lsSet('jx_my_msgs', [...myMsgs().slice(-200), m.id]);
    }
    inp.value = '';
    nameIn.classList.add('hidden');
    await draw(true);
  } catch (x) {
    toast('ما انرسلت الرسالة', { text: x.message, emoji: '⚠️', kind: 'bad' });
  } finally { btn.disabled = false; inp.focus(); }
}

function setBadge(n) {
  const fab = $('#fab-chat'); if (!fab) return;
  fab.querySelector('.count-badge')?.remove();
  if (n > 0) fab.insertAdjacentHTML('beforeend', `<span class="count-badge">${n}</span>`);
}

async function checkUnread() {
  const t = thread();
  if (!t || $('#chat-panel')) return;
  try {
    const r = await db.rpc('support_fetch', { p_thread: t.id, p_secret: t.secret, p_mark: false });
    if (r.unread > 0 && r.unread !== lsGet('jx_unread_seen', 0)) toast('رد جديد من المحل 💬', { text: 'افتح الدردشة لقراءته', emoji: '🎧' });
    lsSet('jx_unread_seen', r.unread);
    setBadge(r.unread);
  } catch { /* تجاهل */ }
}
