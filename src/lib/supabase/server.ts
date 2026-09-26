import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './env';

/**
 * Client Supabase untuk Server Component / Server Action / Route Handler.
 * Identitas datang dari cookie sesi (di-refresh oleh proxy.ts) -- RLS
 * tetap berlaku penuh (bukan admin).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Dipanggil dari Server Component (bukan Route Handler / Server Action)
          // -- boleh diabaikan karena proxy.ts sudah menjaga sesi tetap segar.
        }
      },
    },
  });
}
