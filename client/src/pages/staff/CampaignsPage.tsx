import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function CampaignsPage() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Campaigns</h1>
          <p className="mt-1 text-ink-muted">Write a promo and pick an audience. Sending is not connected yet.</p>
        </div>
        <Button asChild className="h-12 rounded-xl">
          <Link to="/admin/campaigns/new">New campaign</Link>
        </Button>
      </div>
      <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-ink">No campaigns yet. Write your first promo.</p>
        <Button asChild variant="outline" className="mt-4 h-12 rounded-xl">
          <Link to="/admin/campaigns/new">New campaign</Link>
        </Button>
      </div>
    </div>
  );
}
