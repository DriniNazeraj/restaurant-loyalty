import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, api, type Contact } from "@/lib/api";
import { getStaffToken } from "@/lib/auth";

export default function ContactsPage() {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState("Search or export once the API is running.");
  const [pending, setPending] = useState(false);

  const label = useMemo(
    () => (contacts.length ? `Export ${contacts.length} contacts` : "Export CSV"),
    [contacts.length],
  );

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    const token = getStaffToken();
    if (!token) return;
    setPending(true);
    try {
      const result = await api.listContacts(token, { q: query || undefined });
      setContacts(result.contacts);
      setMessage(result.contacts.length ? "" : query ? `No one matches "${query}".` : "No guests yet. Print your QR card to start.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Couldn't load contacts.");
    } finally {
      setPending(false);
    }
  }

  async function exportCsv() {
    const token = getStaffToken();
    if (!token) return;
    try {
      const file = await api.exportContactsCsv(token, query || undefined);
      const blob = new Blob([file.text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Couldn't export CSV.");
    }
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">Contacts</h1>
      <p className="mt-1 text-ink-muted">Search the guest list and export a CSV of the current results.</p>

      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void runSearch(event)}>
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone or email"
            className="h-12 rounded-xl pl-9 text-base"
            aria-label="Search name, phone or email"
          />
        </div>
        <Button type="submit" className="h-12 rounded-xl" disabled={pending}>
          Search
        </Button>
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => void exportCsv()}>
          <DownloadIcon className="size-4" />
          {label}
        </Button>
      </form>

      {message ? <p className="mt-6 text-sm text-ink-muted">{message} {message.startsWith("No guests") ? <Link className="underline" to="/admin/qr">Go to QR card</Link> : null}</p> : null}

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead>Consent</TableHead>
              <TableHead>Reward</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell>{contact.phoneE164}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{formatBirthday(contact.birthDay, contact.birthMonth)}</TableCell>
                <TableCell>
                  {contact.marketingConsent ? (
                    <Badge className="bg-olive text-white">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
                <TableCell>{contact.reward?.code ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {contacts.map((contact) => (
          <li key={contact.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-ink">{contact.name}</p>
              <Badge variant="secondary">{contact.reward?.code ?? "No code"}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{contact.phoneE164}</p>
            {contact.marketingConsent ? (
              <Badge className="mt-2 bg-olive text-white">Yes</Badge>
            ) : (
              <Badge variant="secondary" className="mt-2">No</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatBirthday(day?: number | null, month?: number | null): string {
  if (!day || !month) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    new Date(2024, month - 1, day),
  );
}
