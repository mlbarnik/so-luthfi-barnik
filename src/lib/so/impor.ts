import 'server-only';
import ExcelJS from 'exceljs';

export interface BarisImpor {
  [kolom: string]: string | number | undefined;
}

/**
 * Baca file .xlsx jadi daftar baris berbentuk objek (key = header kolom,
 * huruf kecil semua, spasi dirapikan). Sheet pertama saja yang dibaca.
 * Baris kosong dilewati. Angka & teks dari Excel dipertahankan apa
 * adanya (tidak dipaksa jadi string) supaya validator di pemanggil bisa
 * cek tipe sendiri.
 */
export async function bacaExcel(buffer: ArrayBuffer): Promise<BarisImpor[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel tidak punya sheet sama sekali.');

  const headerRow = ws.getRow(1);
  const kolom: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    kolom[colNumber] = String(cell.value ?? '').trim().toLowerCase();
  });
  if (kolom.filter(Boolean).length === 0) {
    throw new Error('Baris pertama (header) kosong. Baris pertama harus berisi nama kolom.');
  }

  const hasil: BarisImpor[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const baris: BarisImpor = {};
    let adaIsi = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = kolom[colNumber];
      if (!key) return;
      let v = cell.value;
      if (v && typeof v === 'object' && 'text' in v) v = (v as { text: string }).text; // rich text
      if (v !== null && v !== undefined && v !== '') adaIsi = true;
      baris[key] = v as string | number | undefined;
    });
    if (adaIsi) hasil.push(baris);
  });
  return hasil;
}

export interface HasilImporBaris {
  baris: number;
  ok: boolean;
  pesan?: string;
}
export interface RingkasanImpor {
  total: number;
  sukses: number;
  gagal: number;
  detail: HasilImporBaris[];
}