'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function TombolKeluar() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function keluar() {
    start(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <Button variant="destructive" className="w-full" onClick={keluar} disabled={pending}>
      {pending ? 'Keluar…' : 'Keluar'}
    </Button>
  );
}
