import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  getBacklinksForPage,
  rebuildBacklinksIndex,
  WIKI_BACKLINKS_UPDATED,
  WIKI_NAVIGATE_EVENT,
  type WikiNavigateDetail,
} from '../wikiBacklinks'
import {
  addWikiPage,
  loadHeaderSubtitle,
  loadHeaderTitle,
  loadWikiPageIndex,
  pageExists,
  persistHeaderSubtitle,
  persistHeaderTitle,
  updatePageTitleInIndex,
  type WikiPageInfo,
} from '../wikiPageRegistry'
import { WIKI_AUTOSAVE_INTERVAL_LS_KEY } from '../documentPageConstants'

export function useWikiDocumentPage() {
  const { pageKey: rawKey } = useParams<{ pageKey: string }>()
  const navigate = useNavigate()
  const pageKey = rawKey ? decodeURIComponent(rawKey) : 'main'

  const [pages, setPages] = useState<WikiPageInfo[]>(loadWikiPageIndex)
  const [backlinksRev, setBacklinksRev] = useState(0)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [pagesSidebarOpen, setPagesSidebarOpen] = useState(true)

  const refreshPages = useCallback(() => setPages(loadWikiPageIndex()), [])

  useEffect(() => {
    rebuildBacklinksIndex()
    /* После перестроения индекса обновляем производное состояние для useMemo backlinks */
    queueMicrotask(() => setBacklinksRev((x) => x + 1))
  }, [])

  useEffect(() => {
    const onBl = () => setBacklinksRev((x) => x + 1)
    window.addEventListener(WIKI_BACKLINKS_UPDATED, onBl)
    return () => window.removeEventListener(WIKI_BACKLINKS_UPDATED, onBl)
  }, [])

  useEffect(() => {
    const onNav = (e: Event) => {
      const d = (e as CustomEvent<WikiNavigateDetail>).detail
      if (d?.pageKey) {
        navigate(`/p/${encodeURIComponent(d.pageKey)}`)
      }
    }
    window.addEventListener(WIKI_NAVIGATE_EVENT, onNav as EventListener)
    return () => window.removeEventListener(WIKI_NAVIGATE_EVENT, onNav as EventListener)
  }, [navigate])

  useEffect(() => {
    if (!pageExists(pageKey)) {
      navigate('/p/main', { replace: true })
    }
  }, [pageKey, navigate])

  const meta = pages.find((p) => p.key === pageKey)

  const [title, setTitle] = useState(() =>
    loadHeaderTitle(pageKey, meta?.title ?? 'Новая страница'),
  )
  const [subtitle, setSubtitle] = useState(() => loadHeaderSubtitle(pageKey, 'Добавить описание'))

  const [autoSaveMs, setAutoSaveMs] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(WIKI_AUTOSAVE_INTERVAL_LS_KEY) ?? '10000', 10)
      return Number.isFinite(v) ? v : 10000
    } catch {
      return 10000
    }
  })

  useEffect(() => {
    const m = loadWikiPageIndex().find((p) => p.key === pageKey)
    const nextTitle = loadHeaderTitle(pageKey, m?.title ?? 'Новая страница')
    const nextSubtitle = loadHeaderSubtitle(pageKey, 'Добавить описание')
    queueMicrotask(() => {
      setTitle(nextTitle)
      setSubtitle(nextSubtitle)
    })
  }, [pageKey])

  useEffect(() => {
    persistHeaderTitle(pageKey, title)
  }, [title, pageKey])

  useEffect(() => {
    persistHeaderSubtitle(pageKey, subtitle)
  }, [subtitle, pageKey])

  useEffect(() => {
    const t = window.setTimeout(() => {
      updatePageTitleInIndex(pageKey, title)
      refreshPages()
    }, 500)
    return () => clearTimeout(t)
  }, [title, pageKey, refreshPages])

  useEffect(() => {
    try {
      localStorage.setItem(WIKI_AUTOSAVE_INTERVAL_LS_KEY, String(autoSaveMs))
    } catch {
      /* ignore */
    }
  }, [autoSaveMs])

  const backlinkKeys = useMemo(() => {
    void backlinksRev
    return getBacklinksForPage(pageKey)
  }, [pageKey, backlinksRev])

  const onCreatePage = useCallback(() => setNewPageOpen(true), [])

  const onConfirmNewPage = useCallback(
    (newTitle: string) => {
      const p = addWikiPage(newTitle)
      refreshPages()
      navigate(`/p/${encodeURIComponent(p.key)}`)
    },
    [navigate, refreshPages],
  )

  const exists = pageExists(pageKey)

  return {
    pageKey,
    pages,
    backlinkKeys,
    newPageOpen,
    setNewPageOpen,
    pagesSidebarOpen,
    setPagesSidebarOpen,
    title,
    setTitle,
    subtitle,
    setSubtitle,
    autoSaveMs,
    setAutoSaveMs,
    onCreatePage,
    onConfirmNewPage,
    pageExists: exists,
  }
}
