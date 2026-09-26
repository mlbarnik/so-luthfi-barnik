#!/usr/bin/env node
/**
 * scripts/create-staff.mjs
 *
 * Dijalankan SENDIRI oleh admin dari komputer sendiri (BUKAN dari dalam
 * aplikasi web) untuk membuat atau mereset login PIN seorang staf.
 * Butuh SUPABASE_SECRET_KEY -- jangan pernah taruh script atau env ini
 * di kode yang dikirim ke browser.
 *
 * Cara pakai (Node 20.6+ punya --env-file bawaan, tidak perlu dotenv):
 *
 *   Staf baru:
 *     node --env-file=.env.local scripts/create-staff.mjs \
 *       --nama "Rina W." --inisial RW --role pic --pin 2468
 *
 *   Reset PIN staf yang sudah ada:
 *     node --env-file=.env.local scripts/create-staff.mjs \
 *       --email pic-rw@auth.luthfibarnik.internal --reset --pin 1122
 *
 * Peran yang valid: admin, pic, ic, kepala_toko, spv, owner
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHmac, randomUUID } from 'node:crypto';

function ambilArg(nama, wajib = false) {
  const i = process.argv.indexOf(`--${nama}`);
  const nilai = i >= 0 ? process.argv[i + 1] : undefined;
  if (wajib && !nilai) {
    console.error(`Argumen --${nama} wajib diisi.`);
    process.exit(1);
  }
  return nilai;
}
const adaFlag = (nama) => process.argv.includes(`--${nama}`);

const PERAN_VALID = ['admin', 'pic', 'ic', 'kepala_toko', 'spv', 'owner'];

function wajibEnv(nama) {
  const v = process.env[nama];
  if (!v) {
    console.error(`Env ${nama} belum ada. Jalankan dengan: node --env-file=.env.local scripts/create-staff.mjs ...`);
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = wajibEnv('NEXT_PUBLIC_SUPABASE_URL');
const SECRET_KEY = wajibEnv('SUPABASE_SECRET_KEY');
const PIN_SECRET = wajibEnv('PIN_HMAC_SECRET');

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hmacPin(pin) {
  return createHmac('sha256', PIN_SECRET).update(pin.trim()).digest('hex');
}
function passwordInternalBaru() {
  return randomBytes(24).toString('base64url');
}

async function buatStafBaru() {
  const nama = ambilArg('nama', true);
  const inisial = (ambilArg('inisial') || nama.split(' ').map((s) => s[0]).join('').slice(0, 2)).toUpperCase();
  const role = ambilArg('role', true);
  const pin = ambilArg('pin', true);
  const email = ambilArg('email') || `${role}-${inisial.toLowerCase()}-${randomUUID().slice(0, 6)}@auth.luthfibarnik.internal`;

  if (!PERAN_VALID.includes(role)) {
    console.error(`Peran '${role}' tidak dikenal. Pilih salah satu: ${PERAN_VALID.join(', ')}`);
    process.exit(1);
  }
  if (!/^\d{4,6}$/.test(pin)) {
    console.error('PIN harus 4-6 digit angka.');
    process.exit(1);
  }

  const passwordInternal = passwordInternalBaru();

  const { data: userBaru, error: errUser } = await admin.auth.admin.createUser({
    email, password: passwordInternal, email_confirm: true,
  });
  if (errUser) {
    console.error('Gagal membuat akun Supabase Auth:', errUser.message);
    process.exit(1);
  }

  const { error: errProfil } = await admin.from('profiles').insert({
    id: userBaru.user.id, nama, inisial, role, aktif: true,
  });
  if (errProfil) {
    console.error('Gagal menyimpan profil:', errProfil.message);
    console.error('(Akun Auth sudah terlanjur dibuat, hapus manual dari dashboard Supabase kalau perlu ulang.)');
    process.exit(1);
  }

  const { error: errKred } = await admin.from('staff_credentials').insert({
    id: userBaru.user.id, email, pin_hmac: hmacPin(pin), internal_password: passwordInternal,
  });
  if (errKred) {
    console.error('Gagal menyimpan kredensial:', errKred.message);
    process.exit(1);
  }

  console.log(`\nStaf dibuat:\n  Nama   : ${nama}\n  Peran  : ${role}\n  PIN    : ${pin}\n  Email internal: ${email} (bukan email sungguhan, jangan dipakai untuk apa pun selain login sistem)\n`);
}

async function resetPin() {
  const email = ambilArg('email', true);
  const pin = ambilArg('pin', true);
  if (!/^\d{4,6}$/.test(pin)) {
    console.error('PIN harus 4-6 digit angka.');
    process.exit(1);
  }

  const { data: kred, error: errCari } = await admin
    .from('staff_credentials').select('id').eq('email', email).maybeSingle();
  if (errCari || !kred) {
    console.error('Staf dengan email tersebut tidak ditemukan.');
    process.exit(1);
  }

  const passwordBaru = passwordInternalBaru();
  const { error: errAuth } = await admin.auth.admin.updateUserById(kred.id, { password: passwordBaru });
  if (errAuth) {
    console.error('Gagal mengubah password Supabase Auth:', errAuth.message);
    process.exit(1);
  }

  const { error: errUpdate } = await admin.from('staff_credentials').update({
    pin_hmac: hmacPin(pin), internal_password: passwordBaru,
    failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
  }).eq('id', kred.id);
  if (errUpdate) {
    console.error('Gagal menyimpan PIN baru:', errUpdate.message);
    process.exit(1);
  }

  console.log(`\nPIN untuk ${email} berhasil direset ke: ${pin}\n`);
}

(adaFlag('reset') ? resetPin() : buatStafBaru()).catch((err) => {
  console.error('Terjadi kesalahan tak terduga:', err);
  process.exit(1);
});
