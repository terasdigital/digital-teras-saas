"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "connecting" | "live" | "error";

/**
 * Berlangganan Supabase Realtime pada tabel `orders` untuk satu toko.
 * Tiap perubahan (order baru dari pembeli, atau status diubah di tab lain)
 * memicu `router.refresh()` (ter-debounce) → daftar/detail server dirender
 * ulang tanpa reload browser. RLS memastikan hanya baris toko ini yang tiba.
 *
 * Menampilkan indikator koneksi kecil; komponen ini sendiri tanpa markup daftar.
 */
export function OrdersLive({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orders-live-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        () => scheduleRefresh(),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED")
          setStatus("error");
      });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [storeId, scheduleRefresh]);

  const dot =
    status === "live"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-400"
        : "bg-neutral-300";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={
        status === "live"
          ? "Tersambung — pesanan baru muncul otomatis"
          : status === "connecting"
            ? "Menyambungkan live…"
            : "Live tidak aktif — muat ulang untuk sinkron"
      }
    >
      <span className="relative flex size-2">
        {status === "live" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-60`} />
        )}
        <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
      </span>
      {status === "live" ? "Live" : status === "connecting" ? "Menyambung…" : "Offline"}
    </span>
  );
}
