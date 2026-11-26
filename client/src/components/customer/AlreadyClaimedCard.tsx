import { TicketCheckIcon } from "lucide-react";
import type { RewardStatus } from "@/lib/api-types";

const STATUS_WORD: Record<RewardStatus, string> = {
  active: "Not used yet",
  redeemed: "Used",
  expired: "Expired",
};

type AlreadyClaimedCardProps = {
  last2?: string;
  status?: RewardStatus;
  firstName?: string;
};

/** DESIGN.md §3.3: no gold ticket, masked code only, no retry / reveal. */
export function AlreadyClaimedCard({ last2, status, firstName }: AlreadyClaimedCardProps) {
  return (
    <section
      data-testid="claim-already"
      className="theme-card rounded-2xl border border-line bg-surface p-6 shadow-sm"
      aria-live="polite"
    >
      <TicketCheckIcon className="size-8 text-ink-muted" aria-hidden />
      <h2 className="mt-3 font-heading text-2xl font-bold text-ink">
        {firstName ? `You've already claimed this, ${firstName}` : "You've already claimed this"}
      </h2>
      {last2 ? (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className="font-mono text-2xl font-bold tracking-[0.2em] text-ink-muted"
            aria-label={`Code ending in ${last2.split("").join(" ")}`}
          >
            •••• {last2}
          </span>
          {status ? <span className="text-sm font-semibold text-ink">{STATUS_WORD[status]}</span> : null}
        </p>
      ) : status ? (
        <p className="mt-4 text-sm font-semibold text-ink">{STATUS_WORD[status]}</p>
      ) : null}
      <p className="mt-4 text-ink-muted">
        Open it on the phone you claimed with, or ask your waiter. They can find your reward with your phone number.
      </p>
    </section>
  );
}
