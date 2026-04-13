import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import { loadCommentsAdvanced, loadThreads } from '../comments/commentAdvancedStore'
import { WIKI_PAGE_COMMENT_ANCHOR } from '../comments/commentScopeConstants'

import { excerptFromBlockNode } from './wikiCommentAnchor'

export const commentGutterKey = new PluginKey('wikiCommentGutter')

export const WIKI_COMMENT_OPEN_EVENT = 'wiki-comment-open'

function blockInTable($pos: import('@tiptap/pm/model').ResolvedPos): boolean {
  for (let d = $pos.depth; d > 0; d -= 1) {
    const n = $pos.node(d).type.name
    if (n === 'table' || n === 'tableCell' || n === 'tableHeader' || n === 'tableRow') return true
  }
  return false
}

function countThreadMessages(pageKey: string, anchorKey: string): number {
  const comments = loadCommentsAdvanced(pageKey)
  const threads = loadThreads(pageKey)
  let n = 0
  for (const c of comments) {
    if (c.deleted) continue
    const tm = threads[c.threadId]
    if (!tm || tm.deleted) continue
    const a = tm.anchorKey ?? WIKI_PAGE_COMMENT_ANCHOR
    if (a === anchorKey) n += 1
  }
  return n
}

function buildDecorations(doc: import('@tiptap/pm/model').Node, pageKey: string) {
  const decorations: Decoration[] = []
  let wi = 0
  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return true
    const $p = doc.resolve(pos + 1)
    if (blockInTable($p)) return true
    const anchor = (node.attrs.commentAnchor as string | null | undefined) ?? null
    const count = anchor ? countThreadMessages(pageKey, anchor) : 0
    const innerEnd = pos + node.nodeSize - 1
    const excerpt = excerptFromBlockNode(node)

    const wrap = document.createElement('span')
    wrap.className = 'wiki-comment-gutter-host'
    wrap.contentEditable = 'false'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className =
      count > 0 ? 'wiki-comment-gutter wiki-comment-gutter--has' : 'wiki-comment-gutter wiki-comment-gutter--empty'
    btn.setAttribute('aria-label', count > 0 ? `Комментарии: ${count}` : 'Начать обсуждение')
    const tip =
      count > 0 ? `Показать ${count} комментари${count === 1 ? 'й' : count < 5 ? 'я' : 'ев'}` : 'Начать обсуждение'
    btn.dataset.tooltip = tip
    btn.title = tip


    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(
        new CustomEvent(WIKI_COMMENT_OPEN_EVENT, {
          detail: { pageKey, pos: pos + 1, excerpt },
        }),
      )
    })

    wrap.appendChild(btn)
    wi += 1
    decorations.push(Decoration.widget(innerEnd, wrap, { side: 1, key: `cg-${wi}-${anchor ?? 'x'}` }))
    return true
  })
  return DecorationSet.create(doc, decorations)
}

export const CommentGutter = Extension.create({
  name: 'commentGutter',

  addOptions() {
    return {
      pageKey: 'main',
    }
  },

  addProseMirrorPlugins() {
    const pageKey = this.options.pageKey as string
    return [
      new Plugin({
        key: commentGutterKey,
        state: {
          init: (_, state) => buildDecorations(state.doc, pageKey),
          apply: (tr, set) => {
            if (!tr.docChanged && tr.getMeta('commentGutterRefresh') !== true) return set
            return buildDecorations(tr.doc, pageKey)
          },
        },
        props: {
          decorations(state) {
            return commentGutterKey.getState(state)
          },
        },
      }),
    ]
  },
})
