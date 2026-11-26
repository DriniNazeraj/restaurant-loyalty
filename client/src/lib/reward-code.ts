/** 6-char codes; alphabet omits 0/O/1/I (DESIGN.md §3.2). */
export const REWARD_CODE_LENGTH = 6;
export const REWARD_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const AMBIGUOUS_CODE_CHARS = new Set(["0", "O", "1", "I"]);

export function normalizeRewardCode(raw: string): string {
  return raw.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
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
