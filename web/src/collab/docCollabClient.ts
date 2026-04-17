import type { Editor, JSONContent } from '@tiptap/core'

import type { DocCollabMessageDocument } from './protocol'

function collabWsUrl(base: string, roomId: string): string {
  const u = base.trim().replace(/\/$/, '')
  const joiner = u.includes('?') ? '&' : '?'
  return `${u}${joiner}room=${encodeURIComponent(roomId)}`
}

function newClientId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `c-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
}

export type DocCollabClientOptions = {
  roomId: string
  editor: Editor
  /** Полный базовый URL WebSocket (например ws://localhost:4010/collab). К room добавится query room= */
  wsBaseUrl: string
  /** Лог подключения / ошибок (по умолчанию console). */
  log?: Pick<Console, 'debug' | 'warn'>
}

/**
 * Клиент совместного редактирования: шлёт полный JSON документа при локальных изменениях,
 * принимает чужие и применяет через setContent(..., false) без лишнего onUpdate.
 */
export class DocCollabClient {
  private readonly roomId: string
  private readonly editor: Editor
  private readonly wsBaseUrl: string
  private readonly log: Pick<Console, 'debug' | 'warn'>
  private readonly clientId = newClientId()

  private ws: WebSocket | null = null
  private localRev = 0
  /** Последний принятый rev по каждому чужому clientId (у разных вкладок свои счётчики). */
  private lastRevByPeer = new Map<string, number>()
  private closedByUser = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: DocCollabClientOptions) {
    this.roomId = opts.roomId
    this.editor = opts.editor
    this.wsBaseUrl = opts.wsBaseUrl
    this.log = opts.log ?? console
  }

  connect(): void {
    this.closedByUser = false
    this.openSocket()
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

  /** Вызывать из onUpdate редактора после локального изменения. */
  notifyLocalChange(doc: JSONContent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.localRev += 1
    const msg: DocCollabMessageDocument = {
      type: 'document',
      room: this.roomId,
      clientId: this.clientId,
      rev: this.localRev,
      doc,
      ts: Date.now(),
    }
    try {
      this.ws.send(JSON.stringify(msg))
    } catch (e) {
      this.log.warn('[collab] send failed', e)
    }
  }

  private openSocket(): void {
    if (this.closedByUser) return
    const url = collabWsUrl(this.wsBaseUrl, this.roomId)
    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch (e) {
      this.log.warn('[collab] WebSocket construct failed', e)
      this.scheduleReconnect()
      return
    }
    this.ws = socket

    socket.addEventListener('open', () => {
      this.log.debug?.('[collab] open', url)
      const initial = this.editor.getJSON()
      this.notifyLocalChange(initial)
    })

    socket.addEventListener('message', (ev) => {
      const raw = typeof ev.data === 'string' ? ev.data : ''
      if (!raw) return
      let msg: DocCollabMessageDocument
      try {
        msg = JSON.parse(raw) as DocCollabMessageDocument
      } catch {
        return
      }
      if (msg.type !== 'document' || msg.room !== this.roomId) return
      if (msg.clientId === this.clientId) return
      if (!msg.doc || typeof msg.doc !== 'object') return

      const prev = this.lastRevByPeer.get(msg.clientId) ?? 0
      if (msg.rev <= prev) return
      this.lastRevByPeer.set(msg.clientId, msg.rev)

      this.editor.commands.setContent(msg.doc, { emitUpdate: false })
    })

    socket.addEventListener('close', () => {
      if (this.ws === socket) this.ws = null
      if (!this.closedByUser) this.scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      /* close последует отдельно */
    })
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, 2500)
  }
}

export function getDocCollabWsBaseUrl(): string {
  const v = import.meta.env.VITE_DOC_COLLAB_WS_URL
  return typeof v === 'string' ? v.trim() : ''
}
