import { useRef, useState } from "react";
import { CheckCircle2Icon, Loader2Icon, TriangleAlertIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ApiError, api, type RewardLookupResponse } from "@/lib/api";
import { getStaffToken } from "@/lib/auth";
import {
  AMBIGUOUS_CODE_CHARS,
  REWARD_CODE_LENGTH,
  isCompleteRewardCode,
  isRewardCodeChar,
  normalizeRewardCode,
} from "@/lib/reward-code";

type RedeemResult =
  | { kind: "valid"; data: RewardLookupResponse }
  | { kind: "used"; data: RewardLookupResponse }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const submittedRef = useRef("");

  async function lookup(nextCode: string) {
    const normalized = normalizeRewardCode(nextCode);
    if (!isCompleteRewardCode(normalized) || submittedRef.current === normalized) return;
    const token = getStaffToken();
    if (!token) return;
    submittedRef.current = normalized;
    setPending(true);
    setHint(null);
    try {
      const data = await api.getReward(token, normalized);
      setResult({ kind: data.reward.redeemedAt ? "used" : "valid", data });
    } catch (error) {
      // Cross-restaurant codes also return 404; show the same copy (DESIGN.md §8b).
      if (error instanceof ApiError && error.code === "NOT_FOUND") {
        setResult({ kind: "not_found" });
      } else if (error instanceof ApiError && error.code === "ALREADY_REDEEMED") {
        setResult({ kind: "used", data: { reward: { id: "", code: normalized, title: "", redeemedAt: new Date().toISOString() }, contact: { id: "", name: "a waiter", phoneE164: "", email: "" } } });
      } else {
        setResult({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Couldn't check that code.",
        });
      }
    } finally {
      setPending(false);
    }
  }

  async function markUsed() {
    if (!result || result.kind !== "valid") return;
    const token = getStaffToken();
    if (!token) return;
    setPending(true);
    try {
      const data = await api.redeemReward(token, result.data.reward.code);
      setResult({ kind: "used", data: { ...data, reward: { ...data.reward, redeemedAt: data.reward.redeemedAt ?? new Date().toISOString() } } });
    } catch (error) {
      if (error instanceof ApiError && error.code === "ALREADY_REDEEMED") {
        setResult({ kind: "used", data: result.data });
      } else if (error instanceof ApiError && error.code === "NOT_FOUND") {
        setResult({ kind: "not_found" });
      } else {
        setResult({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Couldn't mark this as used.",
        });
      }
    } finally {
      setPending(false);
    }
  }

  function onChange(raw: string) {
    const normalized = normalizeRewardCode(raw);
    const last = normalized.slice(-1);
    if (last && AMBIGUOUS_CODE_CHARS.has(last)) {
      setHint("That character isn't used in codes");
      return;
    }
    if (last && !isRewardCodeChar(last)) {
      setHint("That character isn't used in codes");
      return;
    }
    setHint(null);
    setCode(normalized);
    submittedRef.current = "";
    if (normalized.length === REWARD_CODE_LENGTH) {
      void lookup(normalized);
    }
  }

  function reset() {
    setCode("");
    setResult(null);
    setHint(null);
    submittedRef.current = "";
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">Redeem</h1>
      <p className="mt-1 text-ink-muted">Type the 6-character code from the guest&apos;s screen.</p>

      <div className="mt-8 max-w-md">
        <InputOTP
          maxLength={REWARD_CODE_LENGTH}
          value={code}
          onChange={onChange}
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          containerClassName="justify-start"
        >
          <InputOTPGroup className="gap-2">
            {Array.from({ length: REWARD_CODE_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-14 w-12 rounded-xl border border-input font-mono text-[28px] first:rounded-xl last:rounded-xl"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {hint ? <p className="mt-3 text-sm text-danger">{hint}</p> : null}
        <Button
          type="button"
          className="mt-4 h-12 w-full rounded-xl sm:w-auto"
          disabled={pending || !isCompleteRewardCode(code)}
          onClick={() => void lookup(code)}
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Check code
        </Button>
      </div>

      <div className="mt-6 max-w-md">
        {result?.kind === "valid" ? (
          <div className="rounded-2xl border border-line border-l-4 border-l-success bg-card p-5">
            <p className="flex items-center gap-2 font-medium text-success">
              <CheckCircle2Icon className="size-5" />
              Valid · {result.data.contact.name}
            </p>
            <p className="mt-1 text-sm text-ink-muted">Claimed on this visit</p>
            <Button className="mt-4 h-12 w-full rounded-xl" onClick={() => void markUsed()} disabled={pending}>
              Mark as used
            </Button>
          </div>
        ) : null}
        {result?.kind === "used" ? (
          <div className="rounded-2xl border border-line border-l-4 border-l-warning bg-card p-5">
            <p className="flex items-center gap-2 font-medium text-warning">
              <TriangleAlertIcon className="size-5" />
              Already used
              {result.data.reward.redeemedAt
                ? ` ${new Date(result.data.reward.redeemedAt).toLocaleString("en-GB")}`
                : ""}
              {result.data.contact.name ? ` by ${result.data.contact.name}` : ""}
            </p>
            <Button variant="outline" className="mt-4 h-12 rounded-xl" onClick={reset}>
              Redeem another
            </Button>
          </div>
        ) : null}
        {result?.kind === "not_found" ? (
          <div className="rounded-2xl border border-line border-l-4 border-l-danger bg-card p-5">
            <p className="flex items-center gap-2 font-medium text-danger">
              <XCircleIcon className="size-5" />
              No reward with that code. Check the letters with the guest.
            </p>
          </div>
        ) : null}
        {result?.kind === "error" ? (
          <div className="rounded-2xl border border-line border-l-4 border-l-danger bg-card p-5 text-danger">
            {result.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
