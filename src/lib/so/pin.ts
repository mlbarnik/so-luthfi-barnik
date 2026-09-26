import 'server-only';
import { createHmac, randomBytes } from 'crypto';
import { PIN_HMAC_SECRET } from '@/lib/supabase/env';

/** PIN diubah jadi HMAC-SHA256 (kunci server) supaya bisa dicari lewat
 * index database tanpa perlu meloop bcrypt.compare ke tiap staf, dan
 * PIN mentah tidak pernah tersimpan di database. Keamanan PIN 4-6 digit
 * sebenarnya bertumpu pada RATE LIMIT (lihat login_throttle), bukan pada
 * algoritma hash -- ruang 4 digit cuma 10.000 kombinasi, hash sekuat
 * apa pun tidak menolong kalau percobaan tidak dibatasi. */
export function hmacPin(pin: string): string {
  return createHmac('sha256', PIN_HMAC_SECRET()).update(pin.trim()).digest('hex');
}

/** Password internal acak & kuat untuk akun Supabase Auth staf --
 * BUKAN PIN. Dibuat sekali saat staf dibuat/direset (lihat scripts/create-staff.mjs). */
export function buatPasswordInternal(): string {
  return randomBytes(24).toString('base64url');
}
