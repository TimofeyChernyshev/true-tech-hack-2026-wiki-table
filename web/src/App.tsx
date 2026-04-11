import { useCallback, useMemo, useState } from 'react'
import { fetchTableRecords } from './api/tableRecords'
import type { TableRecordsResponse } from './api/types'
import { WikiEditor } from './editor/WikiEditor'
import './App.css'

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

function Toolbar() {
  const tool = (label: string) => (
    <button type="button" className="tb-btn" disabled title={label}>
      {label}
    </button>
  )

  return (
    <div className="wiki-toolbar" role="toolbar" aria-label="Панель форматирования (макет)">
      <div className="wiki-toolbar-nav">
        <button type="button" className="tb-nav" disabled title="Отменить">
          ↶
        </button>
        <button type="button" className="tb-nav" disabled title="Повторить">
          ↷
        </button>
      </div>
      <div className="wiki-toolbar-sep" aria-hidden />
      <div className="wiki-toolbar-inner">
        <div className="tb-group">
          {tool('B')}
          {tool('I')}
          <button type="button" className="tb-btn tb-btn-on" disabled title="Зачёркнутый">
            S
          </button>
          {tool('U')}
        </div>
        <div className="tb-group">{tool('T')}</div>
        <div className="tb-group">
          {tool('H1')}
          {tool('H2')}
          {tool('H3')}
        </div>
        <div className="tb-group">
          {tool('L')}
          {tool('C')}
          {tool('R')}
        </div>
        <div className="tb-group">
          {tool('1.')}
          {tool('•')}
          {tool('☑')}
        </div>
        <div className="tb-group">{tool('@')}</div>
        <div className="tb-group">{tool('</>')}</div>
        <div className="tb-group">{tool('❝')}</div>
        <div className="tb-group">{tool('🖼')}</div>
      </div>
    </div>
  )
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function fieldColumns(records: TableRecordsResponse['records']): string[] {
  const keys = new Set<string>()
  for (const r of records) {
    Object.keys(r.fields ?? {}).forEach((k) => keys.add(k))
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b))
}

export default function App() {
  const [dstId, setDstId] = useState('dstFiaiw12AA')
  const [viewId, setViewId] = useState('')
  const [pageSize, setPageSize] = useState(100)
  const [pageNum, setPageNum] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TableRecordsResponse | null>(null)

  const load = useCallback(async () => {
    const id = dstId.trim()
    if (!id) {
      setError('Укажите dstId таблицы')
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetchTableRecords(id, {
        viewId: viewId.trim() || undefined,
        pageSize,
        pageNum,
      })
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [dstId, viewId, pageSize, pageNum])

  const columns = useMemo(() => (data ? fieldColumns(data.records) : []), [data])

  return (
    <div className="wiki-app">
      <header className="wiki-doc-header">
        <div className="wiki-doc-icon-wrap">
          <DocPageIcon />
        </div>
        <div className="wiki-doc-titles">
          <p className="wiki-doc-title">Новая страница</p>
          <p className="wiki-doc-subtitle">Добавить описание</p>
        </div>
      </header>

      <Toolbar />

      <main className="wiki-main">
        <div className="wiki-main-inner">
          <h1 className="wiki-h1">Записи таблицы</h1>
          <p className="wiki-lead">
            Ниже — редактор страницы (Tiptap, блоки кода с подсветкой). Наберите{' '}
            <kbd className="wiki-kbd">/</kbd> для slash-меню. Данные таблицы — через API{' '}
            <code>TableRecordsResponse</code>.
          </p>

          <WikiEditor />

          <section className="form-panel">
            <label className="field">
              <span>dstId</span>
              <input
                value={dstId}
                onChange={(e) => setDstId(e.target.value)}
                placeholder="dstFiaiw12AA"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>viewId (необязательно)</span>
              <input
                value={viewId}
                onChange={(e) => setViewId(e.target.value)}
                placeholder="viwG9l1VPD6nH"
                autoComplete="off"
              />
            </label>
            <label className="field narrow">
              <span>pageSize</span>
              <input
                type="number"
                min={1}
                max={150}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || 100)}
              />
            </label>
            <label className="field narrow">
              <span>pageNum</span>
              <input
                type="number"
                min={1}
                value={pageNum}
                onChange={(e) => setPageNum(Number(e.target.value) || 1)}
              />
            </label>
            <button type="button" className="primary" onClick={load} disabled={loading}>
              {loading ? 'Загрузка…' : 'Загрузить'}
            </button>
          </section>

          {error && <div className="banner error">{error}</div>}

          {data && (
            <section className="result">
              <div className="meta">
                <strong>TableRecordsResponse:</strong>{' '}
                <code>pageNum</code>={data.pageNum}, <code>pageSize</code>={data.pageSize},{' '}
                <code>records.length</code>={data.records.length}
              </div>
              <div className="table-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>recordId</th>
                      {columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      <th>createdAt</th>
                      <th>updatedAt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((r) => (
                      <tr key={r.recordId}>
                        <td className="mono">{r.recordId}</td>
                        {columns.map((c) => (
                          <td key={c}>{formatCell(r.fields[c])}</td>
                        ))}
                        <td className="mono muted">
                          {r.createdAt != null ? r.createdAt : '—'}
                        </td>
                        <td className="mono muted">
                          {r.updatedAt != null ? r.updatedAt : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <pre className="json-preview">{JSON.stringify(data, null, 2)}</pre>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
