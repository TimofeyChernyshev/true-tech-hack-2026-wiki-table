import { useEffect, useState } from 'react'
import type { CommentAccessMode } from './commentAdvancedTypes'

type Props = {
  open: boolean
  onClose: () => void
  mode: CommentAccessMode
  onSave: (m: CommentAccessMode) => void
}

export function CommentAccessModal({ open, onClose, mode, onSave }: Props) {
  const [v, setV] = useState(mode)
  useEffect(() => {
    setV(mode)
  }, [mode, open])

  if (!open) return null

  return (
    <div className="wiki-modal-root" role="dialog" aria-modal="true" aria-labelledby="wiki-ca-title">
      <button type="button" className="wiki-modal-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="wiki-modal-card">
        <h2 id="wiki-ca-title" className="wiki-modal-title">
          Доступ к комментариям
        </h2>
        <p className="wiki-modal-hint">Кто может оставлять комментарии на этой странице</p>
        <label className="wiki-radio-row">
          <input type="radio" name="access" checked={v === 'all'} onChange={() => setV('all')} />
          <span>Все пользователи</span>
        </label>
        <label className="wiki-radio-row">
          <input
            type="radio"
            name="access"
            checked={v === 'creator'}
            onChange={() => setV('creator')}
          />
          <span>Только создатель страницы (этот браузер при первом открытии)</span>
        </label>
        <div className="wiki-modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onSave(v)
              onClose()
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
