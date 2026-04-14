import { readSession } from '../auth/stubAuthStorage'

/** Как на бэкенде wiki_page/domain.RecordUpdate — тело комнаты type=records. */
export type MwsRecordUpdate = {
  recordId: string
  fields: Record<string, unknown>
}

export type MwsRecordsWsHandlers = {
  onOpen?: () => void
  onClose?: () => void
  onError?: (e: Event) => void
  /** Снимок состояния комнаты или broadcast от других клиентов */
  onRecords: (updates: MwsRecordUpdate[]) => void
}

function wikiUser(): { userId: string; userName: string } {
  const s = readSession()
  if (s) {
    return { userId: s.email, userName: s.displayName?.trim() || s.email }
  }
  return { userId: 'anonymous', userName: 'anonymous' }
}

/**
 * Базовый URL WebSocket wiki-page: `/api/v1/ws` (см. wiki_page.HandleWebSocket).
 * Пример: `ws://127.0.0.1:8081/api/v1/ws` или через Vite proxy `ws://localhost:5173/api/v1/ws`.
 */
export function getDefaultMwsRecordsWsBase(): string {
  const v = (import.meta.env.VITE_WIKI_WS_BASE as string | undefined)?.trim()
  if (v) return v.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const { protocol, host } = window.location
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${host}/api/v1/ws`
  }
  return `ws://127.0.0.1:8081/api/v1/ws`
}

function buildWsUrl(
  base: string,
  roomDstId: string,
  viewId: string,
  spaceId: string | null,
): string {
  const normalized = base.startsWith('ws://') || base.startsWith('wss://') ? base : `ws://${base}`
  const u = new URL(normalized)
  const { userId, userName } = wikiUser()
  u.searchParams.set('room', roomDstId)
  u.searchParams.set('type', 'records')
  if (spaceId?.trim()) u.searchParams.set('spaceId', spaceId.trim())
  if (viewId.trim()) u.searchParams.set('viewId', viewId.trim())
  u.searchParams.set('userId', userId)
  u.searchParams.set('userName', userName)
  return u.toString()
}

function decodeWsPayload(data: string | ArrayBuffer): string {
  if (typeof data === 'string') return data
  return new TextDecoder('utf-8').decode(data)
}

/**
 * Один сокет на dstId: отправка JSON-массива RecordUpdate, приём того же формата.
 */
export class MwsRecordsWsClient {
  private ws: WebSocket | null = null
  private readonly handlers: MwsRecordsWsHandlers
  private readonly dstId: string
  private readonly viewId: string
  private readonly spaceId: string | null
  private readonly wsBase: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closedByUser = false

  constructor(
    dstId: string,
    viewId: string,
    spaceId: string | null,
    wsBase: string,
    handlers: MwsRecordsWsHandlers,
  ) {
    this.dstId = dstId
    this.viewId = viewId
    this.spaceId = spaceId
    this.wsBase = wsBase
    this.handlers = handlers
  }

  connect(): void {
    this.closedByUser = false
    this.open()
  }

  disconnect(): void {
    this.closedByUser = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  get isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /** Отправить дельту; сервер рассылает остальным и периодически пишет в MWS Tables. */
  sendUpdates(updates: MwsRecordUpdate[]): void {
    if (!updates.length || !this.isOpen) return
    try {
      this.ws!.send(JSON.stringify(updates))
    } catch {
      /* ignore */
    }
  }

  private open(): void {
    if (this.closedByUser) return
    const url = buildWsUrl(this.wsBase, this.dstId, this.viewId, this.spaceId)
    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch {
      this.scheduleReconnect()
      return
    }
    socket.binaryType = 'arraybuffer'
    this.ws = socket

    socket.onopen = () => {
      this.handlers.onOpen?.()
    }

    socket.onclose = () => {
      this.ws = null
      this.handlers.onClose?.()
      if (!this.closedByUser) this.scheduleReconnect()
    }

    socket.onerror = (e) => {
      this.handlers.onError?.(e)
    }

    socket.onmessage = (ev) => {
      const text = decodeWsPayload(ev.data as string | ArrayBuffer)
      if (!text.trim()) return
      try {
        const parsed = JSON.parse(text) as unknown
        if (!Array.isArray(parsed)) return
        const updates: MwsRecordUpdate[] = []
        for (const row of parsed) {
          if (!row || typeof row !== 'object') continue
          const o = row as { recordId?: unknown; fields?: unknown }
          if (typeof o.recordId !== 'string' || !o.fields || typeof o.fields !== 'object') continue
          updates.push({
            recordId: o.recordId,
            fields: o.fields as Record<string, unknown>,
          })
        }
        if (updates.length) this.handlers.onRecords(updates)
      } catch {
        /* ignore malformed */
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, 2500)
  }
}
