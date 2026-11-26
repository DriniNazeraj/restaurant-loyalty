import { useEffect } from "react";
import "@/fonts/customer.ts";
import { readDocumentMeta, setDocumentMeta } from "@/lib/document-meta";
import { PH } from "@/lib/placeholders";

/** DESIGN.md §8c: calm cream 404, no links to staff pages. */
export default function NotFoundPage() {
  useEffect(() => {
    const previous = readDocumentMeta();
    setDocumentMeta({ title: `Nothing here · ${PH.productName}`, description: "This page doesn't exist." });
    return () => setDocumentMeta(previous);
  }, []);

  return (
    <div className="customer-app flex min-h-svh flex-col font-sans">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <h1 className="font-heading text-3xl leading-tight font-bold text-ink">Nothing here</h1>
        <p className="mt-3 text-lg text-ink-muted">This page doesn't exist. If you scanned a table card, ask your waiter.</p>
      </main>
      <footer className="px-5 pb-8 text-center text-xs text-ink-muted">Powered by {PH.productName}</footer>
    </div>
  );
}
