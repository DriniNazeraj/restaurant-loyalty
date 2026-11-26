import { useEffect, useState } from "react";
import { spellRewardCode } from "@/lib/reward-code";
import { PH } from "@/lib/placeholders";

type TicketState = "active" | "redeemed" | "expired";

type RewardTicketProps = {
  code: string;
  guestName: string;
  state?: TicketState;
  redeemedAt?: string | null;
  expiredOn?: string | null;
};

export function RewardTicket({
  code,
  guestName,
  state = "active",
  redeemedAt,
  expiredOn,
}: RewardTicketProps) {
  const clock = useTickingClock();
  const band =
    state === "redeemed"
      ? "bg-success text-white"
      : state === "expired"
        ? "bg-ink-muted text-white"
        : "bg-gold text-ink";
  const bandLabel =
    state === "redeemed" ? "ENJOYED ✓" : state === "expired" ? "EXPIRED" : PH.rewardBand;

  return (
    <article className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-lg">
      <div className={`relative px-6 py-3 text-center font-heading text-sm font-bold tracking-[0.16em] ${band}`}>
        {bandLabel}
        {state === "active" ? (
          <span
            aria-hidden
            className="ticket-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
          />
        ) : null}
      </div>
      <div className="relative px-6 pb-6 pt-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-3 flex justify-between px-3"
        >
          <span className="size-6 rounded-full bg-bg" />
          <span className="size-6 rounded-full bg-bg" />
        </div>
        <div className="mb-4 border-t border-dashed border-line" />
        <p className="text-lg text-ink">
          {state === "redeemed"
            ? `Redeemed today at ${formatRedeemedTime(redeemedAt)}`
            : state === "expired"
              ? `This reward expired on ${expiredOn ?? "—"}.`
              : `Hi ${guestName}, show this to your waiter`}
        </p>
        <p
          className={`mt-4 text-center font-mono text-[40px] font-bold tracking-[0.2em] text-ink sm:text-5xl ${
            state === "redeemed" ? "line-through opacity-50" : ""
          }`}
          aria-label={spellRewardCode(code)}
        >
          {code}
        </p>
        {state === "active" ? (
          <p className="mt-4 text-center text-sm text-ink-muted" aria-live="polite">
            {clock}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-ink-muted">{PH.rewardTerms}</p>
      </div>
    </article>
  );
}

function useTickingClock(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Tirane",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function formatRedeemedTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Tirane",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
