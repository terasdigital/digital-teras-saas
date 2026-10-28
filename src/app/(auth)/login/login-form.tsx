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
  loginAction,
  googleLoginAction,
} from "@/lib/actions/auth";
import type { AuthResult } from "@/lib/validation/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Masuk
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<AuthResult, FormData>(
    loginAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.notice) toast.success(state.notice);
  }, [state]);

  return (
    <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Masuk</h1>
        <p className="text-sm text-muted-foreground">
          Selamat datang kembali di terasmu.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
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
            autoComplete="current-password"
            required
          />
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
          Masuk dengan Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
          Daftar
        </Link>
      </p>
    </div>
  );
}
