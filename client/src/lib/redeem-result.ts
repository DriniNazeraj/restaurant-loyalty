import type { StaffRewardDetail } from "@/lib/api-types";

export type RedeemResult =
  | { kind: "valid"; reward: StaffRewardDetail; name: string; phone?: string }
  | { kind: "done"; reward: StaffRewardDetail; name: string }
  | { kind: "used"; reward: StaffRewardDetail; name: string }
  | { kind: "expired"; reward: StaffRewardDetail; name: string }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export function resultFromReward(reward: StaffRewardDetail, name: string): RedeemResult {
  if (reward.status === "redeemed") return { kind: "used", reward, name };
  if (reward.status === "expired") return { kind: "expired", reward, name };
  return { kind: "valid", reward, name };
}
