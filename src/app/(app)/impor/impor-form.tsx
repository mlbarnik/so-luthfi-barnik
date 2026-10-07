'use client';

import { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface HasilBaris { baris: number; ok: boolean; pesan?: string }
interface Ringkasan { total: number; sukses: number; gagal: number; detail: HasilBaris[] }

const KONFIG = {
  produk: {
    judul: 'Impor Master Barang',
    endpoint: '/api/admin/impor-produk',
    kolom: 'barcode, nama, satuan, kategori, harga',
    wajib: 'barcode dan nama wajib diisi. satuan default "PCS" kalau kosong.',
    kunci: 'barcode',
  },
  lokasi: {
    judul: 'Impor Master Lokasi / Rak',
    endpoint: '/api/admin/impor-lokasi',
    kolom: 'kode, tipe, area, lantai, zona, jenis',
    wajib: 'kode wajib. tipe harus salah satu: rak, palet, showcase, floor, freezer, buffer. area harus salah satu: toko, gudang_lt3, gudang_utama.',
    kunci: 'kode',
  },
} as const;

export function ImporForm({ jenis }: { jenis: 'produk' | 'lokasi' }) {
  const cfg = KONFIG[jenis];
  const inputRef = useRef<HTMLInputElement>(null);
  const [namaFile, setNamaFile] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState<Ringkasan | null>(null);
  const [error, setError] = useState('');

  async function kirim() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setMengirim(true);
    setError('');
    setHasil(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(cfg.endpoint, { method: 'POST', body: form });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Impor gagal.');
        return;
      }
      setHasil(json.ringkasan);
    } catch {
      setError('Tidak ada koneksi ke server. Coba lagi.');
    } finally {
      setMengirim(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-[15px] font-semibold">{cfg.judul}</h3>
      <p className="mb-1 text-[13px] text-neutral-500">
        Kolom (baris 1 = header): <code className="font-mono">{cfg.kolom}</code>
      </p>
      <p className="mb-3 text-[12.5px] text-neutral-400">{cfg.wajib} Upsert berdasarkan <code className="font-mono">{cfg.kunci}</code> — data lama dengan {cfg.kunci} yang sama akan ditimpa.</p>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-3 text-sm dark:border-neutral-700">
        <UploadCloud className="h-5 w-5 shrink-0 text-neutral-400" />
        <span className="min-w-0 flex-1 truncate text-neutral-600 dark:text-neutral-300">
          {namaFile || 'Pilih file .xlsx…'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => setNamaFile(e.target.files?.[0]?.name ?? '')}
        />
      </label>

      <Button className="mt-3 w-full" disabled={!namaFile || mengirim} onClick={kirim}>
        {mengirim ? 'Mengimpor… (bisa beberapa menit untuk file besar)' : `Impor ${jenis === 'produk' ? 'Barang' : 'Lokasi'}`}
      </Button>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}

      {hasil && (
        <div className="mt-3">
          <div className="flex gap-4 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
            <span>Total baris: <b>{hasil.total}</b></span>
            <span className="text-emerald-600">Berhasil: <b>{hasil.sukses}</b></span>
            <span className="text-red-600">Gagal: <b>{hasil.gagal}</b></span>
          </div>
          {hasil.detail.length > 0 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              {hasil.detail.map((d, i) => (
                <div key={i} className="flex items-start gap-2 border-b border-neutral-100 px-3 py-2 text-[12.5px] last:border-0 dark:border-neutral-800">
                  {d.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />}
                  <span>{d.baris > 0 ? `Baris ${d.baris}: ` : ''}{d.pesan}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}