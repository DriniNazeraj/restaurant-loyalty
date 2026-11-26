import type { ReactNode } from "react";
import "@/fonts/customer.ts";
import { PH } from "@/lib/placeholders";

export function CustomerLayout({ restaurantName, children }: { restaurantName: string; children: ReactNode }) {
  return (
    <div className="customer-app flex min-h-svh flex-col font-sans">
      <header className="flex h-14 items-center justify-center px-5">
        <p className="font-heading text-lg font-bold text-ink">{restaurantName}</p>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-10">{children}</main>
      <footer className="px-5 pb-8 text-center text-xs text-ink-muted">Powered by {PH.productName}</footer>
    </div>
  );
}
