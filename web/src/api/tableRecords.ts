import type { ErrorResponse, TableRecordsResponse } from './types'

export async function fetchTableRecords(
  dstId: string,
  options?: {
    viewId?: string
    pageSize?: number
    maxRecords?: number
    pageNum?: number
  },
): Promise<TableRecordsResponse> {
  const q = new URLSearchParams()
  if (options?.viewId) q.set('viewId', options.viewId)
  if (options?.pageSize != null) q.set('pageSize', String(options.pageSize))
  if (options?.maxRecords != null) q.set('maxRecords', String(options.maxRecords))
  if (options?.pageNum != null) q.set('pageNum', String(options.pageNum))

  const qs = q.toString()
  const path = `/api/v1/tables/${encodeURIComponent(dstId)}/records${qs ? `?${qs}` : ''}`
  const res = await fetch(path)
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Некорректный JSON (HTTP ${res.status})`)
  }

  if (!res.ok) {
    const err = body as Partial<ErrorResponse>
    const msg = err.message ?? `HTTP ${res.status}`
    const details = err.details ? `: ${err.details}` : ''
    throw new Error(`${msg}${details}`)
  }

  return body as TableRecordsResponse
}
