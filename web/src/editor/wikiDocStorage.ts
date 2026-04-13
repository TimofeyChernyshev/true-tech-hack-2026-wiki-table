import type { JSONContent } from '@tiptap/core'

const DEFAULT_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function loadWikiDoc(storageKey: string): JSONContent {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return DEFAULT_DOC
    const parsed = JSON.parse(raw) as JSONContent
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') return parsed
  } catch {
    /* ignore */
  }
  return DEFAULT_DOC
}

/** Сохранение только локально; синхронизация с сервером — через WebSocket (вне этого модуля). */
export function persistWikiDocLocal(storageKey: string, doc: JSONContent) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(doc))
  } catch {
    /* ignore */
  }
}
