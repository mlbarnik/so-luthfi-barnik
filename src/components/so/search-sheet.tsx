'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import type { Product, Location } from '@/types/database';

type Hasil = Product | Location;
function isProduk(h: Hasil): h is Product {
  return (h as Product).barcode !== undefined;
}

export function SearchSheet<T extends Hasil>({
  open, onOpenChange, jenis, onPilih,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jenis: 'produk' | 'lokasi';
  onPilih: (item: T) => void;
}) {
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Hasil[]>([]);
  const [cari, setCari] = useState(false);

  // Kedua effect di bawah ini menyinkronkan state dengan sistem eksternal
  // (reset saat sheet ditutup, dan memanggil server saat query berubah) --
  // pemakaian effect yang memang dianjurkan React, jadi aturan lint
  // "set-state-in-effect" (dibuat untuk menangkap derived-state yang
  // seharusnya dihitung langsung saat render) sengaja dimatikan di sini.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) { setQ(''); setHasil([]); }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHasil([]);
      return;
    }
    setCari(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/${jenis}?search=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setHasil(json.ok ? json.data : []);
      setCari(false);
    }, 280); // debounce -- baru minta ke server 280ms setelah berhenti mengetik
    return () => clearTimeout(t);
  }, [q, jenis]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={jenis === 'produk' ? 'Cari barang' : 'Cari lokasi'}>
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={jenis === 'produk' ? 'Nama atau barcode…' : 'Kode, zona, jenis…'}
      />
      <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
        {q.trim().length < 2 && <p className="py-6 text-center text-sm text-neutral-400">Ketik minimal 2 huruf.</p>}
        {cari && <p className="py-6 text-center text-sm text-neutral-400">Mencari…</p>}
        {!cari && q.trim().length >= 2 && hasil.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-400">Tidak ada yang cocok.</p>
        )}
        {hasil.map((h) => (
          <button
            key={isProduk(h) ? h.barcode : h.kode}
            onClick={() => { onPilih(h as T); onOpenChange(false); }}
            className="flex w-full flex-col items-start py-3 text-left"
          >
            <span className="font-semibold">{isProduk(h) ? h.nama : h.kode}</span>
            <span className="font-mono text-xs text-neutral-500">
              {isProduk(h) ? `${h.barcode} · ${h.satuan}` : `${h.tipe} · ${h.lantai ?? '-'} · ${h.jenis ?? '-'}`}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
