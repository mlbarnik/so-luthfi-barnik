import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stock Opname — Luthfi Barnik',
  description: 'Sistem pendataan barang & stock opname Luthfi Barnik',
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-50">
        {children}
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
