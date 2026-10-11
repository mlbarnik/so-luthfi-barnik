/**
 * Pembantu pencocokan barcode. Fungsi murni (tanpa akses database) supaya
 * mudah diuji.
 *
 * Kenapa perlu: satu barang yang sama bisa tercatat dalam beberapa bentuk
 * yang sebenarnya setara -- UPC-A (12 digit) = EAN-13 dengan awalan 0
 * (13 digit) = GTIN-14 dengan dua awalan 0 -- dan Excel sering MEMBUANG
 * angka 0 di depan kalau kolom barcode bertipe angka. Akibatnya hasil
 * scan "tidak ditemukan" padahal barangnya ada di master.
 */
export function kandidatBarcode(mentah: string): string[] {
  const v = mentah.replace(/\s+/g, '');
  if (!v) return [];
  const hasil = new Set<string>([v]);
  if (/^\d+$/.test(v)) {
    const tanpaNol = v.replace(/^0+/, '');
    if (tanpaNol) {
      hasil.add(tanpaNol);
      for (const panjang of [8, 12, 13, 14]) {
        if (tanpaNol.length <= panjang) hasil.add(tanpaNol.padStart(panjang, '0'));
      }
    }
  }
  return [...hasil];
}

/**
 * Membersihkan teks pencarian sebelum dipakai di filter PostgREST .or(...).
 * Karakter , ( ) " \ * % mengacaukan sintaks filter (mis. nama barang
 * "Gelas (6pcs)" membuat pencarian error / membaca filter yang salah).
 */
export function bersihkanPencarian(q: string): string {
  return q.replace(/[,()"\\*%]/g, ' ').replace(/\s+/g, ' ').trim();
}