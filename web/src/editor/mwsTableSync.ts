import type { Editor, JSONContent } from '@tiptap/core'

import { fetchAllTableRecords } from '../api/tableRecords'
import { findMwsTableAtSelection, parseMwsTableNode, type MwsTableAnchor } from './mwsTableContext'
import { tableResponseToTiptapJson } from './mwsTable'

function replaceTableNode(editor: Editor, anchor: MwsTableAnchor, json: JSONContent) {
  const node = editor.state.doc.nodeAt(anchor.tablePos)
  if (!node || node.type.name !== 'table') return
  const next = editor.schema.nodeFromJSON(json)
  const tr = editor.state.tr.replaceWith(anchor.tablePos, anchor.tablePos + node.nodeSize, next)
  editor.view.dispatch(tr)
}

/** Перечитать данные MWS и заменить узел таблицы по известному якорю (в т.ч. при hover без курсора в ячейке). */
export async function refreshMwsTableAtAnchor(editor: Editor, anchor: MwsTableAnchor): Promise<void> {
  const data = await fetchAllTableRecords(anchor.dstId, anchor.viewId || undefined)
  const docJson = tableResponseToTiptapJson(data, anchor.dstId, anchor.viewId, {
    mwsSpaceId: anchor.spaceId ?? undefined,
  })
  const node = editor.state.doc.nodeAt(anchor.tablePos)
  if (!node || node.type.name !== 'table') return
  const parsed = parseMwsTableNode(node)
  if (!parsed || parsed.dstId !== anchor.dstId) return
  const nextAnchor: MwsTableAnchor = { tablePos: anchor.tablePos, tableNode: node, ...parsed }
  replaceTableNode(editor, nextAnchor, docJson)
}

/** Перечитать данные MWS и заменить узел таблицы под курсором (после create/delete записей или полей). */
export async function refreshMwsTableAtCursor(editor: Editor): Promise<void> {
  const before = findMwsTableAtSelection(editor)
  if (!before) return
  await refreshMwsTableAtAnchor(editor, before)
}
