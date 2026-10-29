"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { prepareImageUpload } from "@/lib/actions/store";
import { assetUrl, STORE_ASSETS_BUCKET } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

type Props = {
  purpose: "avatar" | "banner" | "produk";
  label: string;
  /** Path tersimpan saat ini (dari DB) — dipakai untuk preview awal. */
  currentPath?: string | null;
  /** Path hasil upload yang belum disimpan — status form. */
  value: string | null;
  onChange: (path: string | null) => void;
  aspect?: "square" | "wide";
};

export function AssetUpload({
  purpose,
  label,
  currentPath,
  value,
  onChange,
  aspect = "square",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const activePath = value ?? currentPath ?? null;
  const preview = assetUrl(activePath);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Ukuran gambar maksimal 2 MB ya.");
      return;
    }
    setUploading(true);
    try {
      const prepared = await prepareImageUpload(purpose, file.name);
      if (!prepared?.path || !prepared.token) {
        toast.error(prepared?.error ?? "Gagal menyiapkan upload.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(STORE_ASSETS_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: file.type || "image/webp",
        });
      if (error) {
        toast.error("Upload gagal — cek koneksi lalu coba lagi.");
        return;
      }
      onChange(prepared.path);
      toast.success(`${label} berhasil diunggah.`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div
        className={
          "relative overflow-hidden rounded-lg border bg-muted " +
          (aspect === "wide" ? "aspect-[3/1] w-full" : "size-24")
        }
      >
        {preview ? (
          <Image
            src={preview}
            alt={label}
            fill
            sizes={aspect === "wide" ? "100vw" : "96px"}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImagePlus className="size-6" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/webp,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {activePath ? "Ganti" : "Pilih gambar"}
        </Button>
        {activePath && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            <X />
            Hapus
          </Button>
        )}
      </div>
    </div>
  );
}
