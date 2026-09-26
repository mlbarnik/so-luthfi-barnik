'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TombolSinkron({ sessionId, sudahSinkron }: { sessionId?: string; sudahSinkron?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function kirim() {
    start(async () => {
      const res = await fetch('/api/sheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error ?? 'Sinkron gagal.', { description: 'Data di database tetap aman.' });
        return;
      }
      toast.success(`${json.baris_ditulis} baris ditulis ke Google Sheets.`);
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant={sudahSinkron ? 'outline' : 'default'} onClick={kirim} disabled={pending}>
      <Send className="h-3.5 w-3.5" />
      {pending ? 'Mengirim…' : sudahSinkron ? 'Kirim ulang' : 'Kirim ke spreadsheet'}
    </Button>
  );
}
