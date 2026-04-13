import type {
  CreateFieldBody,
  CreateRecordsRequest,
  DeleteRecordsResponse,
  ErrorResponse,
  FieldResponse,
  RecordsResponse,
  TableDataResponse,
} from './types'

/**
 * REST к бэкенду `/api/v1/tables/{dstId}/…` (см. api/table-service.yaml):
 * - GET    …/records      — список записей (и метаданные полей)
 * - POST   …/records      — создать записи (моментально по кнопке)
 * - DELETE …/records      — удалить записи по id
 * - POST   …/fields       — новый столбец (query spaceId)
 * - DELETE …/fields/{fieldId} — удалить столбец (query spaceId)
 *
 * Правки текста ячеек/страницы — через коллаборацию / вебсокет, не через эти методы.
 */

function parseJsonBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Некорректный JSON в ответе сервера')
  }
}

export function parseApiError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const o = body as Partial<ErrorResponse> & { msg?: string }
    const msg = o.message ?? o.msg
    if (typeof msg === 'string' && msg.length > 0) {
      const details = typeof o.details === 'string' ? `: ${o.details}` : ''
      return `${msg}${details}`
    }
  }
  return `HTTP ${status}`
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const text = await res.text()
  const body = text ? parseJsonBody(text) : null

  if (!res.ok) {
    throw new Error(parseApiError(body, res.status))
  }
  return (body ?? ({} as T)) as T
}

export async function createTableRecords(
  dstId: string,
  body: CreateRecordsRequest,
  viewId?: string | null,
): Promise<RecordsResponse> {
  const q = new URLSearchParams()
  if (viewId) q.set('viewId', viewId)
  const qs = q.toString()
  const path = `/api/v1/tables/${encodeURIComponent(dstId)}/records${qs ? `?${qs}` : ''}`
  return requestJson<RecordsResponse>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function deleteTableRecords(dstId: string, recordIds: string[]): Promise<DeleteRecordsResponse> {
  const path = `/api/v1/tables/${encodeURIComponent(dstId)}/records`
  return requestJson<DeleteRecordsResponse>(path, {
    method: 'DELETE',
    body: JSON.stringify({ recordIds }),
  })
}

export async function createTableField(dstId: string, spaceId: string, body: CreateFieldBody): Promise<FieldResponse> {
  const q = new URLSearchParams()
  q.set('spaceId', spaceId)
  const path = `/api/v1/tables/${encodeURIComponent(dstId)}/fields?${q}`
  return requestJson<FieldResponse>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function deleteTableField(dstId: string, fieldId: string, spaceId: string): Promise<void> {
  const q = new URLSearchParams()
  q.set('spaceId', spaceId)
  const path = `/api/v1/tables/${encodeURIComponent(dstId)}/fields/${encodeURIComponent(fieldId)}?${q}`
  await requestJson<unknown>(path, { method: 'DELETE' })
}

export async function fetchTableData(
  dstId: string,
  options?: {
    viewId?: string
    pageSize?: number
    pageNum?: number
  },
): Promise<TableDataResponse> {
  const q = new URLSearchParams()
  if (options?.viewId) q.set('viewId', options.viewId)
  if (options?.pageSize != null) q.set('pageSize', String(options.pageSize))
  if (options?.pageNum != null) q.set('pageNum', String(options.pageNum))

  const qs = q.toString()
  const path = `/api/v1/tables/${encodeURIComponent(dstId)}/records${qs ? `?${qs}` : ''}`
  return requestJson<TableDataResponse>(path)
}

const MAX_PAGES = 200
const DEFAULT_PAGE = 100

/** Все страницы записей (до лимита Fusion по pageSize на запрос). */
export async function fetchAllTableRecords(
  dstId: string,
  viewId?: string,
  pageSize = DEFAULT_PAGE,
): Promise<TableDataResponse> {
  const all: TableDataResponse['records'] = []
  let pageNum = 1
  let meta: Pick<TableDataResponse, 'tableId' | 'tableName' | 'fields'> | null = null
  let hasMore = true

  while (hasMore && pageNum <= MAX_PAGES) {
    const chunk = await fetchTableData(dstId, { viewId, pageSize, pageNum })
    if (!meta) {
      meta = {
        tableId: chunk.tableId ?? dstId,
        tableName: chunk.tableName,
        fields: chunk.fields ?? [],
      }
    }
    all.push(...chunk.records)
    hasMore = Boolean(chunk.pagination?.hasMore)
    pageNum += 1
  }

  if (!meta) {
    throw new Error('Пустой ответ при загрузке таблицы')
  }

  return {
    tableId: meta.tableId,
    tableName: meta.tableName,
    fields: meta.fields,
    records: all,
    pagination: {
      pageNum: 1,
      pageSize: all.length,
      total: all.length,
      hasMore: false,
    },
  }
}

