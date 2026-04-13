import type { JSONContent } from '@tiptap/core'

/**
 * Контракт обмена с микросервисом коллаборации (WebSocket).
 * Бэкенд может расширять поля; фронт шлёт и принимает минимум ниже.
 */
export type DocCollabMessageDocument = {
  type: 'document'
  /** Идентификатор комнаты = тот же ключ, что и документ wiki (pageKey). */
  room: string
  /** Уникальный id клиента (вкладка). */
  clientId: string
  /** Логические часы отправителя (монотонно растут у отправителя). */
  rev: number
  /** Полное тело документа TipTap (JSON). */
  doc: JSONContent
  /** Опционально: время на клиенте для отладки / будущего LWW на сервере. */
  ts?: number
}

export type DocCollabMessage = DocCollabMessageDocument
