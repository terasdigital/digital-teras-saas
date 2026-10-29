"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  deleteProductAction,
  setProductActiveAction,
} from "@/lib/actions/product";

type Props = {
  productId: string;
  productName: string;
  isActive: boolean;
};

export function ProductRowActions({ productId, productName, isActive }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyLabel, setBusyLabel] = useState<"toggle" | "delete" | null>(null);
  const busy = pending && busyLabel !== null;

  function handleToggle(next: boolean) {
    setBusyLabel("toggle");
    start(async () => {
      try {
        const res = await setProductActiveAction(productId, next);
        if (res.error) toast.error(res.error);
        else router.refresh();
      } finally {
        setBusyLabel(null);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Hapus produk "${productName}"? Riwayat pesanan yang memakai produk ini tetap aman.`)) return;
    setBusyLabel("delete");
    start(async () => {
      try {
        const res = await deleteProductAction(productId);
        if (res.error) toast.error(res.error);
        else {
          toast.success("Produk dihapus.");
          router.refresh();
        }
      } finally {
        setBusyLabel(null);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Aktif
        <Switch
          checked={isActive}
          disabled={busy}
          onCheckedChange={handleToggle}
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        disabled={busy}
        onClick={handleDelete}
        title="Hapus produk"
      >
        <Trash2 className={busyLabel === "delete" ? "animate-pulse" : undefined} />
      </Button>
    </div>
  );
}
