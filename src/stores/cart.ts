import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface CartLine {
  productId: string
  variantId: string
  productName: string
  variantName: string
  imagePath: string | null
  unitPriceIdr: number
  qty: number
  /** Snapshot stok varian; null = tidak dilacak. Batas lunak di UI — otoritas tetap di place_order. */
  stock: number | null
}

interface CartState {
  byStore: Record<string, CartLine[]>
  add: (slug: string, line: Omit<CartLine, 'qty'>, qty?: number) => void
  setQty: (slug: string, variantId: string, qty: number) => void
  remove: (slug: string, variantId: string) => void
  clear: (slug: string) => void
}

const MAX_QTY = 99

function capFor(line: Pick<CartLine, 'stock'>): number {
  return line.stock === null ? MAX_QTY : Math.min(line.stock, MAX_QTY)
}

/**
 * Satu store global, terisi per slug — dua etalase yang dibuka bergantian
 * tidak saling mencemori keranjang. Persist ke localStorage (per browser).
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      byStore: {},

      add: (slug, line, qty = 1) =>
        set((state) => {
          const lines = state.byStore[slug] ?? []
          const existing = lines.find((l) => l.variantId === line.variantId)
          const cap = capFor(line)
          const nextQty = Math.min((existing?.qty ?? 0) + qty, cap)
          const next = existing
            ? lines.map((l) =>
                l.variantId === line.variantId
                  ? { ...l, qty: nextQty, unitPriceIdr: line.unitPriceIdr, stock: line.stock }
                  : l,
              )
            : [...lines, { ...line, qty: Math.min(qty, cap) }]
          return { byStore: { ...state.byStore, [slug]: next } }
        }),

      setQty: (slug, variantId, qty) =>
        set((state) => {
          const lines = state.byStore[slug] ?? []
          const target = lines.find((l) => l.variantId === variantId)
          if (!target) return state
          const capped = Math.max(1, Math.min(qty, capFor(target)))
          return {
            byStore: {
              ...state.byStore,
              [slug]: lines.map((l) => (l.variantId === variantId ? { ...l, qty: capped } : l)),
            },
          }
        }),

      remove: (slug, variantId) =>
        set((state) => ({
          byStore: {
            ...state.byStore,
            [slug]: (state.byStore[slug] ?? []).filter((l) => l.variantId !== variantId),
          },
        })),

      clear: (slug) =>
        set((state) => ({ byStore: { ...state.byStore, [slug]: [] } })),
    }),
    {
      name: 'dt.cart.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/** Konstanta stabil — selector zustand tidak boleh mengembalikan array baru tiap render. */
export const EMPTY_CART: CartLine[] = []

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0)
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceIdr * l.qty, 0)
}
