import { useCallback, useEffect, useId, useState } from 'react'

import { insertMwsWorkbenchTableFromUrl } from './mwsTableInsert'
import { getStoredMwsSpaceId, persistDefaultMwsSpaceId } from './mwsTableContext'

import type { Editor } from '@tiptap/core'

type Props = {
  open: boolean
  editor: Editor | null
  onClose: () => void
}

const EXAMPLE = 'https://tables.mws.ru/workbench/ВАШ_DST_ID/ВАШ_VIEW_ID'

export function MwsTableInsertModal({ open, editor, onClose }: Props) {
  const dlgId = useId()
  const [url, setUrl] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setUrl('')
      setSpaceId(getStoredMwsSpaceId() ?? '')
      setErr(null)
      setBusy(false)
    }
  }, [open])

  const submit = useCallback(async () => {
    if (!editor) return
    setBusy(true)
    setErr(null)
    try {
      const sid = spaceId.trim()
      if (sid) persistDefaultMwsSpaceId(sid)
      await insertMwsWorkbenchTableFromUrl(editor, url, sid || null)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [editor, url, spaceId, onClose])

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
    <div className="wiki-modal-root" role="dialog" aria-modal="true" aria-labelledby={dlgId}>
      <button type="button" className="wiki-modal-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="wiki-modal-card wiki-modal-card--wide">
        <h2 id={dlgId} className="wiki-modal-title">
          Таблица из MWS
        </h2>
        <p className="wiki-modal-hint">
          Вставьте <strong>ссылку на workbench</strong> из MWS Tables (как при вставке из буфера). Данные подгружаются
          через API; рядом с таблицей будет строка со ссылкой.
        </p>
        <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Формат ссылки</p>
        <code className="wiki-mws-url-sample">{EXAMPLE}</code>
        <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Вставьте URL</p>
        <input
          type="url"
          className="wiki-doc-title-input wiki-new-page-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={EXAMPLE}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
          }}
          autoFocus
          aria-label="URL workbench MWS"
        />
        <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Space ID (для +/− столбца через API)</p>
        <input
          type="text"
          className="wiki-doc-title-input wiki-new-page-input"
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          placeholder="spaceId из MWS или VITE_MWS_TABLE_SPACE_ID"
          aria-label="Space ID MWS"
        />
        {err ? <p className="wiki-modal-error">{err}</p> : null}
        <div className="wiki-modal-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={busy || !url.trim()}>
            {busy ? 'Загрузка…' : 'Вставить таблицу'}
          </button>
        </div>
      </div>
    </div>
  )
}
