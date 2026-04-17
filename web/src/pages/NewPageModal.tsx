import { useCallback, useEffect, useId, useState } from 'react'

import { ModalShell } from '../components/shared/ModalShell'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (title: string) => void
}

export function NewPageModal({ open, onClose, onCreate }: Props) {
  const titleId = useId()
  const [title, setTitle] = useState('Новая страница')

  /* eslint-disable react-hooks/set-state-in-effect -- сброс поля при открытии модалки */
  useEffect(() => {
    if (open) setTitle('Новая страница')
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = useCallback(() => {
    const t = title.trim()
    onCreate(t.length ? t : 'Без названия')
    onClose()
  }, [title, onCreate, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <ModalShell open={open} onBackdropClose={onClose} ariaLabelledBy={titleId}>
      <h2 id={titleId} className="wiki-modal-title">
        Новая страница
      </h2>
      <p className="wiki-modal-hint">Название появится в списке слева; технический ключ создаётся автоматически.</p>
      <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Название</p>
      <input
        id={titleId + '-input'}
        type="text"
        className="wiki-doc-title-input wiki-new-page-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        autoFocus
        aria-label="Название новой страницы"
        data-testid="newPageModal-titleInput"
      />
      <div className="wiki-modal-actions">
        <button type="button" className="secondary" onClick={onClose} data-testid="newPageModal-cancelButton">
          Отмена
        </button>
        <button type="button" className="primary" onClick={submit} data-testid="newPageModal-submitButton">
          Создать
        </button>
      </div>
    </ModalShell>
  )
}
