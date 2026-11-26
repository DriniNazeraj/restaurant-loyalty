const rewardKey = (slug: string) => `loyalty.rewardToken:${slug}`;
const rewardPayloadKey = (slug: string, token: string) =>
  `loyalty.rewardPayload:${slug}:${token}`;

export type CachedReward = {
  token: string;
  code: string;
  title: string;
  name: string;
  redeemedAt: string | null;
  isExisting: boolean;
};

export function saveRewardToken(slug: string, token: string): void {
  localStorage.setItem(rewardKey(slug), token);
}

export function readRewardToken(slug: string): string | null {
  return localStorage.getItem(rewardKey(slug));
}

export function saveRewardPayload(
  slug: string,
  token: string,
  payload: CachedReward,
): void {
  saveRewardToken(slug, token);
  localStorage.setItem(rewardPayloadKey(slug, token), JSON.stringify(payload));
}

export function readRewardPayload(
  slug: string,
  token: string,
): CachedReward | null {
  const raw = localStorage.getItem(rewardPayloadKey(slug, token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedReward;
  } catch {
    return null;
  }
}
