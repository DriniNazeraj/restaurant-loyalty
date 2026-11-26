import { useCallback, useState } from "react";
import { Link } from "@/lib/router";
import { useLocationState, useParams } from "@/lib/router-hooks";
import { toast } from "sonner";
import "@/fonts/reward-mono.ts";
import { AlreadyClaimedCard } from "@/components/customer/AlreadyClaimedCard";
import { CustomerLayout } from "@/components/customer/CustomerLayout";
import { RewardTicket } from "@/components/customer/RewardTicket";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ApiError, api } from "@/lib/api";
import type { RewardStatus } from "@/lib/api-types";
import { PH } from "@/lib/placeholders";
import { readTicket, saveTicket } from "@/lib/storage";
import { usePublicRestaurant } from "@/lib/use-restaurant";
import { useVisibleInterval } from "@/lib/use-visible-interval";

const POLL_MS = 5000;

export default function RewardPage() {
  const { slug = "", token = "" } = useParams<{ slug?: string; token?: string }>();
  const welcomeBack = Boolean(useLocationState<{ welcomeBack?: boolean }>()?.welcomeBack);
  const [restaurantState] = usePublicRestaurant(slug);
  const restaurant = restaurantState.kind === "ready" ? restaurantState.restaurant : null;
  const restaurantName = restaurant?.name ?? PH.restaurantName;

  // The full code only exists on the phone that claimed it (cached at signup).
  const [ticket, setTicket] = useState(() => readTicket(slug, token));
  const [status, setStatus] = useState<RewardStatus | null>(ticket?.status ?? null);
  const [missing, setMissing] = useState(false);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.claimStatus(token);
      setMissing(false);
      setStatus(result.status);
      setTicket((current) => {
        if (!current || (current.status === result.status && current.redeemedAt === result.redeemedAt)) return current;
        const next = { ...current, status: result.status, redeemedAt: result.redeemedAt };
        saveTicket(slug, next);
        return next;
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "NOT_FOUND") setMissing(true);
      // Network blips / rate limits: keep showing the last known state, try again next tick.
    }
  }, [slug, token]);

  // Polls only while the tab is visible; also re-checks on focus/visibility return.
  useVisibleInterval(poll, POLL_MS, status !== "redeemed" && status !== "expired" && !missing, true);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  if (missing) {
    return (
      <CustomerLayout restaurantName={restaurantName}>
        <div className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
          <h1 className="font-heading text-2xl font-bold text-ink">We can't find this reward</h1>
          <p className="mt-2 text-ink-muted">The link may be incomplete. Ask your waiter, they can find it with your phone number.</p>
          <Link className="mt-4 inline-block font-semibold text-brand underline" to={`/r/${slug}`}>
            Back to {restaurantName}
          </Link>
        </div>
      </CustomerLayout>
    );
  }

  if (!ticket) {
    // Link opened on another phone / storage cleared: never reveal the code here.
    return (
      <CustomerLayout restaurantName={restaurantName}>
        <div className="mt-6">
          <AlreadyClaimedCard status={status ?? undefined} />
        </div>
      </CustomerLayout>
    );
  }

  const effectiveStatus = status ?? ticket.status;

  return (
    <CustomerLayout restaurantName={restaurantName}>
      {welcomeBack && effectiveStatus === "active" ? (
        <p className="mt-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink" role="status">
          Welcome back, you already have a reward
        </p>
      ) : null}
      <div className="mt-2">
        <RewardTicket
          code={ticket.code}
          title={ticket.title || PH.rewardBand}
          guestName={ticket.firstName}
          status={effectiveStatus}
          redeemedAt={ticket.redeemedAt}
          expiresAt={ticket.expiresAt}
          terms={termsLine(restaurant?.rewardExpiryDays)}
        />
      </div>
      <p className="text-center text-sm text-ink-muted">Keep this page open, or come back to this link anytime.</p>
      <Button type="button" variant="outline" className="h-12 rounded-xl border-line bg-surface" onClick={() => void copyLink()}>
        Copy link
      </Button>
      <Toaster position="top-center" />
    </CustomerLayout>
  );
}

function termsLine(expiryDays: number | null | undefined): string {
  const validity = expiryDays == null ? "no expiry" : `valid ${expiryDays} days`;
  return `One per person · ${validity} [PH] · dine-in only [PH]`;
}
