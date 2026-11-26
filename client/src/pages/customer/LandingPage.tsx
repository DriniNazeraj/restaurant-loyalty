import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { z } from "zod";
import "@/fonts/customer.ts";
import { ConsentRow } from "@/components/customer/ConsentRow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, api } from "@/lib/api";
import { applyRestaurantTheme } from "@/lib/restaurant-theme";
import { PH } from "@/lib/placeholders";
import { saveRewardPayload } from "@/lib/storage";

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

const landingSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(60, "Name must be 60 characters or less"),
    phone: z.string().trim().min(1, "Enter your phone number"),
    email: z.email("Enter a valid email"),
    birthDay: z.string(),
    birthMonth: z.string(),
    marketingConsent: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const hasDay = value.birthDay.length > 0;
    const hasMonth = value.birthMonth.length > 0;
    if (hasDay !== hasMonth) {
      ctx.addIssue({
        code: "custom",
        message: "Choose both a day and a month",
        path: [hasDay ? "birthMonth" : "birthDay"],
      });
    }
  });

type LandingValues = z.infer<typeof landingSchema>;

const COUNTRY_CODES = [
  { value: "+355", label: "🇦🇱 +355" },
  { value: "+39", label: "🇮🇹 +39" },
  { value: "+30", label: "🇬🇷 +30" },
  { value: "+383", label: "🇽🇰 +383" },
  { value: "+389", label: "🇲🇰 +389" },
  { value: "+1", label: "🇺🇸 +1" },
] as const;

