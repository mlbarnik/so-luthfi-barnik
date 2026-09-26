'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ModeItem, ModeSO } from '@/types/database';

export interface DraftItem {
  client_item_id: string;
  barcode: string;
  nama: string;
  satuan: string;
  lokasi_kode: string;
  qty: number;
  mode: ModeItem;
  so_mode: ModeSO;
  qty_sebelum: number | null;
  di_bawah_min: boolean;
  ts: number;
}

const KEY = 'lb.so.draft.v1';

/**
 * Draft tersimpan di localStorage supaya selamat dari reload halaman /
 * aplikasi tertutup tidak sengaja. CATATAN JUJUR: ini BUKAN IndexedDB.
 * Untuk draft per sesi kerja (puluhan-ratusan item sebelum "Kirim"),
 * localStorage cukup -- batas ~5MB jauh lebih dari cukup. Kalau nanti
 * pola pemakaian berubah (draft dibiarkan menumpuk berhari-hari, atau
 * perlu antrean submit offline yang lebih canggih), pindah ke IndexedDB
 * (lib idb) adalah langkah lanjutan yang jelas -- lihat README.
 */
function bacaSemua(): DraftItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DraftItem[]) : [];
  } catch {
    return [];
  }
}
function tulisSemua(items: DraftItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage penuh/diblokir browser -- draft tetap ada di memori sampai reload
  }
}

const IDEM_KEY = 'lb.so.idem.v1';

/** Idempotency key dibuat sekali per "sesi kirim" dan dipakai ulang kalau
 * submit gagal/diulang (mis. koneksi putus lalu dicoba lagi) -- server
 * RPC submit_so_batch akan mengenali key yang sama dan TIDAK memproses
 * dobel. Key baru dibuat lagi setelah submit sukses atau draft dikosongkan. */
export function ambilIdemKey(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  let k = localStorage.getItem(IDEM_KEY);
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem(IDEM_KEY, k);
  }
  return k;
}
export function resetIdemKey() {
  try { localStorage.removeItem(IDEM_KEY); } catch { /* abaikan */ }
}

export function useDraft() {
  const [items, setItems] = useState<DraftItem[]>([]);

  // localStorage cuma boleh dibaca setelah hydrasi client (SSR tidak
  // punya localStorage) -- effect ini menyinkronkan state React dengan
  // storage browser, bukan menghitung derived state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setItems(bacaSemua());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const simpan = useCallback((item: DraftItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((d) => d.client_item_id === item.client_item_id);
      const next = idx >= 0 ? [...prev.slice(0, idx), item, ...prev.slice(idx + 1)] : [item, ...prev];
      tulisSemua(next);
      return next;
    });
  }, []);

  const hapus = useCallback((clientItemId: string) => {
    setItems((prev) => {
      const next = prev.filter((d) => d.client_item_id !== clientItemId);
      tulisSemua(next);
      return next;
    });
  }, []);

  const kosongkan = useCallback(() => {
    setItems([]);
    tulisSemua([]);
  }, []);

  return { items, simpan, hapus, kosongkan };
}
