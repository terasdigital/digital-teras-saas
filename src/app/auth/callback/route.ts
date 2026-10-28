import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Titik kembali (redirect target) semua alur OAuth / konfirmasi email PKCE.
 * Menukar `code` sekali pakai menjadi sesi (disimpan di cookie).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
