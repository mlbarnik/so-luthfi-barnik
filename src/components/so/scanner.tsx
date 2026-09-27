'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const FORMAT: BarcodeFormatSederhana[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
type BarcodeFormatSederhana = 'ean_13' | 'ean_8' | 'upc_a' | 'upc_e' | 'code_128' | 'code_39';
interface DetektorBarcode {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => DetektorBarcode;

/**
 * Pemindai barcode kamera.
 *
 * Native `BarcodeDetector` bawaan browser dipakai kalau ada (cepat, tanpa
 * download tambahan) -- ini yang jalan di Chrome/Edge Android & desktop.
 * Kalau tidak ada (Safari/iOS, Firefox), fallback ke pustaka `barcode-detector`
 * (WASM, ZXing-C++) yang di-import SECARA DINAMIS supaya file WASM-nya
 * (~1-2 MB) cuma diunduh browser yang benar-benar butuh, tidak membebani
 * pengguna Chrome yang sudah punya versi native-nya.
 *
 * BELUM SEMPAT DITES DI IPHONE SUNGGUHAN dari sandbox ini (tidak ada
 * device fisik) -- coba dulu di lapangan sebelum dipakai serius. Kalau
 * ternyata tetap ada masalah kamera di perangkat tertentu, input manual
 * di bawah selalu tersedia sebagai jalan keluar yang pasti berfungsi.
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
          // Diunduh hanya saat dibutuhkan (Safari/iOS, dst). WASM-nya
          // diambil pustaka ini dari CDN jsDelivr saat runtime.
          // The fallback package is optional and may not provide declarations
          // in the consuming project; its runtime shape is declared above.
          // @ts-ignore -- intentional dynamic import of an optionally installed package
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
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
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <b className="flex-1 text-[15px]">{judul}</b>
        <button onClick={onTutup} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mx-6 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-neutral-900">
        {siap ? (
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="p-6 text-center text-sm text-neutral-400">Menyiapkan…</div>
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