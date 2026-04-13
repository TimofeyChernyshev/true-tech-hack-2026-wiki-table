import { extractOutgoingPageKeys, readWikiDocJson } from './wikiBacklinks'
import { loadWikiPageIndex, wikiDocStorageKey } from './wikiPageRegistry'

export type WikiGraphNode = {
  id: string
  title: string
}

/** Направленное ребро: страница `from` содержит ссылку на `to`. */
export type WikiGraphEdge = {
  from: string
  to: string
}

export type WikiLinkGraph = {
  nodes: WikiGraphNode[]
  edges: WikiGraphEdge[]
}

/**
 * Граф связей между wiki-страницами: рёбра = явные ссылки в тексте (mark link с href /p/...).
 * Страницы без исходящих ссылок всё равно попадают в узлы.
 */
export function buildWikiLinkGraph(): WikiLinkGraph {
  const pages = loadWikiPageIndex()
  const pageKeys = new Set(pages.map((p) => p.key))
  const nodes: WikiGraphNode[] = pages.map((p) => ({ id: p.key, title: p.title }))
  const edges: WikiGraphEdge[] = []
  const seen = new Set<string>()

  for (const p of pages) {
    const doc = readWikiDocJson(wikiDocStorageKey(p.key))
    if (!doc) continue
    for (const target of extractOutgoingPageKeys(doc)) {
      if (target === p.key) continue
      if (!pageKeys.has(target)) continue
      const ek = `${p.key}→${target}`
      if (seen.has(ek)) continue
      seen.add(ek)
      edges.push({ from: p.key, to: target })
    }
  }

  return { nodes, edges }
}
