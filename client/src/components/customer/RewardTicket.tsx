import { useEffect, useState } from "react";
import { formatDate, formatTime } from "@/lib/format";
import { spellRewardCode } from "@/lib/reward-code";
import type { RewardStatus } from "@/lib/api-types";

type RewardTicketProps = {
  code: string;
  title: string;
  guestName: string;
  status: RewardStatus;
  redeemedAt?: string | null;
  expiresAt?: string | null;
  terms: string;
};

export function RewardTicket({ code, title, guestName, status, redeemedAt, expiresAt, terms }: RewardTicketProps) {
  const band =
    status === "redeemed" ? "bg-success text-white" : status === "expired" ? "bg-ink-muted text-white" : "bg-gold text-ink";
  const bandLabel = status === "redeemed" ? "ENJOYED ✓" : status === "expired" ? "EXPIRED" : title.toUpperCase();
  const line =
    status === "redeemed"
      ? `Redeemed ${isToday(redeemedAt) ? "today" : `on ${formatDate(redeemedAt)}`} at ${formatTime(redeemedAt)}`
      : status === "expired"
        ? `This reward expired on ${formatDate(expiresAt)}.`
        : `Hi ${guestName}, show this to your waiter`;

  return (
    <article
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-lg"
      data-status={status}
      data-testid="reward-ticket"
    >
      <div
        className={`relative overflow-hidden px-6 py-3 text-center font-heading text-sm font-bold tracking-[0.16em] ${band}`}
      >
        <span aria-live="polite">{bandLabel}</span>
        {status === "active" ? (
          <span
            aria-hidden
            className="ticket-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
          />
        ) : null}
      </div>
      <div className="relative px-6 pt-5 pb-6">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-3 flex justify-between px-3">
          <span className="size-6 rounded-full bg-bg" />
          <span className="size-6 rounded-full bg-bg" />
        </div>
        <div className="mb-4 border-t border-dashed border-line" />
        <p className="text-lg text-ink" aria-live="polite">
          {line}
        </p>
        <p
          data-testid="reward-code"
          className={`mt-4 text-center font-mono text-[40px] leading-none font-bold tracking-[0.2em] text-ink sm:text-5xl ${
            status !== "active" ? "line-through opacity-50" : ""
          }`}
          aria-label={`Reward code ${spellRewardCode(code)}`}
        >
          {code}
        </p>
        {status === "active" ? <LiveProof /> : null}
        <p className="mt-4 text-xs text-ink-muted">{terms}</p>
      </div>
    </article>
  );
}

/** Date + ticking HH:MM:SS so a waiter can tell a live screen from a screenshot. */
function LiveProof() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Tirane",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Tirane",
  }).format(now);
  return (
    <p className="mt-4 text-center text-sm text-ink-muted tabular-nums">
      {date} · <span className="font-mono">{time}</span>
    </p>
  );
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane" }).format(d);
  return fmt(new Date(iso)) === fmt(new Date());
}
