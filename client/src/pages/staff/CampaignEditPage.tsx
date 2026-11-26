import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PlugIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { PH } from "@/lib/placeholders";

export default function CampaignEditPage() {
  const { id } = useParams();
  const [title, setTitle] = useState(id ? "Monday BOGO [PH]" : "");
  const [message, setMessage] = useState("Hi {first name}, [PH promo text]");
  const [audience, setAudience] = useState("all_consented");
  const count = message.length;
  const preview = useMemo(
    () => message.replaceAll("{first name}", "Ana"),
    [message],
  );

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">
        {id ? "Edit campaign" : "New campaign"}
      </h1>
      <p className="mt-1 text-ink-muted">Draft a message. The send action stays disabled in v1.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <Field>
            <FieldLabel htmlFor="campaign-name">Name</FieldLabel>
            <Input
              id="campaign-name"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Monday BOGO [PH]"
              className="h-12 rounded-xl text-base"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="campaign-message">Message</FieldLabel>
            <Textarea
              id="campaign-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="rounded-xl text-base"
            />
            <p className={`text-sm ${count > 160 ? "text-warning" : "text-ink-muted"}`}>
              {count} / 160 characters
              {count > 160 ? " · May be split into 2 messages" : ""}
            </p>
          </Field>
          <Field>
            <FieldLabel>Audience</FieldLabel>
            <RadioGroup value={audience} onValueChange={setAudience} className="gap-3">
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3">
                <RadioGroupItem value="all_consented" id="aud-all" />
                <span>Everyone who agreed to offers</span>
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3">
                <RadioGroupItem value="birthdays_this_week" id="aud-bday" />
                <span>Birthdays this week (Mon–Sun, Europe/Tirane)</span>
              </label>
            </RadioGroup>
            <p className="text-sm text-ink-muted">
              Only guests who ticked the offers box are ever included.
            </p>
          </Field>
        </div>

        <div className="rounded-2xl border border-border bg-muted p-5">
          <p className="text-sm font-medium text-ink-muted">Preview</p>
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-ink-muted">{PH.restaurantName}</p>
            <p className="mt-2 text-ink">{preview}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="h-12 rounded-xl">
          Save draft
        </Button>
        <Button type="button" disabled className="h-12 rounded-xl">
          <PlugIcon className="size-4" aria-hidden />
          Sending not connected yet
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => void navigator.clipboard.writeText(message)}
        >
          Copy message
        </Button>
      </div>
    </div>
  );
}
