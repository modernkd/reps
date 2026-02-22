import { useEffect, useState } from 'react'

import {
  resolveExerciseReferenceContent,
  type ExerciseReferenceContent,
} from './exerciseImages'

type UseExerciseReferenceContentResult = {
  content: ExerciseReferenceContent | undefined
  isLoading: boolean
}

export function useExerciseReferenceContent(
  exerciseId: string,
  exerciseName: string,
  refreshKey = 0,
): UseExerciseReferenceContentResult {
  const [content, setContent] = useState<ExerciseReferenceContent | undefined>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const hasSearchTarget = exerciseName.trim().length > 0
    if (!hasSearchTarget) {
      setContent(undefined)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    resolveExerciseReferenceContent(exerciseId, exerciseName)
      .then((nextContent) => {
        if (!cancelled) {
          setContent(nextContent)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [exerciseId, exerciseName, refreshKey])

  return { content, isLoading }
}
