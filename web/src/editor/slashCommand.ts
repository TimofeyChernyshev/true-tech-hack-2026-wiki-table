import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import tippy, { type Instance } from 'tippy.js'
import { SlashMenu, type SlashMenuProps, type SlashMenuRef } from './SlashMenu'
import { filterSlashItems, type SlashItem } from './slashItems'

export const slashPluginKey = new PluginKey('slashCommands')

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      Suggestion<SlashItem, SlashItem>({
        editor,
        char: '/',
        pluginKey: slashPluginKey,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          for (let d = $from.depth; d > 0; d -= 1) {
            const n = $from.node(d)
            if (n.type.spec.code || n.type.name === 'codeBlock') {
              return false
            }
          }
          return true
        },
        command: ({ editor: ed, range, props }) => {
          props.run({ editor: ed, range })
        },
        items: ({ query }) => filterSlashItems(editor, query),
        render: () => {
          let component: ReactRenderer<SlashMenuRef, SlashMenuProps> | null = null
          let popup: Instance | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props: {
                  items: props.items,
                  command: props.command,
                },
              })

              popup = tippy(document.body, {
                getReferenceClientRect: () => {
                  const r = props.clientRect?.()
                  return r ?? new DOMRect(0, 0, 0, 0)
                },
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                offset: [0, 8],
                zIndex: 10000,
              })
            },

            onUpdate(props) {
              component?.updateProps({
                items: props.items,
                command: props.command,
              })
              popup?.setProps({
                getReferenceClientRect: () => {
                  const r = props.clientRect?.()
                  return r ?? new DOMRect(0, 0, 0, 0)
                },
              })
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.hide()
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },

            onExit() {
              popup?.destroy()
              component?.destroy()
              popup = null
              component = null
            },
          }
        },
      }),
    ]
  },
})
