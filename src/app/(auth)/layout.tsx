import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mx-auto mb-8 block w-fit text-xl font-bold tracking-tight"
        >
          Digital Teras
        </Link>
        {children}
      </div>
    </main>
  );
}
