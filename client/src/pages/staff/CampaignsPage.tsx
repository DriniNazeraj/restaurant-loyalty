import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { ChevronRightIcon, MegaphoneIcon, PlugIcon } from "lucide-react";
import { PageHeader } from "@/components/staff/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import type { Campaign, CampaignStatus } from "@/lib/api-types";
import { AUDIENCE_LABEL } from "@/lib/campaign-labels";
import { getStaffToken, isOwner, useStaffSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";

function StatusBadge({ status }: { status: CampaignStatus }) {
  if (status === "draft") return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-ink-muted">Draft</span>;
  if (status === "ready") return <span className="rounded-full bg-olive px-2 py-0.5 text-xs font-medium text-white">Ready</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
      <PlugIcon className="size-3" aria-hidden /> Not sent
    </span>
  );
}

export default function CampaignsPage() {
  const owner = isOwner(useStaffSession());
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStaffToken();
    if (!token) return;
    api
      .listCampaigns(token)
      .then((d) => setCampaigns(d.campaigns))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't load campaigns."));
  }, []);

  const newButton = owner ? (
    <Button asChild className="h-11 rounded-xl">
      <Link to="/admin/campaigns/new">New campaign</Link>
    </Button>
  ) : null;

  return (
    <div>
      <PageHeader title="Campaigns" description="Write a promo and pick who gets it. Sending isn't connected yet." actions={newButton} />
      {!owner ? <p className="mt-3 text-sm text-ink-muted">Waiters can view campaigns. Only the owner can write or change them.</p> : null}

      <div className="mt-6">
        {error ? (
          <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-danger">
            {error}
          </p>
        ) : campaigns === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <MegaphoneIcon className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-2 text-ink">No campaigns yet. Write your first promo.</p>
            {owner ? (
              <Button asChild variant="outline" className="mt-4 h-11 rounded-xl">
                <Link to="/admin/campaigns/new">New campaign</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/admin/campaigns/${c.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{c.title}</p>
                    <p className="truncate text-sm text-ink-muted">
                      {AUDIENCE_LABEL[c.audienceType]} · updated {formatDate(c.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                  <ChevronRightIcon className="size-4 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
