import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "@/lib/router";
import { useLocationState, useNavigate } from "@/lib/router-hooks";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import * as z from "zod/mini";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { ApiError, api } from "@/lib/api";
import { saveStaffSession, useStaffSession } from "@/lib/auth";
import { readDocumentMeta, setDocumentMeta } from "@/lib/document-meta";
import { applyRestaurantTheme } from "@/lib/restaurant-theme";
import { PH } from "@/lib/placeholders";

const loginSchema = z.object({
  email: z.string().check(z.trim(), z.minLength(1, "Enter your email"), z.refine((v) => /^[^\s@]+@[^\s@]+$/.test(v), "Enter a valid email")),
  password: z.string().check(z.minLength(1, "Enter your password")),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const from = safeFrom(useLocationState<{ from?: string }>()?.from);
  const session = useStaffSession();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = readDocumentMeta();
    setDocumentMeta({
      title: `Staff sign in · ${PH.productName}`,
      description: `Sign in to ${PH.productName} to redeem guest rewards, see contacts and print QR cards.`,
    });
    return () => setDocumentMeta(previous);
  }, []);

  const form = useForm<LoginValues>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (session) return <Navigate to={from} replace />;

  async function onSubmit(values: LoginValues) {
    setError(null);
    try {
      const result = await api.login(values.email, values.password);
      saveStaffSession(result);
      applyRestaurantTheme(result.restaurant.brandColor);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setError("Too many attempts. Try again in a few minutes.");
        return;
      }
      if (err instanceof ApiError && (err.code === "UNAUTHORIZED" || err.status === 401)) {
        setError("Email or password is wrong");
        return;
      }
      setError(err instanceof ApiError && err.code !== "NETWORK_ERROR" ? err.message : "Couldn't connect. Is the server running?");
    }
  }

  return (
    <div className="staff-app flex min-h-svh items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-center font-heading text-2xl font-bold text-ink">{PH.productName}</h1>
        <p className="mt-1 text-center text-sm text-ink-muted">Staff sign in</p>
        <form className="mt-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                className="h-12 rounded-xl text-base"
                {...form.register("email")}
                aria-invalid={Boolean(form.formState.errors.email)}
              />
              <div className="min-h-5">
                {form.formState.errors.email ? (
                  <FieldError errors={[form.formState.errors.email]} />
                ) : null}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-12 rounded-xl pr-12 text-base"
                  {...form.register("password")}
                  aria-invalid={Boolean(form.formState.errors.password)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center text-ink-muted"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
              <div className="min-h-5">
                {form.formState.errors.password ? (
                  <FieldError errors={[form.formState.errors.password]} />
                ) : null}
              </div>
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={form.formState.isSubmitting} className="h-12 w-full rounded-xl">
              {form.formState.isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  Logging in…
                </>
              ) : (
                "Log in"
              )}
            </Button>
          </FieldGroup>
        </form>
        <p className="mt-4 text-center text-xs text-ink-muted">
          Forgot password? Ask [PH company] to reset it.
        </p>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

/** Only return to an /admin page (never an external or login URL). */
function safeFrom(from: string | undefined): string {
  if (from && from.startsWith("/admin/") && !from.startsWith("/admin/login")) return from;
  return "/admin/redeem";
}
