/**
 * Aturan pemetaan "username" -> email Supabase Auth.
 *
 * Staf cukup mengetik username pendek (mis. "rina"). Di Supabase Auth
 * akunnya tetap terdaftar dengan email biasa: rina@auth.luthfibarnik.internal
 * (bukan email sungguhan, tidak ada kotak masuknya, tidak dipakai untuk
 * kirim apa pun). Kalau yang diketik sudah mengandung "@", dianggap email
 * lengkap dan dipakai apa adanya -- jadi email asli juga boleh dipakai.
 */
export const DOMAIN_INTERNAL = 'auth.luthfibarnik.internal';

export function keEmail(identitas: string): string {
  const v = identitas.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${DOMAIN_INTERNAL}`;
}