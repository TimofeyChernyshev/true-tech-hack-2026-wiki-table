import type { AnyExtension, JSONContent } from '@tiptap/core'
import { getSchema } from '@tiptap/core'
import { prosemirrorJSONToYDoc } from 'y-prosemirror'
import * as Y from 'yjs'

export function wikiYStateStorageKey(pageKey: string): string {
  return `wiki-y-state-v1-${pageKey}`
}

function decodeYUpdate(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

/**
 * Один Y.Doc на страницу: восстановление из localStorage или начальное дерево из JSON (TipTap).
 */
export function createWikiYDoc(
  pageKey: string,
  initialDoc: JSONContent,
  baseExtensions: AnyExtension[],
): Y.Doc {
  const schema = getSchema(baseExtensions)
  const ydoc = new Y.Doc()
  let hadPersist = false
  try {
    const raw = localStorage.getItem(wikiYStateStorageKey(pageKey))
    if (raw) {
      const buf = decodeYUpdate(raw)
      if (buf?.length) {
        Y.applyUpdate(ydoc, buf, 'persist')
        hadPersist = true
      }
    }
  } catch {
    /* ignore */
  }

  if (!hadPersist) {
    try {
      const seed = prosemirrorJSONToYDoc(schema, initialDoc as Record<string, unknown>, 'default')
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(seed))
      seed.destroy()
    } catch {
      /* пустой документ по умолчанию в Y */
    }
  }

  return ydoc
}

export function encodeYDocBase64(ydoc: Y.Doc): string {
  const u = Y.encodeStateAsUpdate(ydoc)
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s)
}
