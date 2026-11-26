import { CheckCircle2Icon, ClockIcon, Loader2Icon, TriangleAlertIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RedeemResult } from "@/lib/redeem-result";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";

type Props = {
  result: RedeemResult;
  pending: boolean;
  onRedeem: () => void;
  onReset: () => void;
};

export function RewardResultCard({ result, pending, onRedeem, onReset }: Props) {
  const base = "rounded-2xl border border-border border-l-4 bg-card p-5";

  switch (result.kind) {
    case "valid":
      return (
        <div className={`${base} border-l-success`} data-testid="redeem-result" data-state="valid" role="status">
          <p className="flex items-center gap-2 text-lg font-semibold text-success">
            <CheckCircle2Icon className="size-5" aria-hidden />
            Valid · {result.name}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {result.reward.title} · code <span className="font-mono font-bold text-ink">{result.reward.code}</span> · claimed{" "}
            {relativeTime(result.reward.createdAt)}
          </p>
          <Button
            data-testid="redeem-button"
            className="mt-4 h-12 w-full rounded-xl text-base sm:w-auto sm:px-8"
            onClick={onRedeem}
            disabled={pending}
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
            Mark as used
          </Button>
        </div>
      );
    case "done":
      return (
        <div className={`${base} border-l-success bg-success/5`} data-testid="redeem-result" data-state="done" role="status">
          <p className="flex items-center gap-2 text-2xl font-bold text-success">
            <CheckCircle2Icon className="size-7" aria-hidden />
            Redeemed ✓ · {result.name}
          </p>
          <Button variant="outline" className="mt-4 h-12 rounded-xl" onClick={onReset}>
            Redeem another
          </Button>
        </div>
      );
    case "used":
      return (
        <div className={`${base} border-l-warning`} data-testid="redeem-result" data-state="used" role="alert">
          <p className="flex items-center gap-2 text-lg font-semibold text-warning">
            <TriangleAlertIcon className="size-5" aria-hidden />
            Already used {formatDateTime(result.reward.redeemedAt)}
            {result.reward.redeemedBy ? ` by ${result.reward.redeemedBy}` : ""}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {result.name} · code <span className="font-mono">{result.reward.code}</span>
          </p>
        </div>
      );
    case "expired":
      return (
        <div className={`${base} border-l-ink-muted`} data-testid="redeem-result" data-state="expired" role="alert">
          <p className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ClockIcon className="size-5" aria-hidden />
            Expired on {formatDate(result.reward.expiresAt)}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{result.name}</p>
        </div>
      );
    case "not_found":
      return (
        <div className={`${base} border-l-danger`} data-testid="redeem-result" data-state="not_found" role="alert">
          <p className="flex items-center gap-2 text-lg font-semibold text-danger">
            <XCircleIcon className="size-5" aria-hidden />
            No reward with that code
          </p>
          <p className="mt-1 text-sm text-ink-muted">Check the letters with the guest.</p>
        </div>
      );
    case "error":
      return (
        <div className={`${base} border-l-danger`} data-testid="redeem-result" data-state="error" role="alert">
          <p className="flex items-center gap-2 font-medium text-danger">
            <XCircleIcon className="size-5" aria-hidden />
            {result.message}
          </p>
        </div>
      );
  }
}
