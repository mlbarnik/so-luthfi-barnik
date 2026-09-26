-- =========================================================================
-- seed.sql — data contoh untuk pengembangan lokal saja.
-- Dijalankan otomatis oleh `supabase db reset`. JANGAN dijalankan di
-- project produksi (isi barang aslinya lewat proses impor, bukan file ini).
-- =========================================================================

insert into public.locations (kode, tipe, area, lantai, zona, jenis) values
  ('1A-01','rak','toko','Lantai 1','Zona A','Houseware'),
  ('1A-02','rak','toko','Lantai 1','Zona A','Houseware'),
  ('1B-05','rak','toko','Lantai 1','Zona B','Fashion'),
  ('1S-01','showcase','toko','Lantai 1','Kasir','Accessories'),
  ('2C-03','rak','toko','Lantai 2','Zona C','Makanan'),
  ('G3-11','buffer','gudang_lt3','Gudang Lt.3','Buffer','Campuran'),
  ('GU-01','rak','gudang_utama','Gudang Utama','Zona A','Campuran')
on conflict (kode) do nothing;

insert into public.products (barcode, nama, satuan, kategori, harga) values
  ('8992745110234','Baskom Plastik 35cm Lion Star','PCS','Houseware',18500),
  ('8991002101234','Toples Kue 1.5L Tutup Kunci','LUSIN','Houseware',96000),
  ('8996789900987','Sapu Ijuk Gagang Kayu','PCS','Houseware',14000),
  ('8990011223344','Kaos Polos Cotton 30s XL','PCS','Fashion',38000),
  ('8998877665544','Kacang Atom Bawang 250gr','BAL','Makanan',72000)
on conflict (barcode) do nothing;

insert into public.location_thresholds (product_id, location_id, stok_min, stok_maks, sumber)
select p.id, l.id, v.stok_min, v.stok_maks, 'so_harian'
from (values
  ('8992745110234','1A-01',24,120),
  ('8991002101234','1A-02',18,90),
  ('8996789900987','1A-02',10,60),
  ('8990011223344','1B-05',40,200),
  ('8998877665544','2C-03',15,60)
) as v(barcode, kode, stok_min, stok_maks)
join public.products p on p.barcode = v.barcode
join public.locations l on l.kode = v.kode
on conflict (product_id, location_id) do nothing;
