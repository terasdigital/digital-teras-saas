const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const number = new Intl.NumberFormat('id-ID')

/** 1250000 → "Rp1.250.000". Uang disimpan sebagai IDR utuh (bigint/number). */
export function formatRupiah(value: number | bigint): string {
  // Intl id-ID menyisipkan non-breaking space (Rp 1.250.000) —
  // dinormalisasi ke notasi marketplace tanpa spasi agar aman di teks WhatsApp.
  return rupiah
    .format(typeof value === 'bigint' ? Number(value) : value)
    .replace(/ /g, '')
}

/** 12500 → "12.500" (untuk stok, jumlah pesanan, dsb). */
export function formatNumber(value: number | bigint): string {
  return number.format(typeof value === 'bigint' ? Number(value) : value)
}

/** "Rp25.000", "25000", "25.000" → 25000. null bila bukan angka. */
export function parseRupiahInput(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '')
  if (digits === '') return null
  const value = Number(digits)
  return Number.isFinite(value) ? value : null
}
