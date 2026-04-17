import { useEffect, useState } from 'react'

import { ModalShell } from '../components/shared/ModalShell'
import type { CommentAccessMode } from './commentAdvancedTypes'

type Props = {
  open: boolean
  onClose: () => void
  mode: CommentAccessMode
  onSave: (m: CommentAccessMode) => void
}

export function CommentAccessModal({ open, onClose, mode, onSave }: Props) {
  const [v, setV] = useState(mode)
  /* eslint-disable react-hooks/set-state-in-effect -- режим с пропса при открытии */
  useEffect(() => {
    setV(mode)
  }, [mode, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <ModalShell open={open} onBackdropClose={onClose} ariaLabelledBy="wiki-ca-title">
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
        <button type="button" className="secondary" onClick={onClose} data-testid="commentAccessModal-cancelButton">
          Отмена
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            onSave(v)
            onClose()
          }}
          data-testid="commentAccessModal-saveButton"
        >
          Сохранить
        </button>
      </div>
    </ModalShell>
  )
}
