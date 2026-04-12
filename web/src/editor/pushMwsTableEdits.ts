import type { JSONContent } from '@tiptap/core'

import { updateTableRecords } from '../api/tableRecords'



function walkDoc(node: JSONContent | undefined, visit: (n: JSONContent) => void): void {

  if (!node) return

  visit(node)

  node.content?.forEach((c) => walkDoc(c, visit))

}



function collectMwsTables(doc: JSONContent): JSONContent[] {

  const out: JSONContent[] = []

  walkDoc(doc, (n) => {

    if (n.type === 'table' && n.attrs?.mwsDstId) {

      out.push(n)

    }

  })

  return out

}



function paragraphPlain(p: JSONContent): string {

  if (!p.content?.length) return ''

  let s = ''

  for (const n of p.content) {

    if (n.type === 'text') {

      s += n.text ?? ''

    } else if (n.type === 'hardBreak') {

      s += '\n'

    }

  }

  return s

}



/** Текст ячейки таблицы (без разметки кроме переносов внутри параграфа). */

export function tableCellPlainText(cell: JSONContent | undefined): string {

  if (!cell?.content?.length) return ''

  const lines: string[] = []

  for (const block of cell.content) {

    if (block.type === 'paragraph' || block.type === 'heading') {

      lines.push(paragraphPlain(block))

    }

  }

  return lines.join('\n').trimEnd()

}



function stableTableKey(table: JSONContent): string {

  const dstId = String(table.attrs?.mwsDstId ?? '')

  const viewId = String(table.attrs?.mwsViewId ?? '')

  const keys = String(table.attrs?.mwsRecordFieldKeys ?? '')

  return `${dstId}\u001f${viewId}\u001f${keys}`

}



/**

 * Отправляет правки MWS-таблиц на бэкенд (PATCH). Пропускает таблицу, если JSON строк

 * не менялся с прошлого успешного push (ключ — dstId+viewId+список полей).

 */

export async function pushMwsTableEditsFromDoc(

  doc: JSONContent,

  lastPushedContent: Map<string, string>,

): Promise<void> {

  const tables = collectMwsTables(doc)



  for (const table of tables) {

    const dstId = table.attrs?.mwsDstId as string | undefined

    if (!dstId) continue



    const viewIdRaw = table.attrs?.mwsViewId as string | null | undefined

    const viewId = viewIdRaw && viewIdRaw.length > 0 ? viewIdRaw : undefined



    let fieldKeys: string[] = []

    const rawKeys = table.attrs?.mwsRecordFieldKeys as string | null | undefined

    if (rawKeys) {

      try {

        const parsed = JSON.parse(rawKeys) as unknown

        if (Array.isArray(parsed)) {

          fieldKeys = parsed.filter((x): x is string => typeof x === 'string')

        }

      } catch {

        continue

      }

    }

    if (fieldKeys.length === 0) continue



    const contentSig = JSON.stringify(table.content)

    const sk = stableTableKey(table)

    if (lastPushedContent.get(sk) === contentSig) continue



    const rows = table.content ?? []

    if (rows.length < 2) {

      lastPushedContent.set(sk, contentSig)

      continue

    }



    const bodyRows = rows.slice(1)

    const records: { recordId: string; fields: Record<string, unknown> }[] = []



    for (const row of bodyRows) {

      if (row.type !== 'tableRow') continue

      const recordId = row.attrs?.mwsRecordId as string | null | undefined

      if (!recordId) continue



      const cells = (row.content ?? []).filter((c) => c.type === 'tableCell')

      const fields: Record<string, unknown> = {}

      for (let i = 0; i < fieldKeys.length; i++) {

        const key = fieldKeys[i]

        if (!key) continue

        fields[key] = tableCellPlainText(cells[i])

      }

      records.push({ recordId, fields })

    }



    if (records.length === 0) {

      lastPushedContent.set(sk, contentSig)

      continue

    }



    await updateTableRecords(dstId, { records }, viewId)

    lastPushedContent.set(sk, contentSig)
  }
}

/** Сбросить запомненные снимки push для dstId (после refresh с сервера). */
export function clearMwsPushStateForDst(lastPushedContent: Map<string, string>, dstId: string): void {
  const prefix = `${dstId}\u001f`
  for (const k of [...lastPushedContent.keys()]) {
    if (k.startsWith(prefix)) {
      lastPushedContent.delete(k)
    }
  }
}



