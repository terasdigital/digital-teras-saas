"use client";

import { useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";

const noopSubscribe = () => () => {};

/**
 * Tombol buka chat WhatsApp untuk pesanan `ref`.
 * - URL WA diambil dari sessionStorage (disimpan CheckoutDialog saat submit).
 * - Sengaja TANPA auto-open: window.open di useEffect selalu di luar
 *   user-gesture → diblokir popup-blocker (justru sumber kebingungan).
 *   Tombol <a target="_blank"> di bawah adalah gesture langsung yang
 *   dijamin membuka tab WA. sessionStorage tidak dihapus agar tombol
 *   tetap ada walau halaman di-refresh.
 */
export function WhatsAppLauncher({ orderRef }: { orderRef: string }) {
  // Baca sessionStorage tanpa useEffect+setState: useSyncExternalStore memberi
  // snapshot server (null) saat hidrasi lalu snapshot klien (URL) — perbedaan
  // ini memang dirancang, jadi tidak memicu hydration warning.
  const url = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return sessionStorage.getItem(`dt.wa.${orderRef}`);
      } catch {
        return null;
      }
    },
    () => null,
  );

  if (!url) {
    return (
      <p className="text-xs text-neutral-500">
        Pesananmu sudah tercatat. Bila tab WhatsApp tidak terbuka, penjual akan
        menghubungimu — atau buka kembali dari keranjang.
      </p>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      <MessageCircle className="size-5" />
      Buka WhatsApp &amp; Kirim Pesanan
    </a>
  );
}
