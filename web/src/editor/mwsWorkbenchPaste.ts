import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { fetchAllTableRecords } from '../api/tableRecords'
import { parseMwsWorkbenchUrl } from '../utils/parseMwsWorkbenchUrl'
import { tableResponseToTiptapJson } from './mwsTable'

export const mwsWorkbenchPasteKey = new PluginKey('mwsWorkbenchPaste')

export const MwsWorkbenchPaste = Extension.create({
  name: 'mwsWorkbenchPaste',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: mwsWorkbenchPasteKey,
        props: {
          handlePaste(view, event) {
            const cd = event.clipboardData
            const text = cd?.getData('text/plain')
            const line = text?.trim().split(/\r?\n/)[0]?.trim() ?? ''
            const parsed = parseMwsWorkbenchUrl(line)
            if (!parsed) return false

            event.preventDefault()
            const { from, to } = view.state.selection

            void (async () => {
              try {
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
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from, to })
                  .insertContentAt(from, [urlParagraph, tableDoc])
                  .run()
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                window.alert(msg)
              }
            })()

            return true
          },
        },
      }),
    ]
  },
})
