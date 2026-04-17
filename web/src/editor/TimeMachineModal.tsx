import type { JSONContent } from '@tiptap/core'

import { ModalShell } from '../components/shared/ModalShell'
import type { DocVersionEntry } from './docVersionsStore'

type Props = {
  open: boolean
  onClose: () => void
  versions: DocVersionEntry[]
  onRestore: (doc: JSONContent) => void
  onSnapshotNow: () => void
}

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
}

export function TimeMachineModal({
  open,
  onClose,
  versions,
  onRestore,
  onSnapshotNow,
}: Props) {
  return (
    <ModalShell open={open} onBackdropClose={onClose} ariaLabelledBy="wiki-tm-title" cardClassName="wiki-modal-card--wide">
      <div className="wiki-tm-head">
        <h2 id="wiki-tm-title" className="wiki-modal-title">
          Машина времени
        </h2>
        <button
          type="button"
          className="secondary wiki-tm-snap"
          onClick={onSnapshotNow}
          data-testid="timeMachineModal-snapshotButton"
        >
          Снимок сейчас
        </button>
      </div>
        <p className="wiki-modal-hint">
          Локальные версии документа (браузер). Откат заменяет текущий текст; отмена — стрелкой «Назад» в
          редакторе, если шаг ещё в истории.
        </p>
        <ul className="wiki-tm-list">
          {versions.length === 0 ? (
            <li className="wiki-tm-empty">Пока нет сохранённых снимков</li>
          ) : (
            versions.map((v) => (
              <li key={v.id} className="wiki-tm-item">
                <time dateTime={new Date(v.savedAt).toISOString()}>{formatWhen(v.savedAt)}</time>
                <button
                  type="button"
                  className="primary wiki-tm-restore"
                  onClick={() => {
                    onRestore(v.doc)
                    onClose()
                  }}
                  data-testid="timeMachineModal-restoreButton"
                >
                  Откатить сюда
                </button>
              </li>
            ))
          )}
        </ul>
      <div className="wiki-modal-actions wiki-modal-actions--single">
        <button type="button" className="secondary" onClick={onClose} data-testid="timeMachineModal-closeButton">
          Закрыть
        </button>
      </div>
    </ModalShell>
  )
}
