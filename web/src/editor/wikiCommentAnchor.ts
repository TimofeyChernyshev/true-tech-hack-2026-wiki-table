import { Extension } from '@tiptap/core'

import type { Editor } from '@tiptap/core'

import type { ResolvedPos } from '@tiptap/pm/model'

function findBlockDepth($pos: ResolvedPos): number | null {
  for (let d = $pos.depth; d > 0; d -= 1) {
    const n = $pos.node(d)
    if (n.type.name === 'paragraph' || n.type.name === 'heading') return d
  }
  return null
}

/** Возвращает data-comment-anchor для блока; при отсутствии создаёт id и применяет транзакцию. */
export function ensureCommentAnchorAtPosition(editor: Editor, pos: number): string | null {
  const { state, view } = editor
  const $pos = state.doc.resolve(pos)
  const depth = findBlockDepth($pos)
  if (depth === null) return null
  const node = $pos.node(depth)
  const before = $pos.before(depth)
  let id = node.attrs.commentAnchor as string | null | undefined
  if (id) return id
  id = `ca-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`
  const tr = state.tr.setNodeMarkup(before, undefined, { ...node.attrs, commentAnchor: id })
  view.dispatch(tr)
  return id
}

export function excerptFromBlockNode(node: { textContent: string }): string {
  const t = node.textContent.replace(/\s+/g, ' ').trim()
  if (t.length <= 140) return t
  return `${t.slice(0, 137)}…`
}

export const WikiCommentAnchor = Extension.create({
  name: 'wikiCommentAnchor',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          commentAnchor: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-comment-anchor'),
            renderHTML: (attributes) => {
              const v = attributes.commentAnchor as string | null | undefined
              if (!v) return {}
              return { 'data-comment-anchor': v }
            },
          },
        },
      },
    ]
  },
})
