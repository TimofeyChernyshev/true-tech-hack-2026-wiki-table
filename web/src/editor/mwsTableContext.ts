import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

const LS_SPACE = 'wiki-mws-default-space-id'

export type MwsTableAnchor = {
  tablePos: number
  tableNode: PMNode
  dstId: string
  viewId: string
  spaceId: string | null
  recordFieldKeys: string[]
  columnFieldIds: string[]
}

export function getStoredMwsSpaceId(): string | undefined {
  try {
    const ls = localStorage.getItem(LS_SPACE)?.trim()
    if (ls) return ls
  } catch {
    /* ignore */
  }
  const env = import.meta.env.VITE_MWS_TABLE_SPACE_ID as string | undefined
  const t = env?.trim()
  return t || undefined
}

export function persistDefaultMwsSpaceId(spaceId: string) {
  const t = spaceId.trim()
  if (!t) return
  try {
    localStorage.setItem(LS_SPACE, t)
  } catch {
    /* ignore */
  }
}

/** Space для API полей: сначала с таблицы, затем localStorage / env. */
export function resolveMwsSpaceIdForApi(tableSpaceId: string | null | undefined): string | null {
  const a = tableSpaceId?.trim()
  if (a) return a
  return getStoredMwsSpaceId() ?? null
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function parseMwsTableNode(tableNode: PMNode): Omit<MwsTableAnchor, 'tablePos' | 'tableNode'> | null {
  const dstId = tableNode.attrs.mwsDstId as string | null | undefined
  if (!dstId?.trim()) return null
  const viewId = ((tableNode.attrs.mwsViewId as string | null) ?? '').trim()
  const spaceRaw = tableNode.attrs.mwsSpaceId as string | null | undefined
  const spaceId = spaceRaw?.trim() ? spaceRaw.trim() : null
  const recordFieldKeys = parseJsonArray(tableNode.attrs.mwsRecordFieldKeys as string | null)
  const columnFieldIds = parseJsonArray(tableNode.attrs.mwsColumnFieldIds as string | null)
  return { dstId: dstId.trim(), viewId, spaceId, recordFieldKeys, columnFieldIds }
}

export function findMwsTableAtSelection(editor: Editor): MwsTableAnchor | null {
  const { selection } = editor.state
  const $pos = selection.$from
  for (let d = $pos.depth; d >= 0; d -= 1) {
    const n = $pos.node(d)
    if (n.type.name !== 'table') continue
    const parsed = parseMwsTableNode(n)
    if (!parsed) return null
    return { tablePos: $pos.before(d), tableNode: n, ...parsed }
  }
  return null
}

/** Якорь MWS-таблицы по DOM-элементу `<table>` (например при hover). */
export function findMwsTableAnchorFromElement(editor: Editor, tableEl: HTMLElement): MwsTableAnchor | null {
  const view = editor.view
  let pos: number
  try {
    pos = view.posAtDOM(tableEl, 0, 1)
  } catch {
    try {
      pos = view.posAtDOM(tableEl, 0, -1)
    } catch {
      return null
    }
  }
  const doc = editor.state.doc
  const clamped = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(clamped)
  for (let d = $pos.depth; d >= 0; d -= 1) {
    const n = $pos.node(d)
    if (n.type.name !== 'table') continue
    const parsed = parseMwsTableNode(n)
    if (!parsed) return null
    return { tablePos: $pos.before(d), tableNode: n, ...parsed }
  }
  return null
}

export function selectionInMwsTable(editor: Editor, tablePos: number): boolean {
  const a = findMwsTableAtSelection(editor)
  return a !== null && a.tablePos === tablePos
}

export function getMwsRowRecordId(editor: Editor): string | null {
  const { selection } = editor.state
  const $pos = selection.$from
  for (let d = $pos.depth; d >= 0; d -= 1) {
    const n = $pos.node(d)
    if (n.type.name !== 'tableRow') continue
    const id = n.attrs.mwsRecordId as string | null | undefined
    return id?.trim() ? id.trim() : null
  }
  return null
}

/** Индекс колонки (0-based) для ячейки под курсором. */
export function getMwsColumnIndex(editor: Editor): number | null {
  const { selection } = editor.state
  const $pos = selection.$from
  for (let d = $pos.depth; d >= 0; d -= 1) {
    const n = $pos.node(d)
    if (n.type.name !== 'tableCell' && n.type.name !== 'tableHeader') continue
    const rowDepth = d - 1
    if (rowDepth < 0) return null
    return $pos.index(rowDepth)
  }
  return null
}

export function fieldIdForColumn(anchor: MwsTableAnchor, colIndex: number): string | null {
  const byId = anchor.columnFieldIds[colIndex]
  if (byId?.trim()) return byId.trim()
  const byKey = anchor.recordFieldKeys[colIndex]
  return byKey?.trim() ? byKey.trim() : null
}
