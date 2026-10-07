import { wajibPeran } from '@/lib/so/guard';
import { ImporForm } from './impor-form';

export default async function HalamanImpor() {
  await wajibPeran(['admin']);
  return (
    <div className="lg:max-w-3xl">
      <h2 className="text-lg font-semibold">Impor Data</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Isi atau perbarui master barang dan master lokasi lewat file Excel (.xlsx).
        Barang/lokasi dengan barcode atau kode yang sudah ada akan DITIMPA datanya
        (bukan dobel) — selain itu ditambahkan sebagai baris baru.
      </p>
      <ImporForm jenis="produk" />
      <div className="h-6" />
      <ImporForm jenis="lokasi" />
    </div>
  );
}