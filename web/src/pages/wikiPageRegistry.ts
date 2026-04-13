export type WikiPageInfo = {
  key: string
  title: string
  createdAt: number
}

const INDEX_KEY = 'wiki-pages-index-v1'

const LEGACY_TITLE_MAIN = 'wiki-doc-title-main'
const LEGACY_SUB_MAIN = 'wiki-doc-subtitle-main'

/** Только ASCII в ключе страницы — иначе запись не проходила валидацию при чтении индекса. */
function slugBase(name: string): string {
  const t = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return t.length ? t.slice(0, 48) : 'page'
}

export function wikiDocStorageKey(pageKey: string): string {
  return `wiki-doc-${pageKey}`
}

export function wikiHeaderTitleKey(pageKey: string): string {
  return `wiki-header-title-${pageKey}`
}

export function wikiHeaderSubtitleKey(pageKey: string): string {
  return `wiki-header-subtitle-${pageKey}`
}

export function loadWikiPageIndex(): WikiPageInfo[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as unknown
      if (Array.isArray(arr) && arr.length > 0) {
        const out: WikiPageInfo[] = []
        for (const x of arr) {
          if (x && typeof x === 'object' && 'key' in x && 'title' in x) {
            const o = x as { key: unknown; title: unknown; createdAt?: unknown }
            if (typeof o.key === 'string' && /^[a-zA-Z0-9._-]{1,120}$/.test(o.key)) {
              out.push({
                key: o.key,
                title: typeof o.title === 'string' ? o.title : o.key,
                createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
              })
            }
          }
        }
        if (out.length) return out
      }
    }
  } catch {
    /* ignore */
  }
  const main: WikiPageInfo = { key: 'main', title: 'Главная', createdAt: Date.now() }
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify([main]))
  } catch {
    /* ignore */
  }
  return [main]
}

export function saveWikiPageIndex(pages: WikiPageInfo[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(pages))
  } catch {
    /* ignore */
  }
}

export function pageExists(pageKey: string): boolean {
  return loadWikiPageIndex().some((p) => p.key === pageKey)
}

export function updatePageTitleInIndex(pageKey: string, title: string) {
  const pages = loadWikiPageIndex()
  const i = pages.findIndex((p) => p.key === pageKey)
  if (i < 0) return
  const next = title.trim() || pages[i].title
  if (next === pages[i].title) return
  pages[i] = { ...pages[i], title: next }
  saveWikiPageIndex(pages)
}

export function addWikiPage(displayTitle: string): WikiPageInfo {
  const pages = loadWikiPageIndex()
  const keys = new Set(pages.map((p) => p.key))
  let key = `${slugBase(displayTitle)}-${Date.now().toString(36)}`
  while (keys.has(key)) key = `${key}x`
  const entry: WikiPageInfo = {
    key,
    title: displayTitle.trim() || 'Без названия',
    createdAt: Date.now(),
  }
  pages.push(entry)
  saveWikiPageIndex(pages)
  return entry
}

export function loadHeaderTitle(pageKey: string, fallbackTitle: string): string {
  try {
    const v = localStorage.getItem(wikiHeaderTitleKey(pageKey))
    if (v) return v
    if (pageKey === 'main') {
      const leg = localStorage.getItem(LEGACY_TITLE_MAIN)
      if (leg) return leg
    }
  } catch {
    /* ignore */
  }
  return fallbackTitle
}

export function loadHeaderSubtitle(pageKey: string, fallback: string): string {
  try {
    const v = localStorage.getItem(wikiHeaderSubtitleKey(pageKey))
    if (v) return v
    if (pageKey === 'main') {
      const leg = localStorage.getItem(LEGACY_SUB_MAIN)
      if (leg) return leg
    }
  } catch {
    /* ignore */
  }
  return fallback
}

export function persistHeaderTitle(pageKey: string, title: string) {
  try {
    localStorage.setItem(wikiHeaderTitleKey(pageKey), title)
    if (pageKey === 'main') localStorage.setItem(LEGACY_TITLE_MAIN, title)
  } catch {
    /* ignore */
  }
}

export function persistHeaderSubtitle(pageKey: string, subtitle: string) {
  try {
    localStorage.setItem(wikiHeaderSubtitleKey(pageKey), subtitle)
    if (pageKey === 'main') localStorage.setItem(LEGACY_SUB_MAIN, subtitle)
  } catch {
    /* ignore */
  }
}
