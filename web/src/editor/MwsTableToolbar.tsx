import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Editor } from '@tiptap/core'

import { createTableField, createTableRecords, deleteTableField, deleteTableRecords } from '../api/tableRecords'
import {
  fieldIdForColumn,
  findMwsTableAnchorFromElement,
  findMwsTableAtSelection,
  getMwsColumnIndex,
  getMwsRowRecordId,
  resolveMwsSpaceIdForApi,
  selectionInMwsTable,
  type MwsTableAnchor,
} from './mwsTableContext'
import { refreshMwsTableAtAnchor } from './mwsTableSync'

type Props = {
  editor: Editor | null
}

const HIDE_DELAY_MS = 220

export function MwsTableToolbar({ editor }: Props) {
  const [docTick, setDocTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [colPrompt, setColPrompt] = useState(false)
  const [colName, setColName] = useState('')

  const [hoveredTable, setHoveredTable] = useState<HTMLTableElement | null>(null)
  const [barRect, setBarRect] = useState<DOMRect | null>(null)

  const barRef = useRef<HTMLDivElement | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null)

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    if (colPrompt) return
    cancelHide()
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      setHoveredTable(null)
      setBarRect(null)
    }, HIDE_DELAY_MS)
  }, [colPrompt, cancelHide])

  useEffect(() => {
    if (!editor) return
    const bump = () => setDocTick((x) => x + 1)
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])

  const hoverAnchor = useMemo(() => {
    if (!editor || !hoveredTable) return null
    return findMwsTableAnchorFromElement(editor, hoveredTable)
  }, [editor, hoveredTable, docTick])

  useEffect(() => {
    if (hoveredTable && editor && !hoverAnchor) {
      setHoveredTable(null)
      setBarRect(null)
    }
  }, [hoveredTable, editor, hoverAnchor])

  useEffect(() => {
    if (!hoverAnchor) setColPrompt(false)
  }, [hoverAnchor])

  useEffect(() => {
    if (colPrompt) cancelHide()
  }, [colPrompt, cancelHide])

  useEffect(() => {
    if (!hoveredTable) {
      setBarRect(null)
      return
    }
    const upd = () => setBarRect(hoveredTable.getBoundingClientRect())
    upd()
    window.addEventListener('scroll', upd, true)
    window.addEventListener('resize', upd)
    const ro = new ResizeObserver(upd)
    ro.observe(hoveredTable)
    return () => {
      window.removeEventListener('scroll', upd, true)
      window.removeEventListener('resize', upd)
      ro.disconnect()
    }
  }, [hoveredTable])

  useEffect(() => {
    if (!editor) return

    const processMove = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY)
      if (barRef.current?.contains(el as Node)) {
        cancelHide()
        return
      }
      const table = (el as Element | null)?.closest?.('table[data-mws-dst-id]')
      if (table && editor.view.dom.contains(table)) {
        cancelHide()
        setHoveredTable(table as HTMLTableElement)
        return
      }
      if (!colPrompt) scheduleHide()
    }

    const onMove = (e: MouseEvent) => {
      pendingMoveRef.current = { x: e.clientX, y: e.clientY }
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const p = pendingMoveRef.current
        pendingMoveRef.current = null
        if (p) processMove(p.x, p.y)
      })
    }

    document.addEventListener('mousemove', onMove)
    return () => {
      document.removeEventListener('mousemove', onMove)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      cancelHide()
    }
  }, [editor, colPrompt, cancelHide, scheduleHide])

  const run = useCallback(
    async (fn: (a: MwsTableAnchor) => Promise<void>, anchorOverride?: MwsTableAnchor | null) => {
      if (!editor) return
      const a = anchorOverride ?? findMwsTableAtSelection(editor)
      if (!a) return
      setBusy(true)
      setErr(null)
      try {
        await fn(a)
        await refreshMwsTableAtAnchor(editor, a)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [editor],
  )

  const onAddRow = useCallback(() => {
    if (!hoverAnchor) return
    void run(
      async (a) => {
        const fields: Record<string, unknown> = {}
        for (const k of a.recordFieldKeys) {
          fields[k] = ''
        }
        await createTableRecords(a.dstId, { records: [{ fields }] }, a.viewId || null)
      },
      hoverAnchor,
    )
  }, [run, hoverAnchor])

  const onDeleteRow = useCallback(() => {
    if (!editor || !hoverAnchor) return
    if (!selectionInMwsTable(editor, hoverAnchor.tablePos)) {
      setErr('Выберите строку данных в этой таблице (не заголовок).')
      return
    }
    const rid = getMwsRowRecordId(editor)
    if (!rid) {
      setErr('Выберите строку данных (не заголовок).')
      return
    }
    void run(
      async (a) => {
        await deleteTableRecords(a.dstId, [rid])
      },
      hoverAnchor,
    )
  }, [editor, run, hoverAnchor])

  const onAddColumn = useCallback(() => {
    setColPrompt(true)
    setColName('')
    setErr(null)
  }, [])

  const confirmAddColumn = useCallback(() => {
    if (!hoverAnchor) return
    const name = colName.trim() || 'Новый столбец'
    setColPrompt(false)
    void run(
      async (a) => {
        const space = resolveMwsSpaceIdForApi(a.spaceId)
        if (!space) {
          throw new Error(
            'Нужен Space ID MWS: укажите при вставке таблицы, в переменной VITE_MWS_TABLE_SPACE_ID или сохраните в модалке вставки.',
          )
        }
        await createTableField(a.dstId, space, { name, type: 'SingleText' })
      },
      hoverAnchor,
    )
  }, [colName, run, hoverAnchor])

  const onDeleteColumn = useCallback(() => {
    if (!editor || !hoverAnchor) return
    if (!selectionInMwsTable(editor, hoverAnchor.tablePos)) {
      setErr('Поставьте курсор в ячейку этой таблицы.')
      return
    }
    const col = getMwsColumnIndex(editor)
    if (col == null) {
      setErr('Поставьте курсор в ячейку столбца.')
      return
    }
    const fieldId = fieldIdForColumn(hoverAnchor, col)
    if (!fieldId) {
      setErr('Не удалось определить id поля для этой колонки.')
      return
    }
    void run(
      async (inner) => {
        const space = resolveMwsSpaceIdForApi(inner.spaceId)
        if (!space) {
          throw new Error(
            'Нужен Space ID MWS: укажите при вставке таблицы, в переменной VITE_MWS_TABLE_SPACE_ID или сохраните в модалке вставки.',
          )
        }
        await deleteTableField(inner.dstId, fieldId, space)
      },
      hoverAnchor,
    )
  }, [editor, run, hoverAnchor])

  if (!editor) return null

  const showBar = Boolean(hoverAnchor && barRect)

  const bar =
    showBar && barRect ? (
      <div
        ref={barRef}
        className="wiki-mws-table-hover-bar"
        role="toolbar"
        aria-label="MWS таблица: строки и столбцы"
        style={{
          position: 'fixed',
          left: barRect.left,
          top: barRect.top - 6,
          transform: 'translateY(-100%)',
          maxWidth: Math.max(280, barRect.width),
          zIndex: 100,
        }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        data-testid="mwsTableToolbar-hoverBar"
      >
        <span className="wiki-mws-table-hover-bar-label">Таблица MWS</span>
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
            <button
              type="button"
              className="tb-btn tb-btn--xs"
              disabled={busy}
              title="POST …/records"
              onClick={onAddRow}
              data-testid="mwsTableToolbar-addRowButton"
            >
              + Строка
            </button>
            <button
              type="button"
              className="tb-btn tb-btn--xs"
              disabled={busy}
              title="DELETE …/records"
              onClick={onDeleteRow}
              data-testid="mwsTableToolbar-deleteRowButton"
            >
              − Строка
            </button>
            <button
              type="button"
              className="tb-btn tb-btn--xs"
              disabled={busy}
              title="POST …/fields"
              onClick={onAddColumn}
              data-testid="mwsTableToolbar-addColumnButton"
            >
              + Столбец
            </button>
            <button
              type="button"
              className="tb-btn tb-btn--xs"
              disabled={busy}
              title="DELETE …/fields/{fieldId}"
              onClick={onDeleteColumn}
              data-testid="mwsTableToolbar-deleteColumnButton"
            >
              − Столбец
            </button>
          </>
        )}
        {err ? <span className="wiki-toolbar-mws-err">{err}</span> : null}
      </div>
    ) : null

  return bar ? createPortal(bar, document.body) : null
}
