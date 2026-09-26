import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const BATAS_PERCOBAAN = 5;
const KUNCI_MENIT = 15;
const DEVICE_COOKIE = 'lb_device';

export async function idPerangkat(): Promise<string> {
  const jar = await cookies();
  const ada = jar.get(DEVICE_COOKIE)?.value;
  if (ada) return ada;
  const baru = randomUUID();
  jar.set(DEVICE_COOKIE, baru, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return baru;
}

export async function cekTerkunci(admin: SupabaseClient, kunci: string): Promise<{ terkunci: boolean; sisaMenit?: number }> {
  const { data } = await admin
    .from('login_throttle')
    .select('terkunci_sampai')
    .eq('kunci', kunci)
    .maybeSingle<{ terkunci_sampai: string | null }>();
  if (data?.terkunci_sampai && new Date(data.terkunci_sampai) > new Date()) {
    const sisaMs = new Date(data.terkunci_sampai).getTime() - Date.now();
    return { terkunci: true, sisaMenit: Math.ceil(sisaMs / 60000) };
  }
  return { terkunci: false };
}

export async function catatGagal(admin: SupabaseClient, kunci: string): Promise<void> {
  const { data } = await admin
    .from('login_throttle')
    .select('percobaan')
    .eq('kunci', kunci)
    .maybeSingle<{ percobaan: number }>();
  const percobaan = (data?.percobaan ?? 0) + 1;
  const terkunci_sampai = percobaan >= BATAS_PERCOBAAN
    ? new Date(Date.now() + KUNCI_MENIT * 60000).toISOString()
    : null;
  await admin.from('login_throttle').upsert({
    kunci, percobaan, terkunci_sampai, updated_at: new Date().toISOString(),
  });
}

export async function resetThrottle(admin: SupabaseClient, kunci: string): Promise<void> {
  await admin.from('login_throttle').delete().eq('kunci', kunci);
}
