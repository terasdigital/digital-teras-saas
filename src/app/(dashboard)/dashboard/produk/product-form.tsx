"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AssetUpload } from "@/components/dashboard/asset-upload";
import { saveProductAction } from "@/lib/actions/product";

type Row = {
  id: string | null;
  name: string;
  priceInput: string;
  stockInput: string; // '' = stok tidak dilacak
};

type Initial = {
  name: string;
  description: string;
  imagePath: string | null;
  variants: Row[];
  hasVariants: boolean;
};

type Props = {
  productId?: string | null;
  initial?: Initial | null;
  variantLimit: number | null;
};

const emptyRow = (): Row => ({ id: null, name: "", priceInput: "", stockInput: "" });

export function ProductForm({ productId = null, initial = null, variantLimit }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();

  const [hasVariants, setHasVariants] = useState(initial?.hasVariants ?? false);
  const [rows, setRows] = useState<Row[]>(
    initial?.variants?.length ? initial.variants : [emptyRow()],
  );
  const [imagePath, setImagePath] = useState<string | null>(initial?.imagePath ?? null);

  // pernah punya varian lalu mode single → varian lain akan dihapus saat simpan
  const willDropVariants =
    !hasVariants && initial != null && initial.variants.length > 1;

  const limitEffective = variantLimit ?? 30;

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    if (rows.length >= limitEffective) {
      toast.error(
        variantLimit != null
          ? `Paket kamu membolehkan maks ${variantLimit} varian per produk — kurangi atau upgrade ya.`
          : "Maksimal 30 varian.",
      );
      return;
    }
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const src = new FormData(e.currentTarget);
    const fd = new FormData();
    fd.set("name", String(src.get("name") ?? ""));
    fd.set("description", String(src.get("description") ?? ""));
    fd.set("imagePath", imagePath ?? "");
    fd.set("hasVariants", hasVariants ? "on" : "");
    fd.set(
      "variantsJson",
      JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          name: hasVariants ? r.name : "Default",
          priceInput: r.priceInput,
          stockInput: r.stockInput,
        })),
      ),
    );

    startSave(async () => {
      const res = await saveProductAction(productId, fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res?.ok) {
        toast.success(initial ? "Produk diperbarui." : "Produk ditambahkan.");
        router.push("/dashboard/produk");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nama produk</Label>
            <Input
              id="name"
              name="name"
              placeholder="mis. Keripik Singkong Balado"
              defaultValue={initial?.name}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Rasa, berat, cara penyimpanan…"
              defaultValue={initial?.description}
            />
          </div>

          <AssetUpload
            purpose="produk"
            label="Foto produk"
            value={imagePath}
            onChange={setImagePath}
          />

          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Punya varian (ukuran/warna/etc.)?</p>
                <p className="text-xs text-muted-foreground">
                  Mati = satu harga &amp; stok untuk produk ini.
                </p>
              </div>
              <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
            </div>

            {willDropVariants && (
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                ⚠ Semua varian lama (kecuali yang pertama) akan dihapus saat menyimpan.
                Riwayat pesanan yang sudah masuk tetap aman.
              </p>
            )}

            {rows.slice(0, hasVariants ? rows.length : 1).map((row, i) => (
              <div
                key={row.id ?? `new-${i}`}
                className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
              >
                {hasVariants && (
                  <div className="flex min-w-36 flex-1 flex-col gap-1">
                    <Label className="text-xs text-muted-foreground" htmlFor={`v-name-${i}`}>
                      Nama varian
                    </Label>
                    <Input
                      id={`v-name-${i}`}
                      placeholder="merah · L"
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex w-40 flex-col gap-1">
                  <Label className="text-xs text-muted-foreground" htmlFor={`v-price-${i}`}>
                    Harga (Rp)
                  </Label>
                  <Input
                    id={`v-price-${i}`}
                    inputMode="numeric"
                    placeholder="25.000"
                    value={row.priceInput}
                    onChange={(e) => updateRow(i, { priceInput: e.target.value })}
                    required
                  />
                </div>
                <div className="flex w-32 flex-col gap-1">
                  <Label className="text-xs text-muted-foreground" htmlFor={`v-stock-${i}`}>
                    Stok
                  </Label>
                  <Input
                    id={`v-stock-${i}`}
                    inputMode="numeric"
                    placeholder="—"
                    value={row.stockInput}
                    onChange={(e) => updateRow(i, { stockInput: e.target.value })}
                    title="Kosongkan bila stok tidak dilacak"
                  />
                </div>
                {hasVariants && rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(i)}
                    title="Hapus varian"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}

            {!hasVariants && (
              <p className="text-xs text-muted-foreground">
                Kolom Stok kosong = tidak dilacak. Setelah varian dibuat, harganya
                yang menentukan tampilan &ldquo;mulai dari&rdquo; di etalase.
              </p>
            )}

            {hasVariants && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={addRow}
                disabled={rows.length >= limitEffective}
              >
                <Plus />
                Tambah varian
                {variantLimit != null && (
                  <span className="text-xs text-muted-foreground">
                    ({rows.length}/{variantLimit})
                  </span>
                )}
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" asChild>
              <Link href="/dashboard/produk">Batal</Link>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {initial ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
