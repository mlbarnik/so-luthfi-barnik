'use client';

/**
 * Client Supabase untuk komponen browser ('use client').
 * Pakai publishable key -- aman ditaruh di kode yang terkirim ke browser,
 * privilese rendah, akses data tetap dijaga RLS.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
