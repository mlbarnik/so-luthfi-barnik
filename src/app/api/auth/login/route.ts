import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase/env';
import { keEmail } from '@/lib/so/akun';
import { idPerangkat, cekTerkunci, catatGagal, resetThrottle } from '@/lib/so/throttle';

const Body = z.object({
  identitas: z.string().trim().min(2).max(120),
  password: z.string().min(6).max(72),
});

/**
 * Login memakai akun Supabase Auth biasa (username/email + password).
 * Sesi yang dibuat adalah sesi Supabase asli (cookie, di-refresh oleh
 * proxy.ts), jadi RLS langsung bekerja lewat auth.uid().
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Isi username dan password (minimal 6 karakter).' }, { status: 400 });
  }
  const { identitas, password } = parsed.data;

  const admin = createAdminClient();
  const device = await idPerangkat();

  const throttle = await cekTerkunci(admin, device);
  if (throttle.terkunci) {
    return NextResponse.json(
      { ok: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${throttle.sisaMenit} menit.` },
      { status: 429 }
    );
  }

  // Route Handler boleh menulis cookie, jadi sesi langsung tertanam di respons ini.
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: keEmail(identitas),
    password,
  });

  if (error || !data.user) {
    await catatGagal(admin, device);
    return NextResponse.json({ ok: false, error: 'Username atau password salah.' }, { status: 401 });
  }

  // Akun Auth ada belum tentu boleh masuk: harus punya profil aktif.
  const { data: profil } = await supabase
    .from('profiles')
    .select('nama, inisial, role, aktif')
    .eq('id', data.user.id)
    .maybeSingle<{ nama: string; inisial: string; role: string; aktif: boolean }>();

  if (!profil || !profil.aktif) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: 'Akun ini belum terdaftar atau sudah dinonaktifkan. Hubungi admin.' },
      { status: 403 }
    );
  }

  await resetThrottle(admin, device);
  return NextResponse.json({ ok: true, profil });
}