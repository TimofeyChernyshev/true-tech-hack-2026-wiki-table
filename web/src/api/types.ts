/** Соответствует ответу бэкенда (см. api/back-front.yaml, TableDataResponse) */

export type TableFieldType =
  | 'SingleText'
  | 'Text'
  | 'SingleSelect'
  | 'MultiSelect'
  | 'Number'
  | 'Currency'
  | 'Percent'
  | 'DateTime'
  | 'Attachment'
  | 'Member'
  | 'Checkbox'
  | 'Rating'
  | 'URL'
  | 'Phone'
  | 'Email'

export interface TableField {
  id: string
  name: string
  type: TableFieldType
  description?: string
  property?: Record<string, unknown>
}

export interface TableRecord {
  recordId: string
  fields: Record<string, unknown>
  createdAt?: number
  updatedAt?: number
}

export interface Pagination {
  pageNum: number
  pageSize: number
  total: number
  hasMore: boolean
}

export interface TableDataResponse {
  tableId: string
  tableName?: string
  fields: TableField[]
  records: TableRecord[]
  pagination: Pagination
}

export interface RecordsResponse {
  records: TableRecord[]
}

export interface DeleteRecordsResponse {
  success?: boolean
  message?: string
}

export interface ErrorResponse {
  code: number
  message: string
  details?: string
}

export interface CreateRecordsRequest {
  records: { fields: Record<string, unknown> }[]
}

export interface UpdateRecordsRequest {
  records: { recordId: string; fields: Record<string, unknown> }[]
}

export interface DeleteRecordsRequest {
  recordIds: string[]
}

/** Тело POST /tables/{dstId}/fields */
export interface CreateFieldBody {
  name: string
  type: TableFieldType
  property?: Record<string, unknown>
}

/** Ответ после создания поля */
export interface FieldResponse {
  id: string
  name: string
  type: string
}


/** Тело POST /tables/{dstId}/fields */
export interface CreateFieldBody {
  name: string
  type: TableFieldType
  property?: Record<string, unknown>
}

/** Ответ после создания поля */
export interface FieldResponse {
  id: string
  name: string
  type: string
}

