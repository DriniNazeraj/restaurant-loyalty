import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { DownloadIcon, Loader2Icon, RotateCcwIcon, SearchIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/staff/PageHeader";
import { ConsentBadge, RewardBadge } from "@/components/staff/StatusBadges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";
import type {
  ContactConsentFilter,
  ContactRewardFilter,
  ContactSort,
  ContactWithReward,
  ListContactsResponse,
} from "@/lib/api-types";
import { getStaffToken, isOwner, useStaffSession } from "@/lib/auth";
import { formatBirthday, formatDate, formatDateTime } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";

const PAGE_SIZE = 50;

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: ListContactsResponse }
  | { kind: "error"; message: string };

export default function ContactsPage() {
  const session = useStaffSession();
  const owner = isOwner(session);
  const [q, setQ] = useState("");
  const [consent, setConsent] = useState<ContactConsentFilter>("all");
  const [reward, setReward] = useState<ContactRewardFilter>("all");
  const [sort, setSort] = useState<ContactSort>("newest");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<ContactWithReward | null>(null);
  const [exporting, setExporting] = useState(false);
  const debouncedQ = useDebounced(q.trim(), 300);

  useEffect(() => {
    const token = getStaffToken();
    if (!token) return;
    const controller = new AbortController();
    api
      .listContacts(token, { q: debouncedQ, consent, reward, sort, page, limit: PAGE_SIZE }, controller.signal)
      .then((data) => setState({ kind: "ready", data }))
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        setState({ kind: "error", message: error instanceof ApiError ? error.message : "Couldn't load contacts." });
      });
    return () => controller.abort();
  }, [debouncedQ, consent, reward, sort, page, attempt]);

  const total = state.kind === "ready" ? state.data.pagination.total : 0;
  const filtersActive = debouncedQ !== "" || consent !== "all" || reward !== "all";

  async function exportCsv() {
    const token = getStaffToken();
    if (!token) return;
    setExporting(true);
    try {
      const csv = await api.exportContactsCsv(token, { q: debouncedQ, consent, reward, sort });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (error instanceof ApiError && error.code === "FORBIDDEN") toast.error("Only the owner can export contacts.");
      else toast.error(error instanceof ApiError ? error.message : "Couldn't export.");
    } finally {
      setExporting(false);
    }
  }

  function onRewardChanged(updated: ContactWithReward) {
    setSelected(updated);
    setAttempt((n) => n + 1);
  }

  return (
    <div>
      <PageHeader title="Contacts" description="Everyone who claimed a reward. Search, filter and export." />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, phone or email"
            aria-label="Search name, phone or email"
            data-testid="contacts-search"
            className="h-11 rounded-xl pl-9 text-base"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <FilterSelect
            label="Consent"
            value={consent}
            onChange={(v) => {
              setConsent(v as ContactConsentFilter);
              setPage(1);
            }}
            options={[
              ["all", "All"],
              ["consented", "Consented"],
              ["not_consented", "Not consented"],
            ]}
          />
          <FilterSelect
            label="Reward"
            value={reward}
            onChange={(v) => {
              setReward(v as ContactRewardFilter);
              setPage(1);
            }}
            options={[
              ["all", "All"],
              ["active", "Not used"],
              ["redeemed", "Used"],
              ["expired", "Expired"],
            ]}
          />
          <FilterSelect
            label="Sort"
            value={sort}
            onChange={(v) => {
              setSort(v as ContactSort);
              setPage(1);
            }}
            options={[
              ["newest", "Newest"],
              ["name", "Name"],
            ]}
          />
        </div>
        {owner ? (
          <div className="flex flex-col gap-1 lg:items-end">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => void exportCsv()}
              disabled={exporting || total === 0}
              data-testid="contacts-export"
            >
              {exporting ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <DownloadIcon className="size-4" aria-hidden />}
              Export {total} {total === 1 ? "contact" : "contacts"}
            </Button>
            {consent !== "consented" ? (
              <p className="flex max-w-64 items-start gap-1 text-xs text-warning">
                <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                Includes people who didn't agree to marketing, so don't message them.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {state.kind === "loading" ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : state.kind === "error" ? (
          <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-danger">
            <p>{state.message}</p>
            <Button
              variant="outline"
              className="mt-3 h-11 rounded-xl"
              onClick={() => {
                setState({ kind: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : state.data.contacts.length === 0 ? (
          filtersActive ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-ink">{debouncedQ ? `No one matches "${debouncedQ}".` : "No one matches these filters."}</p>
              <Button
                variant="outline"
                className="mt-4 h-11 rounded-xl"
                onClick={() => {
                  setQ("");
                  setConsent("all");
                  setReward("all");
                  setPage(1);
                }}
              >
                Clear search
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <UsersIcon className="mx-auto size-8 text-ink-muted" aria-hidden />
              <p className="mt-2 text-ink">No guests yet. Print your QR card to start.</p>
              <Button asChild variant="outline" className="mt-4 h-11 rounded-xl">
                <Link to="/admin/qr">Go to QR card</Link>
              </Button>
            </div>
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Birthday</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.data.contacts.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                      <TableCell className="font-medium">
                        <button type="button" className="text-left hover:underline" onClick={() => setSelected(c)}>
                          {c.name}
                        </button>
                      </TableCell>
                      <TableCell className="tabular-nums">{c.phoneE164}</TableCell>
                      <TableCell>{c.email ?? "—"}</TableCell>
                      <TableCell>{formatBirthday(c.birthDay, c.birthMonth)}</TableCell>
                      <TableCell>
                        <ConsentBadge consented={c.marketingConsent} />
                      </TableCell>
                      <TableCell>
                        <RewardBadge status={c.reward.status} />
                      </TableCell>
                      <TableCell>{formatDate(c.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="flex flex-col gap-2 md:hidden">
              {state.data.contacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm"
                    onClick={() => setSelected(c)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-ink">{c.name}</p>
                      <RewardBadge status={c.reward.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-muted tabular-nums">
                      {c.phoneE164} · {formatDate(c.createdAt)}
                    </p>
                    <div className="mt-2">
                      <ConsentBadge consented={c.marketingConsent} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination
              page={state.data.pagination.page}
              totalPages={state.data.pagination.totalPages}
              total={total}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <ContactSheet contact={selected} owner={owner} onClose={() => setSelected(null)} onChanged={onRewardChanged} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-border bg-card px-2 text-sm text-ink"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
      <p>
        {total} {total === 1 ? "guest" : "guests"} · page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 rounded-xl" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" className="h-11 rounded-xl" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function ContactSheet({
  contact,
  owner,
  onClose,
  onChanged,
}: {
  contact: ContactWithReward | null;
  owner: boolean;
  onClose: () => void;
  onChanged: (c: ContactWithReward) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function undo() {
    const token = getStaffToken();
    if (!token || !contact) return;
    setPending(true);
    try {
      const data = await api.undoRedeem(token, contact.reward.code);
      toast.success("Reward marked as not used");
      onChanged({ ...contact, reward: data.reward });
    } catch (error) {
      if (error instanceof ApiError && error.code === "FORBIDDEN") toast.error("Only the owner can undo a redeem.");
      else toast.error(error instanceof ApiError ? error.message : "Couldn't undo.");
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <Sheet open={!!contact} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        {contact ? (
          <>
            <SheetHeader>
              <SheetTitle>{contact.name}</SheetTitle>
              <SheetDescription>Joined {formatDateTime(contact.createdAt)}</SheetDescription>
            </SheetHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-4 text-sm">
              <dt className="text-ink-muted">Phone</dt>
              <dd className="tabular-nums">{contact.phoneE164}</dd>
              <dt className="text-ink-muted">Email</dt>
              <dd className="break-all">{contact.email ?? "—"}</dd>
              <dt className="text-ink-muted">Birthday</dt>
              <dd>{formatBirthday(contact.birthDay, contact.birthMonth)}</dd>
              <dt className="text-ink-muted">Consent</dt>
              <dd className="flex flex-col gap-1">
                <ConsentBadge consented={contact.marketingConsent} />
                {contact.consentedAt ? <span className="text-xs text-ink-muted">{formatDateTime(contact.consentedAt)}</span> : null}
              </dd>
              <dt className="text-ink-muted">Reward</dt>
              <dd className="flex flex-col gap-1">
                <span className="font-mono font-bold">{contact.reward.code}</span>
                <RewardBadge status={contact.reward.status} />
                {contact.reward.redeemedAt ? (
                  <span className="text-xs text-ink-muted">
                    Used {formatDateTime(contact.reward.redeemedAt)}
                    {contact.reward.redeemedBy ? ` by ${contact.reward.redeemedBy}` : ""}
                  </span>
                ) : null}
                {contact.reward.expiresAt ? (
                  <span className="text-xs text-ink-muted">Expires {formatDate(contact.reward.expiresAt)}</span>
                ) : null}
              </dd>
            </dl>
            {owner && contact.reward.status === "redeemed" ? (
              <div className="px-4 pb-4">
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => setConfirming(true)} disabled={pending}>
                  <RotateCcwIcon className="size-4" aria-hidden />
                  Undo redeem
                </Button>
              </div>
            ) : null}
            <AlertDialog open={confirming} onOpenChange={setConfirming}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark this reward as not used?</AlertDialogTitle>
                  <AlertDialogDescription>The guest will be able to use their code again. This is logged.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void undo()}>Undo redeem</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
