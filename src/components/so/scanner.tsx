'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Pemindai barcode kamera.
 *
 * CATATAN JUJUR (tolong dites di perangkat asli sebelum dipakai di
 * lapangan): pakai BarcodeDetector API bawaan browser kalau tersedia --
 * ini cepat dan tanpa dependency tambahan, TAPI baru didukung luas di
 * Chrome/Edge Android & desktop. Safari iOS pada umumnya BELUM mendukungnya
 * (per pengecekan terakhir). Untuk PIC yang pakai iPhone, kamu perlu
 * pustaka cadangan (mis. zxing-wasm atau @undecaf/barcode-detector-polyfill)
 * -- sengaja belum saya pasang di sini supaya kamu bisa pilih sendiri
 * setelah tahu device apa saja yang benar-benar dipakai di toko/gudang
 * (lihat pertanyaan soal ini di README). Selama itu, input manual di
 * bawah selalu tersedia sebagai jalan keluar yang pasti jalan di semua HP.
 */
export function Scanner({
  judul, onHasil, onTutup,
}: { judul: string; onHasil: (kode: string) => void; onTutup: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [dukung, setDukung] = useState<'cek' | 'ya' | 'tidak'>('cek');
  const [manual, setManual] = useState('');
  const [pesan, setPesan] = useState('Arahkan kamera ke barcode…');

  useEffect(() => {
    let batal = false;
    const punyaDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    // Menyinkronkan state dengan kapabilitas browser -- pengecualian yang sah.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setDukung(punyaDetector ? 'ya' : 'tidak');
    if (!punyaDetector) return;

    let frameId = 0;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (batal) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // @ts-expect-error -- BarcodeDetector belum ada di lib.dom.d.ts versi TS saat ini
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });

        const loop = async () => {
          if (batal || !videoRef.current) return;
          try {
            const hasil = await detector.detect(videoRef.current);
            if (hasil.length > 0) {
              onHasil(hasil[0].rawValue);
              return; // berhenti scan begitu satu barcode terbaca -- tidak terus memproses frame
            }
          } catch {
            // frame kadang gagal didecode, lanjut saja ke frame berikutnya
          }
          frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);
      } catch {
        setPesan('Tidak bisa mengakses kamera. Pastikan izin kamera diberikan, atau ketik kode manual.');
      }
    })();

    return () => {
      batal = true;
      cancelAnimationFrame(frameId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onHasil]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <b className="flex-1 text-[15px]">{judul}</b>
        <button onClick={onTutup} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mx-6 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-neutral-900">
        {dukung === 'ya' ? (
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="p-6 text-center text-sm text-neutral-400">
            {dukung === 'cek' ? 'Memeriksa dukungan kamera…' : 'Browser ini belum mendukung pemindaian barcode otomatis. Ketik kode di bawah.'}
          </div>
        )}
      </div>

      <p className="px-6 pb-1 pt-3 text-center text-sm text-neutral-400">{pesan}</p>

      <div className="flex gap-2 p-4">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && manual.trim() && onHasil(manual.trim())}
          placeholder="atau ketik kode manual"
          inputMode="numeric"
          className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
        />
        <Button onClick={() => manual.trim() && onHasil(manual.trim())} className="bg-amber-400 text-neutral-900 hover:bg-amber-300">
          OK
        </Button>
      </div>
    </div>
  );
}
