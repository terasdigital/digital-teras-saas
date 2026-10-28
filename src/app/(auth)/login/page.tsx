import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <Suspense>
      <LoginFormWrapper searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      {error === "google" && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          Login Google gagal. Coba lagi atau pakai email.
        </p>
      )}
      <LoginForm next={next ?? "/dashboard"} />
    </>
  );
}
