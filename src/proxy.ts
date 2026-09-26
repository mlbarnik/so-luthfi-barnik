/**
 * proxy.ts — pengganti middleware.ts di Next.js 16 (nama & jalur
 * eksekusinya sama, cuma namanya diganti supaya tidak dikira middleware
 * gaya Express). Jalan di runtime Node.js secara default di Next 16,
 * jadi @supabase/ssr (yang butuh Node API) langsung jalan tanpa akal-akalan.
 *
 * Tugas SATU-SATUNYA file ini: menyegarkan token sesi Supabase di cookie
 * supaya PIC tidak "logout sendiri" gara-gara access token kedaluwarsa
 * di tengah pemakaian. File ini BUKAN penjaga keamanan utama -- proxy
 * bisa dilewati (CVE-2025-29927), jadi setiap Server Component/Route
 * Handler tetap mengecek auth.getUser() + peran sendiri (lihat
 * src/lib/so/guard.ts). Anggap proxy ini cuma "penyegar sesi", bukan pintu.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Memanggil getUser() (bukan getSession()) memastikan token benar-benar
  // divalidasi ulang ke server Supabase Auth, sekaligus memicu refresh
  // token kalau access token-nya sudah lewat masa berlaku.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Jalankan di semua route KECUALI aset statis Next.js dan file publik
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
};
