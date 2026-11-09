-- =====================================================================
-- قاعدة بيانات موقع جعفر السلمي — شغّل هذا الملف مرة واحدة في
-- Supabase ← SQL Editor ← New query ← الصق ← Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- المدراء ----------
create table if not exists public.admins (email text primary key);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- الجداول ----------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null default 'PS4/PS5',
  status text not null default 'available' check (status in ('available', 'unavailable')),
  language text not null default 'en' check (language in ('ar', 'en')),
  price integer default 1500,
  size text default '',
  description text default '',
  cover text default '',
  screenshots text[] not null default '{}',
  likes integer not null default 0,
  dislikes integer not null default 0,
  requests integer not null default 0,
  created_at timestamptz not null default now()
);

-- روابط المصادر (مخفية — للمدير فقط)
create table if not exists public.game_sources (
  game_id uuid primary key references public.games(id) on delete cascade,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text default 'أخرى',
  condition text not null default 'new' check (condition in ('new', 'used')),
  delivery boolean not null default false,
  warranty text default 'ضمان 3 أشهر ضد أي خلل مصنعي',
  price integer,
  description text default '',
  images text[] not null default '{}',
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  image text default '',
  title text default '',
  subtitle text default '',
  link_type text check (link_type in ('game', 'product')),
  link_id uuid,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text,
  icon text default '🔔',
  title text not null,
  body text default '',
  link text,
  ref text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_ref_idx on public.notifications (ref, created_at desc);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  code text primary key,
  percent integer not null check (percent between 1 and 90),
  active boolean not null default true,
  max_uses integer,
  uses integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity (start with 1001),
  customer_name text not null,
  kind text not null check (kind in ('games', 'products')),
  items jsonb not null default '[]',
  subtotal integer not null default 0,
  percent integer not null default 0,
  discount integer not null default 0,
  total integer not null default 0,
  coupon text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_requests (
  game_id uuid references public.games(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (game_id, device_id)
);

create table if not exists public.game_votes (
  game_id uuid references public.games(id) on delete cascade,
  device_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (game_id, device_id)
);

-- ألعاب يطلبها الزباين وغير موجودة في الموقع
create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  norm text not null unique,
  platform text default 'PS4/PS5',
  count integer not null default 0,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.custom_request_devices (
  req_id uuid references public.custom_requests(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (req_id, device_id)
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  rawg_id integer,
  title text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------- الصلاحيات (RLS) ----------
alter table public.admins enable row level security;
alter table public.games enable row level security;
alter table public.game_sources enable row level security;
alter table public.products enable row level security;
alter table public.banners enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.game_requests enable row level security;
alter table public.game_votes enable row level security;
alter table public.sync_queue enable row level security;
alter table public.custom_requests enable row level security;
alter table public.custom_request_devices enable row level security;

do $$
declare t text;
begin
  -- جداول يقرأها الجميع ويعدلها المدير فقط
  foreach t in array array['games', 'products', 'banners', 'notifications', 'settings'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  -- جداول خاصة بالمدير فقط
  foreach t in array array['game_sources', 'coupons', 'orders', 'game_requests', 'game_votes', 'sync_queue', 'custom_requests', 'custom_request_devices'] loop
    execute format('drop policy if exists "admin only" on public.%I', t);
    execute format('create policy "admin only" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- دوال الزوار (آمنة ومحدودة) ----------

-- إشعار طلب توفير (يُجمّع الطلبات على نفس اللعبة خلال 6 ساعات)
create or replace function public._notify_request(p_game uuid, p_title text, p_count int) returns void
language plpgsql security definer set search_path = public as $$
declare v_body text; v_ref text := 'req:' || p_game::text;
begin
  v_body := case when p_count > 1
    then p_count || ' أشخاص طلبوا توفير لعبة «' || p_title || '» — جاري تجهيزها في المحل'
    else 'لاعب طلب توفير لعبة «' || p_title || '» — جاري تجهيزها في المحل' end;
  update notifications set body = v_body, created_at = now()
   where ref = v_ref and created_at > now() - interval '6 hours';
  if not found then
    insert into notifications (type, icon, title, body, link, ref)
    values ('request', '🙋', 'طلب توفير لعبة', v_body, '#/game/' || p_game::text, v_ref);
  end if;
end $$;
revoke all on function public._notify_request(uuid, text, int) from public, anon, authenticated;

create or replace function public.request_game(p_game uuid, p_device text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n int; v_title text; v_recent int;
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 64 then raise exception 'bad device'; end if;
  select count(*) into v_recent from game_requests where device_id = p_device and created_at > now() - interval '1 hour';
  if v_recent >= 15 then raise exception 'طلبات كثيرة، حاول لاحقاً'; end if;
  if not exists (select 1 from games where id = p_game and status = 'unavailable') then
    select requests into v_n from games where id = p_game; return coalesce(v_n, 0);
  end if;
  insert into game_requests (game_id, device_id) values (p_game, p_device) on conflict do nothing;
  if found then
    update games set requests = requests + 1 where id = p_game returning requests, title into v_n, v_title;
    perform _notify_request(p_game, v_title, v_n);
  else
    select requests into v_n from games where id = p_game;
  end if;
  return v_n;
end $$;

create or replace function public.request_custom_game(p_title text, p_platform text, p_device text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_title text := left(trim(coalesce(p_title, '')), 80); v_norm text; v_id uuid; v_n int; v_recent int; v_body text; v_ref text;
begin
  if length(v_title) < 2 then raise exception 'اكتب اسم اللعبة'; end if;
  if p_device is null or length(p_device) < 8 or length(p_device) > 64 then raise exception 'bad device'; end if;
  select count(*) into v_recent from custom_request_devices where device_id = p_device and created_at > now() - interval '1 hour';
  if v_recent >= 10 then raise exception 'طلبات كثيرة، حاول لاحقاً'; end if;
  v_norm := regexp_replace(lower(v_title), '\s+', ' ', 'g');
  insert into custom_requests (title, norm, platform) values (v_title, v_norm, coalesce(nullif(p_platform, ''), 'PS4/PS5'))
  on conflict (norm) do update set status = 'open', updated_at = now()
  returning id into v_id;
  insert into custom_request_devices (req_id, device_id) values (v_id, p_device) on conflict do nothing;
  if found then
    update custom_requests set count = count + 1 where id = v_id returning count, title into v_n, v_title;
    v_ref := 'creq:' || v_id::text;
    v_body := case when v_n > 1 then v_n || ' أشخاص طلبوا توفير لعبة «' || v_title || '» — جاري تجهيزها في المحل'
      else 'لاعب طلب توفير لعبة «' || v_title || '» — جاري تجهيزها في المحل' end;
    update notifications set body = v_body, created_at = now() where ref = v_ref and created_at > now() - interval '6 hours';
    if not found then
      insert into notifications (type, icon, title, body, link, ref) values ('request', '🙋', 'طلب توفير لعبة', v_body, '#/games', v_ref);
    end if;
  else
    select count into v_n from custom_requests where id = v_id;
  end if;
  return v_n;
end $$;

create or replace function public.vote_game(p_game uuid, p_device text, p_vote int) returns json
language plpgsql security definer set search_path = public as $$
declare v_old int := 0; v_l int; v_d int;
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 64 or p_vote not in (-1, 0, 1) then raise exception 'bad input'; end if;
  select vote into v_old from game_votes where game_id = p_game and device_id = p_device;
  v_old := coalesce(v_old, 0);
  if v_old <> p_vote then
    if p_vote = 0 then delete from game_votes where game_id = p_game and device_id = p_device;
    else insert into game_votes (game_id, device_id, vote) values (p_game, p_device, p_vote)
         on conflict (game_id, device_id) do update set vote = excluded.vote;
    end if;
    update games set
      likes = greatest(0, likes + (case when p_vote = 1 then 1 else 0 end) - (case when v_old = 1 then 1 else 0 end)),
      dislikes = greatest(0, dislikes + (case when p_vote = -1 then 1 else 0 end) - (case when v_old = -1 then 1 else 0 end))
    where id = p_game;
  end if;
  select likes, dislikes into v_l, v_d from games where id = p_game;
  return json_build_object('likes', v_l, 'dislikes', v_d);
end $$;

-- التحقق من كود الخصم (يرجع النسبة أو 0 — بدون كشف الأكواد)
create or replace function public.check_coupon(p_code text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select percent from coupons
    where upper(code) = upper(trim(coalesce(p_code, ''))) and active
      and (expires_at is null or expires_at > now())
      and (max_uses is null or uses < max_uses)), 0);
$$;

-- إنشاء الطلب وحساب الخصم في الخادم
create or replace function public.place_order(p_name text, p_kind text, p_items uuid[], p_coupon text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb; v_sub int := 0; v_cnt int := 0; v_auto int := 0; v_cp int := 0; v_pct int; v_disc int;
  v_set jsonb; v_code text; v_row orders;
begin
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'الاسم مطلوب'; end if;
  if p_kind not in ('games', 'products') or p_items is null or array_length(p_items, 1) is null or array_length(p_items, 1) > 50 then raise exception 'طلب غير صالح'; end if;
  if (select count(*) from orders where created_at > now() - interval '10 minutes') > 60 then raise exception 'ضغط كبير، حاول بعد قليل'; end if;

  if p_kind = 'games' then
    select coalesce(sum(price), 0), count(*), coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'price', price, 'platform', platform)), '[]')
      into v_sub, v_cnt, v_items from games where id = any(p_items) and status = 'available';
    select value into v_set from settings where key = 'discount';
    if coalesce((v_set ->> 'enabled')::boolean, false)
       and v_cnt >= greatest(2, coalesce((v_set ->> 'min_count')::int, 3)) then
      v_auto := coalesce((v_set ->> 'percent')::int, 0);
    end if;
  else
    select coalesce(sum(coalesce(price, 0)), 0), count(*), coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', name, 'price', price)), '[]')
      into v_sub, v_cnt, v_items from products where id = any(p_items);
  end if;
  if v_cnt = 0 then raise exception 'العناصر غير متوفرة'; end if;

  if p_coupon is not null and length(trim(p_coupon)) > 0 then v_cp := check_coupon(p_coupon); end if;
  v_pct := greatest(v_auto, v_cp);
  v_disc := round(v_sub * v_pct / 100.0);
  if v_cp > 0 and v_cp >= v_auto then
    v_code := upper(trim(p_coupon));
    update coupons set uses = uses + 1 where upper(code) = v_code;
  end if;

  insert into orders (customer_name, kind, items, subtotal, percent, discount, total, coupon)
  values (left(trim(p_name), 80), p_kind, v_items, v_sub, v_pct, v_disc, v_sub - v_disc, v_code)
  returning * into v_row;

  if v_pct >= 30 then
    insert into notifications (type, icon, title, body) values ('discount_win', '💰', 'خصم كبير!', 'زبون حصل على خصم ' || v_pct || '% على طلبه 🎉');
  end if;
  return row_to_json(v_row);
end $$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.request_game(uuid, text) to anon, authenticated;
grant execute on function public.vote_game(uuid, text, int) to anon, authenticated;
grant execute on function public.request_custom_game(text, text, text) to anon, authenticated;
grant execute on function public.check_coupon(text) to anon, authenticated;
grant execute on function public.place_order(text, text, uuid[], text) to anon, authenticated;

-- ---------- تخزين الصور ----------
insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict (id) do nothing;
drop policy if exists "admin upload images" on storage.objects;
create policy "admin upload images" on storage.objects for insert to authenticated with check (bucket_id = 'images' and public.is_admin());
drop policy if exists "admin update images" on storage.objects;
create policy "admin update images" on storage.objects for update to authenticated using (bucket_id = 'images' and public.is_admin());
drop policy if exists "admin delete images" on storage.objects;
create policy "admin delete images" on storage.objects for delete to authenticated using (bucket_id = 'images' and public.is_admin());

-- ---------- إعدادات افتراضية ----------
insert into public.settings (key, value) values
  ('discount', '{"enabled": true, "percent": 20, "min_count": 3}')
on conflict (key) do nothing;

-- ---------- المدير ----------
-- غيّر البريد إذا غيرته في js/config.js (ADMIN_EMAIL)
insert into public.admins (email) values ('admin@jaafar.shop') on conflict do nothing;
