import type { JSONContent } from '@tiptap/core'

import { loadWikiPageIndex, wikiDocStorageKey, type WikiPageInfo } from './wikiPageRegistry'

export function readWikiDocJson(storageKey: string): JSONContent | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as JSONContent
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') return parsed
  } catch {
    /* ignore */
  }
  return null
}

const BACKLINKS_KEY = 'wiki-backlinks-index-v1'

/** Событие: перейти на wiki-страницу (detail.pageKey). */
export const WIKI_NAVIGATE_EVENT = 'wiki-navigate'

export type WikiNavigateDetail = { pageKey: string }

/** После пересборки индекса обратных ссылок. */
export const WIKI_BACKLINKS_UPDATED = 'wiki-backlinks-updated'

export type BacklinksMap = Record<string, string[]>

function loadMap(): BacklinksMap {
  try {
    const raw = localStorage.getItem(BACKLINKS_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    const out: BacklinksMap = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        out[k] = v.filter((x): x is string => typeof x === 'string')
      }
    }
    return out
  } catch {
    return {}
  }
}

function saveMap(m: BacklinksMap) {
  try {
    localStorage.setItem(BACKLINKS_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

/** Извлекает ключ wiki-страницы из href вида /p/foo, .../p/foo, полный URL. */
export function parsePageKeyFromHref(href: string): string | null {
  const s = href.trim()
  const m = s.match(/(?:^|\/)(?:p)\/([^/?#]+)/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

function walkDocLinks(doc: JSONContent, out: Set<string>) {
  if (doc.type === 'text' && doc.marks) {
    for (const mk of doc.marks) {
      if (mk.type === 'link' && mk.attrs && typeof mk.attrs.href === 'string') {
        const key = parsePageKeyFromHref(mk.attrs.href)
        if (key) out.add(key)
      }
    }
  }
  if (Array.isArray(doc.content)) {
    for (const c of doc.content) walkDocLinks(c, out)
  }
}

export function extractOutgoingPageKeys(doc: JSONContent): Set<string> {
  const s = new Set<string>()
  walkDocLinks(doc, s)
  return s
}

export function rebuildBacklinksIndex(): BacklinksMap {
  const pages = loadWikiPageIndex()
  const incoming: BacklinksMap = {}
  for (const p of pages) {
    const doc = readWikiDocJson(wikiDocStorageKey(p.key))
    if (!doc) continue
    for (const target of extractOutgoingPageKeys(doc)) {
      if (target === p.key) continue
      if (!incoming[target]) incoming[target] = []
      if (!incoming[target].includes(p.key)) incoming[target].push(p.key)
    }
  }
  saveMap(incoming)
  return incoming
}

let reindexTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleBacklinksReindex() {
  if (reindexTimer) clearTimeout(reindexTimer)
  reindexTimer = setTimeout(() => {
    reindexTimer = null
    rebuildBacklinksIndex()
    try {
      window.dispatchEvent(new CustomEvent(WIKI_BACKLINKS_UPDATED))
    } catch {
      /* ignore */
    }
  }, 700)
}

export function getBacklinksForPage(pageKey: string): string[] {
  const m = loadMap()
  return [...(m[pageKey] ?? [])]
}

export function pageTitleLookup(pages: WikiPageInfo[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of pages) map.set(p.key, p.title)
  return map
}
