import type { Editor } from '@tiptap/core'
import { fetchAllTableRecords } from '../api/tableRecords'
import { fingerprintMwsTableData, tableResponseToTiptapJson } from './mwsTable'

export type RefreshMwsTablesOptions = {
  /**
   * false — фоновая подгрузка с MWS, не попадает в историю отмены (стрелки).
   * true — шаг можно отменить (например явное действие пользователя).
   */
  addToHistory?: boolean
  /** Вызывается после замены таблицы данными с сервера (сброс кэша push MWS). */
  onTableReplaced?: (dstId: string) => void
}

/** Обновляет таблицы с data-mws-dst-id данными Fusion; при неизменном снимке пропускает замену. */
export async function refreshMwsTables(
  editor: Editor,
  options?: RefreshMwsTablesOptions,
): Promise<void> {
  const addToHistory = options?.addToHistory !== false
  const onTableReplaced = options?.onTableReplaced
  const schema = editor.schema
  const hits: { pos: number; nodeSize: number; dstId: string; viewId: string }[] = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true
    const dstId = node.attrs.mwsDstId as string | null | undefined
    if (!dstId) return true
    const viewId = (node.attrs.mwsViewId as string | null | undefined) ?? ''
    hits.push({ pos, nodeSize: node.nodeSize, dstId, viewId })
    return true
  })

  hits.sort((a, b) => b.pos - a.pos)

  for (const h of hits) {
    const state = editor.state
    const cur = state.doc.nodeAt(h.pos)
    if (!cur || cur.type.name !== 'table' || cur.attrs.mwsDstId !== h.dstId) continue

    const prevFp = (cur.attrs.mwsFingerprint as string | null | undefined) ?? null
    const data = await fetchAllTableRecords(h.dstId, h.viewId || undefined)
    const nextFp = fingerprintMwsTableData(data)
    if (prevFp === nextFp) continue

    const json = tableResponseToTiptapJson(data, h.dstId, h.viewId)
    const node = schema.nodeFromJSON(json)
    const tr = state.tr.replaceWith(h.pos, h.pos + cur.nodeSize, node)
    if (!addToHistory) {
      tr.setMeta('addToHistory', false)
    }
    editor.view.dispatch(tr)
    onTableReplaced?.(h.dstId)
  }
}

export function docHasMwsTables(editor: Editor): boolean {
  let found = false
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'table' && node.attrs.mwsDstId) {
      found = true
      return false
    }
    return true
  })
  return found
}
