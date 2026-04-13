import type { Editor, JSONContent } from '@tiptap/core'

import { fetchAllTableRecords } from '../api/tableRecords'
import { findMwsTableAtSelection, type MwsTableAnchor } from './mwsTableContext'
import { tableResponseToTiptapJson } from './mwsTable'

function replaceTableNode(editor: Editor, anchor: MwsTableAnchor, json: JSONContent) {
  const node = editor.state.doc.nodeAt(anchor.tablePos)
  if (!node || node.type.name !== 'table') return
  const next = editor.schema.nodeFromJSON(json)
  const tr = editor.state.tr.replaceWith(anchor.tablePos, anchor.tablePos + node.nodeSize, next)
  editor.view.dispatch(tr)
}

/** Перечитать данные MWS и заменить узел таблицы под курсором (после create/delete записей или полей). */
export async function refreshMwsTableAtCursor(editor: Editor): Promise<void> {
  const before = findMwsTableAtSelection(editor)
  if (!before) return
  const data = await fetchAllTableRecords(before.dstId, before.viewId || undefined)
  const docJson = tableResponseToTiptapJson(data, before.dstId, before.viewId, {
    mwsSpaceId: before.spaceId ?? undefined,
  })
  const after = findMwsTableAtSelection(editor)
  if (!after || after.dstId !== before.dstId) return
  replaceTableNode(editor, after, docJson)
}
