import { useCallback, useMemo, useState } from 'react'
import { fetchTableRecords } from './api/tableRecords'
import type { TableRecordsResponse } from './api/types'
import './App.css'

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
    <div className="app">
      <header className="header">
        <h1>Записи таблицы (Wiki API)</h1>
        <p className="subtitle">
          GET <code>/api/v1/tables/&#123;dstId&#125;/records</code> — ответ{' '}
          <code>TableRecordsResponse</code>
        </p>
      </header>

      <section className="form">
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
  )
}
