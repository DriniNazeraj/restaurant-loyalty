import { useState } from "react";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { applyRestaurantTheme, isBrandContrastOk } from "@/lib/restaurant-theme";
import { PH } from "@/lib/placeholders";
import { readStaffSession } from "@/lib/auth";

export default function SettingsPage() {
  const session = readStaffSession();
  const [name, setName] = useState<string>(session?.restaurant.name ?? PH.restaurantName);
  const [color, setColor] = useState<string>(session?.restaurant.brandColor ?? "#B83A22");
  const [headline, setHeadline] = useState<string>(session?.restaurant.rewardTitle ?? PH.offerHeadline);
  const [terms, setTerms] = useState<string>(PH.rewardTerms);
  const [offerOn, setOfferOn] = useState(true);
  const contrastOk = isBrandContrastOk(color);

  function onColor(next: string) {
    setColor(next);
    if (isBrandContrastOk(next)) applyRestaurantTheme(next);
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-heading text-2xl font-bold text-ink">Settings</h1>
      <p className="mt-1 text-ink-muted">Restaurant branding and reward copy. All values are [PH] until Drini fills them in.</p>

      <div className="mt-6 space-y-5">
        <Field>
          <FieldLabel htmlFor="settings-name">Restaurant name</FieldLabel>
          <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} className="h-12 rounded-xl text-base" />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-slug">Slug</FieldLabel>
          <Input id="settings-slug" value={session?.restaurant.slug ?? PH.restaurantSlug} readOnly className="h-12 rounded-xl text-base" />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-color">Brand colour</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              id="settings-color"
              type="color"
              value={color}
              onChange={(event) => onColor(event.target.value)}
              className="size-11 cursor-pointer rounded-xl border border-border"
              aria-label="Brand colour swatch"
            />
            <Input
              value={color}
              onChange={(event) => onColor(event.target.value)}
              className="h-12 rounded-xl font-mono text-base"
            />
          </div>
          {contrastOk ? null : (
            <p className="text-sm text-danger">Too light for white text, pick a darker shade</p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-headline">Reward headline</FieldLabel>
          <Input id="settings-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} className="h-12 rounded-xl text-base" />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-terms">Reward terms</FieldLabel>
          <Textarea id="settings-terms" value={terms} onChange={(event) => setTerms(event.target.value)} className="rounded-xl text-base" />
        </Field>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <p className="text-sm font-medium">Offer on</p>
          <Switch checked={offerOn} onCheckedChange={setOfferOn} aria-label="Offer on" />
        </div>
        <Button
          type="button"
          className="h-12 rounded-xl"
          onClick={() => toast.success("Saved")}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
