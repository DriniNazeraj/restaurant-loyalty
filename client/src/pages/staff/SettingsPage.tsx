import { useState } from "react";
import { CopyIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/staff/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import type { StaffRestaurant } from "@/lib/api-types";
import { getStaffToken, updateSessionRestaurant, useStaffSession } from "@/lib/auth";
import { applyRestaurantTheme, isBrandContrastOk } from "@/lib/restaurant-theme";

type Form = {
  name: string;
  tagline: string;
  rewardTitle: string;
  rewardDescription: string;
  consentText: string;
  brandColor: string;
  offerActive: boolean;
  expiryDays: string; // "" = never expires
};

function toForm(r: StaffRestaurant): Form {
  return {
    name: r.name,
    tagline: r.tagline,
    rewardTitle: r.rewardTitle,
    rewardDescription: r.rewardDescription,
    consentText: r.consentText,
    brandColor: r.brandColor,
    offerActive: r.offerActive,
    expiryDays: r.rewardExpiryDays == null ? "" : String(r.rewardExpiryDays),
  };
}

export default function SettingsPage() {
  const session = useStaffSession();
  const [form, setForm] = useState<Form | null>(() => (session ? toForm(session.restaurant) : null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  if (!session || !form) return null;

  const hexValid = /^#[0-9A-Fa-f]{6}$/.test(form.brandColor);
  const contrastOk = hexValid && isBrandContrastOk(form.brandColor);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const token = getStaffToken();
    if (!token) return;
    if (!contrastOk) {
      setErrors({ brandColor: "Too light for white text, pick a darker shade" });
      return;
    }
    const expiry = form.expiryDays.trim() === "" ? null : Number(form.expiryDays);
    if (expiry !== null && (!Number.isInteger(expiry) || expiry < 1 || expiry > 3650)) {
      setErrors({ rewardExpiryDays: "Use a whole number of days (1–3650), or leave empty for no expiry" });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const { restaurant } = await api.updateSettings(token, {
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        rewardTitle: form.rewardTitle.trim(),
        rewardDescription: form.rewardDescription.trim(),
        consentText: form.consentText.trim(),
        brandColor: form.brandColor,
        offerActive: form.offerActive,
        rewardExpiryDays: expiry,
      });
      updateSessionRestaurant(restaurant);
      applyRestaurantTheme(restaurant.brandColor);
      setForm(toForm(restaurant));
      toast.success("Saved");
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") setErrors(error.fields);
      else if (error instanceof ApiError && error.code === "FORBIDDEN") toast.error("Only the owner can change settings.");
      else toast.error(error instanceof ApiError ? error.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const slug = session.restaurant.slug;

  return (
    <form className="max-w-xl" onSubmit={(e) => void save(e)} noValidate>
      <PageHeader title="Settings" description="Your restaurant's name, colour and reward. Guests see these." />
      <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
        <Field id="s-name" label="Restaurant name" error={errors.name}>
          <Input id="s-name" value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} className="h-11 rounded-xl text-base" />
        </Field>
        <Field id="s-slug" label="Link name (slug)">
          <div className="flex gap-2">
            <Input id="s-slug" value={slug} readOnly className="h-11 rounded-xl bg-muted font-mono text-base" />
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              aria-label="Copy slug"
              onClick={() => void navigator.clipboard.writeText(slug).then(() => toast.success("Copied"))}
            >
              <CopyIcon className="size-4" />
            </Button>
          </div>
        </Field>
        <Field id="s-tagline" label="Tagline" error={errors.tagline}>
          <Input id="s-tagline" value={form.tagline} maxLength={160} onChange={(e) => set("tagline", e.target.value)} className="h-11 rounded-xl text-base" />
        </Field>
        <Field id="s-color" label="Brand colour" error={errors.brandColor ?? (hexValid && !contrastOk ? "Too light for white text, pick a darker shade" : undefined)}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={hexValid ? form.brandColor : "#B83A22"}
              onChange={(e) => set("brandColor", e.target.value.toUpperCase())}
              aria-label="Pick brand colour"
              className="size-11 cursor-pointer rounded-xl border border-border bg-card"
            />
            <Input
              id="s-color"
              value={form.brandColor}
              maxLength={7}
              onChange={(e) => set("brandColor", e.target.value)}
              className="h-11 w-32 rounded-xl font-mono text-base"
            />
            <span
              className="flex h-11 items-center rounded-xl px-4 text-sm font-semibold"
              style={{ background: hexValid ? form.brandColor : undefined, color: "#FFFFFF" }}
              aria-hidden
            >
              Aa
            </span>
          </div>
        </Field>
        <Field id="s-reward" label="Reward headline" error={errors.rewardTitle}>
          <Input id="s-reward" value={form.rewardTitle} maxLength={80} onChange={(e) => set("rewardTitle", e.target.value)} className="h-11 rounded-xl text-base" />
        </Field>
        <Field id="s-reward-desc" label="Reward terms" error={errors.rewardDescription}>
          <Textarea id="s-reward-desc" value={form.rewardDescription} maxLength={300} onChange={(e) => set("rewardDescription", e.target.value)} className="rounded-xl text-base" />
        </Field>
        <Field id="s-expiry" label="Reward valid for (days)" error={errors.rewardExpiryDays} help="Leave empty for no expiry.">
          <Input
            id="s-expiry"
            inputMode="numeric"
            value={form.expiryDays}
            onChange={(e) => set("expiryDays", e.target.value.replace(/\D/g, ""))}
            className="h-11 w-32 rounded-xl text-base"
          />
        </Field>
        <Field id="s-consent" label="Marketing consent text" error={errors.consentText} help="Shown next to the unticked offers box.">
          <Textarea id="s-consent" value={form.consentText} maxLength={300} onChange={(e) => set("consentText", e.target.value)} className="rounded-xl text-base" />
        </Field>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <Label htmlFor="s-offer">Offer on</Label>
            <p className="text-xs text-ink-muted">When off, the landing page shows "This offer has ended".</p>
          </div>
          <Switch id="s-offer" checked={form.offerActive} onCheckedChange={(v) => set("offerActive", v)} />
        </div>
        <Button type="submit" className="h-11 self-start rounded-xl px-6" disabled={saving}>
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, error, help, children }: { id: string; label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs text-ink-muted">{help}</p>
      ) : null}
    </div>
  );
}
