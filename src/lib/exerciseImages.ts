import {
  getCatalogExerciseIdByName,
  isCustomExerciseVariant,
} from "./variants";
import { defaultExercisesData } from "./defaultExercisesData";

const CUSTOM_IMAGE_STORAGE_KEY = "workout-tracker.custom-exercise-images.v1";
const LOCAL_FALLBACK_EXERCISE_ID = "ex_bench_press";

export type ExerciseReferenceImage = {
  url: string;
  source: "uploaded" | "commons" | "db";
};

export type FreeExerciseDbEntry = {
  id: string;
  name: string;
  category?: string;
  equipment?: string;
  force?: string;
  level?: string;
  mechanic?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  images?: string[];
  instructions?: string[];
};

type StoredCustomExerciseImages = Record<string, string>;

export type ExerciseReferenceContent = {
  images: string[];
  instructions: string[];
  source: "uploaded" | "commons" | "db";
};

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function readCustomImageStore(): StoredCustomExerciseImages {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_IMAGE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as StoredCustomExerciseImages;
  } catch {
    return {};
  }
}

function writeCustomImageStore(store: StoredCustomExerciseImages): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CUSTOM_IMAGE_STORAGE_KEY,
      JSON.stringify(store),
    );
  } catch {
    // Ignore failed persistence in private mode / restricted contexts.
  }
}

export function getUploadedExerciseImage(
  exerciseName: string,
): string | undefined {
  const key = normalizeExerciseName(exerciseName);
  if (!key) {
    return undefined;
  }

  const store = readCustomImageStore();
  return store[key];
}

export function saveUploadedExerciseImage(
  exerciseName: string,
  imageUrl: string,
): void {
  const key = normalizeExerciseName(exerciseName);
  if (!key || !imageUrl) {
    return;
  }

  const next = readCustomImageStore();
  next[key] = imageUrl;
  writeCustomImageStore(next);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read image file."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

// In-memory cache for the free-exercise-db JSON
let freeExerciseDbCache: null | FreeExerciseDbEntry[] = null;
const exerciseReferenceContentCache = new Map<
  string,
  ExerciseReferenceContent
>();



export async function getFreeExerciseDbExerciseNames(): Promise<string[]> {
  // Delegate to central exerciseDb module
  const { getAllExerciseNames } = await import("./exerciseDb");
  return getAllExerciseNames();
}

function buildFreeExerciseImageUrl(path: string): string {
  return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${path}`;
}

function resolveExerciseImagePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("/images/") || /^https?:\/\//.test(trimmed)) {
    return trimmed;
  }

  return buildFreeExerciseImageUrl(trimmed);
}



export async function resolveFreeExerciseDbEntry(
  exerciseName: string,
): Promise<FreeExerciseDbEntry | undefined> {
  // Delegate to central exerciseDb module
  const { getExerciseByName } = await import("./exerciseDb");
  return getExerciseByName(exerciseName);
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function resolveExerciseReferenceContent(
  exerciseId: string,
  exerciseName: string,
): Promise<ExerciseReferenceContent | undefined> {
  const normalizedName = normalizeExerciseName(exerciseName);
  if (!normalizedName) {
    return undefined;
  }
  const normalizedExerciseId = exerciseId.trim();

  const uploaded = getUploadedExerciseImage(exerciseName);
  if (uploaded) {
    return {
      source: "uploaded",
      images: [uploaded],
      instructions: [],
    };
  }

  // Cache by ID preferentially if we have it, reducing name thrashing.
  const cacheKey = normalizedExerciseId || normalizedName;
  const cachedContent = exerciseReferenceContentCache.get(cacheKey);
  if (cachedContent) {
    return cachedContent;
  }

  if (normalizedExerciseId && defaultExercisesData[normalizedExerciseId]) {
    const data = defaultExercisesData[normalizedExerciseId];
    const images = data.images || [];
    const instructions = (data.instructions || [])
      .map((i: string) => i.trim())
      .filter((i: string) => i.length > 0);

    if (images.length > 0) {
      const result: ExerciseReferenceContent = {
        source: "db",
        images,
        instructions,
      };

      exerciseReferenceContentCache.set(cacheKey, result);
      return result;
    }
  }

  // Use central exerciseDb module instead of direct DB access
  const { getExerciseByName, getExerciseById } = await import("./exerciseDb");
  
  let matchedDbExercise;
  if (normalizedExerciseId) {
    matchedDbExercise = await getExerciseById(normalizedExerciseId);
  }
  
  if (!matchedDbExercise && exerciseName) {
    matchedDbExercise = await getExerciseByName(exerciseName);
  }
  
  if (matchedDbExercise) {
    const images =
      matchedDbExercise.images
        ?.map((path) => path.trim())
        .filter((path) => path.length > 0)
        .map(resolveExerciseImagePath) ?? [];
    const instructions =
      matchedDbExercise.instructions
        ?.map((instruction) => instruction.trim())
        .filter((instruction) => instruction.length > 0) ?? [];

    if (images.length > 0) {
      const result: ExerciseReferenceContent = {
        source: "db",
        images,
        instructions,
      };

      exerciseReferenceContentCache.set(normalizedName, result);
      return result;
    }
  }

  // Keep custom variants resilient when remote image URLs cannot be used.
  if (
    normalizedExerciseId &&
    isCustomExerciseVariant(normalizedExerciseId, exerciseName) &&
    matchedDbExercise?.images?.length
  ) {
    const firstImagePath = matchedDbExercise.images[0];
    if (firstImagePath) {
      const base64 = await fetchImageAsBase64(
        buildFreeExerciseImageUrl(firstImagePath),
      );
      if (base64) {
        const instructions =
          matchedDbExercise.instructions
            ?.map((instruction) => instruction.trim())
            .filter((instruction) => instruction.length > 0) ?? [];
        saveUploadedExerciseImage(exerciseName, base64);

        const result: ExerciseReferenceContent = {
          source: "uploaded",
          images: [base64],
          instructions,
        };

        exerciseReferenceContentCache.set(cacheKey, result);
        return result;
      }
    }
  }

  const fallbackExerciseId =
    normalizedExerciseId ||
    getCatalogExerciseIdByName(exerciseName) ||
    LOCAL_FALLBACK_EXERCISE_ID;

  const fallback: ExerciseReferenceContent = {
    source: "db", // default fallback assumes these are our static images
    images: [`/images/exercises/${fallbackExerciseId}_0.webp`],
    instructions: [],
  };
  exerciseReferenceContentCache.set(cacheKey, fallback);

  return fallback;
}

export async function resolveExerciseReferenceImage(
  exerciseId: string,
  exerciseName: string,
): Promise<ExerciseReferenceImage | undefined> {
  const content = await resolveExerciseReferenceContent(
    exerciseId,
    exerciseName,
  );
  const firstImage = content?.images[0];
  if (!firstImage) {
    return undefined;
  }

  return {
    source: content.source,
    url: firstImage,
  };
}
