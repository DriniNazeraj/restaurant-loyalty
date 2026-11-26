import type { ReactNode } from "react";
import { THEMES, useActiveTheme } from "@/lib/theme";

/**
 * DESIGN.md §10.1 photo hero: fixed-height box so the LCP image can't shift layout;
 * header + offer text pinned inside; text sits on at least black/65 (DESIGN.md §10.7).
 * Phone height is 234px (not the spec's 260px) so the CTA stays above the fold on 390×844;
 * desktop stays 340px. Photos are [PH] Pexels stock (see public/hero/CREDITS.md).
 */
export function HeroBand({ restaurantName, children }: { restaurantName: string; children: ReactNode }) {
  const theme = useActiveTheme();
  const photo = THEMES[theme].hero;

  return (
    <div className="relative h-[234px] overflow-hidden bg-neutral-900 sm:h-[340px]" data-testid="hero">
      <img
        key={theme}
        src={photo.small}
        srcSet={`${photo.small} 800w, ${photo.large} ${photo.largeWidth}w`}
        sizes="(min-width: 768px) 768px, 100vw"
        width={1600}
        height={1000}
        fetchPriority="high"
        decoding="async"
        alt=""
        className="absolute inset-0 size-full object-cover"
        data-testid="hero-image"
      />
      <div aria-hidden className="hero-overlay absolute inset-0" />
      <header className="relative z-10 flex h-12 items-center justify-center px-5">
        <p className="font-heading text-lg font-bold text-white" data-testid="hero-wordmark">{restaurantName}</p>
      </header>
      <div className="hero-text-scrim absolute inset-x-0 bottom-0 z-10 min-h-[11.25rem] sm:min-h-[13.5rem]">
        <div className="mx-auto w-full max-w-md px-5 pb-10 text-white">{children}</div>
        {/* §10.1 says bottom-7 py-1; that box overlaps the subline by 12px at 390. bottom-6 sits it
            exactly on the card overlap edge with no overlap. */}
        <a
          href={photo.url}
          target="_blank"
          rel="noopener"
          className="absolute right-2 bottom-6 text-[11px] text-white underline-offset-2 hover:underline"
          data-testid="hero-credit"
        >
          Photo: {photo.credit} / Pexels [PH]
        </a>
      </div>
    </div>
  );
}
