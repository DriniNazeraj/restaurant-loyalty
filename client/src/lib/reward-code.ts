/** 6-char codes; alphabet omits 0/O/1/I (DESIGN.md §3.2). */
export const REWARD_CODE_LENGTH = 6;
export const REWARD_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const AMBIGUOUS_CODE_CHARS = new Set(["0", "O", "1", "I"]);

/** Uppercase and drop all whitespace/separators: waiters type "tsj vjs", guests paste "TSJ-VJS". */
export function normalizeRewardCode(raw: string): string {
  return raw.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
}

const CODE_SEPARATORS = /[\s\u00A0\u200B-]/;

/** Uppercase and drop spaces/dashes only, keeping other characters so we can hint about them. */
export function stripCodeWhitespace(raw: string): string {
  return raw.toUpperCase().replaceAll(new RegExp(CODE_SEPARATORS.source, "g"), "");
}

export function isAmbiguousCodeChar(char: string): boolean {
  return AMBIGUOUS_CODE_CHARS.has(char.toUpperCase());
}

export function isRewardCodeChar(char: string): boolean {
  return REWARD_CODE_ALPHABET.includes(char.toUpperCase());
}

export function isCompleteRewardCode(code: string): boolean {
  const normalized = normalizeRewardCode(code);
  return (
    normalized.length === REWARD_CODE_LENGTH &&
    [...normalized].every((char) => REWARD_CODE_ALPHABET.includes(char))
  );
}

export function spellRewardCode(code: string): string {
  return [...code].join(" ");
}

/**
 * Strips spaces/dashes from text *before* the browser inserts it. Needed for the 6-box input:
 * input-otp caps the value at 6 (native maxlength + slice), so "n2k ubm" arriving in one input
 * event (autocomplete, IME commit, dictation) would otherwise lose its last letter to the space.
 * Returns a cleanup function.
 */
export function stripSeparatorsOnInsert(input: HTMLInputElement): () => void {
  const onBeforeInput = (event: InputEvent) => {
    if (!event.inputType.startsWith("insert") || event.data == null) return;
    if (!CODE_SEPARATORS.test(event.data)) return;
    event.preventDefault();
    const clean = stripCodeWhitespace(event.data);
    if (!clean) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(clean, start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  input.addEventListener("beforeinput", onBeforeInput);
  return () => input.removeEventListener("beforeinput", onBeforeInput);
}
