"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  cartCount,
  cartTotal,
  EMPTY_CART,
  useCartStore,
  type CartLine,
} from "@/stores/cart";
import { submitOrderAction } from "@/lib/actions/checkout";
import { formatRupiah } from "@/lib/format";
import { getSessionId, track } from "@/lib/track";

export const OPEN_CART_EVENT = "dt:open-cart";

/**
 * Flag terhidrasi via useSyncExternalStore — server bilang false, klien
 * selalu true; tanpa setState di dalam effect (aturan react-hooks baru).
 */
const emptySubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Button keranjang mengambang — hanya muncul bila ada isi.
 * `mounted` guard: cart berasal dari localStorage sehingga render server
 * (kosong) tidak boleh diadu dengan render klien terisi → tanpa guard,
 * hydration mismatch.
 */
export function CartButton({ storeSlug }: { storeSlug: string }) {
  const mounted = useHydrated();
  const [open, setOpen] = useState(false);
  const lines = useCartStore((s) => s.byStore[storeSlug] ?? EMPTY_CART);
  const count = cartCount(lines);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_CART_EVENT, handler);
    return () => window.removeEventListener(OPEN_CART_EVENT, handler);
  }, []);

  if (!mounted || count === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <ShoppingBag className="size-4" />
        Keranjang
        <span className="flex min-w-6 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-xs font-bold text-neutral-900">
          {count}
        </span>
      </button>
      <CartSheet storeSlug={storeSlug} open={open} onOpenChange={setOpen} />
    </>
  );
}

function CartSheet({
  storeSlug,
  open,
  onOpenChange,
}: {
  storeSlug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const lines = useCartStore((s) => s.byStore[storeSlug] ?? EMPTY_CART);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Keranjang</SheetTitle>
            <SheetDescription>
              Cek pilihanmu — pesanan lanjut ke WhatsApp penjual.
            </SheetDescription>
          </SheetHeader>

          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Keranjang masih kosong 🌱
            </p>
          ) : (
            <div className="flex flex-col">
              {lines.map((l) => (
                <CartLineRow
                  key={l.variantId}
                  line={l}
                  onQty={(q) => setQty(storeSlug, l.variantId, q)}
                  onRemove={() => remove(storeSlug, l.variantId)}
                />
              ))}
              <Separator className="my-2" />
              <div className="flex items-center justify-between py-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatRupiah(cartTotal(lines))}</span>
              </div>
              <Button size="lg" onClick={() => setCheckoutOpen(true)}>
                Lanjut ke Pesanan
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutDialog
        storeSlug={storeSlug}
        lines={lines}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onDone={() => {
          onOpenChange(false);
          setCheckoutOpen(false);
        }}
      />
    </>
  );
}

function CartLineRow({
  line,
  onQty,
  onRemove,
}: {
  line: CartLine;
  onQty: (q: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.productName}</p>
        {line.variantName !== "Default" && (
          <p className="truncate text-xs text-muted-foreground">{line.variantName}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatRupiah(line.unitPriceIdr)}
          {line.stock !== null && ` · sisa ${line.stock}`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onQty(line.qty - 1)}
          disabled={line.qty <= 1}
        >
          <Minus className="size-3" />
        </Button>
        <span className="w-6 text-center text-sm tabular-nums">{line.qty}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onQty(line.qty + 1)}
          disabled={line.stock !== null && line.qty >= line.stock}
        >
          <Plus className="size-3" />
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function CheckoutDialog({
  storeSlug,
  lines,
  open,
  onOpenChange,
  onDone,
}: {
  storeSlug: string;
  lines: CartLine[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const clear = useCartStore((s) => s.clear);
  const [saving, startCheckout] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  function handleConfirm() {
    // KUNCI anti-popup-blocker: buka tab kosong SINKRON di dalam gesture klik
    // (sebelum await). Tab yang dibuka saat klik tidak diblokir; kita tinggal
    // mengisi lokasinya setelah server action selesai. Tanpa 'noopener' karena
    // kita butuh handle-nya — sebagai gantinya putus back-reference ke opener
    // selagi masih about:blank (aman dari reverse-tabnabbing).
    track(storeSlug, "checkout");

    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;

    startCheckout(async () => {
      const res = await submitOrderAction({
        storeSlug,
        buyer: { name, phone, note },
        lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        session: getSessionId(),
      });
      if ("error" in res) {
        toast.error(res.error);
        popup?.close(); // tutup tab kosong bila pesanan gagal dibuat
        return;
      }
      // Fallback andal: simpan URL untuk tombol <a> di terima-kasih.
      try {
        sessionStorage.setItem(`dt.wa.${res.ref}`, res.waUrl);
      } catch {
        /* mode privat / storage penuh — tombol manual masih ada fallback */
      }
      // Isi tab yang dibuka saat gesture (bila browser mengizinkan).
      if (popup) {
        try {
          popup.location.href = res.waUrl;
        } catch {
          /* diblokir total → andalkan tombol di terima-kasih */
        }
      }
      clear(storeSlug);
      onDone();
      router.push(`/${storeSlug}/terima-kasih?ref=${encodeURIComponent(res.ref)}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selangkah lagi 📲</DialogTitle>
          <DialogDescription>
            Pesananmu tersimpan di toko ini. Setelah tekan konfirmasi, WhatsApp
            terbuka berisi rincian pesanan — tinggal pencet kirim ke{" "}
            <span className="font-medium text-foreground">penjual</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="buyer-name">Nama kamu *</Label>
            <Input
              id="buyer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Budi"
              maxLength={80}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="buyer-phone">No. HP (opsional)</Label>
            <Input
              id="buyer-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0857xxxxxxx"
              maxLength={17}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="buyer-note">Catatan (opsional)</Label>
            <Textarea
              id="buyer-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="mis. titip warna merah ya"
              maxLength={300}
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {lines.reduce((n, l) => n + l.qty, 0)} barang
              </span>
              <span className="font-bold">{formatRupiah(cartTotal(lines))}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={saving || lines.length === 0}>
            {saving && <Loader2 className="animate-spin" />}
            Pesan via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
