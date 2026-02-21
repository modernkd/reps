import { useEffect } from 'react'
import type { ReactNode } from 'react'

import styles from './styles/Modal.module.css'

type ModalProps = {
  title: string
  isOpen: boolean
  onClose: () => void
  closeLabel?: string
  children: ReactNode
}

export function Modal({ title, isOpen, onClose, closeLabel = 'Close', children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} className={styles.closeButton}>
            {closeLabel}
          </button>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
