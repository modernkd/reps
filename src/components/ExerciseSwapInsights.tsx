import type { ExerciseSwapOption } from '@/lib/exerciseDb'
import { getCopy, type AppLanguage } from '@/lib/i18n'
import { useExerciseSwapRecommendations } from '@/lib/useExerciseSwapRecommendations'

import styles from './styles/ExerciseSwapInsights.module.css'

type ExerciseSwapInsightsProps = {
  language: AppLanguage
  exerciseName: string
  onSwap: (nextExerciseName: string) => void
}

function getReasonLabels(
  option: ExerciseSwapOption,
  copy: ReturnType<typeof getCopy>,
): string[] {
  const labels: string[] = []

  if (option.muscleFocus.length > 0) {
    labels.push(copy.sessionPlan.reasonMuscle(option.muscleFocus[0]!))
  }

  if (option.sameEquipment && option.exercise.equipment) {
    labels.push(copy.sessionPlan.reasonEquipment(option.exercise.equipment))
  }

  if (option.sameCategory && option.exercise.category) {
    labels.push(copy.sessionPlan.reasonCategory(option.exercise.category))
  }

  return labels
}

type SwapOptionListProps = {
  options: ExerciseSwapOption[]
  copy: ReturnType<typeof getCopy>
  emptyText: string
  onSwap: (nextExerciseName: string) => void
}

function SwapOptionList({ options, copy, emptyText, onSwap }: SwapOptionListProps) {
  if (options.length === 0) {
    return <p className={styles.emptyState}>{emptyText}</p>
  }

  return (
    <ul className={styles.optionList}>
      {options.map((option) => {
        const reasonLabels = getReasonLabels(option, copy)

        return (
          <li key={option.exercise.id}>
            <button
              type="button"
              className={styles.optionButton}
              onClick={() => onSwap(option.exercise.name)}
              aria-label={copy.sessionPlan.swapToExercise(option.exercise.name)}
            >
              <span className={styles.optionName}>{option.exercise.name}</span>
              {reasonLabels.length > 0 ? (
                <span className={styles.optionMeta}>{reasonLabels.join(' · ')}</span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function ExerciseSwapInsights({
  language,
  exerciseName,
  onSwap,
}: ExerciseSwapInsightsProps) {
  const trimmedName = exerciseName.trim()
  const copy = getCopy(language)
  const { recommendations, isLoading } = useExerciseSwapRecommendations(trimmedName)

  if (!trimmedName) {
    return null
  }

  const similarOptions = recommendations?.similar ?? []
  const beginnerOptions = recommendations?.beginnerSafe ?? []
  const techniqueSnippets = recommendations?.techniqueSnippets ?? []

  return (
    <section className={styles.root}>
      <div className={styles.swapColumns}>
        <div className={styles.swapBlock}>
          <h4 className={styles.blockTitle}>{copy.sessionPlan.swapWithSimilar}</h4>
          {isLoading ? (
            <p className={styles.loading}>{copy.sessionPlan.loadingAlternatives}</p>
          ) : (
            <SwapOptionList
              options={similarOptions}
              copy={copy}
              emptyText={copy.sessionPlan.noSwapAlternatives}
              onSwap={onSwap}
            />
          )}
        </div>

        <div className={styles.swapBlock}>
          <h4 className={styles.blockTitle}>{copy.sessionPlan.beginnerSafeAlternatives}</h4>
          {isLoading ? (
            <p className={styles.loading}>{copy.sessionPlan.loadingAlternatives}</p>
          ) : (
            <SwapOptionList
              options={beginnerOptions}
              copy={copy}
              emptyText={copy.sessionPlan.noBeginnerAlternatives}
              onSwap={onSwap}
            />
          )}
        </div>
      </div>

      {techniqueSnippets.length > 0 ? (
        <div className={styles.techniqueBlock}>
          <h4 className={styles.blockTitle}>{copy.sessionPlan.techniqueSnippets}</h4>
          <ul className={styles.techniqueList}>
            {techniqueSnippets.map((snippet, index) => (
              <li key={`${trimmedName}_${index}`} className={styles.techniqueItem}>
                {snippet}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
