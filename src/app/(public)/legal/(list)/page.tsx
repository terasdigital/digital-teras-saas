import { redirect } from "next/navigation";

// /legal tanpa sub-path → arahkan ke Syarat
export default function LegalIndex() {
  redirect("/legal/terms");
}
