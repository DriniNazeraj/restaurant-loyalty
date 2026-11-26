const DEFAULT_BRAND = "#B83A22";

/** Sets --brand on :root so restaurant colour is a CSS variable (DESIGN.md §2). */
export function applyRestaurantTheme(brandColor?: string | null): void {
  const root = document.documentElement;
  root.setAttribute("data-restaurant", "");
  root.style.setProperty("--brand", brandColor || DEFAULT_BRAND);
}

export function contrastRatioAgainstWhite(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const l = relativeLuminance(rgb);
  const white = 1;
  const lighter = Math.max(l, white);
  const darker = Math.min(l, white);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isBrandContrastOk(hex: string): boolean {
  const ratio = contrastRatioAgainstWhite(hex);
  return ratio !== null && ratio >= 4.5;
}

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.trim().replace("#", "");
  if (!/^([0-9a-fA-F]{6})$/.test(value)) return null;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}
