import { NavLink } from 'react-router-dom'

import type { WikiPageInfo } from './wikiPageRegistry'

type Props = {
  pages: WikiPageInfo[]
  onCreatePage: () => void
}

export function WikiPagesSidebar({ pages, onCreatePage }: Props) {
  const sorted = [...pages].sort((a, b) => a.title.localeCompare(b.title, 'ru'))

  return (
    <aside className="wiki-pages-sidebar" aria-label="Страницы">
      <div className="wiki-pages-sidebar-head">
        <span className="wiki-pages-sidebar-title">Страницы</span>
        <button type="button" className="wiki-pages-sidebar-new" onClick={onCreatePage}>
          + Новая
        </button>
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
              >
                <span className="wiki-pages-sidebar-link-text">{p.title}</span>
                <span className="wiki-pages-sidebar-link-key">{p.key}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
