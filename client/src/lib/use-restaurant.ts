import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { PublicRestaurant } from "@/lib/api-types";
import { restaurantDescription, setDocumentMeta } from "@/lib/document-meta";
import { applyRestaurantTheme } from "@/lib/restaurant-theme";

export type RestaurantState =
  | { kind: "loading" }
  | { kind: "ready"; restaurant: PublicRestaurant }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export function usePublicRestaurant(slug: string): [RestaurantState, () => void] {
  const [state, setState] = useState<RestaurantState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getRestaurant(slug)
      .then(({ restaurant }) => {
        if (cancelled) return;
        applyRestaurantTheme(restaurant.brandColor);
        setDocumentMeta({
          title: restaurant.name,
          description: restaurantDescription(restaurant.name, restaurant.rewardTitle),
        });
        setState({ kind: "ready", restaurant });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        applyRestaurantTheme();
        if (error instanceof ApiError && error.code === "NOT_FOUND") setState({ kind: "not_found" });
        else setState({ kind: "error", message: error instanceof ApiError ? error.message : "Couldn't load." });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  return [state, () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }];
}
