import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import "@/fonts/customer.ts";
import "@/fonts/reward-mono.ts";
import { RewardTicket } from "@/components/customer/RewardTicket";
import { Button } from "@/components/ui/button";
import { PH } from "@/lib/placeholders";
import { readRewardPayload, readRewardToken, type CachedReward } from "@/lib/storage";
import { useVisibleInterval } from "@/lib/use-visible-interval";

type RewardLocationState = { welcomeBack?: boolean };

export default function RewardPage() {
  const { slug = PH.restaurantSlug, token } = useParams();
  const location = useLocation();
  const welcomeBack = Boolean((location.state as RewardLocationState | null)?.welcomeBack);
  const resolvedToken = token ?? readRewardToken(slug) ?? "";

  const [snapshot, setSnapshot] = useState<CachedReward | null>(() =>
    resolvedToken ? readRewardPayload(slug, resolvedToken) : null,
  );

  const state = useMemo(() => {
    if (snapshot?.redeemedAt) return "redeemed" as const;
    return "active" as const;
  }, [snapshot?.redeemedAt]);

  useVisibleInterval(
    () => {
      if (!resolvedToken) return;
      const next = readRewardPayload(slug, resolvedToken);
      if (next) setSnapshot(next);
      // Public reward-status polling will call the API once that route exists.
    },
    5000,
    Boolean(resolvedToken),
  );

  const code = snapshot?.code ?? "AB7K2Q";
  const name = snapshot?.name ?? "there";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <div className="customer-app min-h-svh px-5 py-8 font-sans">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="text-center">
          <p className="font-heading text-lg font-bold text-ink">{PH.restaurantName}</p>
        </header>
        {welcomeBack || snapshot?.isExisting ? (
          <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink" role="status">
            Welcome back, you already have a reward
          </p>
        ) : null}
        <div aria-live="polite">
          <RewardTicket
            code={code}
            guestName={name}
            state={state}
            redeemedAt={snapshot?.redeemedAt}
          />
        </div>
        <p className="text-center text-sm text-ink-muted">
          Keep this page open, or come back to this link anytime.
        </p>
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => void copyLink()}>
          Copy link
        </Button>
        <p className="text-center text-xs text-ink-muted">
          <Link to={`/r/${slug}`} className="underline underline-offset-2">
            Back to {PH.restaurantName}
          </Link>
        </p>
      </div>
    </div>
  );
}
