/**
 * Клиент к сервису MWS GPT (`/api/v1/gpt/…`, см. api/gpt-service.yaml).
 * В dev Vite проксирует на порт GPT; в Docker nginx шлёт на сервис `gpt`.
 */

const GPT_BASE = '/api/v1/gpt'

export type GptMessageRole = 'system' | 'user' | 'assistant'

export type GptMessage = {
  role: GptMessageRole
  content: string
}

export type GptModelInfo = {
  id: string
  name: string
  provider: string
}

export type GptChatRequest = {
  model?: string
  messages: GptMessage[]
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export type GptChatResponse = {
  id?: string
  message: GptMessage
  model?: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

type GptErrorBody = {
  error?: {
    code?: string
    message?: string
    details?: string
  }
}

function parseJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function formatGptError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const e = (body as GptErrorBody).error
    if (e && typeof e.message === 'string' && e.message.length > 0) {
      const d = typeof e.details === 'string' && e.details.length > 0 ? ` (${e.details})` : ''
      return `${e.message}${d}`
    }
  }
  return `Ошибка запроса к AI (${status})`
}

export async function fetchGptModels(): Promise<GptModelInfo[]> {
  const res = await fetch(`${GPT_BASE}/models`, {
    headers: { Accept: 'application/json' },
  })
  const raw = await res.text()
  const body = parseJson(raw)
  if (!res.ok) {
    throw new Error(formatGptError(body, res.status))
  }
  if (!body || typeof body !== 'object') {
    throw new Error('Пустой ответ списка моделей')
  }
  const models = (body as { models?: unknown }).models
  if (!Array.isArray(models)) {
    throw new Error('Некорректный формат списка моделей')
  }
  return models.filter(
    (m): m is GptModelInfo =>
      typeof m === 'object' &&
      m !== null &&
      typeof (m as GptModelInfo).id === 'string' &&
      typeof (m as GptModelInfo).name === 'string',
  )
}

export async function fetchGptChat(req: GptChatRequest): Promise<GptChatResponse> {
  const res = await fetch(`${GPT_BASE}/chat`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })
  const raw = await res.text()
  const body = parseJson(raw)
  if (!res.ok) {
    throw new Error(formatGptError(body, res.status))
  }
  if (!body || typeof body !== 'object') {
    throw new Error('Пустой ответ чата')
  }
  const o = body as Partial<GptChatResponse>
  if (!o.message || typeof o.message.content !== 'string' || typeof o.message.role !== 'string') {
    throw new Error('Некорректный ответ чата')
  }
  return o as GptChatResponse
}
