"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssetUpload } from "@/components/dashboard/asset-upload";
import { checkSlugAvailability, createStoreAction } from "@/lib/actions/store";
import { suggestSlug } from "@/lib/slug";
import { env } from "@/lib/env";
import type { StoreFormResult } from "@/lib/validation/store";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Buat Toko
    </Button>
  );
}

type SlugState = "idle" | "checking" | "available" | "taken";

export function OnboardingForm() {
  const [state, formAction] = useActionState<StoreFormResult, FormData>(
    createStoreAction,
    null,
  );

  const [name, setName] = useState("");
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [slugMessage, setSlugMessage] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [bannerPath, setBannerPath] = useState<string | null>(null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  // Slug otomatis mengikuti nama selama user belum mengeditnya sendiri —
  // nilai DERIVED saat render, bukan setState di dalam effect.
  const slug = slugOverride ?? suggestSlug(name);

  // Live-check availability: satu-satunya efek samping adalah timer+network.
  useEffect(() => {
    if (slug.length < 3) {
      // reset idle juga di dalam timeout agar tidak setState sinkron
      const t = setTimeout(() => {
        setSlugState("idle");
        setSlugMessage(null);
      }, 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(async () => {
      setSlugState("checking");
      const result = await checkSlugAvailability(slug);
      setSlugState(result.available ? "available" : "taken");
      setSlugMessage(result.message ?? null);
    }, 400);
    return () => clearTimeout(timer);
  }, [slug]);

  if (state?.ok && state.createdSlug) {
    return <SuccessCard slug={state.createdSlug} />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Buat tokomu</CardTitle>
        <CardDescription>
          Tiga isian wajib — nama, alamat link, dan nomor WhatsApp untuk menerima pesanan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nama toko</Label>
            <Input
              id="name"
              name="name"
              placeholder="mis. Toko Kopi Senja"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Alamat toko</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                {new URL(env.APP_URL).host}/
              </span>
              <Input
                id="slug"
                name="slug"
                className="pl-[min(50%,12rem)]"
                placeholder="kopisenja"
                value={slug}
                onChange={(e) =>
                  // Ringan: huruf kecil + buang karakter asing, TAPI biarkan
                  // strip tersisa (termasuk yang baru diketik) utuh.
                  setSlugOverride(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                required
              />
              <span className="absolute inset-y-0 right-3 flex items-center">
                {slugState === "checking" && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {slugState === "available" && <Check className="size-4 text-green-600" />}
                {slugState === "taken" && <X className="size-4 text-destructive" />}
              </span>
            </div>
            <p
              className={
                "text-xs " +
                (slugState === "taken" ? "text-destructive" : "text-muted-foreground")
              }
            >
              {slugMessage ??
                (slugState === "available"
                  ? "Alamat ini tersedia ✔"
                  : "Huruf kecil, angka, dan strip. Ini yang kamu taruh di bio.")}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsapp">Nomor WhatsApp toko</Label>
            <Input
              id="whatsapp"
              name="whatsapp"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="0812-3456-7890"
              minLength={9}
              maxLength={17}
              pattern="[0-9+()\- ]{9,17}"
              title="Nomor seluler Indonesia: 08xx atau +62 8xx"
              required
            />
            <p className="text-xs text-muted-foreground">
              Semua pesanan dari pengunjung masuk ke nomor ini — harus nomor
              seluler (08xx).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tagline">Tagline (opsional)</Label>
            <Input id="tagline" name="tagline" placeholder="Kopi nusantara, disangrai harian" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Deskripsi singkat (opsional)</Label>
            <Textarea id="bio" name="bio" rows={3} placeholder="Ceritakan sedikit tentang tokomu…" />
          </div>

          <div className="flex flex-wrap gap-6">
            <AssetUpload
              purpose="avatar"
              label="Foto profil"
              value={avatarPath}
              onChange={setAvatarPath}
            />
            <div className="flex-1 min-w-56">
              <AssetUpload
                purpose="banner"
                label="Banner (opsional)"
                value={bannerPath}
                onChange={setBannerPath}
                aspect="wide"
              />
            </div>
          </div>

          <input type="hidden" name="avatarPath" value={avatarPath ?? ""} />
          <input type="hidden" name="bannerPath" value={bannerPath ?? ""} />

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

function SuccessCard({ slug }: { slug: string }) {
  const publicUrl = `${env.APP_URL}/${slug}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Link toko disalin — tempel di bio kamu!");
    } catch {
      toast.error("Tidak bisa menyalin otomatis — salin manual ya.");
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-green-600">Toko kamu sudah jadi! 🎉</CardTitle>
        <CardDescription>
          Halaman publik akan aktif penuh di Milestone 3 — tapi nama dan datanya
          sudah tersimpan aman.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
          <code className="flex-1 truncate text-sm">{publicUrl}</code>
          <Button type="button" size="icon" variant="ghost" onClick={copy}>
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard">Lanjut ke Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
