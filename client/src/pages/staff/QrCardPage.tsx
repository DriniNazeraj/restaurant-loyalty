import { PH } from "@/lib/placeholders";
import { Button } from "@/components/ui/button";

export default function QrCardPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">QR table card</h1>
      <p className="mt-1 text-ink-muted">Print a card guests can scan. Preview is a placeholder until the API returns a QR.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium">Headline [PH]</p>
          <p className="mt-1 text-ink-muted">{PH.qrHeadline}</p>
          <p className="mt-4 text-sm font-medium">Small line [PH]</p>
          <p className="mt-1 text-ink-muted">{PH.qrSub}</p>
          <p className="mt-4 text-sm font-medium">Size</p>
          <p className="mt-1 text-ink-muted">A6 card (105×148mm) — default</p>
        </div>

        <div className="flex flex-col items-center">
          <article className="w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-surface shadow-sm print:rounded-none">
            <div className="bg-brand px-4 py-3 text-center font-heading text-lg font-bold text-brand-fg">
              {PH.restaurantName}
            </div>
            <div className="space-y-4 px-6 py-6 text-center">
              <h2 className="font-heading text-3xl font-bold text-ink">{PH.qrHeadline}</h2>
              <div className="mx-auto flex aspect-square w-[70%] items-center justify-center border-4 border-ink bg-white text-xs text-ink-muted">
                QR placeholder
              </div>
              <p className="font-mono text-xs text-ink">[PH-domain]/r/{PH.restaurantSlug}</p>
              <p className="text-sm text-ink-muted">{PH.qrSub}</p>
            </div>
          </article>
          <p className="mt-3 text-sm text-ink-muted">Test it: scan with your phone (link once the API is up).</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="h-12 rounded-xl" type="button" onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="outline" className="h-12 rounded-xl" type="button" disabled>
              Download PNG
            </Button>
            <Button variant="outline" className="h-12 rounded-xl" type="button" disabled>
              Download PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
