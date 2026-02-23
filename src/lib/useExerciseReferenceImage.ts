import { useEffect, useState } from "react";

import {
  resolveExerciseReferenceImage,
  type ExerciseReferenceImage,
} from "./exerciseImages";

type UseExerciseReferenceImageResult = {
  image: ExerciseReferenceImage | undefined;
  isLoading: boolean;
};

export function useExerciseReferenceImage(
  exerciseId: string,
  exerciseName: string,
  refreshKey = 0,
): UseExerciseReferenceImageResult {
  const [image, setImage] = useState<ExerciseReferenceImage | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const hasSearchTarget = exerciseName.trim().length > 0;
    if (!hasSearchTarget) {
      setImage(undefined);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    resolveExerciseReferenceImage(exerciseId, exerciseName)
      .then((nextImage) => {
        if (!cancelled) {
          setImage(nextImage);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [exerciseId, exerciseName, refreshKey]);

  return { image, isLoading };
}
