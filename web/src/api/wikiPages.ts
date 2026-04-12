import type { JSONContent } from '@tiptap/core'

function wikiPagePath(pageKey: string): string {
  return `/api/v1/wiki/pages/${encodeURIComponent(pageKey)}`
}

/** GET: тело — корень документа TipTap (`{ type: 'doc', ... }`). 404 — страницы нет на сервере. */
export async function fetchWikiPage(pageKey: string): Promise<JSONContent | null> {
  const res = await fetch(wikiPagePath(pageKey), {
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`)
  }
  const j = text ? (JSON.parse(text) as unknown) : null
  if (j && typeof j === 'object' && (j as JSONContent).type === 'doc') {
    return j as JSONContent
  }
  throw new Error('Ответ сервера не похож на документ wiki')
}

/** PUT: сохранить JSON документа; успех — 204 No Content. */
export async function putWikiPage(pageKey: string, doc: JSONContent): Promise<void> {
  const res = await fetch(wikiPagePath(pageKey), {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  })
  if (res.status === 204 || res.status === 200) return
  const text = await res.text()
  throw new Error(text || `HTTP ${res.status}`)
}
