import { useCallback, useEffect, useId, useState } from 'react'

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

  useEffect(() => {
    if (open) setHref(initialHref)
  }, [open, initialHref])

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

  if (!open) return null

  return (
    <div className="wiki-modal-root" role="dialog" aria-modal="true" aria-labelledby={baseId + '-t'}>
      <button type="button" className="wiki-modal-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="wiki-modal-card">
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
        />
        <div className="wiki-modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              onRemove()
              onClose()
            }}
          >
            Убрать ссылку
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="primary" onClick={submit}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
