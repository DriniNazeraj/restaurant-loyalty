import { useSyncExternalStore } from "react";

/**
 * DESIGN.md §10: five themes as `html[data-theme]` CSS variable blocks (styles/themes.css).
 * The DEMO bits (switcher, localStorage, ?theme=, ?themes=1) are temporary; see §10.4 and
 * the removal checklist in client/public/hero/CREDITS.md / the PR body.
 */
export const THEME_IDS = ["trattoria", "minimal", "luxe", "cafe", "rustic"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "trattoria";

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  /** background, primary, ticket: the three dots in the switcher. */
  dots: [string, string, string];
  hero: { small: string; large: string; largeWidth: number; credit: string; url: string };
};

const hero = (id: ThemeId, largeWidth: number, credit: string, url: string) => ({
  small: `/hero/${id}-800.webp`,
  large: `/hero/${id}-${largeWidth}.webp`,
  largeWidth,
  credit,
  url,
});

export const THEMES: Record<ThemeId, ThemeMeta> = {
  trattoria: {
    id: "trattoria",
    name: "Trattoria",
    dots: ["#FBF6EC", "#A4261C", "#3E6B2F"],
    hero: hero("trattoria", 1600, "Cristian Mihaila", "https://www.pexels.com/photo/spaghetti-on-plate-11653569/"),
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    dots: ["#FFFFFF", "#0A0A0A", "#1D4ED8"],
    hero: hero("minimal", 1600, "Wender Junior Souza Vieira", "https://www.pexels.com/photo/empty-restaurant-interior-6429597/"),
  },
  luxe: {
    id: "luxe",
    name: "Dark luxe",
    dots: ["#0E0D0B", "#C9A45C", "#C9A45C"],
    hero: hero("luxe", 1600, "Rachel Claire", "https://www.pexels.com/photo/gourmet-on-a-black-earthenware-5865244/"),
  },
  cafe: {
    id: "cafe",
    name: "Bright cafe",
    dots: ["#FFF9E8", "#C2410C", "#0F766E"],
    hero: hero(
      "cafe",
      1600,
      "Amine Kübranur Çakıroğlu",
      "https://www.pexels.com/photo/cozy-cafe-scene-with-dessert-and-coffee-by-window-38975923/",
    ),
  },
  rustic: {
    id: "rustic",
    name: "Rustic bistro",
    dots: ["#F1E9DA", "#4A5D3A", "#9C3D1F"],
    hero: hero("rustic", 1280, "Maria Orlova", "https://www.pexels.com/photo/banquet-tables-in-restaurant-with-shiny-fireplace-4915622/"),
  },
};

export const THEME_STORAGE_KEY = "rl-theme-demo";
const DEMO_SESSION_KEY = "rl-theme-demo-on";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Each theme's @fontsource CSS is its own chunk, so only the active theme's fonts download. */
const FONT_LOADERS: Record<ThemeId, () => Promise<unknown>> = {
  trattoria: () => import("@/styles/themes/trattoria.fonts.css"),
  minimal: () => import("@/styles/themes/minimal.fonts.css"),
  luxe: () => import("@/styles/themes/luxe.fonts.css"),
  cafe: () => import("@/styles/themes/cafe.fonts.css"),
  rustic: () => import("@/styles/themes/rustic.fonts.css"),
};

export function getActiveTheme(): ThemeId {
  const value = document.documentElement.dataset.theme;
  return isThemeId(value) ? value : DEFAULT_THEME;
}

/** Fonts for whatever index.html's inline script picked before paint. Call once at startup. */
export function loadActiveThemeFonts(): void {
  void FONT_LOADERS[getActiveTheme()]();
}

/** DEMO: shown only with VITE_THEME_DEMO=true or ?themes=1 (kept for this tab once seen). */
export function isThemeDemoEnabled(): boolean {
  if (import.meta.env.VITE_THEME_DEMO === "true") return true;
  try {
    if (new URLSearchParams(window.location.search).get("themes") === "1") {
      sessionStorage.setItem(DEMO_SESSION_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(DEMO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** DEMO: instant switch = one attribute; fonts load lazily; choice persists. */
export function setTheme(id: ThemeId): void {
  void FONT_LOADERS[id]();
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // private mode: the switch still works for this page view
  }
  if (isThemeDemoEnabled()) clearRestaurantTint();
  window.dispatchEvent(new Event(THEME_EVENT));
}

const THEME_EVENT = "rl-theme-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export function useActiveTheme(): ThemeId {
  return useSyncExternalStore(subscribe, getActiveTheme, () => DEFAULT_THEME);
}

const TINT_PROPS = ["--primary", "--primary-foreground", "--ring"] as const;

/**
 * Per-restaurant brand colour tints the theme's primary (v1 behaviour). §10.2: while the demo
 * switcher is on, the theme wins and the restaurant colour is ignored.
 */
export function applyRestaurantTint(brandColor?: string | null): void {
  const root = document.documentElement;
  root.setAttribute("data-restaurant", "");
  // §10.2: while the demo is on the theme wins. A ?theme=<id> link (saved by the inline script in
  // index.html) or an earlier pick counts as demo too, so per-theme links show the real theme colours.
  if (!brandColor || isThemeDemoEnabled() || hasStoredDemoTheme()) {
    clearRestaurantTint();
    return;
  }
  root.style.setProperty("--primary", brandColor);
  root.style.setProperty("--primary-foreground", "#FFFFFF");
  root.style.setProperty("--ring", brandColor);
}

function hasStoredDemoTheme(): boolean {
  try {
    return isThemeId(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return false;
  }
}

function clearRestaurantTint(): void {
  for (const prop of TINT_PROPS) document.documentElement.style.removeProperty(prop);
}
