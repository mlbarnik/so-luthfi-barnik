-- =========================================================================
-- 0003_rls.sql
-- Row Level Security. Prinsip: kunci semuanya dulu (RLS on, tanpa policy
-- = tertutup total), baru dibuka satu-satu sesuai peran yang butuh.
--
-- staff_credentials & login_throttle SENGAJA tidak diberi policy apa pun
-- -> hanya secret key (service role, yang melewati RLS) yang bisa baca/tulis.
-- =========================================================================

alter table public.profiles              enable row level security;
alter table public.staff_credentials      enable row level security;
alter table public.login_throttle         enable row level security;
alter table public.locations              enable row level security;
alter table public.products               enable row level security;
alter table public.location_thresholds    enable row level security;
alter table public.stock                  enable row level security;
alter table public.so_sessions            enable row level security;
alter table public.so_items               enable row level security;
alter table public.fulfillment_requests   enable row level security;
alter table public.sheet_sync_log         enable row level security;
alter table public.counters               enable row level security;

-- helper: peran user yang sedang login (dipakai berulang di bawah)
create or replace function public.peran_saya()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and aktif = true;
$$;

-- ---------------------------------------------------------------- profiles
create policy "profiles_select_semua_staf_login" on public.profiles
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------- locations
create policy "locations_select_semua_staf_login" on public.locations
  for select using (auth.uid() is not null);
create policy "locations_tulis_admin" on public.locations
  for all using (public.peran_saya() = 'admin')
  with check (public.peran_saya() = 'admin');

-- ---------------------------------------------------------------- products
create policy "products_select_semua_staf_login" on public.products
  for select using (auth.uid() is not null);
create policy "products_tulis_admin" on public.products
  for all using (public.peran_saya() = 'admin')
  with check (public.peran_saya() = 'admin');

-- ---------------------------------------------------- location_thresholds
create policy "threshold_select_semua_staf_login" on public.location_thresholds
  for select using (auth.uid() is not null);
create policy "threshold_tulis_admin_ic" on public.location_thresholds
  for all using (public.peran_saya() in ('admin','ic'))
  with check (public.peran_saya() in ('admin','ic'));

-- ---------------------------------------------------------------- stock
-- Hanya baca lewat REST. Semua tulis WAJIB lewat submit_so_batch()
-- (SECURITY DEFINER) -- sengaja tidak ada policy insert/update/delete
-- untuk role authenticated di sini.
create policy "stock_select_semua_staf_login" on public.stock
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------- so_sessions
create policy "so_sessions_select_manajemen" on public.so_sessions
  for select using (public.peran_saya() in ('admin','ic','kepala_toko','spv','owner'));
create policy "so_sessions_select_milik_sendiri" on public.so_sessions
  for select using (pic_id = auth.uid());
-- insert/update HANYA lewat submit_so_batch (SECURITY DEFINER)

-- ---------------------------------------------------------------- so_items
create policy "so_items_select_manajemen" on public.so_items
  for select using (public.peran_saya() in ('admin','ic','kepala_toko','spv','owner'));
create policy "so_items_select_punya_sesi_sendiri" on public.so_items
  for select using (
    exists (select 1 from public.so_sessions s
            where s.id = so_items.session_id and s.pic_id = auth.uid())
  );

-- ---------------------------------------------------------- fulfillment_requests
create policy "fulfillment_select_yang_berhak" on public.fulfillment_requests
  for select using (public.peran_saya() in ('admin','ic','kepala_toko','spv','owner'));
create policy "fulfillment_update_yang_berhak" on public.fulfillment_requests
  for update using (public.peran_saya() in ('admin','ic','kepala_toko'))
  with check (public.peran_saya() in ('admin','ic','kepala_toko'));
-- insert HANYA lewat submit_so_batch

-- ---------------------------------------------------------------- sheet_sync_log
create policy "sheet_sync_log_select_manajemen" on public.sheet_sync_log
  for select using (public.peran_saya() in ('admin','ic','spv','owner'));
-- insert dilakukan route server pakai secret key (lewat RLS)
