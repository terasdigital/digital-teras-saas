import Link from "next/link";
import { Zap } from "lucide-react";

/** Badge Free-plan — plan berbayar boleh menyembunyikannya (M6/M7). */
export function BrandingBadge() {
  return (
    <div className="flex justify-center pb-6 pt-2">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-full border bg-white/90 px-3.5 py-1.5 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur transition-colors hover:text-neutral-900"
      >
        <Zap className="size-3 fill-amber-400 text-amber-400" />
        Dibuat dengan Digital Teras
      </Link>
    </div>
  );
}
