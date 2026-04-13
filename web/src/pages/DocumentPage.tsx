import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { WikiDocumentEditor } from '../editor/WikiDocumentEditor'
import { WikiPagesSidebar } from './WikiPagesSidebar'
import {
  addWikiPage,
  loadHeaderSubtitle,
  loadHeaderTitle,
  loadWikiPageIndex,
  pageExists,
  persistHeaderSubtitle,
  persistHeaderTitle,
  updatePageTitleInIndex,
  wikiDocStorageKey,
} from './wikiPageRegistry'
import '../App.css'

const AUTOSAVE_KEY = 'wiki-autosave-interval-ms'

const AUTOSAVE_OPTIONS = [
  { value: 3000, label: '3 с' },
  { value: 10000, label: '10 с' },
  { value: 30000, label: '30 с' },
  { value: 60000, label: '1 мин' },
  { value: 0, label: 'Только при паузе ввода' },
] as const

function DocPageIcon() {
  return (
    <svg
      className="wiki-doc-icon-svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 1.5h5.17L12.5 4.83V14.5h-8.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 1.65V4.5h2.85" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export function DocumentPage() {
  const { pageKey: rawKey } = useParams<{ pageKey: string }>()
  const navigate = useNavigate()
  const pageKey = rawKey ? decodeURIComponent(rawKey) : 'main'

  const [pages, setPages] = useState(loadWikiPageIndex)

  const refreshPages = useCallback(() => setPages(loadWikiPageIndex()), [])

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
      const v = parseInt(localStorage.getItem(AUTOSAVE_KEY) ?? '10000', 10)
      return Number.isFinite(v) ? v : 10000
    } catch {
      return 10000
    }
  })

  useEffect(() => {
    const m = loadWikiPageIndex().find((p) => p.key === pageKey)
    setTitle(loadHeaderTitle(pageKey, m?.title ?? 'Новая страница'))
    setSubtitle(loadHeaderSubtitle(pageKey, 'Добавить описание'))
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
      localStorage.setItem(AUTOSAVE_KEY, String(autoSaveMs))
    } catch {
      /* ignore */
    }
  }, [autoSaveMs])

  const onCreatePage = useCallback(() => {
    const name = window.prompt('Название новой страницы', 'Новая страница')
    if (name === null) return
    const p = addWikiPage(name.trim() || 'Без названия')
    refreshPages()
    navigate(`/p/${encodeURIComponent(p.key)}`)
  }, [navigate, refreshPages])

  if (!pageExists(pageKey)) {
    return null
  }

  const storageKey = wikiDocStorageKey(pageKey)

  return (
    <div className="wiki-app">
      <div className="wiki-layout-with-pages">
        <WikiPagesSidebar pages={pages} onCreatePage={onCreatePage} />
        <div className="wiki-layout-main-column">
          <header className="wiki-doc-header">
            <div className="wiki-doc-icon-wrap">
              <DocPageIcon />
            </div>
            <div className="wiki-doc-titles">
              <input
                className="wiki-doc-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Заголовок страницы"
              />
              <input
                className="wiki-doc-subtitle-input"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                aria-label="Подзаголовок"
              />
            </div>
            <label className="wiki-autosave-label">
              <span className="wiki-autosave-label-text">Локальное автосохранение</span>
              <select
                className="wiki-autosave-select"
                value={autoSaveMs}
                onChange={(e) => setAutoSaveMs(Number(e.target.value))}
                aria-label="Интервал автосохранения"
              >
                {AUTOSAVE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </header>

          <WikiDocumentEditor
            storageKey={storageKey}
            pageKey={pageKey}
            excerpt={subtitle}
            autoSaveIntervalMs={autoSaveMs}
          />
        </div>
      </div>
    </div>
  )
}
