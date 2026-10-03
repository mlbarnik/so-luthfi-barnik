#!/usr/bin/env node
/**
 * scripts/create-staff.mjs
 *
 * Dijalankan SENDIRI oleh admin dari komputer sendiri (BUKAN dari dalam
 * aplikasi web) untuk membuat / mengatur akun staf. Butuh SUPABASE_SECRET_KEY
 * -- jangan pernah taruh script atau env ini di kode yang dikirim ke browser.
 *
 * Login staf = username + password (akun Supabase Auth biasa).
 * Username "rina" tersimpan sebagai rina@auth.luthfibarnik.internal.
 *
 *   Satu staf baru:
 *     node --env-file=.env.local scripts/create-staff.mjs \
 *       --nama "Rina W." --username rina --password rahasia123 --role pic
 *
 *   Banyak staf dari CSV (lihat scripts/contoh-staf.csv):
 *     node --env-file=.env.local scripts/create-staff.mjs --csv scripts/daftar-staf.csv
 *
 *   Ganti password staf:
 *     node --env-file=.env.local scripts/create-staff.mjs --reset --username rina --password baru12345
 *
 *   Ganti username akun lama (mis. akun era PIN yang emailnya panjang):
 *     node --env-file=.env.local scripts/create-staff.mjs --reset \
 *       --email <email-lama> --username-baru suhendri --password baru12345
 *
 *   Lihat semua staf (nama, peran, email login, aktif/tidak):
 *     node --env-file=.env.local scripts/create-staff.mjs --daftar
 *
 * Peran yang valid: admin, pic, ic, kepala_toko, spv, owner
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DOMAIN_INTERNAL = 'auth.luthfibarnik.internal';
const PERAN_VALID = ['admin', 'pic', 'ic', 'kepala_toko', 'spv', 'owner'];

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

function wajibEnv(nama) {
  const v = process.env[nama];
  if (!v) {
    console.error(`Env ${nama} belum ada. Jalankan dengan: node --env-file=.env.local scripts/create-staff.mjs ...`);
    process.exit(1);
  }
  return v;
}

const admin = createClient(wajibEnv('NEXT_PUBLIC_SUPABASE_URL'), wajibEnv('SUPABASE_SECRET_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const keEmail = (identitas) => {
  const v = identitas.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${DOMAIN_INTERNAL}`;
};

function cekUsername(u) {
  if (!u || !/^[a-z0-9._-]{2,30}$/i.test(u)) {
    throw new Error(`username '${u ?? ''}' tidak valid (2-30 karakter: huruf, angka, titik, strip, garis bawah, tanpa spasi)`);
  }
}
function cekPassword(p) {
  if (!p || String(p).length < 6) throw new Error('password minimal 6 karakter');
}

/** Cari user Auth berdasarkan email (jumlah staf kecil, cukup listUsers). */
async function cariUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const ketemu = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (ketemu) return ketemu;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Inti pembuatan satu staf. Melempar Error kalau gagal (tidak process.exit)
 * supaya mode CSV bisa lanjut ke baris berikutnya. */
async function buatSatuStaf({ nama, inisial, role, username, password, email }) {
  if (!nama) throw new Error('nama kosong');
  if (!PERAN_VALID.includes(role)) throw new Error(`peran '${role}' tidak dikenal (pilih: ${PERAN_VALID.join(', ')})`);
  if (!email) cekUsername(username);
  cekPassword(password);

  const emailFinal = email ? email.trim().toLowerCase() : keEmail(username);
  const inisialFinal = (inisial || nama.split(' ').map((s) => s[0]).join('')).slice(0, 2).toUpperCase();

  const { data: userBaru, error: errUser } = await admin.auth.admin.createUser({
    email: emailFinal, password, email_confirm: true,
  });
  if (errUser) throw new Error(`akun Supabase Auth gagal dibuat -- ${errUser.message}`);

  const { error: errProfil } = await admin.from('profiles').insert({
    id: userBaru.user.id, nama, inisial: inisialFinal, role, aktif: true,
  });
  if (errProfil) {
    await admin.auth.admin.deleteUser(userBaru.user.id); // jangan sisakan akun yatim
    throw new Error(`profil gagal disimpan, akun dibatalkan -- ${errProfil.message}`);
  }
  return { nama, role, login: email ? emailFinal : username.trim().toLowerCase() };
}

