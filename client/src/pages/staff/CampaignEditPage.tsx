import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-hooks";
import { CopyIcon, Loader2Icon, PlugZapIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { ForbiddenNotice } from "@/components/staff/OwnerOnly";
import { PageHeader } from "@/components/staff/PageHeader";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, api } from "@/lib/api";
import type { AudienceCountsResponse, AudienceType, Campaign } from "@/lib/api-types";
import { getStaffToken, isOwner, useStaffSession } from "@/lib/auth";
import { formatWeekRange } from "@/lib/format";
import { AUDIENCE_LABEL } from "@/lib/campaign-labels";

const TOKEN = "{first name}";
const SMS_LIMIT = 160;
const SAMPLE_NAME = "Ana";

type Draft = { title: string; message: string; audienceType: AudienceType };
const EMPTY: Draft = { title: "", message: "", audienceType: "all_consented" };
const draftKey = (id: string | undefined) => `loyalty.campaignDraft:${id ?? "new"}`;

function readLocalDraft(id: string | undefined): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export default function CampaignEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const session = useStaffSession();
  const owner = isOwner(session);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [draft, setDraft] = useState<Draft>(() => readLocalDraft(id) ?? EMPTY);
  const [saved, setSaved] = useState<Draft>(EMPTY);
  const [counts, setCounts] = useState<AudienceCountsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmLeave, setConfirmLeave] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    const token = getStaffToken();
    if (!token) return;
    api.audienceCounts(token).then(setCounts).catch(() => undefined);
    if (!id) return;
    api
      .listCampaigns(token)
      .then(({ campaigns }) => {
        const found = campaigns.find((c) => c.id === id);
        if (!found) return setNotFound(true);
        const server: Draft = { title: found.title, message: found.message, audienceType: found.audienceType };
        setCampaign(found);
        setSaved(server);
        setDraft(readLocalDraft(id) ?? server);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Autosave edits locally so a session expiry or reload doesn't lose them.
  useEffect(() => {
    if (!owner) return;
    if (dirty) localStorage.setItem(draftKey(id), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(id));
  }, [draft, dirty, id, owner]);

  useEffect(() => {
    if (!dirty || !owner) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, owner]);

  function insertToken() {
    const el = messageRef.current;
    const start = el?.selectionStart ?? draft.message.length;
    const end = el?.selectionEnd ?? draft.message.length;
    const message = draft.message.slice(0, start) + TOKEN + draft.message.slice(end);
    setDraft({ ...draft, message });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + TOKEN.length, start + TOKEN.length);
    });
  }

  async function save(status: "draft" | "ready") {
    const token = getStaffToken();
    if (!token) return;
    setSaving(true);
    setErrors({});
    try {
      const body = { title: draft.title.trim(), message: draft.message.trim(), audienceType: draft.audienceType, status };
      const result = campaign ? await api.updateCampaign(token, campaign.id, body) : await api.createCampaign(token, body);
      const server: Draft = { title: result.campaign.title, message: result.campaign.message, audienceType: result.campaign.audienceType };
      localStorage.removeItem(draftKey(id));
      setCampaign(result.campaign);
      setSaved(server);
      setDraft(server);
      toast.success(status === "ready" ? "Saved as ready" : "Draft saved");
      if (!id) navigate(`/admin/campaigns/${result.campaign.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") setErrors(error.fields);
      else if (error instanceof ApiError && error.code === "FORBIDDEN") toast.error("Only the owner can save campaigns.");
      else toast.error(error instanceof ApiError ? error.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  function leave() {
    if (dirty && owner) setConfirmLeave(true);
    else navigate("/admin/campaigns");
  }

  if (!id && !owner) return <ForbiddenNotice what="Writing campaigns" />;
  if (notFound) return <p className="text-ink-muted">Campaign not found.</p>;
  if (loading) return <Loader2Icon className="size-5 animate-spin text-ink-muted" aria-label="Loading" />;

  const length = draft.message.length;
  const count = counts?.counts[draft.audienceType];
  const preview = draft.message.replaceAll(TOKEN, SAMPLE_NAME);
  const readOnly = !owner;

  return (
    <div>
      <PageHeader
        title={id ? draft.title || "Campaign" : "New campaign"}
        description={readOnly ? "View only. The owner can change this campaign." : "Write the message and pick who it's for."}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-title">Name</Label>
            <Input
              id="c-title"
              value={draft.title}
              disabled={readOnly}
              maxLength={120}
              placeholder="Monday BOGO [PH]"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              aria-invalid={!!errors.title}
              className="h-11 rounded-xl text-base"
            />
            <p className="text-xs text-ink-muted">Only staff see this.</p>
            {errors.title ? <p className="text-sm text-danger">{errors.title}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="c-message">Message</Label>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={insertToken}
                  className="min-h-9 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
                >
                  + {TOKEN}
                </button>
              ) : null}
            </div>
            <Textarea
              id="c-message"
              ref={messageRef}
              rows={5}
              maxLength={1000}
              disabled={readOnly}
              value={draft.message}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              placeholder={`Hi ${TOKEN}, it's 2-for-1 starters this Monday 4–7pm [PH]`}
              aria-invalid={!!errors.message}
              aria-describedby="c-message-count"
              className="rounded-xl text-base"
            />
            <p id="c-message-count" className={`text-sm ${length > SMS_LIMIT ? "text-warning" : "text-ink-muted"}`}>
              {length} / {SMS_LIMIT} characters{length > SMS_LIMIT ? " · May be split into 2 messages" : ""}
            </p>
            {errors.message ? <p className="text-sm text-danger">{errors.message}</p> : null}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Audience</legend>
            <RadioGroup
              value={draft.audienceType}
              onValueChange={(v) => setDraft({ ...draft, audienceType: v as AudienceType })}
              disabled={readOnly}
              className="gap-2"
              data-testid="campaign-audience"
            >
              {(["all_consented", "birthdays_this_week"] as const).map((type) => (
                <label
                  key={type}
                  htmlFor={`aud-${type}`}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-soft/40"
                >
                  <RadioGroupItem value={type} id={`aud-${type}`} />
                  <span className="flex-1">
                    <span className="block font-medium text-ink">{AUDIENCE_LABEL[type]}</span>
                    <span className="block text-sm text-ink-muted">
                      {counts ? `${counts.counts[type]} ${counts.counts[type] === 1 ? "person" : "people"}` : "…"}
                      {type === "birthdays_this_week" && counts
                        ? ` · ${formatWeekRange(counts.weekRange.start, counts.weekRange.end)}`
                        : ""}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <p className="text-sm text-ink-muted">Only guests who ticked the offers box are ever included.</p>
            {count === 0 ? (
              <p className="flex items-center gap-1 text-sm text-warning">
                <TriangleAlertIcon className="size-4" aria-hidden /> No one in this audience yet
              </p>
            ) : null}
          </fieldset>
        </div>

        <div className="rounded-2xl border border-border bg-muted/60 p-5">
          <p className="text-sm font-medium text-ink-muted">Preview</p>
          <div className="mt-4 flex flex-col items-start gap-1">
            <p className="text-xs text-ink-muted">{session?.restaurant.name}</p>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 whitespace-pre-wrap text-ink shadow-sm" data-testid="campaign-preview">
              {preview || <span className="text-ink-muted">Your message shows here.</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!readOnly ? (
          <>
            <Button variant="outline" className="h-11 rounded-xl" disabled={saving} onClick={() => void save("draft")}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" disabled={saving} onClick={() => void save("ready")}>
              Mark ready
            </Button>
          </>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span wrapper so the tooltip still works on a disabled button */}
            <span tabIndex={0} className="rounded-xl">
              <Button className="pointer-events-none h-11 rounded-xl" disabled data-testid="campaign-send" aria-describedby="send-note">
                <PlugZapIcon className="size-4" aria-hidden />
                Sending not connected yet
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>We'll turn this on once we pick WhatsApp or SMS.</TooltipContent>
        </Tooltip>
        <Button
          variant="link"
          className="h-11"
          onClick={() =>
            void navigator.clipboard.writeText(draft.message).then(
              () => toast.success("Message copied"),
              () => toast.error("Couldn't copy"),
            )
          }
        >
          <CopyIcon className="size-4" /> Copy message
        </Button>
        <Button variant="ghost" className="h-11 rounded-xl" onClick={leave}>
          Back
        </Button>
      </div>
      <p id="send-note" className="mt-2 text-xs text-ink-muted">
        We'll turn this on once we pick WhatsApp or SMS.
      </p>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your edits since the last save will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                localStorage.removeItem(draftKey(id));
                navigate("/admin/campaigns");
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