export default function LandingPage() {
  const { slug = PH.restaurantSlug } = useParams();
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState("+355");
  const [restaurantName, setRestaurantName] = useState<string>(PH.restaurantName);
  const [offerEnded, setOfferEnded] = useState(false);
  const [submitError, setSubmitError] = useState<"network" | "rate" | "conflict" | string | null>(
    null,
  );

  const form = useForm<LandingValues>({
    resolver: zodResolver(landingSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      birthDay: "",
      birthMonth: "",
      marketingConsent: false,
    },
    mode: "onBlur",
  });

  useEffect(() => {
    document.title = restaurantName;
    let cancelled = false;
    api
      .getRestaurant(slug)
      .then(({ restaurant }) => {
        if (cancelled) return;
        setRestaurantName(restaurant.name);
        applyRestaurantTheme(restaurant.brandColor);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        applyRestaurantTheme();
        if (error instanceof ApiError && error.code === "NOT_FOUND") {
          setOfferEnded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, restaurantName]);

  async function onSubmit(values: LandingValues) {
    setSubmitError(null);
    const birthday =
      values.birthDay && values.birthMonth
        ? { month: Number(values.birthMonth), day: Number(values.birthDay) }
        : null;
    const phone = `${countryCode}${values.phone.replace(/^0+/, "").replaceAll(/\s+/g, "")}`;

    try {
      const result = await api.signup(slug, {
        name: values.name,
        phone,
        email: values.email,
        birthday,
        marketingConsent: values.marketingConsent,
      });
      const token = result.reward.id;
      saveRewardPayload(slug, token, {
        token,
        code: result.reward.code,
        title: result.reward.title,
        name: result.contact.name,
        redeemedAt: result.reward.redeemedAt,
        isExisting: result.isExisting,
      });
      // Preload the mono font only after a successful submit, then go to the ticket.
      void import("@/fonts/reward-mono.ts");
      navigate(`/r/${slug}/reward/${token}`, {
        state: { welcomeBack: result.isExisting },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "RATE_LIMITED") {
          setSubmitError("rate");
          return;
        }
        if (error.code === "NETWORK_ERROR") {
          setSubmitError("network");
          return;
        }
        if (error.code === "CONTACT_CONFLICT") {
          setSubmitError("conflict");
          return;
        }
        if (error.fields) {
          for (const [field, message] of Object.entries(error.fields)) {
            if (field in values) {
              form.setError(field as keyof LandingValues, { message });
            }
          }
        }
        setSubmitError(error.message);
        return;
      }
      setSubmitError("network");
    }
  }

  function focusFirstError(errors: typeof form.formState.errors) {
    const order: (keyof LandingValues)[] = [
      "name",
      "phone",
      "email",
      "birthDay",
      "birthMonth",
      "marketingConsent",
    ];
    const first = order.find((key) => errors[key]);
    if (first) document.getElementById(first)?.focus();
  }

  return (
    <div className="customer-app min-h-svh font-sans">
      <header className="flex h-14 items-center justify-center px-5">
        <p className="font-heading text-lg font-bold text-ink">{restaurantName}</p>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 pb-12">
        <section>
          <p className="text-sm text-brand">{PH.eyebrow}</p>
          <h1 className="mt-1 font-heading text-4xl font-bold leading-tight text-ink">
            {PH.offerHeadline}
          </h1>
          <p className="mt-2 text-ink-muted">{PH.offerSub}</p>
        </section>

        {offerEnded ? (
          <div className="rounded-2xl bg-surface p-5 shadow-sm">
            <p className="text-ink">{PH.offerEnded}</p>
          </div>
        ) : (
          <form
            className="rounded-2xl bg-surface p-5 shadow-sm"
            onSubmit={form.handleSubmit(onSubmit, focusFirstError)}
            noValidate
          >
            <FieldGroup className="gap-6">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                      {...field}
                      id="name"
                      autoComplete="given-name"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.error ? "name-error" : undefined}
                      className="h-12 rounded-xl text-base"
                    />
                    <div className="min-h-5">
                      {fieldState.invalid ? (
                        <FieldError id="name-error" errors={[fieldState.error]} className="flex items-center gap-1 text-danger">
                          <AlertCircleIcon className="size-4" aria-hidden />
                        </FieldError>
                      ) : null}
                    </div>
                  </Field>
                )}
              />

              <div className="grid gap-6">
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="phone">Phone</FieldLabel>
                      <div className="flex gap-2">
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger
                            aria-label="Country code"
                            className="h-12 w-[7.5rem] shrink-0 rounded-xl text-base"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          {...field}
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          aria-invalid={fieldState.invalid}
                          aria-describedby={fieldState.error ? "phone-error" : undefined}
                          className="h-12 rounded-xl text-base"
                        />
                      </div>
                      <div className="min-h-5">
                        {fieldState.invalid ? (
                          <FieldError id="phone-error" errors={[fieldState.error]} className="text-danger" />
                        ) : null}
                      </div>
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.error ? "email-error" : undefined}
                      className="h-12 rounded-xl text-base"
                    />
                    <div className="min-h-5">
                      {fieldState.invalid ? (
                        <FieldError id="email-error" errors={[fieldState.error]} className="text-danger" />
                      ) : null}
                    </div>
                  </Field>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="birthDay"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="birthDay">Birthday day</FieldLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="birthDay"
                          aria-invalid={fieldState.invalid}
                          className="h-12 w-full rounded-xl text-base"
                        >
                          <SelectValue placeholder="Day" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((day) => (
                            <SelectItem key={day} value={day}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="min-h-5 text-sm text-ink-muted">
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} className="text-danger" />
                        ) : (
                          "So we can treat you on your birthday"
                        )}
                      </p>
                    </Field>
                  )}
                />
                <Controller
                  name="birthMonth"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="birthMonth">Birthday month</FieldLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="birthMonth"
                          aria-invalid={fieldState.invalid}
                          className="h-12 w-full rounded-xl text-base"
                        >
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="min-h-5">
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} className="text-danger" />
                        ) : null}
                      </div>
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="marketingConsent"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <ConsentRow
                      id="marketingConsent"
                      label={PH.consentLabel}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      describedBy="consent-note"
                    />
                  </Field>
                )}
              />

              {submitError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>Couldn&apos;t finish that</AlertTitle>
                  <AlertDescription>
                    {submitError === "network"
                      ? "Couldn't connect. Check your signal and try again."
                      : submitError === "rate"
                        ? "Too many tries, wait a minute and try again."
                        : submitError === "conflict"
                          ? "That phone and email belong to different guests. Check the details and try again."
                          : submitError}
                    {submitError === "network" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3"
                        onClick={() => void form.handleSubmit(onSubmit, focusFirstError)()}
                      >
                        Try again
                      </Button>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-14 w-full rounded-xl bg-brand text-lg font-semibold text-brand-fg hover:bg-brand/90"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="size-5 animate-spin" aria-hidden />
                    Getting your code…
                  </>
                ) : (
                  PH.cta
                )}
              </Button>
              <p id="consent-note" className="text-xs text-ink-muted">
                {PH.privacyNote}
              </p>
            </FieldGroup>
          </form>
        )}
      </main>
      <footer className="px-5 pb-8 text-center text-xs text-ink-muted">
        Powered by {PH.productName}
      </footer>
    </div>
  );
}
