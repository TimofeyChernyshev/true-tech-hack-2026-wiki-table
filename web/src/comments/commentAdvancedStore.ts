import type { AdvancedComment, CommentAccessMode, CommentAuditEvent, ThreadMeta } from './commentAdvancedTypes'
import type { WikiComment } from './types'

const COMMENTS_V1 = (pageKey: string) => `wiki-comments-${pageKey}`
const COMMENTS_V2 = (pageKey: string) => `wiki-comments-v2-${pageKey}`
const THREADS = (pageKey: string) => `wiki-comment-threads-${pageKey}`
const ACCESS = (pageKey: string) => `wiki-comments-access-${pageKey}`
const AUDIT = (pageKey: string) => `wiki-comment-audit-${pageKey}`
const OWNER = (pageKey: string) => `wiki-page-owner-${pageKey}`
const DEVICE = 'wiki-device-author-id'

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE)
    if (!id) {
      id = `u-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
      localStorage.setItem(DEVICE, id)
    }
    return id
  } catch {
    return 'anon'
  }
}

export function getOrCreatePageOwnerId(pageKey: string): string {
  try {
    const k = OWNER(pageKey)
    let id = localStorage.getItem(k)
    if (!id) {
      id = `owner-${crypto.randomUUID?.() ?? `${Date.now()}`}`
      localStorage.setItem(k, id)
    }
    return id
  } catch {
    return 'owner-local'
  }
}

export function loadAccessMode(pageKey: string): CommentAccessMode {
  try {
    const v = localStorage.getItem(ACCESS(pageKey))
    return v === 'creator' ? 'creator' : 'all'
  } catch {
    return 'all'
  }
}

export function saveAccessMode(pageKey: string, mode: CommentAccessMode) {
  try {
    localStorage.setItem(ACCESS(pageKey), mode)
  } catch {
    /* ignore */
  }
}

function migrateV1(pageKey: string): AdvancedComment[] {
  try {
    const raw = localStorage.getItem(COMMENTS_V1(pageKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: AdvancedComment[] = []
    for (const c of parsed) {
      if (!c || typeof c !== 'object') continue
      const w = c as WikiComment
      if (typeof w.id !== 'string' || typeof w.author !== 'string' || typeof w.text !== 'string') continue
      out.push({
        id: w.id,
        threadId: w.id,
        parentId: null,
        author: w.author,
        authorId: getOrCreateDeviceId(),
        text: w.text,
        createdAt: typeof w.createdAt === 'number' ? w.createdAt : Date.now(),
        likes: w.likes ?? 0,
        likedBy: [],
      })
    }
    return out
  } catch {
    return []
  }
}

export function loadCommentsAdvanced(pageKey: string): AdvancedComment[] {
  try {
    const raw = localStorage.getItem(COMMENTS_V2(pageKey))
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const list = parsed.filter(
          (x): x is AdvancedComment =>
            typeof x === 'object' &&
            x !== null &&
            typeof (x as AdvancedComment).id === 'string' &&
            typeof (x as AdvancedComment).threadId === 'string',
        )
        if (list.length > 0) return list
      }
    }
    const migrated = migrateV1(pageKey)
    if (migrated.length) saveCommentsAdvanced(pageKey, migrated)
    return migrated
  } catch {
    return []
  }
}

export function saveCommentsAdvanced(pageKey: string, list: AdvancedComment[]) {
  try {
    localStorage.setItem(COMMENTS_V2(pageKey), JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function loadThreads(pageKey: string): Record<string, ThreadMeta> {
  try {
    const raw = localStorage.getItem(THREADS(pageKey))
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, ThreadMeta>
    return typeof o === 'object' && o !== null ? o : {}
  } catch {
    return {}
  }
}

export function saveThreads(pageKey: string, threads: Record<string, ThreadMeta>) {
  try {
    localStorage.setItem(THREADS(pageKey), JSON.stringify(threads))
  } catch {
    /* ignore */
  }
}

export function loadCommentAudit(pageKey: string): CommentAuditEvent[] {
  try {
    const raw = localStorage.getItem(AUDIT(pageKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is CommentAuditEvent =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as CommentAuditEvent).id === 'string' &&
        typeof (x as CommentAuditEvent).ts === 'number' &&
        typeof (x as CommentAuditEvent).kind === 'string' &&
        typeof (x as CommentAuditEvent).threadId === 'string',
    )
  } catch {
    return []
  }
}

export function saveCommentAudit(pageKey: string, list: CommentAuditEvent[]) {
  try {
    localStorage.setItem(AUDIT(pageKey), JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function appendCommentAudit(pageKey: string, ev: CommentAuditEvent) {
  const cur = loadCommentAudit(pageKey)
  saveCommentAudit(pageKey, [...cur, ev])
}
