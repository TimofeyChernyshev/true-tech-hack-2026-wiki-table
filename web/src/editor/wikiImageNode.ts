import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

function distToImage(selFrom: number, pos: number, nodeSize: number) {
  return Math.min(Math.abs(selFrom - pos), Math.abs(selFrom - pos - nodeSize))
}

export function findImageNodePos(editor: Editor): number | null {
  const { state } = editor
  const sel = state.selection

  if (sel instanceof NodeSelection && sel.node.type.name === 'image') {
    return sel.from
  }

  const $from = sel.$from
  const after = $from.nodeAfter
  if (after?.type.name === 'image') {
    return $from.pos
  }
  const before = $from.nodeBefore
  if (before?.type.name === 'image') {
    return $from.pos - before.nodeSize
  }

  let onlyImagePos: number | null = null
  let imageCount = 0
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return
    imageCount += 1
    onlyImagePos = pos
  })
  if (imageCount === 1 && onlyImagePos != null) {
    return onlyImagePos
  }

  const lo = Math.max(0, sel.from - 24)
  const hi = Math.min(state.doc.content.size, sel.to + 24)
  let bestPos: number | null = null
  let bestDist = Infinity
  state.doc.nodesBetween(lo, hi, (node, pos) => {
    if (node.type.name !== 'image') return
    const d = distToImage(sel.from, pos, node.nodeSize)
    if (d < bestDist) {
      bestDist = d
      bestPos = pos
    }
  })
  if (bestPos != null && bestDist <= 24) {
    return bestPos
  }

  bestPos = null
  bestDist = Infinity
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return
    const d = distToImage(sel.from, pos, node.nodeSize)
    if (d < bestDist) {
      bestDist = d
      bestPos = pos
    }
  })

  return bestDist <= 48 ? bestPos : null
}

export type ImageAttrPatch = Record<string, string | number | null | undefined>

export function applyImageAttrsAtPos(editor: Editor, pos: number, patch: ImageAttrPatch): boolean {
  return editor.commands.command(({ tr, state }) => {
    const node = state.doc.nodeAt(pos)
    if (!node || node.type.name !== 'image') return false
    const next = { ...node.attrs } as Record<string, unknown>
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue
      next[k] = v
    }
    tr.setNodeMarkup(pos, undefined, next as typeof node.attrs)
    tr.setSelection(NodeSelection.create(tr.doc, pos))
    return true
  })
}
