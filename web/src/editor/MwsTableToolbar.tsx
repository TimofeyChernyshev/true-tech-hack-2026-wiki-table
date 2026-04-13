import { useCallback, useEffect, useState } from 'react'

import type { Editor } from '@tiptap/core'

import { createTableField, createTableRecords, deleteTableField, deleteTableRecords } from '../api/tableRecords'
import {
  fieldIdForColumn,
  findMwsTableAtSelection,
  getMwsColumnIndex,
  getMwsRowRecordId,
  resolveMwsSpaceIdForApi,
  type MwsTableAnchor,
} from './mwsTableContext'
import { refreshMwsTableAtCursor } from './mwsTableSync'

type Props = {
  editor: Editor | null
}

export function MwsTableToolbar({ editor }: Props) {
  const [, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [colPrompt, setColPrompt] = useState(false)
  const [colName, setColName] = useState('')

  useEffect(() => {
    if (!editor) return
    const bump = () => setTick((x) => x + 1)
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])

  const anchor = editor ? findMwsTableAtSelection(editor) : null
  const visible = Boolean(anchor)

  useEffect(() => {
    if (!visible) setColPrompt(false)
  }, [visible])

  const run = useCallback(
    async (fn: (a: MwsTableAnchor) => Promise<void>) => {
      if (!editor) return
      const a = findMwsTableAtSelection(editor)
      if (!a) return
      setBusy(true)
      setErr(null)
      try {
        await fn(a)
        await refreshMwsTableAtCursor(editor)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [editor],
  )

  const onAddRow = useCallback(() => {
    void run(async (a) => {
      const fields: Record<string, unknown> = {}
      for (const k of a.recordFieldKeys) {
        fields[k] = ''
      }
      await createTableRecords(a.dstId, { records: [{ fields }] }, a.viewId || null)
    })
  }, [run])

  const onDeleteRow = useCallback(() => {
    if (!editor) return
    const rid = getMwsRowRecordId(editor)
    if (!rid) {
      setErr('Выберите строку данных (не заголовок).')
      return
    }
    void run(async (a) => {
      await deleteTableRecords(a.dstId, [rid])
    })
  }, [editor, run])

  const onAddColumn = useCallback(() => {
    setColPrompt(true)
    setColName('')
    setErr(null)
  }, [])

  const confirmAddColumn = useCallback(() => {
    const name = colName.trim() || 'Новый столбец'
    setColPrompt(false)
    void run(async (a) => {
      const space = resolveMwsSpaceIdForApi(a.spaceId)
      if (!space) {
        throw new Error(
          'Нужен Space ID MWS: укажите при вставке таблицы, в переменной VITE_MWS_TABLE_SPACE_ID или сохраните в модалке вставки.',
        )
      }
      await createTableField(a.dstId, space, { name, type: 'SingleText' })
    })
  }, [colName, run])

  const onDeleteColumn = useCallback(() => {
    if (!editor) return
    const col = getMwsColumnIndex(editor)
    if (col == null) {
      setErr('Поставьте курсор в ячейку столбца.')
      return
    }
    const a = findMwsTableAtSelection(editor)
    if (!a) return
    const fieldId = fieldIdForColumn(a, col)
    if (!fieldId) {
      setErr('Не удалось определить id поля для этой колонки.')
      return
    }
    void run(async (inner) => {
      const space = resolveMwsSpaceIdForApi(inner.spaceId)
      if (!space) {
        throw new Error(
          'Нужен Space ID MWS: укажите при вставке таблицы, в переменной VITE_MWS_TABLE_SPACE_ID или сохраните в модалке вставки.',
        )
      }
      await deleteTableField(inner.dstId, fieldId, space)
    })
  }, [editor, run])

  if (!editor) return null

  return (
    <div className={`wiki-toolbar-mws${visible ? ' wiki-toolbar-mws--visible' : ''}`} role="toolbar" aria-label="MWS таблица">
      <span className="wiki-toolbar-mws-label">Таблица MWS</span>
      {colPrompt ? (
        <span className="wiki-toolbar-mws-col-prompt">
          <input
            type="text"
            className="wiki-toolbar-mws-col-input"
            value={colName}
            onChange={(e) => setColName(e.target.value)}
            placeholder="Имя столбца"
            aria-label="Имя нового столбца"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmAddColumn()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setColPrompt(false)
              }
            }}
            autoFocus
          />
          <button type="button" className="tb-btn tb-btn--xs" disabled={busy} onClick={() => confirmAddColumn()}>
            Создать столбец
          </button>
          <button type="button" className="tb-btn tb-btn--xs secondary" disabled={busy} onClick={() => setColPrompt(false)}>
            Отмена
          </button>
        </span>
      ) : (
        <>
          <button type="button" className="tb-btn tb-btn--xs" disabled={!visible || busy} title="POST …/records" onClick={onAddRow}>
            + Строка
          </button>
          <button type="button" className="tb-btn tb-btn--xs" disabled={!visible || busy} title="DELETE …/records" onClick={onDeleteRow}>
            − Строка
          </button>
          <button type="button" className="tb-btn tb-btn--xs" disabled={!visible || busy} title="POST …/fields" onClick={onAddColumn}>
            + Столбец
          </button>
          <button
            type="button"
            className="tb-btn tb-btn--xs"
            disabled={!visible || busy}
            title="DELETE …/fields/{fieldId}"
            onClick={onDeleteColumn}
          >
            − Столбец
          </button>
        </>
      )}
      {err ? <span className="wiki-toolbar-mws-err">{err}</span> : null}
    </div>
  )
}
