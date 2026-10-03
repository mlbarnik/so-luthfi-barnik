'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const router = useRouter();
  const [identitas, setIdentitas] = useState('');
  const [password, setPassword] = useState('');
  const [lihat, setLihat] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError('');
    start(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identitas, password }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error ?? 'Login gagal.');
          setPassword('');
          return;
        }
        router.replace('/');
        router.refresh();
      } catch {
        setError('Tidak ada koneksi ke server. Coba lagi.');
      }
    });
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      {/* Panel merek: di HP jadi header atas, di tablet/PC jadi sisi kiri */}
      <div className="flex flex-col justify-end bg-neutral-900 px-6 pb-8 pt-14 text-neutral-50 md:justify-center md:px-12 md:py-12">
        <div className="text-xs font-semibold tracking-[0.2em] text-amber-400">LUTHFI BARNIK · DURI</div>
        <h1 className="mt-2 text-5xl font-bold leading-[0.95] md:text-6xl">Stock<br />Opname</h1>
        <p className="mt-3 max-w-sm text-sm text-neutral-400">
          Pendataan barang, hitung stok, dan pemenuhan display — dari HP, tablet, atau komputer.
        </p>
      </div>

      <div className="flex items-start justify-center bg-white px-6 py-8 dark:bg-neutral-950 md:items-center md:px-12">
        <form onSubmit={kirim} className="w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Masuk</h2>
            <p className="text-sm text-neutral-500">Pakai username dan password dari admin.</p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">Username</span>
            <Input
              value={identitas}
              onChange={(e) => setIdentitas(e.target.value)}
              placeholder="contoh: rina"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">Password</span>
            <div className="relative">
              <Input
                type={lihat ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setLihat((v) => !v)}
                aria-label={lihat ? 'Sembunyikan password' : 'Lihat password'}
                className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-neutral-500"
              >
                {lihat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending || !identitas.trim() || password.length < 6}>
            {pending ? 'Memeriksa…' : 'Masuk'}
          </Button>

          <p className="text-center text-xs text-neutral-400">
            Lupa password? Minta admin menggantinya.
          </p>
        </form>
      </div>
    </div>
  );
}
