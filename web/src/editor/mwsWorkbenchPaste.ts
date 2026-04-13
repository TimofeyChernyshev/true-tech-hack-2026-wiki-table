import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { parseMwsWorkbenchUrl } from '../utils/parseMwsWorkbenchUrl'
import { insertMwsWorkbenchTableFromUrl } from './mwsTableInsert'

export const mwsWorkbenchPasteKey = new PluginKey('mwsWorkbenchPaste')

export const MwsWorkbenchPaste = Extension.create({
  name: 'mwsWorkbenchPaste',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: mwsWorkbenchPasteKey,
        props: {
          handlePaste(_view, event) {
            const cd = event.clipboardData
            const text = cd?.getData('text/plain')
            const line = text?.trim().split(/\r?\n/)[0]?.trim() ?? ''
            const parsed = parseMwsWorkbenchUrl(line)
            if (!parsed) return false

            event.preventDefault()

            void (async () => {
              try {
                await insertMwsWorkbenchTableFromUrl(editor, line)
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
