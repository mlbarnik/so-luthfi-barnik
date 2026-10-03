'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FORMAT: BarcodeFormatSederhana[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
type BarcodeFormatSederhana = 'ean_13' | 'ean_8' | 'upc_a' | 'upc_e' | 'code_128' | 'code_39';
interface DetektorBarcode {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

/**
 * Pemindai barcode kamera.
 *
 * PERBAIKAN: elemen <video> sekarang SELALU ada di DOM (tidak dipasang
 * belakangan secara kondisional). Sebelumnya <video> baru dirender
 * setelah state `siap` jadi true, padahal effect mencoba menyambungkan
 * stream kamera ke videoRef SEBELUM itu -- videoRef.current masih null
 * saat itu, jadi srcObject tidak pernah terpasang walau browser sudah
 * memberi izin kamera. Sekarang videoRef selalu terpasang; yang
 * disembunyikan/ditampilkan cuma class CSS-nya.
 */
export function Scanner({
  judul, onHasil, onTutup,
}: { judul: string; onHasil: (kode: string) => void; onTutup: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [siap, setSiap] = useState(false);
  const [manual, setManual] = useState('');
  const [pesan, setPesan] = useState('Menyiapkan pemindai…');

  useEffect(() => {
    let batal = false;
    let frameId = 0;

    (async () => {
      let detector: DetektorBarcode;
      try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          // @ts-expect-error -- BarcodeDetector belum ada di lib.dom.d.ts versi TS saat ini
          detector = new window.BarcodeDetector({ formats: FORMAT });
        } else {
          const { BarcodeDetector: BarcodeDetectorWasm } = await import('barcode-detector/pure');
          if (batal) return;
          detector = new BarcodeDetectorWasm({ formats: FORMAT }) as unknown as DetektorBarcode;
        }
      } catch {
        if (!batal) setPesan('Pemindai tidak bisa disiapkan di perangkat ini. Ketik kode manual di bawah.');
        return;
      }
      if (batal) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (batal) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (!videoRef.current) {
          setPesan('Terjadi kesalahan internal (elemen video tidak ditemukan). Ketik kode manual di bawah.');
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setSiap(true);
        setPesan('Arahkan kamera ke barcode…');

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
        if (!batal) setPesan('Tidak bisa mengakses kamera. Pastikan izin kamera diberikan, atau ketik kode manual.');
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
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white md:items-center">
      <div className="flex w-full items-center gap-3 px-4 py-3 md:max-w-2xl">
        <b className="flex-1 text-[15px]">{judul}</b>
        <button onClick={onTutup} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mx-6 flex w-[calc(100%-3rem)] flex-1 items-center justify-center overflow-hidden rounded-xl bg-neutral-900 md:max-w-2xl">
        {/* video SELALU dirender -- videoRef harus ada sebelum stream disambungkan */}
        <video
          ref={videoRef}
          muted
          playsInline
          className={cn('h-full w-full object-cover', !siap && 'hidden')}
        />
        {!siap && <div className="p-6 text-center text-sm text-neutral-400">Menyiapkan…</div>}
      </div>

      <p className="w-full px-6 pb-1 pt-3 text-center text-sm text-neutral-400 md:max-w-2xl">{pesan}</p>

      <div className="flex w-full gap-2 p-4 md:max-w-2xl">
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