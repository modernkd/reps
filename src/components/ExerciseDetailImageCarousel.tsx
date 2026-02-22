import { useEffect, useState } from 'react'

import styles from './styles/ExerciseHistoryView.module.css'

type ExerciseDetailImageCarouselProps = {
  exerciseName: string
  images: string[]
  cycleHint: string
}

export function ExerciseDetailImageCarousel({
  exerciseName,
  images,
  cycleHint,
}: ExerciseDetailImageCarouselProps) {
  const [imageIndex, setImageIndex] = useState(0)
  const hasImages = images.length > 0
  const canCycleImages = images.length > 1

  useEffect(() => {
    setImageIndex(0)
  }, [exerciseName, images.length])

  if (!hasImages) {
    return null
  }

  const currentImageIndex = imageIndex % images.length
  const currentImage = images[currentImageIndex]

  return (
    <div className={styles.detailImageWrapper}>
      <button
        type="button"
        className={styles.detailImageButton}
        onClick={() => {
          if (!canCycleImages) {
            return
          }
          setImageIndex((previousIndex) => (previousIndex + 1) % images.length)
        }}
        aria-label={
          canCycleImages
            ? `${exerciseName} image ${currentImageIndex + 1} of ${images.length}`
            : `${exerciseName} image`
        }
      >
        <img src={currentImage} alt={exerciseName} loading="lazy" />
      </button>
      {canCycleImages ? (
        <>
          <span className={styles.detailImageStep}>
            {currentImageIndex + 1}/{images.length}
          </span>
          <span className={styles.detailImageHint}>{cycleHint}</span>
        </>
      ) : null}
    </div>
  )
}
