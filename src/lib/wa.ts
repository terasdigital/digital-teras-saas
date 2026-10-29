import { formatRupiah } from '@/lib/format'

export interface WaLine {
  productName: string
  variantName: string
  unitPriceIdr: number
  qty: number
}

export interface WaPayload {
  storeName: string
  storeWhatsapp: string
  ref: string
  buyerName: string
  buyerPhone?: string | null
  buyerNote?: string | null
  lines: WaLine[]
  totalIdr: number
}

/** Batas praktis URL WhatsApp — di atas ini link bisa terpotong/ditolak. */
export const WA_TEXT_LIMIT = 2800

function lineText(index: number, l: WaLine): string {
  const variant = l.variantName && l.variantName !== 'Default' ? ` (${l.variantName})` : ''
  const per = formatRupiah(l.unitPriceIdr)
  const subtotal = formatRupiah(BigInt(l.unitPriceIdr) * BigInt(l.qty))
  return `${index + 1}. ${l.productName}${variant} — ${l.qty}x @ ${per} = ${subtotal}`
}

/**
 * Rakit teks + deep-link wa.me. Teks murni & deterministik → terunit;
 * trim progresif bila melewati batas URL (catatan dibuang dulu, lalu baris
 * ekor dengan penanda, URL selalu encodeURIComponent — newline jadi %0A).
 */
export function buildWaMessage(p: WaPayload): { text: string; url: string } {
  const assemble = (
    lines: WaLine[],
    opts: { includeNote?: boolean; truncated?: boolean } = {},
  ): string => {
    const body = lines.map((l, i) => lineText(i, l))
    if (opts.truncated) body.push(`… (${lines.length} barang lainnya menyusul di chat)`)
    const parts = [
      `Halo ${p.storeName}! Saya mau pesan:`,
      '',
      ...body,
      '',
      `*Total: ${formatRupiah(p.totalIdr)}*`,
      '',
      `Nama: ${p.buyerName}`,
    ]
    if (p.buyerPhone) parts.push(`No. HP: ${p.buyerPhone}`)
    if (opts.includeNote !== false && p.buyerNote) parts.push(`Catatan: ${p.buyerNote}`)
    parts.push(`Kode pesanan: ${p.ref}`)
    parts.push('(dikirim dari ' + p.storeName + ' di Digital Teras)')
    return parts.join('\n')
  }

  let text = assemble(p.lines)
  let dropped = 0

  if (text.length > WA_TEXT_LIMIT && p.buyerNote) {
    // 1) buang catatan (variasi rakitan resmi, bukan regex — note bisa berisi newline)
    text = assemble(p.lines, { includeNote: false })
  }
  if (text.length > WA_TEXT_LIMIT) {
    // 2) pangkas baris dari ekor, sisakan penanda
    const lines = [...p.lines]
    while (lines.length > 1 && assemble(lines, { truncated: true }).length > WA_TEXT_LIMIT) {
      lines.pop()
      dropped++
    }
    text = dropped > 0 ? assemble(lines, { truncated: true }) : assemble(lines)
  }

  return {
    text,
    url: `https://wa.me/${p.storeWhatsapp}?text=${encodeURIComponent(text)}`,
  }
}
