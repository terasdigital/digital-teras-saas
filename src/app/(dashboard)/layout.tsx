import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Crown,
  LayoutDashboard,
  Palette,
  Package,
  Receipt,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Toko", href: "/dashboard/toko", icon: Store },
  { label: "Produk", href: "/dashboard/produk", icon: Package },
  { label: "Pesanan", href: "/dashboard/pesanan", icon: Receipt },
  { label: "Analitik", href: "/dashboard/analitik", icon: BarChart3 },
  { label: "Tampilan", href: "/dashboard/tampilan", icon: Palette },
  { label: "Langganan", href: "/dashboard/langganan", icon: Crown },
];

function SidebarNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <nav
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto pb-1",
      )}
    >
      {NAV.map((item) => {
        const Icon = item.icon;
        const base =
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors";
        if (item.soon || !item.href) {
          return (
            <span
              key={item.label}
              title="Hadir di milestone berikutnya"
              className={cn(base, "cursor-default text-muted-foreground/50")}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
              <span className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] md:inline">
                soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              base,
              "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Shell dashboard — SENGAJA tidak membaca sesi di sini:
 * guard per-halaman (requireUser) + proxy menjaga rute privat,
 * sehingga layout ikut ter-prerender ke static shell (PPR).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 px-3 py-5 md:flex">
        <Link href="/" className="mb-6 px-3 text-lg font-bold tracking-tight">
          Digital Teras
        </Link>
        <SidebarNav orientation="vertical" />
        <div className="mt-auto px-3 pt-6 text-xs text-muted-foreground">
          Micro-store WhatsApp untuk UMKM 🇮🇩
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-4 py-3 md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <Link href="/" className="font-bold tracking-tight">
              Digital Teras
            </Link>
          </div>
          <SidebarNav orientation="horizontal" />
        </header>
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
