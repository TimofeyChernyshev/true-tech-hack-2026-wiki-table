import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

import type { MwsRecordUpdate } from './mwsRecordsWs'
import { parseMwsTableNode, type MwsTableAnchor } from './mwsTableContext'
import { formatMwsCellValue } from './mwsTable'

/** recordId -> fieldKey -> строковое значение ячейки */
export type TableSnapshot = Map<string, Map<string, string>>

function textFromCellNode(cell: PMNode): string {
  let s = ''
  cell.descendants((n) => {
    if (n.isText) s += n.text
  })
  return s
}

/** Снимок тела таблицы (без заголовка). */
export function snapshotMwsTableBody(table: PMNode, anchor: MwsTableAnchor): TableSnapshot {
  const out: TableSnapshot = new Map()
  const keys = anchor.recordFieldKeys
  if (keys.length === 0) return out

  const rows = table.childCount
  for (let r = 1; r < rows; r += 1) {
    const row = table.child(r)
    if (row.type.name !== 'tableRow') continue
    const recordId = (row.attrs.mwsRecordId as string | null)?.trim()
    if (!recordId) continue
    const rowMap = new Map<string, string>()
    for (let c = 0; c < keys.length && c < row.childCount; c += 1) {
      const cell = row.child(c)
      if (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') continue
      const k = keys[c]
      if (!k) continue
      rowMap.set(k, textFromCellNode(cell))
    }
    out.set(recordId, rowMap)
  }
  return out
}

/** Сравнение снимков → только изменившиеся записи для PATCH. */
export function diffTableSnapshots(
  before: TableSnapshot | null,
  after: TableSnapshot,
): MwsRecordUpdate[] {
  const updates: MwsRecordUpdate[] = []
  for (const [recordId, afterFields] of after) {
    const prev = before?.get(recordId)
    const fields: Record<string, unknown> = {}
    for (const [key, val] of afterFields) {
      const old = prev?.get(key)
      if (old === val) continue
      fields[key] = val
    }
    if (Object.keys(fields).length > 0) {
      updates.push({ recordId, fields })
    }
  }
  return updates
}

export function collectMwsTableSnapshots(editor: Editor): {
  anchor: MwsTableAnchor
  tablePos: number
  snapshot: TableSnapshot
}[] {
  const out: {
    anchor: MwsTableAnchor
    tablePos: number
    snapshot: TableSnapshot
  }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return
    const parsed = parseMwsTableNode(node)
    if (!parsed) return
    const anchor: MwsTableAnchor = {
      tablePos: pos,
      tableNode: node,
      ...parsed,
    }
    out.push({
      anchor,
      tablePos: pos,
      snapshot: snapshotMwsTableBody(node, anchor),
    })
  })
  return out
}

function columnIndexForFieldKey(anchor: MwsTableAnchor, fieldKey: string): number {
  const i = anchor.recordFieldKeys.indexOf(fieldKey)
  if (i >= 0) return i
  return anchor.columnFieldIds.indexOf(fieldKey)
}

/** Абсолютные границы контента ячейки (внутри tableCell). */
function cellContentRange(
  doc: PMNode,
  tablePos: number,
  rowIndex: number,
  colIndex: number,
): { from: number; to: number } | null {
  const table = doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table') return null
  if (rowIndex >= table.childCount) return null
  const row = table.child(rowIndex)
  if (colIndex >= row.childCount) return null

  let pos = tablePos + 1
  for (let r = 0; r < rowIndex; r += 1) pos += table.child(r).nodeSize
  pos += 1
  const rowNode = table.child(rowIndex)
  for (let c = 0; c < colIndex; c += 1) pos += rowNode.child(c).nodeSize
  const cell = rowNode.child(colIndex)
  const start = pos + 1
  const end = start + cell.content.size
  return { from: start, to: end }
}

/**
 * Применить удалённые правки к первой таблице с данным dstId.
 * Вызывать с meta / флагом, чтобы не уходить в повторную отправку по WS.
 */
export function applyRemoteRecordUpdates(
  editor: Editor,
  dstId: string,
  updates: MwsRecordUpdate[],
): boolean {
  if (!updates.length) return false

  let tablePos: number | null = null
  let anchor: MwsTableAnchor | null = null

  editor.state.doc.descendants((node, pos) => {
    if (tablePos != null) return
    if (node.type.name !== 'table') return
    const parsed = parseMwsTableNode(node)
    if (!parsed || parsed.dstId !== dstId) return
    tablePos = pos
    anchor = { tablePos: pos, tableNode: node, ...parsed }
  })

  if (tablePos == null || !anchor) return false

  const { state } = editor
  const { schema } = state
  type Op = { from: number; to: number; paragraph: PMNode }
  const ops: Op[] = []

  for (const u of updates) {
    const rowIndex = findRowIndexByRecordId(state.doc, tablePos, u.recordId)
    if (rowIndex == null) continue

    for (const [fieldKey, raw] of Object.entries(u.fields)) {
      const col = columnIndexForFieldKey(anchor, fieldKey)
      if (col < 0) continue
      const range = cellContentRange(state.doc, tablePos, rowIndex, col)
      if (!range) continue
      const text = formatRemoteValue(raw)
      const paragraph = schema.nodes.paragraph.create(
        null,
        text ? [schema.text(text)] : [],
      )
      ops.push({ from: range.from, to: range.to, paragraph })
    }
  }

  if (ops.length === 0) return false

  ops.sort((a, b) => b.from - a.from)
  const tr = state.tr
  for (const op of ops) {
    tr.replaceWith(op.from, op.to, op.paragraph)
  }
  tr.setMeta('mwsRemoteSync', true)
  editor.view.dispatch(tr)
  return true
}

function findRowIndexByRecordId(
  doc: PMNode,
  tablePos: number,
  recordId: string,
): number | null {
  const table = doc.nodeAt(tablePos)
  if (!table) return null
  for (let r = 1; r < table.childCount; r += 1) {
    const row = table.child(r)
    const id = (row.attrs.mwsRecordId as string | null)?.trim()
    if (id === recordId) return r
  }
  return null
}

function formatRemoteValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  return formatMwsCellValue(v)
}

export function cloneTableSnapshot(s: TableSnapshot): TableSnapshot {
  const m = new Map<string, Map<string, string>>()
  for (const [rid, row] of s) {
    m.set(rid, new Map(row))
  }
  return m
}

export function snapshotFingerprint(s: TableSnapshot): string {
  const recs = [...s.entries()].sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(
    recs.map(([rid, m]) => [rid, [...m.entries()].sort(([x], [y]) => x.localeCompare(y))]),
  )
}
