import { useEffect, useState } from 'react'
import { WikiDocumentEditor } from '../editor/WikiDocumentEditor'
import '../App.css'

const TITLE_KEY = 'wiki-doc-title-main'
const SUBTITLE_KEY = 'wiki-doc-subtitle-main'
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
  const [title, setTitle] = useState(() => localStorage.getItem(TITLE_KEY) ?? 'Новая страница')
  const [subtitle, setSubtitle] = useState(
    () => localStorage.getItem(SUBTITLE_KEY) ?? 'Добавить описание',
  )
  const [autoSaveMs, setAutoSaveMs] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(AUTOSAVE_KEY) ?? '10000', 10)
      return Number.isFinite(v) ? v : 10000
    } catch {
      return 10000
    }
  })

  useEffect(() => {
    localStorage.setItem(TITLE_KEY, title)
  }, [title])

  useEffect(() => {
    localStorage.setItem(SUBTITLE_KEY, subtitle)
  }, [subtitle])

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, String(autoSaveMs))
    } catch {
      /* ignore */
    }
  }, [autoSaveMs])

  return (
    <div className="wiki-app">
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
          <span className="wiki-autosave-label-text">Автосохранение</span>
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
        storageKey="wiki-doc-main"
        pageKey="main"
        excerpt={subtitle}
        autoSaveIntervalMs={autoSaveMs}
      />
    </div>
  )
}
