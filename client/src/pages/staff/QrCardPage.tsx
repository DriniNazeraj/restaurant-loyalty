import { useEffect, useMemo, useState } from "react";
import { CopyIcon, DownloadIcon, Loader2Icon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/staff/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import type { QrResponse } from "@/lib/api-types";
import { getStaffToken } from "@/lib/auth";
import { PH } from "@/lib/placeholders";
import { PAGE_MM, downloadPdf, downloadPng, renderDataUrl, type CardOptions, type CardSize } from "@/lib/qr-card";

export default function QrCardPage() {
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headline, setHeadline] = useState<string>(PH.qrHeadline);
  const [smallLine, setSmallLine] = useState<string>(PH.qrSub);
  const [showWordmark, setShowWordmark] = useState(true);
  const [size, setSize] = useState<CardSize>("a6");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "png" | "pdf" | "print">(null);

  useEffect(() => {
    const token = getStaffToken();
    if (!token) return;
    api
      .getQr(token)
      .then(setQr)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't load the QR code."));
  }, []);

  const opts = useMemo<CardOptions | null>(
    () =>
      qr
        ? {
            size,
            restaurantName: qr.restaurant.name,
            headline: headline.trim() || PH.qrHeadline,
            smallLine: smallLine.trim(),
            url: qr.landingUrl,
            showWordmark,
            brandColor: qr.restaurant.brandColor,
          }
        : null,
    [qr, size, headline, smallLine, showWordmark],
  );

  // Live preview: the same 300 dpi render used for print / PNG / PDF (debounced).
  useEffect(() => {
    if (!opts) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void renderDataUrl(opts)
        .then((url) => !cancelled && setPreview(url))
        .catch(() => undefined);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [opts]);

  const fileBase = `qr-card-${qr?.restaurant.slug ?? "restaurant"}-${size}`;

  async function run(kind: "png" | "pdf" | "print") {
    if (!opts) return;
    setBusy(kind);
    try {
      if (kind === "png") await downloadPng(opts, `${fileBase}.png`);
      else if (kind === "pdf") await downloadPdf(opts, `${fileBase}.pdf`);
      else printCard(await renderDataUrl(opts), size);
    } catch {
      toast.error("Couldn't create the card. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.landingUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  const page = PAGE_MM[size];

  return (
    <div>
      <PageHeader title="QR table card" description="Print a card for each table. Guests scan it to claim their reward." />
      {error ? (
        <p role="alert" className="mt-6 rounded-2xl border border-danger/30 bg-danger/5 p-4 text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-headline">Headline</Label>
            <Input id="qr-headline" maxLength={40} value={headline} onChange={(e) => setHeadline(e.target.value)} className="h-11 rounded-xl text-base" />
            <p className="text-xs text-ink-muted">{headline.length} / 40</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-small">Small line</Label>
            <Input id="qr-small" maxLength={50} value={smallLine} onChange={(e) => setSmallLine(e.target.value)} className="h-11 rounded-xl text-base" />
            <p className="text-xs text-ink-muted">{smallLine.length} / 50</p>
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="qr-logo">Show logo</Label>
            <Switch id="qr-logo" checked={showWordmark} onCheckedChange={setShowWordmark} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Size</Label>
            <Tabs value={size} onValueChange={(v) => setSize(v as CardSize)}>
              <TabsList className="grid h-11 w-full grid-cols-3">
                <TabsTrigger value="a6">A6 card</TabsTrigger>
                <TabsTrigger value="a5">A5</TabsTrigger>
                <TabsTrigger value="tent">Table tent</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-ink-muted">
              {page.w}×{page.h} mm{size === "tent" ? " · fold along the dashed line" : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div
            className="w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
            style={{ aspectRatio: `${page.w} / ${page.h}` }}
            data-testid="qr-preview"
          >
            {preview ? (
              <img src={preview} alt={`QR card preview for ${qr?.restaurant.name ?? ""}`} className="size-full" />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-ink-muted">
                <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden /> Preparing preview…
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-sm text-ink-muted">
            Test it: scan with your phone
            {qr ? (
              <>
                {" "}
                · <span className="font-mono text-xs">{qr.landingUrl}</span>
              </>
            ) : null}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button className="h-11 rounded-xl" disabled={!opts || !!busy} onClick={() => void run("print")}>
              {busy === "print" ? <Loader2Icon className="size-4 animate-spin" /> : <PrinterIcon className="size-4" />}
              Print
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" disabled={!opts || !!busy} onClick={() => void run("png")}>
              {busy === "png" ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
              Download PNG
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" disabled={!opts || !!busy} onClick={() => void run("pdf")}>
              {busy === "pdf" ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
              Download PDF
            </Button>
            <Button variant="ghost" className="h-11 rounded-xl" disabled={!qr} onClick={() => void copyLink()}>
              <CopyIcon className="size-4" />
              Copy link
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Prints only the card image at its exact page size (app chrome hidden). */
function printCard(dataUrl: string, size: CardSize) {
  const page = PAGE_MM[size];
  const style = document.createElement("style");
  style.textContent = `@page { size: ${page.w}mm ${page.h}mm; margin: 0 }
@media print {
  body > *:not(#qr-print-root) { display: none !important; }
  #qr-print-root { display: block !important; }
  #qr-print-root img { width: ${page.w}mm; height: ${page.h}mm; display: block; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
#qr-print-root { display: none; }`;
  const root = document.createElement("div");
  root.id = "qr-print-root";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "";
  root.appendChild(img);
  document.head.appendChild(style);
  document.body.appendChild(root);
  const cleanup = () => {
    style.remove();
    root.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  img.onload = () => window.print();
}
