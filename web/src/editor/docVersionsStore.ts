import type { JSONContent } from '@tiptap/core'

export type DocVersionEntry = {
  id: string
  savedAt: number
  doc: JSONContent
}

const MAX_VERSIONS = 48
const MIN_GAP_MS = 8000

const keys = {
  list: (storageKey: string) => `wiki-doc-versions-${storageKey}`,
  lastPush: (storageKey: string) => `wiki-doc-versions-meta-${storageKey}`,
}

function loadRaw(storageKey: string): DocVersionEntry[] {
  try {
    const raw = localStorage.getItem(keys.list(storageKey))
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return []
    return p.filter(
      (v): v is DocVersionEntry =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as DocVersionEntry).id === 'string' &&
        typeof (v as DocVersionEntry).savedAt === 'number' &&
        typeof (v as DocVersionEntry).doc === 'object',
    )
  } catch {
    return []
  }
}

function saveRaw(storageKey: string, list: DocVersionEntry[]) {
  try {
    localStorage.setItem(keys.list(storageKey), JSON.stringify(list.slice(-MAX_VERSIONS)))
  } catch {
    /* quota */
  }
}

/** Запись снимка с ограничением по частоте и по изменению JSON. */
export function maybeRecordDocVersion(storageKey: string, doc: JSONContent): void {
  const json = JSON.stringify(doc)
  let lastJson = ''
  let lastAt = 0
  try {
    const meta = localStorage.getItem(keys.lastPush(storageKey))
    if (meta) {
      const o = JSON.parse(meta) as { t?: number; j?: string }
      if (typeof o.t === 'number') lastAt = o.t
      if (typeof o.j === 'string') lastJson = o.j
    }
  } catch {
    /* ignore */
  }
  const now = Date.now()
  if (json === lastJson) return
  if (now - lastAt < MIN_GAP_MS) return

  const list = loadRaw(storageKey)
  const entry: DocVersionEntry = {
    id: `v-${now}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: now,
    doc: JSON.parse(json) as JSONContent,
  }
  saveRaw(storageKey, [...list, entry])
  try {
    localStorage.setItem(keys.lastPush(storageKey), JSON.stringify({ t: now, j: json }))
  } catch {
    /* ignore */
  }
}

/** Принудительный снимок (кнопка в машине времени). */
export function forceRecordDocVersion(storageKey: string, doc: JSONContent): void {
  const list = loadRaw(storageKey)
  const now = Date.now()
  const json = JSON.stringify(doc)
  const entry: DocVersionEntry = {
    id: `v-${now}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: now,
    doc: JSON.parse(json) as JSONContent,
  }
  saveRaw(storageKey, [...list, entry])
  try {
    localStorage.setItem(keys.lastPush(storageKey), JSON.stringify({ t: now, j: json }))
  } catch {
    /* ignore */
  }
}

export function listDocVersions(storageKey: string): DocVersionEntry[] {
  return loadRaw(storageKey).sort((a, b) => b.savedAt - a.savedAt)
}
