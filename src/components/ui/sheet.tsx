'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sheet({
  open, onOpenChange, title, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-neutral-200 bg-white p-0 pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-900'
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <Dialog.Title className="flex-1 text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="grid h-8 w-8 place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="px-4 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
