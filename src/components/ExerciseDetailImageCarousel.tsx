import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

import styles from "./styles/ExerciseHistoryView.module.css";

type ExerciseDetailImageCarouselProps = {
  exerciseName: string;
  images: string[];
  cycleHint?: string;
  imageAlt?: string;
  imageObjectFit?: "cover" | "contain";
  imageAspectRatio?: string;
  autoplayIntervalMs?: number;
  manualPauseDurationMs?: number;
};

export function ExerciseDetailImageCarousel({
  exerciseName,
  images,
  cycleHint,
  imageAlt,
  imageObjectFit = "cover",
  imageAspectRatio = "4 / 5",
  autoplayIntervalMs,
  manualPauseDurationMs = 20000,
}: ExerciseDetailImageCarouselProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [isManualMode, setIsManualMode] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageRetryCount, setImageRetryCount] = useState(0);

  const manualModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hasImages = images.length > 0;
  const canCycleImages = images.length > 1;

  useEffect(() => {
    setImageIndex(0);
    setIsManualMode(false);
    setImageError(false);
    setImageRetryCount(0);
    if (manualModeTimeoutRef.current) {
      clearTimeout(manualModeTimeoutRef.current);
      manualModeTimeoutRef.current = null;
    }
  }, [exerciseName, images.length]);

  useEffect(() => {
    return () => {
      if (manualModeTimeoutRef.current) {
        clearTimeout(manualModeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canCycleImages || !autoplayIntervalMs || isManualMode) {
      return;
    }

    const intervalId = setInterval(() => {
      setImageIndex((previousIndex) => {
        setImageError(false);
        setImageRetryCount(0);
        return (previousIndex + 1) % images.length;
      });
    }, autoplayIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoplayIntervalMs, canCycleImages, images.length, isManualMode]);

  if (!hasImages) {
    return null;
  }

  const currentImageIndex = imageIndex % images.length;
  const currentImage = images[currentImageIndex];

  return (
    <div className={styles.detailImageWrapper}>
      <button
        type="button"
        className={styles.detailImageButton}
        onClick={() => {
          if (!canCycleImages) {
            return;
          }
          setImageIndex((previousIndex) => {
            setImageError(false);
            setImageRetryCount(0);
            return (previousIndex + 1) % images.length;
          });

          if (autoplayIntervalMs) {
            setIsManualMode(true);
            if (manualModeTimeoutRef.current) {
              clearTimeout(manualModeTimeoutRef.current);
            }
            manualModeTimeoutRef.current = setTimeout(() => {
              setIsManualMode(false);
              manualModeTimeoutRef.current = null;
            }, manualPauseDurationMs);
          }
        }}
        aria-label={
          canCycleImages
            ? `${exerciseName} image ${currentImageIndex + 1} of ${images.length}`
            : (imageAlt ?? `${exerciseName} image`)
        }
      >
        {imageError ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setImageError(false);
              setImageRetryCount((c) => c + 1);
            }}
            style={{
              width: "100%",
              height: "100%",
              aspectRatio: imageAspectRatio,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--surface-1)",
              color: "var(--ink-500)",
            }}
          >
            <ImageOff size={48} opacity={0.5} />
          </div>
        ) : (
          <img
            key={`${currentImage}-${imageRetryCount}`}
            src={currentImage}
            alt={imageAlt ?? exerciseName}
            loading="lazy"
            style={{ objectFit: imageObjectFit, aspectRatio: imageAspectRatio }}
            onError={() => setImageError(true)}
          />
        )}
      </button>
      {canCycleImages ? (
        <>
          <span className={styles.detailImageStep}>
            {currentImageIndex + 1}/{images.length}
          </span>
          {cycleHint ? (
            <span className={styles.detailImageHint}>{cycleHint}</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

