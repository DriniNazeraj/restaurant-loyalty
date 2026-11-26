import { CheckIcon, ClockIcon, MinusIcon, TicketIcon } from "lucide-react";
import type { RewardStatus } from "@/lib/api-types";

/** Status is never colour alone: icon + word every time (DESIGN.md §7). */
export function RewardBadge({ status }: { status: RewardStatus }) {
  const map = {
    active: { label: "Not used", cls: "bg-brand-soft text-ink", Icon: TicketIcon },
    redeemed: { label: "Used", cls: "bg-success/10 text-success", Icon: CheckIcon },
    expired: { label: "Expired", cls: "bg-muted text-ink-muted", Icon: ClockIcon },
  } as const;
  const { label, cls, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export function ConsentBadge({ consented }: { consented: boolean }) {
  return consented ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      <CheckIcon className="size-3" aria-hidden />
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
      <MinusIcon className="size-3" aria-hidden />
      No
    </span>
  );
}
