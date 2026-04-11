/** Соответствует api/back-front.yaml — TableRecordsResponse */
export interface TableRecordsResponse {
  pageNum: number
  pageSize: number
  records: TableRecord[]
}

export interface TableRecord {
  recordId: string
  fields: Record<string, unknown>
  createdAt?: number
  updatedAt?: number
}

export interface ErrorResponse {
  code: number
  message: string
  details?: string
}
