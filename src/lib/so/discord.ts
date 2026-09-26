import 'server-only';

/**
 * Kirim satu embed Discord lewat webhook. Sesuai keputusan: SATU pesan
 * berisi daftar (bukan satu pesan per barang), dan cukup lewat webhook
 * saja (tanpa tombol aksi interaktif / bot).
 *
 * Butuh salah satu dari:
 *   DISCORD_WEBHOOK_STOK_DISPLAY   -> channel #stok-display
 *   DISCORD_WEBHOOK_INVENTORY_CONTROL -> channel #inventory-control
 * Kalau env var belum diisi, fungsi ini diam-diam tidak melakukan apa-apa
 * (supaya dev lokal tanpa Discord tidak error) -- errornya dicatat ke
 * console saja, TIDAK melempar exception (submit SO tidak boleh gagal
 * gara-gara Discord down, sama seperti aturan PDF di sistem lama).
 */
export async function kirimDaftarPemenuhanKeDiscord(params: {
  channel: 'stok-display' | 'inventory-control';
  judul: string;
  baris: Array<{ nama: string; lokasi: string; sisa: number; satuan: string; keterangan?: string }>;
  soKode?: string;
}) {
  const url = params.channel === 'stok-display'
    ? process.env.DISCORD_WEBHOOK_STOK_DISPLAY
    : process.env.DISCORD_WEBHOOK_INVENTORY_CONTROL;
  if (!url) {
    console.warn(`[discord] webhook untuk #${params.channel} belum diisi, notifikasi dilewati.`);
    return;
  }
  if (params.baris.length === 0) return;

  const deskripsi = params.baris
    .slice(0, 25) // batas embed field Discord
    .map((b) => `• **${b.nama}** — ${b.lokasi} · sisa ${b.sisa} ${b.satuan}${b.keterangan ? ` (${b.keterangan})` : ''}`)
    .join('\n');

  const body = {
    embeds: [{
      title: params.judul,
      description: deskripsi,
      color: params.channel === 'inventory-control' ? 0xE3A24A : 0xF5C518,
      footer: params.soKode ? { text: params.soKode } : undefined,
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[discord] webhook #${params.channel} gagal: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[discord] webhook #${params.channel} error:`, err);
  }
}
