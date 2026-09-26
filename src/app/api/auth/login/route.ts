import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase/env';
import { hmacPin } from '@/lib/so/pin';
import { idPerangkat, cekTerkunci, catatGagal, resetThrottle } from '@/lib/so/throttle';

const Body = z.object({ pin: z.string().min(4).max(6).regex(/^\d+$/) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'PIN tidak valid.' }, { status: 400 });
  }
  const { pin } = parsed.data;

  const admin = createAdminClient();
  const device = await idPerangkat();

  const throttle = await cekTerkunci(admin, device);
  if (throttle.terkunci) {
    return NextResponse.json(
      { ok: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${throttle.sisaMenit} menit.` },
      { status: 429 }
    );
  }

  const { data: staf } = await admin
    .from('staff_credentials')
    .select('id, email, internal_password, profiles!inner(nama, inisial, role, aktif)')
    .eq('pin_hmac', hmacPin(pin))
    .maybeSingle<{
      id: string; email: string; internal_password: string;
      profiles: { nama: string; inisial: string; role: string; aktif: boolean };
    }>();

  if (!staf || !staf.profiles.aktif) {
    await catatGagal(admin, device);
    return NextResponse.json({ ok: false, error: 'PIN tidak dikenali.' }, { status: 401 });
  }

  // Sesi sungguhan dibuat lewat cookie milik Route Handler ini (BUKAN admin
  // client) -- Route Handler boleh menulis cookie, beda dengan Server Component.
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

  const { error } = await supabase.auth.signInWithPassword({
    email: staf.email,
    password: staf.internal_password,
  });

  if (error) {
    // Password internal tersimpan salah/akun Supabase Auth bermasalah --
    // ini bug konfigurasi, bukan PIN salah. Jangan diam-diam dianggap sukses.
    await catatGagal(admin, device);
    return NextResponse.json(
      { ok: false, error: 'Login gagal di server. Hubungi admin.' },
      { status: 500 }
    );
  }

  await resetThrottle(admin, device);

  return NextResponse.json({
    ok: true,
    profil: { nama: staf.profiles.nama, inisial: staf.profiles.inisial, role: staf.profiles.role },
  });
}
