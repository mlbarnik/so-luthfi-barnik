import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Mengaktifkan ulang cache navigasi di sisi browser (ini defaultnya
    // Next.js sebelum versi 15; sejak v15 default-nya 0 = selalu ambil
    // ulang dari server tiap pindah halaman, meski baru saja dikunjungi).
    //
    // Efeknya: kalau kamu pindah ke halaman yang sama dalam 30 detik
    // terakhir, tampilannya langsung muncul dari yang tersimpan di
    // browser -- tidak menunggu server lagi.
    //
    // Trade-off yang perlu kamu tahu: angka di Dashboard/Riwayat bisa
    // telat sampai 30 detik kalau ada perubahan dari device lain pas
    // kamu baru saja buka halaman itu. Kalau itu masalah, reload manual
    // (tarik ke bawah di HP / Ctrl+R) selalu mengambil data terbaru.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;