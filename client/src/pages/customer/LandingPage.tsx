import { useLayoutEffect, useRef, useState } from "react";
import { Controller, useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { Link } from "@/lib/router";
import { useNavigate, useParams } from "@/lib/router-hooks";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { AlreadyClaimedCard } from "@/components/customer/AlreadyClaimedCard";
import { ConsentRow } from "@/components/customer/ConsentRow";
import { CustomerLayout } from "@/components/customer/CustomerLayout";
import { ApiError, api } from "@/lib/api";
import type { PublicSignupMaskedResponse } from "@/lib/api-types";
import { PH } from "@/lib/placeholders";
import { readDeviceToken, readTicket, saveTicket } from "@/lib/storage";
import { usePublicRestaurant } from "@/lib/use-restaurant";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const COUNTRY_CODES = [
  { value: "+355", label: "🇦🇱 +355" },
  { value: "+383", label: "🇽🇰 +383" },
  { value: "+389", label: "🇲🇰 +389" },
  { value: "+39", label: "🇮🇹 +39" },
  { value: "+30", label: "🇬🇷 +30" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+49", label: "🇩🇪 +49" },
  { value: "+1", label: "🇺🇸 +1" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Values = {
  name: string;
  countryCode: string;
  phone: string;
  email: string;
  birthDay: string;
  birthMonth: string;
  marketingConsent: boolean;
};

/**
 * Hand-written resolver instead of a schema library: keeps the public landing chunk
 * under the DESIGN.md §8b JS budget. Returns trimmed values like the server expects.
 */
const resolver: Resolver<Values> = (raw) => {
  const values: Values = { ...raw, name: raw.name.trim(), phone: raw.phone.trim(), email: raw.email.trim() };
  const errors: FieldErrors<Values> = {};
  const fail = (field: keyof Values, message: string) => {
    errors[field] ??= { type: "validate", message };
  };

  if (!values.name) fail("name", "Enter your name");
  else if (values.name.length > 60) fail("name", "Keep it under 60 characters");

  if (!values.phone) fail("phone", "Enter your phone number");
  else if (values.phone.replace(/\D/g, "").length < 6) fail("phone", "That phone number looks too short");
  else if (values.phone.length > 32) fail("phone", "That phone number looks too long");

  if (values.email) {
    if (values.email.length > 254) fail("email", "That email looks too long");
    else if (!EMAIL_RE.test(values.email)) fail("email", "Enter a valid email");
  }

  if (!!values.birthDay !== !!values.birthMonth) fail("birthDay", "Pick day and month, or neither");
  else if (values.birthDay && Number(values.birthDay) > DAYS_IN_MONTH[Number(values.birthMonth) - 1]) {
    fail("birthDay", "That day isn't in that month");
  }

  return Object.keys(errors).length ? { values: {}, errors } : { values, errors: {} };
};

type FieldName = keyof Values;
const FIELD_ORDER: FieldName[] = ["name", "phone", "email", "birthDay", "marketingConsent"];

/** Local formats (069…, 00355…, +355…) are sent as typed; the server normalises. */
function buildPhone(countryCode: string, raw: string): string {
  const typed = raw.trim();
  if (typed.startsWith("+") || typed.startsWith("00")) return typed;
  if (countryCode === "+355") return typed;
  return `${countryCode}${typed.replace(/^0+/, "")}`;
}

/** Server validation `details.fields` keys → our form fields. */
function mapServerField(key: string): FieldName | null {
  if (key === "name" || key === "phone" || key === "email" || key === "marketingConsent") return key;
  if (key.startsWith("birthday")) return "birthDay";
  return null;
}

const GENERIC_SUBMIT_ERROR = "Something went wrong on our side. Please try again, or ask your waiter.";

type SubmitError = { kind: "network" } | { kind: "rate" } | { kind: "other"; message: string };

export default function LandingPage() {
  const { slug = "" } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [restaurantState, retryRestaurant] = usePublicRestaurant(slug);
  const [masked, setMasked] = useState<PublicSignupMaskedResponse | null>(null);
  const [offerEnded, setOfferEnded] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const existingTicket = readTicket(slug);

  const form = useForm<Values>({
    resolver,
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: {
      name: "",
      countryCode: "+355",
      phone: "",
      email: "",
      birthDay: "",
      birthMonth: "",
      marketingConsent: false,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const restaurant = restaurantState.kind === "ready" ? restaurantState.restaurant : null;
  const restaurantName = restaurant?.name ?? "";
  const rewardTitle = restaurant?.rewardTitle.trim() ?? "";
  const rewardLower = rewardTitle.toLowerCase();

  async function onSubmit(values: Values) {
    setSubmitError(null);
    try {
      const email = values.email.trim();
      const result = await api.signup(slug, {
        name: values.name.trim(),
        phone: buildPhone(values.countryCode, values.phone),
        ...(email ? { email } : {}),
        birthday: values.birthDay && values.birthMonth ? { day: Number(values.birthDay), month: Number(values.birthMonth) } : null,
        marketingConsent: values.marketingConsent,
        deviceToken: readDeviceToken(slug),
      });
      if (result.alreadyClaimed) {
        setMasked(result);
        window.scrollTo({ top: 0 });
        return;
      }
      saveTicket(slug, {
        deviceToken: result.deviceToken,
        code: result.reward.code,
        title: result.reward.title,
        firstName: result.firstName,
        status: result.reward.status,
        expiresAt: result.reward.expiresAt,
        redeemedAt: result.reward.redeemedAt,
      });
      // The mono code font is only needed from here on; start fetching it now.
      void import("@/fonts/reward-mono.ts");
      navigate(`/r/${slug}/reward/${encodeURIComponent(result.deviceToken)}`, {
        state: { welcomeBack: result.isExisting },
      });
    } catch (error) {
      if (!(error instanceof ApiError)) return setSubmitError({ kind: "network" });
      if (error.code === "NETWORK_ERROR") return setSubmitError({ kind: "network" });
      if (error.code === "RATE_LIMITED") return setSubmitError({ kind: "rate" });
      if (error.code === "OFFER_ENDED" || error.code === "NOT_FOUND") return setOfferEnded(true);
      if (error.code === "VALIDATION_ERROR") {
        let first: FieldName | null = null;
        for (const [key, message] of Object.entries(error.fields)) {
          const field = mapServerField(key);
          if (!field) continue;
          form.setError(field, { type: "server", message });
          if (!first || FIELD_ORDER.indexOf(field) < FIELD_ORDER.indexOf(first)) first = field;
        }
        if (first) {
          form.setFocus(first);
          return;
        }
      }
      // 413 payload too large, 5xx, malformed body, anything unexpected: generic copy, never raw server text.
      setSubmitError({ kind: "other", message: GENERIC_SUBMIT_ERROR });
    }
  }

  const submit = form.handleSubmit(onSubmit);

  if (restaurantState.kind === "not_found") {
    return (
      <CustomerLayout restaurantName="">
        <div className="mt-8 rounded-2xl bg-surface p-6 shadow-sm">
          <h1 className="font-heading text-2xl font-bold text-ink">We couldn't find this restaurant</h1>
          <p className="mt-2 text-ink-muted">Check the QR code on your table, or ask your waiter.</p>
        </div>
      </CustomerLayout>
    );
  }

  const ended = offerEnded || restaurant?.offerActive === false;

  return (
    <CustomerLayout restaurantName={restaurantName} gap="gap-3">
      {masked ? (
        <AlreadyClaimedCard last2={masked.last2} status={masked.status} />
      ) : (
        <>
          <section>
            <p className="min-h-5 text-sm font-semibold text-brand">{restaurantName ? `Welcome to ${restaurantName}` : ""}</p>
            <OfferHeadline rewardTitle={rewardTitle} />
            <p className="mt-1 text-ink-muted">{PH.offerSub}</p>
          </section>

          {existingTicket && !ended ? (
            <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink">
              You already have a reward on this phone.{" "}
              <Link
                className="font-semibold text-brand underline underline-offset-2"
                to={`/r/${slug}/reward/${encodeURIComponent(existingTicket.deviceToken)}`}
              >
                Show my code
              </Link>
            </p>
          ) : null}

          {restaurantState.kind === "error" ? (
            <InlineAlert message="Couldn't connect. Check your signal and try again." onRetry={retryRestaurant} />
          ) : null}

          {ended ? (
            <div className="rounded-2xl bg-surface p-6 shadow-sm">
              <p className="text-lg text-ink">This offer has ended. Thanks for visiting {restaurantName}.</p>
            </div>
          ) : (
            <form className="rounded-2xl bg-surface p-4 shadow-sm" onSubmit={submit} noValidate>
              <div className="flex flex-col gap-4">
                <TextField
                  id="name"
                  label="Name"
                  error={errors.name?.message}
                  inputProps={{ ...form.register("name"), autoComplete: "given-name", "data-testid": "claim-name" }}
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="phone" className="text-sm font-semibold text-ink">
                    Phone
                  </label>
                  <div className="flex gap-2">
                    <select
                      aria-label="Country code"
                      className="h-12 w-[6.75rem] shrink-0 rounded-xl border border-line bg-surface px-2 text-base text-ink"
                      {...form.register("countryCode")}
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      data-testid="claim-phone"
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? "phone-error" : "phone-help"}
                      className={inputClass(!!errors.phone)}
                      {...form.register("phone")}
                    />
                  </div>
                  <FieldMessage id="phone-error" error={errors.phone?.message} helpId="phone-help" help="One reward per phone number" />
                </div>

                <TextField
                  id="email"
                  label="Email (optional)"
                  error={errors.email?.message}
                  inputProps={{
                    ...form.register("email"),
                    type: "email",
                    inputMode: "email",
                    autoComplete: "email",
                    "data-testid": "claim-email",
                  }}
                />

                <fieldset className="flex flex-col gap-1.5" data-testid="claim-birthday">
                  <legend className="text-sm font-semibold text-ink">
                    Birthday <span className="font-normal text-ink-muted">(optional)</span>
                  </legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <select
                      id="birthDay"
                      aria-label="Birthday day"
                      aria-invalid={!!errors.birthDay}
                      aria-describedby={errors.birthDay ? "birthDay-error" : "birthday-help"}
                      className={inputClass(!!errors.birthDay)}
                      {...form.register("birthDay")}
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Birthday month"
                      aria-invalid={!!errors.birthDay}
                      className={inputClass(!!errors.birthDay)}
                      {...form.register("birthMonth", { onChange: () => form.clearErrors("birthDay") })}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FieldMessage
                    id="birthDay-error"
                    error={errors.birthDay?.message}
                    helpId="birthday-help"
                    help="So we can treat you on your birthday"
                  />
                </fieldset>

                <Controller
                  name="marketingConsent"
                  control={form.control}
                  render={({ field }) => (
                    <ConsentRow
                      id="marketingConsent"
                      testId="claim-consent"
                      label={restaurant?.consentText ?? PH.consentLabel}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      describedBy="consent-note"
                    />
                  )}
                />

                {submitError ? (
                  <InlineAlert
                    message={
                      submitError.kind === "network"
                        ? "Couldn't connect. Check your signal and try again."
                        : submitError.kind === "rate"
                          ? "Too many tries, wait a minute and try again."
                          : submitError.message
                    }
                    onRetry={submitError.kind === "rate" ? undefined : () => void submit()}
                  />
                ) : null}

                <button
                  type="submit"
                  data-testid="claim-submit"
                  disabled={isSubmitting || restaurantState.kind === "loading"}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-center text-lg leading-tight font-semibold text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2Icon className="size-5 animate-spin" aria-hidden />
                      Getting your code…
                    </>
                  ) : rewardLower ? (
                    `Get my ${rewardLower}`
                  ) : (
                    PH.ctaFallback
                  )}
                </button>
                <p id="consent-note" className="text-xs text-ink-muted">
                  Your {rewardLower || "reward"} doesn't depend on the box above. Privacy notice [PH]
                </p>
              </div>
            </form>
          )}
        </>
      )}
    </CustomerLayout>
  );
}

const H1_CLASS = "font-heading text-3xl leading-tight font-bold text-ink min-[400px]:text-4xl";

/**
 * DESIGN.md §8c: "{rewardTitle} on us" when it fits on 2 lines, otherwise just "{rewardTitle}".
 * An invisible copy with the long text is measured, so the visible h1 never flickers or loops.
 */
function OfferHeadline({ rewardTitle }: { rewardTitle: string }) {
  const probeRef = useRef<HTMLParagraphElement>(null);
  const [fitsLong, setFitsLong] = useState(true);
  const long = rewardTitle ? `${rewardTitle} on us` : "";

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe || !long) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(probe).lineHeight) || 1;
      setFitsLong(Math.round(probe.getBoundingClientRect().height / lineHeight) <= 2);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [long]);

  return (
    <div className="relative mt-1">
      {long ? (
        <p ref={probeRef} aria-hidden className={`${H1_CLASS} pointer-events-none invisible absolute inset-x-0 top-0`}>
          {long}
        </p>
      ) : null}
      {/* min-h keeps the form from jumping while the restaurant loads. */}
      <h1 className={`${H1_CLASS} min-h-[1.25em]`}>{fitsLong ? long : rewardTitle}</h1>
    </div>
  );
}

function inputClass(invalid: boolean): string {
  return `h-12 w-full min-w-0 rounded-xl border bg-surface px-3 text-base text-ink outline-none ${
    invalid ? "border-danger" : "border-line"
  }`;
}

type TextFieldProps = {
  id: string;
  label: string;
  error?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & { "data-testid"?: string; ref?: React.Ref<HTMLInputElement> };
};

function TextField({ id, label, error, inputProps }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(!!error)}
        {...inputProps}
      />
      <FieldMessage id={`${id}-error`} error={error} />
    </div>
  );
}

/** Reserves `min-h-5` so errors don't shift the layout (DESIGN.md §7). */
function FieldMessage({ id, error, help, helpId }: { id: string; error?: string; help?: string; helpId?: string }) {
  return (
    <div className="min-h-5 text-sm">
      {error ? (
        <p id={id} role="alert" className="flex items-center gap-1 text-danger">
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-ink-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function InlineAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
      <p className="flex items-start gap-2">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          className="h-11 self-start rounded-xl border border-line bg-surface px-4 font-semibold text-ink"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
