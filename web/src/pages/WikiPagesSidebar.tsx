import { NavLink } from 'react-router-dom'

import type { WikiPageInfo } from './wikiPageRegistry'

type Props = {
  pages: WikiPageInfo[]
  currentPageKey: string
  backlinkKeys: string[]
  onCreatePage: () => void
  /** На экране графа блок «Ссылки сюда» скрыт. */
  showBacklinks?: boolean
}

export function WikiPagesSidebar({
  pages,
  currentPageKey,
  backlinkKeys,
  onCreatePage,
  showBacklinks = true,
}: Props) {
  const sorted = [...pages].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  const titleByKey = new Map(pages.map((p) => [p.key, p.title]))

  return (
    <aside className="wiki-pages-sidebar" aria-label="Страницы">
      <div className="wiki-pages-sidebar-head">
        <span className="wiki-pages-sidebar-title">Страницы</span>
        <button
          type="button"
          className="wiki-pages-sidebar-new"
          onClick={onCreatePage}
          data-testid="wikiPagesSidebar-newPageButton"
        >
          + Новая
        </button>
      </div>
      <div className="wiki-pages-sidebar-graph-row">
        <NavLink
          to="/graph"
          className={({ isActive }) =>
            `wiki-pages-sidebar-graph${isActive ? ' wiki-pages-sidebar-graph--active' : ''}`
          }
          data-testid="wikiPagesSidebar-graphLink"
        >
          Граф связей
        </NavLink>
      </div>
      <nav className="wiki-pages-sidebar-nav">
        <ul className="wiki-pages-sidebar-list">
          {sorted.map((p) => (
            <li key={p.key}>
              <NavLink
                to={`/p/${encodeURIComponent(p.key)}`}
                className={({ isActive }) =>
                  `wiki-pages-sidebar-link${isActive ? ' wiki-pages-sidebar-link--active' : ''}`
                }
                data-testid={`wikiPagesSidebar-pageLink-${p.key}`}
              >
                <span className="wiki-pages-sidebar-link-text">{p.title}</span>
                <span className="wiki-pages-sidebar-link-key">{p.key}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {showBacklinks ? (
        <section className="wiki-pages-sidebar-backlinks" aria-label="Обратные ссылки">
          <h3 className="wiki-pages-sidebar-backlinks-title">Ссылки сюда</h3>
          {backlinkKeys.length === 0 ? (
            <p className="wiki-pages-sidebar-backlinks-empty">
              Другие страницы со ссылкой на «{titleByKey.get(currentPageKey) ?? currentPageKey}» появятся здесь после
              сохранения текста.
            </p>
          ) : (
            <ul className="wiki-pages-sidebar-backlinks-list">
              {backlinkKeys.map((key) => (
                <li key={key}>
                  <NavLink
                    to={`/p/${encodeURIComponent(key)}`}
                    className={({ isActive }) =>
                      `wiki-pages-sidebar-link${isActive ? ' wiki-pages-sidebar-link--active' : ''}`
                    }
                    data-testid={`wikiPagesSidebar-backlinkLink-${key}`}
                  >
                    <span className="wiki-pages-sidebar-link-text">{titleByKey.get(key) ?? key}</span>
                    <span className="wiki-pages-sidebar-link-key">{key}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </aside>
  )
}

export function PagesSidebarToggle({
  expanded,
  onClick,
}: {
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="wiki-pages-sidebar-toggle"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={expanded ? 'Скрыть список страниц' : 'Показать список страниц'}
      title={expanded ? 'Скрыть список страниц' : 'Показать список страниц'}
      data-testid="pagesSidebarToggle-toggleButton"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          d="M4 6h16M4 12h16M4 18h10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}

