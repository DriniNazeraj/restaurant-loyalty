/**
 * Renders the printable QR table card (DESIGN.md §4.5 / §6) to a canvas at 300 dpi.
 * `qrcode` and `jspdf` are dynamically imported so they never touch the landing bundle.
 */
export type CardSize = "a6" | "a5" | "tent";

export type CardOptions = {
  size: CardSize;
  restaurantName: string;
  headline: string;
  smallLine: string;
  url: string;
  showWordmark: boolean;
  brandColor: string;
};

export const PAGE_MM: Record<CardSize, { w: number; h: number; label: string }> = {
  a6: { w: 105, h: 148, label: "A6 card" },
  a5: { w: 148, h: 210, label: "A5" },
  tent: { w: 148, h: 210, label: "Table tent" },
};

const DPI = 300;
const PX_PER_MM = DPI / 25.4;
const PT = DPI / 72; // px per typographic point at 300 dpi
const INK = "#2B1D16";
const MUTED = "#6B5B52";

export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

type QrModules = { size: number; get: (x: number, y: number) => boolean };

async function qrModules(url: string): Promise<QrModules> {
  const QR = await import("qrcode");
  const qr = QR.create(url, { errorCorrectionLevel: "M" });
  const { size, data } = qr.modules;
  return { size, get: (x, y) => Boolean(data[y * size + x]) };
}

function drawQr(ctx: CanvasRenderingContext2D, qr: QrModules, x: number, y: number, side: number) {
  const quiet = 4; // 4-module quiet zone
  const total = qr.size + quiet * 2;
  const cell = side / total;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, side, side);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.get(c, r)) {
        ctx.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** One card face in a w×h px box; scales print sizes from the A6 spec. */
function drawFace(ctx: CanvasRenderingContext2D, qr: QrModules, opts: CardOptions, x: number, y: number, w: number, h: number) {
  const mm = PX_PER_MM;
  const landscape = w > h;
  const scale = landscape ? h / (148 * mm) : w / (105 * mm); // relative to A6 portrait
  const k = Math.max(scale, 0.7);

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);

  const bandH = (landscape ? 14 : 18) * mm * (landscape ? 1 : k);
  ctx.fillStyle = opts.brandColor;
  ctx.fillRect(0, 0, w, bandH);
  if (opts.showWordmark) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${14 * PT * k}px ${themeFont("--font-heading")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.restaurantName, w / 2, bandH / 2, w - 10 * mm);
  }

  const pad = 8 * mm * k;
  ctx.textBaseline = "alphabetic";

  if (!landscape) {
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = `700 ${22 * PT * k}px ${themeFont("--font-heading")}`;
    const lineH = 26 * PT * k;
    let cy = bandH + pad + 20 * PT * k;
    for (const l of wrap(ctx, opts.headline, w - pad * 2).slice(0, 3)) {
      ctx.fillText(l, w / 2, cy);
      cy += lineH;
    }
    const qrSide = 45 * mm * k;
    const qrY = cy - lineH + 6 * mm * k;
    drawQr(ctx, qr, (w - qrSide) / 2, qrY, qrSide);
    let ty = qrY + qrSide + 6 * mm * k;
    ctx.font = `700 ${8 * PT * k}px "JetBrains Mono", monospace`;
    ctx.fillStyle = INK;
    ctx.fillText(shortUrl(opts.url), w / 2, ty, w - pad * 2);
    ty += 7 * mm * k;
    ctx.font = `400 ${10 * PT * k}px ${themeFont("--font-body")}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(opts.smallLine, w / 2, ty, w - pad * 2);
  } else {
    const qrSide = Math.min(45 * mm, h - bandH - pad * 2);
    const qrX = w - pad - qrSide;
    const qrY = bandH + (h - bandH - qrSide) / 2;
    drawQr(ctx, qr, qrX, qrY, qrSide);
    const textW = qrX - pad * 2;
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = `700 ${22 * PT}px ${themeFont("--font-heading")}`;
    let cy = bandH + pad + 22 * PT;
    for (const l of wrap(ctx, opts.headline, textW).slice(0, 3)) {
      ctx.fillText(l, pad, cy);
      cy += 26 * PT;
    }
    cy += 4 * mm;
    ctx.font = `400 ${10 * PT}px ${themeFont("--font-body")}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(opts.smallLine, pad, cy, textW);
    cy += 8 * mm;
    ctx.font = `700 ${8 * PT}px "JetBrains Mono", monospace`;
    ctx.fillStyle = INK;
    ctx.fillText(shortUrl(opts.url), pad, cy, textW);
  }
  ctx.restore();
}

/** The active theme's font stacks (DESIGN.md §10.2), so the printed card matches the app. */
function themeFont(variable: "--font-heading" | "--font-body"): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "sans-serif";
}

export async function renderCard(opts: CardOptions): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const qr = await qrModules(opts.url);
  const page = PAGE_MM[opts.size];
  const w = Math.round(page.w * PX_PER_MM);
  const h = Math.round(page.h * PX_PER_MM);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  if (opts.size === "tent") {
    // A5 folded in half: two landscape faces; the top one is upside down so both read correctly when standing.
    const faceH = h / 2;
    ctx.save();
    ctx.translate(w, faceH);
    ctx.rotate(Math.PI);
    drawFace(ctx, qr, opts, 0, 0, w, faceH);
    ctx.restore();
    drawFace(ctx, qr, opts, 0, faceH, w, faceH);
    ctx.setLineDash([12, 12]);
    ctx.strokeStyle = "#EADFD3";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, faceH);
    ctx.lineTo(w, faceH);
    ctx.stroke();
  } else {
    drawFace(ctx, qr, opts, 0, 0, w, h);
  }
  return canvas;
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

export async function downloadPng(opts: CardOptions, filename: string): Promise<void> {
  const canvas = await renderCard(opts);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't create PNG");
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPdf(opts: CardOptions, filename: string): Promise<void> {
  const [canvas, { jsPDF }] = await Promise.all([renderCard(opts), import("jspdf")]);
  const page = PAGE_MM[opts.size];
  const pdf = new jsPDF({ unit: "mm", format: [page.w, page.h], orientation: "portrait" });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, page.w, page.h);
  pdf.save(filename);
}

export async function renderDataUrl(opts: CardOptions): Promise<string> {
  const canvas = await renderCard(opts);
  return canvas.toDataURL("image/png");
}
