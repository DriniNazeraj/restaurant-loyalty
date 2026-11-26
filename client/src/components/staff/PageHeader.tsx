import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-ink-muted">{description}</p>
      </div>
      {actions}
    </div>
  );
}
