'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function tekan(k: string) {
    setError('');
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    const baru = pin + k;
    setPin(baru);
  }

  function kirim(nilai: string) {
    start(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: nilai }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'PIN salah.');
        setPin('');
        return;
      }
      router.replace('/');
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-900 text-neutral-50">
      <div className="flex flex-1 flex-col justify-end px-6 pb-4 pt-10">
        <div className="font-semibold tracking-[0.2em] text-amber-400 text-xs">LUTHFI BARNIK · DURI</div>
        <h1 className="mt-2 text-5xl font-bold leading-[0.95]">Stock<br />Opname</h1>
        <p className="mt-2 text-sm text-neutral-400">Masukkan PIN untuk mulai.</p>
      </div>

      <div className="flex justify-center gap-3 pb-1 pt-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-[1.5px] ${
              i < pin.length ? 'border-amber-400 bg-amber-400' : 'border-neutral-500'
            }`}
          />
        ))}
      </div>
      <div className="min-h-6 px-6 text-center text-sm text-red-400">
        {pending ? 'Memeriksa…' : error}
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => (
          <button
            key={k}
            onClick={() => (k === 'ok' ? pin.length >= 4 && kirim(pin) : tekan(k))}
            disabled={pending}
            className="bg-neutral-900 py-4 text-3xl font-medium tabular-nums active:bg-neutral-800"
          >
            {k === 'del' ? <span className="text-xs font-semibold text-neutral-400">Hapus</span>
              : k === 'ok' ? <span className="text-xs font-semibold text-neutral-400">Masuk</span>
              : k}
          </button>
        ))}
      </div>
      <p className="bg-neutral-900 px-6 pb-6 pt-3 text-center text-[11px] text-neutral-500">
        Lupa PIN? Minta admin mereset lewat <code className="text-amber-400">scripts/create-staff.mjs --reset</code>.
      </p>
    </div>
  );
}
