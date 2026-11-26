import type { ReactNode } from "react";
import { LockIcon } from "lucide-react";
import { isOwner, useStaffSession } from "@/lib/auth";

export function OwnerOnly({ children }: { children: ReactNode }) {
  const session = useStaffSession();
  if (isOwner(session)) return <>{children}</>;
  return <ForbiddenNotice />;
}

export function ForbiddenNotice({ what = "This page" }: { what?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6" role="alert">
      <p className="flex items-center gap-2 font-medium text-ink">
        <LockIcon className="size-4" aria-hidden />
        {what} is for the owner only
      </p>
      <p className="mt-1 text-sm text-ink-muted">Ask the restaurant owner if you need this.</p>
    </div>
  );
}
