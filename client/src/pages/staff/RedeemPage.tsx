import { useEffect, useRef, useState } from "react";
import { Loader2Icon, PhoneIcon, SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/staff/PageHeader";
import { RewardResultCard } from "@/components/staff/RewardResultCard";
import { resultFromReward, type RedeemResult } from "@/lib/redeem-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ApiError, api } from "@/lib/api";
import type { ContactWithReward } from "@/lib/api-types";
import { getStaffToken } from "@/lib/auth";
import {
  AMBIGUOUS_CODE_CHARS,
  REWARD_CODE_ALPHABET,
  REWARD_CODE_LENGTH,
  isCompleteRewardCode,
  normalizeRewardCode,
  stripCodeWhitespace,
} from "@/lib/reward-code";

const DONE_RESET_MS = 6000;

function errorResult(error: unknown, fallback: string): RedeemResult {
  // 404 covers unknown codes AND other restaurants' codes: same copy either way.
  if (error instanceof ApiError && error.code === "NOT_FOUND") return { kind: "not_found" };
  if (error instanceof ApiError && error.code === "RATE_LIMITED") {
    return { kind: "error", message: "Too many checks. Wait a minute and try again." };
  }
  if (error instanceof ApiError && error.code === "NETWORK_ERROR") return { kind: "error", message: error.message };
  return { kind: "error", message: error instanceof ApiError ? error.message : fallback };
}

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [showPhone, setShowPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneMatches, setPhoneMatches] = useState<ContactWithReward[] | null>(null);
  const lastChecked = useRef("");
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result?.kind !== "done") return;
    const id = window.setTimeout(reset, DONE_RESET_MS);
    return () => window.clearTimeout(id);
  }, [result]);

  async function check(nextCode: string) {
    const normalized = normalizeRewardCode(nextCode);
    const token = getStaffToken();
    if (!token || !isCompleteRewardCode(normalized)) return;
    lastChecked.current = normalized;
    setPending(true);
    setPhoneMatches(null);
    try {
      const data = await api.getReward(token, normalized);
      setResult(resultFromReward(data.reward, data.contact.name));
    } catch (error) {
      setResult(errorResult(error, "Couldn't check that code."));
      if (error instanceof ApiError && error.code === "NOT_FOUND") otpRef.current?.select();
    } finally {
      setPending(false);
    }
  }

  async function markUsed() {
    if (result?.kind !== "valid") return;
    const token = getStaffToken();
    if (!token) return;
    const { reward, name } = result;
    setPending(true);
    try {
      const data = await api.redeemReward(token, reward.code);
      setResult({ kind: "done", reward: data.reward, name: data.contact.name });
    } catch (error) {
      if (error instanceof ApiError && (error.code === "ALREADY_REDEEMED" || error.code === "REWARD_EXPIRED")) {
        // Someone else got there first (or it just expired): show the fresh server state.
        try {
          const fresh = await api.getReward(token, reward.code);
          setResult(resultFromReward(fresh.reward, fresh.contact.name));
        } catch {
          setResult(error.code === "REWARD_EXPIRED" ? { kind: "expired", reward, name } : { kind: "used", reward, name });
        }
      } else {
        setResult(errorResult(error, "Couldn't mark this as used."));
      }
    } finally {
      setPending(false);
    }
  }

  async function findByPhone(event: React.FormEvent) {
    event.preventDefault();
    const token = getStaffToken();
    const q = phone.trim();
    if (!token || q.replace(/\D/g, "").length < 6) {
      setResult({ kind: "error", message: "Type the guest's full phone number." });
      return;
    }
    setPending(true);
    setResult(null);
    setPhoneMatches(null);
    try {
      const data = await api.listContacts(token, { q, limit: 5 });
      const digits = q.replace(/\D/g, "").replace(/^0+/, "");
      const matches = data.contacts.filter((c) => c.phoneE164.replace(/\D/g, "").endsWith(digits.slice(-8)));
      if (matches.length === 0) setResult({ kind: "not_found" });
      else if (matches.length === 1) setResult(resultFromReward(matches[0].reward, matches[0].name));
      else setPhoneMatches(matches);
    } catch (error) {
      setResult(errorResult(error, "Couldn't search contacts."));
    } finally {
      setPending(false);
    }
  }

  function onCodeChange(raw: string) {
    const upper = stripCodeWhitespace(raw);
    const bad = [...upper].find((ch) => !REWARD_CODE_ALPHABET.includes(ch));
    if (bad) {
      setHint(AMBIGUOUS_CODE_CHARS.has(bad) ? "That character isn't used in codes" : "Codes only use letters A–Z and 2–9");
    } else {
      setHint(null);
    }
    const cleaned = [...upper].filter((ch) => REWARD_CODE_ALPHABET.includes(ch)).join("").slice(0, REWARD_CODE_LENGTH);
    setCode(cleaned);
    if (cleaned.length < REWARD_CODE_LENGTH) {
      lastChecked.current = "";
      if (result && result.kind !== "done") setResult(null);
    } else if (cleaned !== lastChecked.current) {
      void check(cleaned);
    }
  }

  function reset() {
    setCode("");
    setResult(null);
    setHint(null);
    setPhoneMatches(null);
    lastChecked.current = "";
    otpRef.current?.focus();
  }

  return (
    <div>
      <PageHeader title="Redeem" description="Type the 6-character code from the guest's screen." />

      <div className="mt-6 max-w-md">
        <InputOTP
          ref={otpRef}
          maxLength={REWARD_CODE_LENGTH}
          value={code}
          onChange={onCodeChange}
          pasteTransformer={stripCodeWhitespace}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          aria-label="Reward code"
          data-testid="redeem-code-input"
          containerClassName="justify-start"
        >
          <InputOTPGroup className="gap-2">
            {Array.from({ length: REWARD_CODE_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-14 w-12 rounded-xl border border-input bg-card font-mono text-[28px] font-bold first:rounded-xl last:rounded-xl"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <p className="mt-2 min-h-5 text-sm text-danger" aria-live="polite">
          {hint}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl"
            disabled={pending || code.length !== REWARD_CODE_LENGTH}
            onClick={() => void check(code)}
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <SearchIcon className="size-4" aria-hidden />}
            Check code
          </Button>
          <button
            type="button"
            className="min-h-11 text-sm font-medium text-ink underline underline-offset-4"
            onClick={() => setShowPhone((v) => !v)}
            aria-expanded={showPhone}
          >
            Find by phone
          </button>
        </div>

        {showPhone ? (
          <form className="mt-3 flex gap-2" onSubmit={(e) => void findByPhone(e)}>
            <div className="relative flex-1">
              <PhoneIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="069 123 4567"
                aria-label="Guest phone number"
                data-testid="redeem-phone-input"
                className="h-12 rounded-xl pl-9 text-base"
              />
            </div>
            <Button type="submit" className="h-12 rounded-xl" disabled={pending}>
              Find
            </Button>
          </form>
        ) : null}
      </div>

      <div className="mt-6 max-w-md">
        {phoneMatches ? (
          <ul className="flex flex-col gap-2">
            {phoneMatches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-border bg-card px-4 text-left"
                  onClick={() => {
                    setPhoneMatches(null);
                    setResult(resultFromReward(c.reward, c.name));
                  }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-ink-muted">{c.phoneE164}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {result ? <RewardResultCard result={result} pending={pending} onRedeem={() => void markUsed()} onReset={reset} /> : null}
      </div>
    </div>
  );
}
