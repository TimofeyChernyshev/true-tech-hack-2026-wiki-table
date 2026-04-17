import type { ReactNode } from 'react'

type Props = {
  open: boolean
  onBackdropClose: () => void
  /** Если задан, передаётся в `aria-labelledby` на корневом узле. */
  ariaLabelledBy?: string
  rootClassName?: string
  cardClassName?: string
  children: ReactNode
}

export function ModalShell({
  open,
  onBackdropClose,
  ariaLabelledBy,
  rootClassName = '',
  cardClassName = '',
  children,
}: Props) {
  if (!open) return null

  const rootExtra = rootClassName.trim()
  const cardExtra = cardClassName.trim()

  return (
    <div
      className={rootExtra ? `wiki-modal-root ${rootExtra}` : 'wiki-modal-root'}
      role="dialog"
      aria-modal="true"
      {...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {})}
    >
      <button
        type="button"
        className="wiki-modal-backdrop"
        aria-label="Закрыть"
        onClick={onBackdropClose}
        data-testid="modalShell-backdropClose"
      />
      <div className={cardExtra ? `wiki-modal-card ${cardExtra}` : 'wiki-modal-card'}>{children}</div>
    </div>
  )
}
