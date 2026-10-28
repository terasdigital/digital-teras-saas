"use client";

import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  registerAction,
  googleLoginAction,
} from "@/lib/actions/auth";
import type { AuthResult } from "@/lib/validation/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Daftar
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<AuthResult, FormData>(
    registerAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.notice) toast.success(state.notice);
  }, [state]);

  return (
    <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Buat akun</h1>
        <p className="text-sm text-muted-foreground">
          Gratis — tokomu jadi dalam hitungan menit.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nama</Label>
          <Input
            id="fullName"
            name="fullName"
            placeholder="Nama kamu"
            autoComplete="name"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="kamu@email.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>
        </div>
        <SubmitButton />
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">atau</span>
        <Separator className="flex-1" />
      </div>

      <form action={googleLoginAction}>
        <Button type="submit" variant="outline" className="w-full">
          Daftar dengan Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Masuk
        </Link>
      </p>
    </div>
  );
}
