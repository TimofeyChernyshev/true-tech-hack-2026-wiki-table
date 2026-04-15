import { useCallback, useEffect, useId, useState } from 'react'

import { ModalShell } from '../components/shared/ModalShell'

type Props = {
  open: boolean
  initialHref: string
  onClose: () => void
  onSave: (href: string) => void
  onRemove: () => void
}

export function LinkHrefModal({ open, initialHref, onClose, onSave, onRemove }: Props) {
  const baseId = useId()
  const [href, setHref] = useState(initialHref)

  /* eslint-disable react-hooks/set-state-in-effect -- синхронизация с initialHref при открытии */
  useEffect(() => {
    if (open) setHref(initialHref)
  }, [open, initialHref])
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = useCallback(() => {
    const h = href.trim()
    if (h === '') onRemove()
    else onSave(h)
    onClose()
  }, [href, onSave, onRemove, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <ModalShell open={open} onBackdropClose={onClose} ariaLabelledBy={baseId + '-t'}>
      <h2 id={baseId + '-t'} className="wiki-modal-title">
        Ссылка
      </h2>
      <p className="wiki-modal-hint">Внутренняя страница: /p/ключ. Внешний сайт: https://… Переход по ссылке в тексте — Ctrl+щелчок (⌘ на macOS).</p>
      <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Адрес (URL)</p>
      <input
        type="text"
        className="wiki-doc-title-input wiki-new-page-input"
        value={href}
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        autoFocus
        aria-label="URL ссылки"
        data-testid="linkHrefModal-hrefInput"
      />
      <div className="wiki-modal-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            onRemove()
            onClose()
          }}
          data-testid="linkHrefModal-removeButton"
        >
          Убрать ссылку
        </button>
        <button type="button" className="secondary" onClick={onClose} data-testid="linkHrefModal-cancelButton">
          Отмена
        </button>
        <button type="button" className="primary" onClick={submit} data-testid="linkHrefModal-saveButton">
          Сохранить
        </button>
      </div>
    </ModalShell>
  )
}
