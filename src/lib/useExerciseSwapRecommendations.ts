import { useEffect, useState } from "react";

import {
  getExerciseSwapRecommendations,
  type ExerciseSwapRecommendations,
} from "./exerciseDb";

type UseExerciseSwapRecommendationsResult = {
  recommendations: ExerciseSwapRecommendations | undefined;
  isLoading: boolean;
};

const recommendationCache = new Map<string, ExerciseSwapRecommendations>();
const inFlightRecommendations = new Map<
  string,
  Promise<ExerciseSwapRecommendations>
>();

function normalizeExerciseKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getOrLoadRecommendations(
  exerciseName: string,
): Promise<ExerciseSwapRecommendations> {
  const normalizedName = normalizeExerciseKey(exerciseName);
  const cached = recommendationCache.get(normalizedName);
  if (cached) {
    return Promise.resolve(cached);
  }

  const inFlight = inFlightRecommendations.get(normalizedName);
  if (inFlight) {
    return inFlight;
  }

  const request = getExerciseSwapRecommendations(exerciseName)
    .then((result) => {
      recommendationCache.set(normalizedName, result);
      return result;
    })
    .finally(() => {
      inFlightRecommendations.delete(normalizedName);
    });

  inFlightRecommendations.set(normalizedName, request);
  return request;
}

export function useExerciseSwapRecommendations(
  exerciseName: string,
): UseExerciseSwapRecommendationsResult {
  const [recommendations, setRecommendations] = useState<
    ExerciseSwapRecommendations | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!exerciseName.trim()) {
      setRecommendations(undefined);
      setIsLoading(false);
      return;
    }

    const normalizedName = normalizeExerciseKey(exerciseName);
    const cached = recommendationCache.get(normalizedName);
    if (cached) {
      setRecommendations(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      getOrLoadRecommendations(exerciseName)
        .then((result) => {
          if (!cancelled) {
            setRecommendations(result);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [exerciseName]);

  return { recommendations, isLoading };
}
