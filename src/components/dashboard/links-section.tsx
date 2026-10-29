"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LinkIcon } from "@/components/storefront/link-icon";
import {
  addLinkAction,
  deleteLinkAction,
  setLinkEnabledAction,
} from "@/lib/actions/link";
import { LINK_ICONS } from "@/lib/validation/link";
import type { LinkRow, LinkUsage } from "@/lib/db/queries/dashboard";

type Props = {
  links: LinkRow[];
  usage: LinkUsage;
};

export function LinksSection({ links, usage }: Props) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState<string>("instagram");
  const [adding, startAdd] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("label", label);
    fd.set("url", url);
    fd.set("icon", icon);
    startAdd(async () => {
      const res = await addLinkAction(null, fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setLabel("");
      setUrl("");
      toast.success("Tautan ditambahkan.");
      router.refresh();
    });
  }

  function run(id: string, fn: () => Promise<{ error?: string } | null>, okMsg?: string) {
    setBusyId(id);
    void startAdd(async () => {
      try {
        const res = await fn();
        if (res?.error) toast.error(res.error);
        else if (okMsg) toast.success(okMsg);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tautan Sosial</CardTitle>
        <CardDescription>
          Muncul di etalase publik, berurutan sesuai penambahan.{" "}
          {usage.limit !== null && (
            <span className="font-medium text-foreground">
              {usage.used}/{usage.limit} terpakai
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {links.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {links.map((link) => (
              <li key={link.id} className="flex items-center gap-3 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-neutral-600">
                  <LinkIcon icon={link.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={"truncate text-sm font-medium " + (link.enabled ? "" : "text-muted-foreground line-through")}>
                    {link.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                </div>
                <Switch
                  checked={link.enabled}
                  disabled={busyId === link.id}
                  onCheckedChange={(next) =>
                    run(link.id, () => setLinkEnabledAction(link.id, next))
                  }
                  title={link.enabled ? "Tampilkan di etalase" : "Sembunyikan"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={busyId === link.id}
                  onClick={() => {
                    if (window.confirm(`Hapus tautan "${link.label}"?`)) {
                      run(link.id, () => deleteLinkAction(link.id), "Tautan dihapus.");
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-36 flex-1 flex-col gap-1">
            <label htmlFor="link-label" className="text-xs text-muted-foreground">
              Label
            </label>
            <Input
              id="link-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Instagram kita"
              required
            />
          </div>
          <div className="flex min-w-44 flex-[1.5] flex-col gap-1">
            <label htmlFor="link-url" className="text-xs text-muted-foreground">
              URL
            </label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="instagram.com/namatoko"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="link-icon" className="text-xs text-muted-foreground">
              Ikon
            </label>
            <select
              id="link-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {LINK_ICONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={adding || (usage.can === false)}>
            {adding && <Loader2 className="animate-spin" />}
            Tambah
          </Button>
        </form>
        {usage.can === false && (
          <p className="text-xs text-amber-600">
            Batas tautan paket tercapai — upgrade hadir di Milestone 7.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
