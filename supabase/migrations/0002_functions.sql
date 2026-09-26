-- =========================================================================
-- 0002_functions.sql
-- Logika bisnis inti yang HARUS atomik: submit draft, penomoran kode.
-- =========================================================================

-- Penomoran kode harian yang aman dari race condition (dua submit
-- bersamaan tidak akan dapat nomor yang sama).
create or replace function public.next_kode(prefix text, pakai_tanggal boolean)
returns text
language plpgsql
as $$
declare
  hari  text := to_char(now(), 'YYMMDD');
  ckey  text := prefix || case when pakai_tanggal then '_' || hari else '' end;
  n     int;
begin
  insert into public.counters(id, value) values (ckey, 1)
    on conflict (id) do update set value = public.counters.value + 1
    returning value into n;
  if pakai_tanggal then
    return prefix || '-' || hari || '-' || lpad(n::text, 3, '0');
  else
    return prefix || '-' || lpad(n::text, 4, '0');
  end if;
end;
$$;

-- -------------------------------------------------------------------------
-- submit_so_batch
--
-- Satu panggilan = satu transaksi atomik untuk seluruh draft:
--   1. Otorisasi peran (pic/ic/admin) dicek DI DALAM fungsi, karena
--      fungsi ini SECURITY DEFINER (jalan sebagai pemilik, melewati RLS)
--      supaya bisa menulis ke stock/so_sessions/so_items/fulfillment_requests
--      sekaligus dalam satu transaksi.
--   2. Idempotency: idempotency_key yang sama -> dikembalikan hasil lama,
--      TIDAK diproses ulang. Aman untuk tombol Kirim yang ditekan
--      berkali-kali akibat koneksi lambat.
--   3. pg_advisory_xact_lock per lokasi (diurutkan dulu) mencegah dua
--      submit bersamaan menimpa lokasi yang sama secara balapan --
--      ini pengganti LockService di Apps Script.
--   4. Barcode & kode lokasi divalidasi ulang di server terhadap master
--      data -- tidak percaya begitu saja data dari klien.
--   5. Kalau qty hasil akhir <= stok_min lokasi tsb, otomatis membuat
--      fulfillment_requests (untuk notifikasi Discord, dikirim oleh
--      Route Handler pemanggil, BUKAN dari dalam SQL).
--
-- p_items: jsonb array, tiap elemen:
--   { "client_item_id": "...", "barcode": "...", "lokasi_kode": "...",
--     "qty": 12, "mode": "BARU" | "ADD" | "OVERWRITE" }
-- -------------------------------------------------------------------------
create or replace function public.submit_so_batch(
  p_idempotency_key text,
  p_mode            text,
  p_items           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role         text;
  v_session_id   uuid;
  v_kode         text;
  v_existing     record;
  v_item         jsonb;
  v_product      record;
  v_location     record;
  v_threshold    record;
  v_qty_sebelum  int;
  v_qty_baru     int;
  v_item_count   int := 0;
  v_total_qty    int := 0;
  v_req_kode     text;
  v_req_id       uuid;
  v_new_requests jsonb := '[]'::jsonb;
  v_loc_ids      uuid[];
  v_loc_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select role into v_role from public.profiles
    where id = auth.uid() and aktif = true;
  if v_role is null or v_role not in ('pic','ic','admin') then
    raise exception 'FORBIDDEN: peran % tidak boleh submit SO', v_role using errcode = '42501';
  end if;

  if p_mode not in ('awal','harian') then
    raise exception 'MODE_INVALID';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'ITEMS_KOSONG';
  end if;

  -- idempoten: submit ulang dengan key yang sama -> kembalikan hasil lama
  select * into v_existing from public.so_sessions where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'session_id', v_existing.id,
      'kode', v_existing.kode,
      'item_count', v_existing.item_count,
      'total_qty', v_existing.total_qty,
      'new_requests', '[]'::jsonb,
      'diulang', true
    );
  end if;

  -- kunci semua lokasi yang terlibat, urut dulu supaya tidak deadlock
  -- dengan submit lain yang menyentuh lokasi-lokasi yang sama
  select array_agg(distinct l.id order by l.id) into v_loc_ids
    from jsonb_array_elements(p_items) it
    join public.locations l on l.kode = (it->>'lokasi_kode');
  if v_loc_ids is null then
    raise exception 'LOKASI_TIDAK_DITEMUKAN';
  end if;
  foreach v_loc_id in array v_loc_ids loop
    perform pg_advisory_xact_lock(hashtext(v_loc_id::text));
  end loop;

  v_kode := public.next_kode('SO', true);
  insert into public.so_sessions (kode, idempotency_key, pic_id, mode)
    values (v_kode, p_idempotency_key, auth.uid(), p_mode)
    returning id into v_session_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where barcode = (v_item->>'barcode') and aktif = true;
    if not found then
      raise exception 'BARANG_TIDAK_DITEMUKAN: %', (v_item->>'barcode');
    end if;

    select * into v_location from public.locations
      where kode = (v_item->>'lokasi_kode') and aktif = true;
    if not found then
      raise exception 'LOKASI_TIDAK_DITEMUKAN: %', (v_item->>'lokasi_kode');
    end if;

    select qty into v_qty_sebelum from public.stock
      where product_id = v_product.id and location_id = v_location.id;
    v_qty_sebelum := coalesce(v_qty_sebelum, 0);

    if (v_item->>'mode') = 'ADD' then
      v_qty_baru := v_qty_sebelum + (v_item->>'qty')::int;
    else
      v_qty_baru := (v_item->>'qty')::int;
    end if;

    insert into public.stock (product_id, location_id, qty, updated_by, updated_at)
      values (v_product.id, v_location.id, v_qty_baru, auth.uid(), now())
      on conflict (product_id, location_id)
      do update set qty = excluded.qty, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

    insert into public.so_items (session_id, product_id, location_id, qty, qty_sebelum,
                                  selisih, mode, client_item_id)
      values (v_session_id, v_product.id, v_location.id, v_qty_baru, v_qty_sebelum,
              v_qty_baru - v_qty_sebelum, (v_item->>'mode'), (v_item->>'client_item_id'));

    v_item_count := v_item_count + 1;
    v_total_qty  := v_total_qty + v_qty_baru;

    -- lokasi buffer gudang tidak memicu permintaan display
    if v_location.tipe <> 'buffer' then
      select * into v_threshold from public.location_thresholds
        where product_id = v_product.id and location_id = v_location.id;
      if found and v_qty_baru <= v_threshold.stok_min then
        v_req_kode := public.next_kode('REQ', false);
        insert into public.fulfillment_requests
            (kode, product_id, location_id, sisa, stok_min, target_isi, status, so_session_id)
          values (v_req_kode, v_product.id, v_location.id, v_qty_baru,
                  v_threshold.stok_min, greatest(v_threshold.stok_maks, v_qty_baru),
                  'baru', v_session_id)
          returning id into v_req_id;
        v_new_requests := v_new_requests || jsonb_build_object(
          'id', v_req_id, 'kode', v_req_kode,
          'barcode', v_product.barcode, 'nama', v_product.nama, 'satuan', v_product.satuan,
          'lokasi_kode', v_location.kode, 'sisa', v_qty_baru, 'stok_min', v_threshold.stok_min
        );
      end if;
    end if;
  end loop;

  update public.so_sessions
    set item_count = v_item_count, total_qty = v_total_qty
    where id = v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'kode', v_kode,
    'item_count', v_item_count,
    'total_qty', v_total_qty,
    'new_requests', v_new_requests,
    'diulang', false
  );
end;
$$;

revoke all on function public.submit_so_batch(text, text, jsonb) from public;
grant execute on function public.submit_so_batch(text, text, jsonb) to authenticated;