function bacaCsv(path) {
  const teks = readFileSync(path, 'utf8').trim();
  const [barisHeader, ...barisData] = teks.split(/\r?\n/);
  const kolom = barisHeader.split(',').map((k) => k.trim().toLowerCase());
  return barisData.filter((b) => b.trim()).map((baris) => {
    const nilai = baris.split(',').map((v) => v.trim());
    const row = {};
    kolom.forEach((k, i) => { row[k] = nilai[i]; });
    return row;
  });
}

async function buatDariCsv(path) {
  const baris = bacaCsv(path);
  const dipakai = new Map();
  console.log(`Membaca ${baris.length} baris dari ${path}...\n`);
  let sukses = 0, gagal = 0;
  for (const [i, r] of baris.entries()) {
    const no = i + 2;
    const u = (r.username ?? '').toLowerCase();
    if (u && dipakai.has(u)) {
      console.error(`Baris ${no} (${r.nama}): GAGAL -- username '${u}' dobel dengan baris untuk "${dipakai.get(u)}".`);
      gagal++;
      continue;
    }
    try {
      const h = await buatSatuStaf(r);
      dipakai.set(u, r.nama);
      console.log(`Baris ${no} (${h.nama}, ${h.role}): OK -- login: ${h.login}`);
      sukses++;
    } catch (err) {
      console.error(`Baris ${no} (${r.nama ?? '?'}): GAGAL -- ${err.message}`);
      gagal++;
    }
  }
  console.log(`\nSelesai: ${sukses} berhasil, ${gagal} gagal.`);
  if (gagal > 0) process.exitCode = 1;
}

async function buatSatuDariArgv() {
  const h = await buatSatuStaf({
    nama: ambilArg('nama', true),
    inisial: ambilArg('inisial'),
    role: ambilArg('role', true),
    username: ambilArg('username'),
    email: ambilArg('email'),
    password: ambilArg('password', true),
  });
  console.log(`\nStaf dibuat:\n  Nama    : ${h.nama}\n  Peran   : ${h.role}\n  Login   : ${h.login}\n  (password sesuai yang kamu ketik tadi)\n`);
}

async function resetAkun() {
  const identitas = ambilArg('username') || ambilArg('email');
  if (!identitas) throw new Error('isi --username atau --email akun yang mau diubah');
  const usernameBaru = ambilArg('username-baru');
  const password = ambilArg('password');
  if (!password && !usernameBaru) throw new Error('isi --password baru dan/atau --username-baru');
  if (password) cekPassword(password);
  if (usernameBaru) cekUsername(usernameBaru);

  const emailLama = keEmail(identitas);
  const user = await cariUserByEmail(emailLama);
  if (!user) throw new Error(`akun dengan email ${emailLama} tidak ditemukan (coba --daftar untuk melihat semua akun)`);

  const perubahan = { email_confirm: true };
  if (password) perubahan.password = password;
  if (usernameBaru) perubahan.email = keEmail(usernameBaru);

  const { error } = await admin.auth.admin.updateUserById(user.id, perubahan);
  if (error) throw new Error(`gagal mengubah akun -- ${error.message}`);

  console.log(`\nAkun ${emailLama} berhasil diubah.${usernameBaru ? `\n  Username baru: ${usernameBaru.toLowerCase()}` : ''}${password ? '\n  Password baru sudah aktif.' : ''}\n`);
}

async function daftarStaf() {
  const { data: profil, error } = await admin.from('profiles').select('id, nama, role, aktif').order('nama');
  if (error) throw new Error(error.message);
  const emailPerId = new Map();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    data.users.forEach((u) => emailPerId.set(u.id, u.email));
    if (data.users.length < 200) break;
  }
  console.log('\nNAMA'.padEnd(22) + 'PERAN'.padEnd(14) + 'AKTIF'.padEnd(7) + 'LOGIN (email)');
  for (const p of profil) {
    const email = emailPerId.get(p.id) ?? '-';
    const login = email.endsWith(`@${DOMAIN_INTERNAL}`) ? email.split('@')[0] : email;
    console.log(p.nama.padEnd(21) + ' ' + p.role.padEnd(13) + ' ' + String(p.aktif).padEnd(6) + ' ' + login + `   <${email}>`);
  }
  console.log('');
}

const csvPath = ambilArg('csv');
const jalan = adaFlag('daftar') ? daftarStaf() : adaFlag('reset') ? resetAkun() : csvPath ? buatDariCsv(csvPath) : buatSatuDariArgv();
jalan.catch((err) => {
  console.error('\nGAGAL:', err.message);
  process.exit(1);
});