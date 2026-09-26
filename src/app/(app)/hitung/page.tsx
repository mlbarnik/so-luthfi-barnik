'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Camera, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Scanner } from '@/components/so/scanner';
import { SearchSheet } from '@/components/so/search-sheet';
import { useDraft, type DraftItem } from '@/lib/so/draft-store';
import type { Product, Location, ModeItem, ModeSO } from '@/types/database';

interface Isi { ada: boolean; qty: number; stok_min: number | null; stok_maks: number | null }

export default function HalamanHitung() {
  const { simpan } = useDraft();

  const [soMode, setSoMode] = useState<ModeSO>('awal');
  const [produk, setProduk] = useState<Product | null>(null);
  const [lokasi, setLokasi] = useState<Location | null>(null);
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<ModeItem>('BARU');
  const [isi, setIsi] = useState<Isi | null>(null);
  const [memuat, setMemuat] = useState(false);

  const [scannerUntuk, setScannerUntuk] = useState<'produk' | 'lokasi' | null>(null);
  const [cariUntuk, setCariUntuk] = useState<'produk' | 'lokasi' | null>(null);

  async function cekIsi(p: Product, l: Location, modeSO: ModeSO) {
    setMemuat(true);
    try {
      const res = await fetch(`/api/cek-isi?barcode=${encodeURIComponent(p.barcode)}&lokasi=${encodeURIComponent(l.kode)}`);
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error ?? 'Gagal memeriksa isi lokasi.');
        setIsi(null);
        setMode('BARU');
        return;
      }
      setIsi(json);
      if (modeSO === 'harian') {
        setMode('OVERWRITE');
        if (json.ada) setQty(json.qty);
      } else {
        setMode(json.ada ? 'ADD' : 'BARU');
      }
    } catch {
      toast.error('Tidak ada koneksi. Cek lagi saat kirim draft.');
      setIsi(null);
    } finally {
      setMemuat(false);
    }
  }

  function pilihProduk(p: Product) {
    setProduk(p);
    setIsi(null);
    setMode('BARU');
    if (lokasi) cekIsi(p, lokasi, soMode);
    else toast.success('Barang ditemukan. Lanjut scan lokasinya.');
  }
  function pilihLokasi(l: Location) {
    setLokasi(l);
    if (produk) cekIsi(produk, l, soMode);
  }
  function gantiSoMode(m: ModeSO) {
    setSoMode(m);
    if (produk && lokasi) cekIsi(produk, lokasi, m);
  }

  function resetSemua() {
    setProduk(null); setLokasi(null); setQty(1); setMode('BARU'); setIsi(null);
  }

  function tambahKeDraft() {
    if (!produk || !lokasi) return;
    const item: DraftItem = {
      client_item_id: crypto.randomUUID(),
      barcode: produk.barcode, nama: produk.nama, satuan: produk.satuan,
      lokasi_kode: lokasi.kode, qty, mode, so_mode: soMode,
      qty_sebelum: isi?.ada ? isi.qty : null,
      di_bawah_min: lokasi.tipe !== 'buffer' && isi?.stok_min != null && qty <= isi.stok_min,
      ts: Date.now(),
    };
    simpan(item);
    toast.success(`${produk.nama} · ${qty} ${produk.satuan} @ ${lokasi.kode}`, { description: 'Masuk draft' });
    const lokasiTerakhir = lokasi;
    resetSemua();
    setLokasi(lokasiTerakhir); // satu lokasi biasanya diisi banyak barang berturut-turut
    setScannerUntuk('produk');
  }

  const langkah2Aktif = !!produk;
  const langkah3Aktif = !!lokasi;

  return (
    <div>
      <h2 className="text-lg font-semibold">Hitung barang</h2>
      <p className="mb-4 text-sm text-neutral-500">Scan barang, scan lokasinya, isi jumlah. Masuk draft dulu, belum terkirim.</p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900">
        {(['awal', 'harian'] as ModeSO[]).map((m) => (
          <button
            key={m}
            onClick={() => gantiSoMode(m)}
            className={`rounded-md py-2 text-[13px] font-semibold ${
              soMode === m ? 'bg-white shadow-sm dark:bg-neutral-800' : 'text-neutral-500'
            }`}
          >
            {m === 'awal' ? 'Pendataan awal' : 'SO harian'}
            <span className="block text-[10.5px] font-normal text-neutral-400">
              {m === 'awal' ? 'barang apa saja yang ada' : 'hitung ulang + selisih'}
            </span>
          </button>
        ))}
      </div>

      {/* Langkah 1: barang */}
      <Card className="mb-3">
        <div className="mb-3 flex items-center gap-2">
          <StepNumber n={1} selesai={!!produk} />
          <span className="flex-1 text-[13.5px] font-semibold">Barang</span>
          {produk && <button className="text-xs font-semibold text-blue-600 underline" onClick={resetSemua}>Ganti</button>}
        </div>
        {produk ? (
          <div>
            <div className="text-[15.5px] font-semibold leading-tight">{produk.nama}</div>
            <div className="font-mono text-xs text-neutral-500">{produk.barcode}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{produk.satuan}</Badge>
              {produk.kategori && <Badge>{produk.kategori}</Badge>}
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setScannerUntuk('produk')}><Camera className="h-4 w-4" />Scan barcode</Button>
            <Button variant="outline" onClick={() => setCariUntuk('produk')}><Search className="h-4 w-4" />Cari</Button>
          </div>
        )}
      </Card>

      {/* Langkah 2: lokasi */}
      <Card className={`mb-3 ${!langkah2Aktif ? 'opacity-50' : ''}`}>
        <div className="mb-3 flex items-center gap-2">
          <StepNumber n={2} selesai={!!lokasi} />
          <span className="flex-1 text-[13.5px] font-semibold">Lokasi</span>
          {lokasi && <button className="text-xs font-semibold text-blue-600 underline" onClick={() => { setLokasi(null); setIsi(null); }}>Ganti</button>}
        </div>
        {lokasi ? (
          <div>
            <div className="font-mono text-lg font-semibold">{lokasi.kode}</div>
            <div className="text-xs text-neutral-500">{lokasi.tipe} · {lokasi.lantai ?? '-'} · {lokasi.zona ?? '-'} · {lokasi.jenis ?? '-'}</div>
            {isi && isi.stok_min != null && (
              <Gauge qty={isi.qty} min={isi.stok_min} maks={isi.stok_maks ?? isi.stok_min} />
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!langkah2Aktif} onClick={() => setScannerUntuk('lokasi')}><Camera className="h-4 w-4" />Scan lokasi</Button>
            <Button variant="outline" disabled={!langkah2Aktif} onClick={() => setCariUntuk('lokasi')}><Search className="h-4 w-4" />Cari</Button>
          </div>
        )}
      </Card>

      {/* Langkah 3: qty */}
      <Card className={`mb-4 ${!langkah3Aktif ? 'opacity-50' : ''}`}>
        <div className="mb-3 flex items-center gap-2">
          <StepNumber n={3} selesai={false} />
          <span className="flex-1 text-[13.5px] font-semibold">{soMode === 'harian' ? 'Hitung fisik' : 'Jumlah di lokasi'}</span>
          <Badge variant={mode === 'BARU' ? 'baru' : mode === 'ADD' ? 'add' : 'over'}>{mode}</Badge>
        </div>
        <div className="flex gap-2">
          <button disabled={!langkah3Aktif} onClick={() => setQty((q) => Math.max(0, q - 1))}
            className="w-14 rounded-lg border border-neutral-300 text-2xl font-semibold dark:border-neutral-700">−</button>
          <input
            disabled={!langkah3Aktif}
            value={qty}
            onChange={(e) => setQty(Math.max(0, parseInt(e.target.value || '0', 10)))}
            inputMode="numeric"
            className="flex-1 rounded-lg border border-neutral-300 text-center text-4xl font-semibold dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button disabled={!langkah3Aktif} onClick={() => setQty((q) => q + 1)}
            className="w-14 rounded-lg border border-neutral-300 text-2xl font-semibold dark:border-neutral-700">+</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[['Kosong', 0], ['+6', 6], ['+12', 12], ['+24', 24]].map(([label, v]) => (
            <button key={label} disabled={!langkah3Aktif}
              onClick={() => setQty((q) => (label === 'Kosong' ? 0 : q + (v as number)))}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold dark:border-neutral-700">
              {label}
            </button>
          ))}
        </div>

        {soMode === 'harian' && isi?.ada && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="tercatat" value={isi.qty} />
            <MiniStat label="hitung fisik" value={qty} />
            <MiniStat label="selisih" value={qty - isi.qty} tanda />
          </div>
        )}
        {soMode === 'awal' && isi?.ada && (
          <div className="mt-3">
            <p className="rounded-t-lg bg-blue-50 p-3 text-[13px] text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Sudah pernah didata: <b>{isi.qty} {produk?.satuan}</b> di {lokasi?.kode}.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {(['ADD', 'OVERWRITE'] as ModeItem[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg border p-3 text-left text-[13px] ${
                    mode === m ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900' : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                >
                  <b className="block">{m === 'ADD' ? 'Tambahkan' : 'Ganti total'}</b>
                  <span className="text-neutral-500">
                    {m === 'ADD' ? `Jadi ${isi.qty + qty} ${produk?.satuan}` : `Jadi ${qty} ${produk?.satuan}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {langkah3Aktif && lokasi?.tipe !== 'buffer' && isi?.stok_min != null && qty <= isi.stok_min && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">
            {qty === 0 ? 'Lokasi kosong. ' : 'Di bawah stok minimum. '}
            Saat draft dikirim, sistem membuat permintaan pemenuhan dan mengirim notifikasi Discord.
          </p>
        )}
      </Card>

      <Button className="w-full" size="lg" disabled={!lokasi || memuat} onClick={tambahKeDraft}>
        Tambah ke draft
      </Button>

      {scannerUntuk && (
        <Scanner
          judul={scannerUntuk === 'produk' ? 'Scan barcode barang' : 'Scan barcode lokasi'}
          onTutup={() => setScannerUntuk(null)}
          onHasil={async (kode) => {
            setScannerUntuk(null);
            const endpoint = scannerUntuk === 'produk'
              ? `/api/produk?barcode=${encodeURIComponent(kode)}`
              : `/api/lokasi?kode=${encodeURIComponent(kode)}`;
            const res = await fetch(endpoint);
            const json = await res.json();
            if (!json.ok) return toast.error(json.error ?? 'Tidak ditemukan.');
            if (scannerUntuk === 'produk') pilihProduk(json.data); else pilihLokasi(json.data);
          }}
        />
      )}

      <SearchSheet open={cariUntuk === 'produk'} onOpenChange={(v) => !v && setCariUntuk(null)} jenis="produk" onPilih={pilihProduk} />
      <SearchSheet open={cariUntuk === 'lokasi'} onOpenChange={(v) => !v && setCariUntuk(null)} jenis="lokasi" onPilih={pilihLokasi} />
    </div>
  );
}

function StepNumber({ n, selesai }: { n: number; selesai: boolean }) {
  return (
    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${selesai ? 'bg-emerald-600' : 'bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900'}`}>
      {n}
    </span>
  );
}
function Gauge({ qty, min, maks }: { qty: number; min: number; maks: number }) {
  const pct = Math.min(100, Math.round((qty / Math.max(maks, 1)) * 100));
  const minPct = Math.min(100, Math.round((min / Math.max(maks, 1)) * 100));
  const warna = qty <= min ? 'bg-red-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-2 text-xs text-neutral-500">
      Isi sekarang <b>{qty}</b> · minimum {min} · maksimum {maks}
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
        <div className={`h-full ${warna}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-red-600" style={{ left: `${minPct}%` }} />
      </div>
    </div>
  );
}
function MiniStat({ label, value, tanda }: { label: string; value: number; tanda?: boolean }) {
  const warna = tanda ? (value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : '') : '';
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`text-2xl font-semibold leading-none ${warna}`}>{tanda && value > 0 ? '+' : ''}{value}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}
