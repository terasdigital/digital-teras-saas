"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AssetUpload } from "@/components/dashboard/asset-upload";
import { updateStoreAction } from "@/lib/actions/store";
import { formatWhatsappLocal } from "@/lib/wa-number";

type StoreFormProps = {
  store: {
    slug: string;
    name: string;
    tagline: string | null;
    bio: string | null;
    whatsapp: string;
    published: boolean;
    avatarPath: string | null;
    bannerPath: string | null;
  };
};

export function StoreForm({ store }: StoreFormProps) {
  const router = useRouter();
  const [saving, startSave] = useTransition();

  // Jangan duplikasi state dari props: selama user belum menyentuh switch,
  // nilai mengikuti data server terbaru (override = null).
  const [publishedOverride, setPublishedOverride] = useState<boolean | null>(null);
  const published = publishedOverride ?? store.published;
  const [avatarPath, setAvatarPath] = useState<string | null>(store.avatarPath);
  const [bannerPath, setBannerPath] = useState<string | null>(store.bannerPath);

  /**
   * Submit imperatif (bukan useActionState) dengan sengaja:
   * - toast ditembakkan dari handler, BUKAN dari effect — jadi tidak hilang
   *   walau komponen di-remount oleh key={updated_at} setelah simpan;
   * - tidak ada action-state ter-serialisasi yang bisa ter-replay saat user
   *   kembali ke halaman (bug "toast palsu").
   * Form ini toh butuh JS (Switch & uploaderSigned-URL), jadi tanpa atribut
   * `action` pun tidak ada regresi progresif yang berarti.
   */
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSave(async () => {
      const result = await updateStoreAction(null, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.ok) {
        toast.success("Perubahan tersimpan.");
        setPublishedOverride(null);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nama toko</Label>
            <Input id="name" name="name" defaultValue={store.name} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Alamat toko</Label>
            <Input value={`/${store.slug}`} readOnly className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Alamat tidak bisa diganti — bikin toko baru kalau perlu (satu akun
              satu toko untuk sekarang).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsapp">Nomor WhatsApp</Label>
            <Input
              id="whatsapp"
              name="whatsapp"
              inputMode="tel"
              autoComplete="tel-national"
              minLength={9}
              maxLength={17}
              pattern="[0-9+()\- ]{9,17}"
              title="Nomor seluler Indonesia: 08xx atau +62 8xx"
              defaultValue={formatWhatsappLocal(store.whatsapp)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Tujuan semua pesanan checkout WhatsApp masuk — harus nomor seluler
              (08xx).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" name="tagline" defaultValue={store.tagline ?? ""} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Deskripsi</Label>
            <Textarea id="bio" name="bio" rows={3} defaultValue={store.bio ?? ""} />
          </div>

          <div className="flex flex-wrap gap-6">
            <AssetUpload
              purpose="avatar"
              label="Foto profil"
              value={avatarPath}
              onChange={setAvatarPath}
            />
            <div className="min-w-56 flex-1">
              <AssetUpload
                purpose="banner"
                label="Banner"
                value={bannerPath}
                onChange={setBannerPath}
                aspect="wide"
              />
            </div>
          </div>

          <input type="hidden" name="avatarPath" value={avatarPath ?? ""} />
          <input type="hidden" name="bannerPath" value={bannerPath ?? ""} />

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Tampilkan toko ke publik</p>
              <p className="text-xs text-muted-foreground">
                Matikan sementara saat kamu belum siap menerima pesanan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {published && <input type="hidden" name="published" value="on" />}
              <Switch checked={published} onCheckedChange={setPublishedOverride} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Simpan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
