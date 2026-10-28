/**
 * Normalisasi nomor WhatsApp Indonesia → digit murni prefix 62.
 * Input user bebas: "0812-3456-7890", "+62 812 3456 7890", "81234567890".
 * Hasil disimpan di stores.whatsapp (kolom CHECK ^[0-9]{9,15}$).
 */
export function normalizeWhatsappNumber(raw: string): string {
  let digits = raw.replace(/\D/g, '')

  if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}` // 08xx → 628xx
  } else if (digits.startsWith('8')) {
    digits = `62${digits}` // 812xx (tanpa prefix negara/0) → 628xx
  } else if (!digits.startsWith('62')) {
    digits = `62${digits}` // asumsi nomor lokal dalam bentuk lain
  }

  return digits
}

export function isValidWhatsappNumber(normalized: string): boolean {
  return /^[0-9]{9,15}$/.test(normalized)
}

/**
 * Setelah normalisasi, nomor WA harus berbentuk seluler Indonesia: 628…
 * (10–15 digit total). Ini yang menolak "12345678", nomor rumah 021…,
 * atau nomor luar negeri yang tadinya lolos karena di-prepend 62.
 */
export function isLikelyIndonesianMobile(normalized: string): boolean {
  return /^628[0-9]{7,12}$/.test(normalized)
}

/** Tampilan ramah: 6281234567890 → "0812-3456-7890" untuk UI dashboard. */
export function formatWhatsappLocal(normalized: string): string {
  if (!normalized.startsWith('62')) return normalized
  const local = `0${normalized.slice(2)}`
  return local.replace(/^(\d{4})(\d{4})(\d+)/, '$1-$2-$3')
}
