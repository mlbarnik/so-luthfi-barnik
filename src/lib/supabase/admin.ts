import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SECRET_KEY } from './env';

/**
 * Client admin -- pakai SECRET KEY, MELEWATI RLS SEPENUHNYA.
 *
 * HANYA dipakai di dalam Route Handler server untuk hal yang memang butuh
 * hak penuh: login (baca staff_credentials), sinkron ke Google Sheets
 * (tulis sheet_sync_log), rate-limit login (login_throttle).
 * JANGAN PERNAH diimpor oleh file yang bisa berjalan di browser.
 */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL(), SUPABASE_SECRET_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
