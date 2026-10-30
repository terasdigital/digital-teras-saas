import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 leading-relaxed">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Kebijakan Privasi Digital Teras
      </h1>
      <div className="flex flex-col gap-4 text-sm text-neutral-700 dark:text-neutral-300">
        <h2 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Data yang kami kumpulkan
        </h2>
        <p>
          <strong>Akun penjual:</strong> email, nama, nomor WhatsApp, dan data
          toko yang kamu isi. <strong>Pembeli:</strong> nama, nomor HP, dan
          catatan yang <em>sengaja</em> diisi saat checkout — dipakai untuk
          mencatat pesanan dan memudahkan penjual menghubungimu.
          <strong>Statistik:</strong> kunjungan &amp; klik etalase dihitung
          per-session tanpa menyimpan alamat IP atau data presisi.
        </p>
        <h2 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Pembayaran
        </h2>
        <p>
          Data pembayaran (nomor kartu/QRIS/VA) diproses oleh Midtrans — kami
          tidak menyimpannya. Kami hanya menyimpan status tagihan langganan.
        </p>
        <h2 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Penyimpanan &amp; hak kamu
        </h2>
        <p>
          Data disimpan di infrastruktur cloud (Supabase &amp; Vercel) dengan
          akses terbatas. Kamu dapat mengekspor/menghapus tokomu lewat dasbor
          atau permintaan ke kontak resmi kami. Data analitik mentah
          otomatis dimusnahkan setelah 90 hari.
        </p>
        <p className="pt-2 text-xs text-neutral-400">
          Terakhir diperbarui: Oktober 2026 · Versi final menyusul saat
          peluncuran publik.
        </p>
      </div>
    </main>
  );
}
