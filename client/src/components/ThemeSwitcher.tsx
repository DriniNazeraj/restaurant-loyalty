/**
 * DEMO ONLY (DESIGN.md §10.4): floating "Palette" pill to compare the five themes.
 * Remove after Drini picks a theme; see the removal checklist in the PR / public/hero/CREDITS.md.
 * Styled with fixed neutral colours so it looks the same in every theme.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, PaletteIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { usePathname } from "@/lib/router-hooks";
import { THEME_IDS, THEMES, setTheme, useActiveTheme, type ThemeId } from "@/lib/theme";

export default function ThemeSwitcher() {
  const active = useActiveTheme();
  const [open, setOpen] = useState(false);
  const rows = useRef<Partial<Record<ThemeId, HTMLButtonElement | null>>>({});
  const pathname = usePathname();
  // Staff phone: sit above the bottom tab bar (shown below lg).
  const staffTabs = pathname.startsWith("/admin") && pathname !== "/admin/login";

  function pick(id: ThemeId) {
    setTheme(id);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const current = THEME_IDS.findIndex((id) => rows.current[id] === document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = THEME_IDS[(current + step + THEME_IDS.length) % THEME_IDS.length];
    rows.current[next]?.focus();
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        data-testid="theme-switcher"
        aria-label={`Theme demo: ${THEMES[active].name}. Change theme`}
        className={`z-50 flex h-11 items-center gap-2 rounded-full bg-black/80 px-4 font-[system-ui] text-sm text-white shadow-lg backdrop-blur focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none ${
          staffTabs
            ? "fixed right-4 bottom-20 lg:bottom-4"
            : // Absolute (not fixed) at the top-right, over the hero on landing, so it
              // scrolls away with the page and never covers the CTA or form fields.
              "absolute top-4 right-4"
        }`}
      >
        <PaletteIcon className="size-4" aria-hidden />
        <span>{THEMES[active].name}</span>
        <span className="text-[10px] tracking-wider opacity-70">DEMO</span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={staffTabs ? "top" : "bottom"}
          align="end"
          sideOffset={8}
          data-testid="theme-switcher-panel"
          className="z-50 w-64 rounded-xl bg-white p-1.5 font-[system-ui] text-neutral-900 shadow-xl ring-1 ring-black/10 outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            rows.current[active]?.focus();
          }}
        >
          <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-neutral-500">Theme demo [PH]</p>
          <div role="radiogroup" aria-label="Theme" onKeyDown={onKeyDown}>
            {THEME_IDS.map((id) => {
              const theme = THEMES[id];
              const checked = id === active;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    rows.current[id] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  data-testid={`theme-option-${id}`}
                  onClick={() => pick(id)}
                  className="flex h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:outline-none"
                >
                  <span className="flex -space-x-1" aria-hidden>
                    {theme.dots.map((color, index) => (
                      <span
                        key={index}
                        className="size-4 rounded-full ring-1 ring-black/15"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="flex-1">{theme.name}</span>
                  {checked ? <CheckIcon className="size-4" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
