import { PagesSidebarToggle } from './WikiPagesSidebar'
import { WIKI_AUTOSAVE_OPTIONS } from './documentPageConstants'

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

type Props = {
  pagesSidebarOpen: boolean
  onToggleSidebar: () => void
  title: string
  onTitleChange: (value: string) => void
  subtitle: string
  onSubtitleChange: (value: string) => void
  autoSaveMs: number
  onAutoSaveMsChange: (value: number) => void
}

export function DocumentPageHeader({
  pagesSidebarOpen,
  onToggleSidebar,
  title,
  onTitleChange,
  subtitle,
  onSubtitleChange,
  autoSaveMs,
  onAutoSaveMsChange,
}: Props) {
  return (
    <header className="wiki-doc-header">
      <PagesSidebarToggle expanded={pagesSidebarOpen} onClick={onToggleSidebar} />
      <div className="wiki-doc-icon-wrap">
        <DocPageIcon />
      </div>
      <div className="wiki-doc-titles">
        <input
          className="wiki-doc-title-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Заголовок страницы"
          data-testid="documentPage-titleInput"
        />
        <input
          className="wiki-doc-subtitle-input"
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
          aria-label="Подзаголовок"
          data-testid="documentPage-subtitleInput"
        />
      </div>
      <label className="wiki-autosave-label">
        <span className="wiki-autosave-label-text">Локальное автосохранение</span>
        <select
          className="wiki-autosave-select"
          value={autoSaveMs}
          onChange={(e) => onAutoSaveMsChange(Number(e.target.value))}
          aria-label="Интервал автосохранения"
          data-testid="documentPage-autosaveSelect"
        >
          {WIKI_AUTOSAVE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </header>
  )
}
