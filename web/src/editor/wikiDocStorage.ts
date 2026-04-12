import type { JSONContent } from '@tiptap/core'
import { fetchWikiPage, putWikiPage } from '../api/wikiPages'

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

/** Сначала бэкенд, при отсутствии или ошибке сети — localStorage. */
export async function loadWikiDocWithRemoteFallback(storageKey: string): Promise<JSONContent> {
  try {
    const remote = await fetchWikiPage(storageKey)
    if (remote) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(remote))
      } catch {
        /* ignore */
      }
      return remote
    }
  } catch {
    /* бэкенд не запущен или недоступен */
  }
  return loadWikiDoc(storageKey)
}

export function saveWikiDoc(storageKey: string, doc: JSONContent) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(doc))
  } catch {
    /* ignore */
  }
  void putWikiPage(storageKey, doc).catch(() => {
    /* офлайн / бэкенд выключен — остаётся только localStorage */
  })
}
