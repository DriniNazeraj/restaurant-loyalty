import type { ReactNode } from "react";
import { HeroBand } from "@/components/customer/HeroBand";
import { PH } from "@/lib/placeholders";

type Props = {
  restaurantName: string;
  children: ReactNode;
  gap?: "gap-3" | "gap-6";
  /** Landing only (§10.1): offer text rendered inside the photo hero; the content overlaps it by 24px. */
  hero?: ReactNode;
};

export function CustomerLayout({ restaurantName, children, gap = "gap-6", hero }: Props) {
  return (
    <div className="customer-app flex min-h-svh flex-col font-sans">
      {hero ? (
        <HeroBand restaurantName={restaurantName}>{hero}</HeroBand>
      ) : (
        <header className="flex h-12 items-center justify-center px-5">
          <p className="font-heading text-lg font-bold text-ink">{restaurantName}</p>
        </header>
      )}
      <main
        className={`mx-auto flex w-full max-w-md flex-1 flex-col ${gap} px-5 pb-10 ${hero ? "relative z-10 -mt-6" : ""}`}
      >
        {children}
      </main>
      <footer className="px-5 pb-8 text-center text-xs text-ink-muted">Powered by {PH.productName}</footer>
    </div>
  );
}
