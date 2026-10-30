import type { Metadata } from "next";

export const metadata: Metadata = { title: "Syarat & Ketentuan" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 leading-relaxed">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Syarat &amp; Ketentuan Digital Teras
      </h1>
      <div className="flex flex-col gap-4 text-sm text-neutral-700 dark:text-neutral-300">
        <p>
          Dengan membuat akun dan menggunakan Digital Teras, kamu menyetujui
          syarat berikut. Dokumen ini masih sederhana karena produk kami masih
          tahap awal — versi final akan diterbitkan saat peluncuran publik.
        </p>
        <h2 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          1. Layanan
        </h2>
        <p>
          Digital Teras menyediakan halaman publik (&ldquo;etalase&rdquo;) untuk
          menampilkan katalog dan meneruskan pesanan penjual ke aplikasi
          WhatsApp penjual. Kami tidak menjadi pihak dalam transaksi antara
          pembeli dan penjual.
        </p>
        <h2 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          2. Kewajiban pengguna
        </h2>
        <p>
          Penjual bertanggung jawab penuh atas kebenaran produk, harga,
          stok, dan proses penjualan. Dilarang memakai layanan untuk
          barang/jasa ilegal, penipuan, atau melanggar hak pihak lain.
        </p>
        <h2 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          3. Pembayaran langganan
        </h2>
        <p>
          Langganan paket berbayar bersifat prabayar (prepaid) dan diproses
          melalui Midtrans. Tidak ada perpanjangan otomatis; langganan berakhir
          pada akhir periode dan toko otomatis kembali ke batas paket Free.
          Tidak ada pengembalian dana kecuali diwajibkan peraturan.
        </p>
        <h2 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          4. Batas &amp; penonaktifan
        </h2>
        <p>
          Kami dapat menonaktifkan etalase yang melanggar hukum atau syarat
          ini. Data tidak dihapus tanpa pemberitahuan kecuali pelanggaran
          berat.
        </p>
        <p className="pt-2 text-xs text-neutral-400">
          Terakhir diperbarui: Oktober 2026 · Hubungi kami lewat WhatsApp resmi
          yang tercantum di beranda.
        </p>
      </div>
    </main>
  );
}
