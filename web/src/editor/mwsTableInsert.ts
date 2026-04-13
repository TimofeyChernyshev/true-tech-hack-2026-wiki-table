import type { Editor } from '@tiptap/core'

import { fetchAllTableRecords } from '../api/tableRecords'
import { parseMwsWorkbenchUrl } from '../utils/parseMwsWorkbenchUrl'
import { tableResponseToTiptapJson } from './mwsTable'

export async function insertMwsWorkbenchTableFromUrl(editor: Editor, rawInput: string): Promise<void> {
  const line = rawInput.trim().split(/\r?\n/)[0]?.trim() ?? ''
  const parsed = parseMwsWorkbenchUrl(line)
  if (!parsed) {
    throw new Error(
      'Ожидается ссылка вида https://tables.mws.ru/workbench/{id}/{viewId} — скопируйте её из адресной строки MWS Tables.',
    )
  }
  const data = await fetchAllTableRecords(parsed.dstId, parsed.viewId)
  const tableDoc = tableResponseToTiptapJson(data, parsed.dstId, parsed.viewId)
  const urlParagraph = {
    type: 'paragraph' as const,
    content: [
      {
        type: 'text' as const,
        text: line,
        marks: [{ type: 'link' as const, attrs: { href: line } }],
      },
    ],
  }
  const { from, to } = editor.state.selection
  const hasRange = from !== to
  const chain = editor.chain().focus()
  if (hasRange) chain.deleteRange({ from, to })
  chain.insertContentAt(hasRange ? from : from, [urlParagraph, tableDoc]).run()
}
