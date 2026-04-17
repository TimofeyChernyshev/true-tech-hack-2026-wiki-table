import type { JSONContent } from '@tiptap/core'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import type { TableDataResponse, TableField, TableRecord } from '../api/types'

/** Порядок ключей fields по первому появлению при обходе всех записей (полный набор колонок). */
export function unionFieldKeysFromRecords(records: TableRecord[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of records) {
    for (const k of Object.keys(r.fields)) {
      if (seen.has(k)) continue
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

/**
 * Реальный ключ в объекте fields записи (Fusion иногда не совпадает с id/именем из метаданных).
 * Дополнительно: порядок ключей из union записей, если совпадает число колонок с числом полей схемы.
 */
export function resolveRecordFieldKey(
  f: TableField,
  fieldIndex: number,
  fields: TableField[],
  records: TableRecord[],
): string {
  for (const r of records) {
    if (Object.prototype.hasOwnProperty.call(r.fields, f.id)) {
      return f.id
    }
    if (f.name && Object.prototype.hasOwnProperty.call(r.fields, f.name)) {
      return f.name
    }
  }
  const union = unionFieldKeysFromRecords(records)
  if (union.length > 0 && fields.length > 0 && union.length === fields.length) {
    if (union[fieldIndex] !== undefined) {
      return union[fieldIndex]!
    }
  }
  return f.name || f.id
}

/** Значение ячейки: Fusion с fieldKey=name отдаёт ключи по имени колонки, с id — по fid. */
export function recordFieldValue(
  fields: Record<string, unknown>,
  f: TableField,
): unknown {
  if (Object.prototype.hasOwnProperty.call(fields, f.id)) {
    return fields[f.id]
  }
  if (f.name && Object.prototype.hasOwnProperty.call(fields, f.name)) {
    return fields[f.name]
  }
  return undefined
}

/** Колонки: сначала поля из API (порядок представления), затем ключи из записей без описания в fields. */
export function columnsForMwsTable(data: TableDataResponse): TableField[] {
  const fromSpec = [...data.fields]
  const known = new Set<string>()
  for (const f of fromSpec) {
    known.add(f.id)
    if (f.name) known.add(f.name)
  }
  const extra: TableField[] = []
  for (const r of data.records) {
    for (const k of Object.keys(r.fields)) {
      if (known.has(k)) continue
      known.add(k)
      extra.push({ id: k, name: k, type: 'SingleText' })
    }
  }
  return [...fromSpec, ...extra]
}

/** Снимок ответа MWS: при совпадении фоновое обновление не трогает документ и не засоряет undo. */
export function fingerprintMwsTableData(data: TableDataResponse): string {
  const total = data.pagination?.total ?? data.records.length
  const cols = columnsForMwsTable(data)
  const fieldIds = cols.map((f) => `${f.id}\u001f${f.name ?? ''}`).join('\u001e')
  const rows = data.records
    .map((r) => `${r.recordId}\u001f${r.updatedAt ?? ''}\u001f${JSON.stringify(r.fields)}`)
    .join('\u001e')
  return `${total}|${fieldIds}|${rows}`
}

export function formatMwsCellValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(formatMwsCellValue).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.title === 'string' && o.title) return o.title
    if (typeof o.name === 'string' && o.name) return o.name
    if (typeof o.text === 'string') return o.text
    if (o.value != null && (typeof o.value === 'string' || typeof o.value === 'number')) {
      return String(o.value)
    }
    if (Array.isArray(o.members)) return formatMwsCellValue(o.members)
    if (Array.isArray(o.data)) return formatMwsCellValue(o.data)
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export type MwsTableEmbedOptions = {
  /** Space MWS для POST/DELETE полей (атрибут таблицы в документе). */
  mwsSpaceId?: string | null
}

export function tableResponseToTiptapJson(
  data: TableDataResponse,
  mwsDstId: string,
  mwsViewId: string,
  options?: MwsTableEmbedOptions,
): JSONContent {
  const fp = fingerprintMwsTableData(data)
  const fields = columnsForMwsTable(data)
  const recordFieldKeys = fields.map((f, i) =>
    resolveRecordFieldKey(f, i, fields, data.records),
  )
  const space = options?.mwsSpaceId?.trim() || null
  const tableAttrs: Record<string, unknown> = {
    mwsDstId,
    mwsViewId: mwsViewId || null,
    mwsFingerprint: fp,
    mwsRecordFieldKeys: fields.length > 0 ? JSON.stringify(recordFieldKeys) : null,
    mwsColumnFieldIds: fields.length > 0 ? JSON.stringify(fields.map((f) => f.id)) : null,
    mwsSpaceId: space,
  }
  if (fields.length === 0) {
    return {
      type: 'table',
      attrs: tableAttrs,
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    }
  }

  const headerRow: JSONContent = {
    type: 'tableRow',
    content: fields.map(
      (f, i): JSONContent => ({
        type: 'tableHeader',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: f.name || f.id || recordFieldKeys[i] || '',
              },
            ],
          },
        ],
      }),
    ),
  }

  const bodyRows: JSONContent[] = data.records.map((rec) => ({
    type: 'tableRow',
    attrs: { mwsRecordId: rec.recordId },
    content: fields.map((_, i): JSONContent => {
      const key = recordFieldKeys[i]!
      const raw = rec.fields[key]
      const text = formatMwsCellValue(raw)
      return {
        type: 'tableCell',
        content: text
          ? [{ type: 'paragraph', content: [{ type: 'text', text }] }]
          : [{ type: 'paragraph' }],
      }
    }),
  }))

  return {
    type: 'table',
    attrs: tableAttrs,
    content: [headerRow, ...bodyRows],
  }
}

export const MwsTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mwsDstId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mws-dst-id'),
        renderHTML: (attrs) => {
          const id = attrs.mwsDstId as string | null
          return id ? { 'data-mws-dst-id': id } : {}
        },
      },
      mwsViewId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mws-view-id'),
        renderHTML: (attrs) => {
          const id = attrs.mwsViewId as string | null
          return id ? { 'data-mws-view-id': id } : {}
        },
      },
      mwsFingerprint: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mws-fp'),
        renderHTML: (attrs) => {
          const fp = attrs.mwsFingerprint as string | null
          return fp ? { 'data-mws-fp': fp } : {}
        },
      },
      mwsRecordFieldKeys: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mws-record-field-keys'),
        renderHTML: (attrs) => {
          const v = attrs.mwsRecordFieldKeys as string | null
          return v ? { 'data-mws-record-field-keys': v } : {}
        },
      },
      mwsColumnFieldIds: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mws-column-field-ids'),
        renderHTML: (attrs) => {
          const v = attrs.mwsColumnFieldIds as string | null
          return v ? { 'data-mws-column-field-ids': v } : {}
        },
      },
      mwsSpaceId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mws-space-id'),
        renderHTML: (attrs) => {
          const v = attrs.mwsSpaceId as string | null
          return v ? { 'data-mws-space-id': v } : {}
        },
      },
    }
  },
})

/** Строка MWS-таблицы с recordId для обратной синхронизации с Fusion. */
export const MwsTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mwsRecordId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mws-record-id'),
        renderHTML: (attrs) => {
          const id = attrs.mwsRecordId as string | null
          return id ? { 'data-mws-record-id': id } : {}
        },
      },
    }
  },
})
