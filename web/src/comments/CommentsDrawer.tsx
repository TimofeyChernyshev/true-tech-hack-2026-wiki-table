import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  appendCommentAudit,
  getOrCreateDeviceId,
  getOrCreatePageOwnerId,
  loadAccessMode,
  loadCommentsAdvanced,
  loadThreads,
  saveCommentsAdvanced,
  saveThreads,
} from './commentAdvancedStore'
import type { AdvancedComment, CommentAccessMode, ThreadMeta } from './commentAdvancedTypes'
import { WIKI_COMMENT_GUTTER_REFRESH, WIKI_PAGE_COMMENT_ANCHOR } from './commentScopeConstants'

export type CommentsScope =
  | { mode: 'page' }
  | { mode: 'block'; anchorKey: string; excerpt: string }

type Props = {
  open: boolean
  onClose: () => void
  pageKey: string
  excerpt?: string
  scope: CommentsScope
  accessRevision?: number
}

function bumpGutter() {
  try {
    window.dispatchEvent(new CustomEvent(WIKI_COMMENT_GUTTER_REFRESH))
  } catch {
    /* ignore */
  }
}

function normalizeThreads(raw: Record<string, ThreadMeta>): Record<string, ThreadMeta> {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k,
      {
        ...v,
        anchorKey: v.anchorKey ?? WIKI_PAGE_COMMENT_ANCHOR,
      },
    ]),
  )
}

function threadAnchor(tm: ThreadMeta | undefined): string | null {
  if (!tm || tm.deleted) return null
  return tm.anchorKey ?? WIKI_PAGE_COMMENT_ANCHOR
}

function initialLetter(name: string): string {
  const t = name.trim()
  return t ? t[0]!.toUpperCase() : '?'
}

function avatarHue(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 13) % 360
  return `hsl(${h} 52% 62%)`
}

/** 27.10.25 в 18:03 */
function formatCommentStamp(ts: number) {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yy} в ${hh}:${mi}`
}

function threadDisplayName(root: AdvancedComment, tm?: ThreadMeta): string {
  if (tm?.contextExcerpt?.trim()) {
    const t = tm.contextExcerpt.trim()
    return t.length > 120 ? `${t.slice(0, 117)}…` : t
  }
  const line = root.text.trim().split(/\r?\n/)[0]?.trim() || 'Обсуждение'
  return line.length > 100 ? `${line.slice(0, 100)}…` : line
}

function renderBody(text: string) {
  const parts = text.split(/(@[\wа-яА-ЯёЁ.-]+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="wiki-mention">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function newAuditId() {
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type RowProps = {
  c: AdvancedComment
  deviceId: string
  locked: boolean
  canPostGlobally: boolean
  menuFor: string | null
  setMenuFor: (id: string | null) => void
  likeToggle: (id: string) => void
  editComment: (id: string) => void
  softDeleteComment: (id: string) => void
  onReply: () => void
}

function FigmaCommentRow({
  c,
  deviceId,
  locked,
  canPostGlobally,
  menuFor,
  setMenuFor,
  likeToggle,
  editComment,
  softDeleteComment,
  onReply,
}: RowProps) {
  return (
    <li className="wiki-comments-figma-item">
      <div className="wiki-comments-figma-item-top">
        <div className="wiki-comments-figma-user">
          <div className="wiki-comments-figma-avatar" style={{ background: avatarHue(c.author) }} aria-hidden>
            {initialLetter(c.author)}
          </div>
          <div className="wiki-comments-figma-user-meta">
            <span className="wiki-comments-figma-name">{c.author}</span>
            <time dateTime={new Date(c.createdAt).toISOString()}>
              {formatCommentStamp(c.createdAt)}
              {c.editedAt ? ' · изм.' : ''}
            </time>
          </div>
        </div>
        <div className="wiki-comments-figma-actions">
          <button
            type="button"
            className="wiki-comments-figma-like"
            title="Нравится"
            onClick={() => likeToggle(c.id)}
          >
            <span className="wiki-comments-figma-like-n">{c.likes}</span>
            <span aria-hidden>👍</span>
          </button>
          <div className="wiki-comments-figma-more-wrap">
            <button
              type="button"
              className="wiki-comments-figma-more"
              aria-expanded={menuFor === c.id}
              onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
            >
              ···
            </button>
            {menuFor === c.id ? (
              <div className="wiki-comments-figma-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                {c.authorId === deviceId ? (
                  <button type="button" role="menuitem" onClick={() => editComment(c.id)}>
                    Изменить
                  </button>
                ) : null}
                {c.authorId === deviceId ? (
                  <button type="button" role="menuitem" onClick={() => softDeleteComment(c.id)}>
                    Удалить
                  </button>
                ) : null}
                {canPostGlobally && !locked ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onReply()
                      setMenuFor(null)
                    }}
                  >
                    Ответить
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="wiki-comments-figma-body">{renderBody(c.text)}</div>
    </li>
  )
}

const AUTHOR_KEY = 'wiki-comment-author'

export function CommentsDrawer({
  open,
  onClose,
  pageKey,
  excerpt = '',
  scope,
  accessRevision = 0,
}: Props) {
  const deviceId = useMemo(() => getOrCreateDeviceId(), [])
  const ownerId = useMemo(() => getOrCreatePageOwnerId(pageKey), [pageKey])
  const [access, setAccess] = useState<CommentAccessMode>(() => loadAccessMode(pageKey))
  const [comments, setComments] = useState<AdvancedComment[]>([])
  const [threads, setThreads] = useState<Record<string, ThreadMeta>>({})
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ threadId: string; parentId: string; label: string } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [viewThreadId, setViewThreadId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const reload = useCallback(() => {
    try {
      setComments(loadCommentsAdvanced(pageKey))
      setThreads(normalizeThreads(loadThreads(pageKey)))
      setAccess(loadAccessMode(pageKey))
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [pageKey])

  useEffect(() => {
    if (open) reload()
  }, [open, reload, accessRevision])

  useEffect(() => {
    if (!open) {
      setViewThreadId(null)
      setReplyTo(null)
    }
  }, [open])

  useEffect(() => {
    setViewThreadId(null)
    setReplyTo(null)
  }, [pageKey])

  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    const t = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', close)
    }
  }, [menuFor])

  const canPostGlobally = access === 'all' || deviceId === ownerId

  const persist = useCallback(
    (nextC: AdvancedComment[], nextT: Record<string, ThreadMeta>) => {
      setComments(nextC)
      setThreads(normalizeThreads(nextT))
      saveCommentsAdvanced(pageKey, nextC)
      saveThreads(pageKey, nextT)
      bumpGutter()
    },
    [pageKey],
  )

  const ensureThreadWithMeta = useCallback(
    (tid: string, cur: Record<string, ThreadMeta>, patch: Partial<ThreadMeta>) => {
      if (cur[tid]) return cur
      return {
        ...cur,
        [tid]: {
          id: tid,
          resolved: false,
          anchorKey: patch.anchorKey ?? WIKI_PAGE_COMMENT_ANCHOR,
          contextExcerpt: patch.contextExcerpt ?? null,
          ...patch,
        },
      }
    },
    [],
  )

  const likeToggle = useCallback(
    (id: string) => {
      const next = comments.map((c) => {
        if (c.id !== id) return c
        const has = c.likedBy.includes(deviceId)
        const likedBy = has ? c.likedBy.filter((x) => x !== deviceId) : [...c.likedBy, deviceId]
        const likes = has ? Math.max(0, c.likes - 1) : c.likes + 1
        return { ...c, likedBy, likes }
      })
      persist(next, threads)
    },
    [comments, threads, deviceId, persist],
  )

  const openEdit = useCallback((id: string) => {
    const c = comments.find((x) => x.id === id)
    if (!c) return
    setEditId(id)
    setEditText(c.text)
    setEditOpen(true)
    setMenuFor(null)
  }, [comments])

  const saveEdit = useCallback(() => {
    if (!editId) return
    const c = comments.find((x) => x.id === editId)
    if (!c) return
    const n = editText
    appendCommentAudit(pageKey, {
      id: newAuditId(),
      ts: Date.now(),
      kind: 'comment_edit',
      threadId: c.threadId,
      commentId: editId,
      author: c.author,
      textBefore: c.text,
      textAfter: n,
    })
    persist(
      comments.map((x) => (x.id === editId ? { ...x, text: n, editedAt: Date.now() } : x)),
      threads,
    )
    setEditOpen(false)
    setEditId(null)
  }, [editId, editText, pageKey, comments, threads, persist])

  const softDeleteComment = useCallback(
    (id: string) => {
      const c = comments.find((x) => x.id === id)
      if (!c) return
      appendCommentAudit(pageKey, {
        id: newAuditId(),
        ts: Date.now(),
        kind: 'comment_delete',
        threadId: c.threadId,
        commentId: id,
        author: c.author,
        textBefore: c.text,
      })
      persist(
        comments.map((x) => (x.id === id ? { ...x, deleted: true, text: '' } : x)),
        threads,
      )
      setMenuFor(null)
    },
    [pageKey, comments, threads, persist],
  )

  const resolveThread = useCallback(
    (tid: string) => {
      appendCommentAudit(pageKey, {
        id: newAuditId(),
        ts: Date.now(),
        kind: 'thread_resolve',
        threadId: tid,
      })
      persist(comments, {
        ...threads,
        [tid]: { ...threads[tid], id: tid, resolved: true, resolvedAt: Date.now() },
      })
    },
    [pageKey, comments, threads, persist],
  )

  const deleteThread = useCallback(
    (tid: string) => {
      appendCommentAudit(pageKey, {
        id: newAuditId(),
        ts: Date.now(),
        kind: 'thread_delete',
        threadId: tid,
      })
      persist(comments, {
        ...threads,
        [tid]: {
          ...threads[tid],
          id: tid,
          deleted: true,
          deletedAt: Date.now(),
        },
      })
      setViewThreadId((v) => (v === tid ? null : v))
      setReplyTo((r) => (r?.threadId === tid ? null : r))
    },
    [pageKey, comments, threads, persist],
  )

  const roots = useMemo(() => {
    const list = comments.filter((c) => {
      if (c.parentId !== null) return false
      if (c.deleted) return false
      const tm = threads[c.threadId]
      if (tm?.deleted) return false
      return true
    })
    list.sort((a, b) => b.createdAt - a.createdAt)
    return list
  }, [comments, threads])

  const scopedRoots = useMemo(() => {
    return roots.filter((r) => {
      const tm = threads[r.threadId]
      const a = threadAnchor(tm)
      if (!a) return false
      if (scope.mode === 'page') return a === WIKI_PAGE_COMMENT_ANCHOR
      return a === scope.anchorKey
    })
  }, [roots, threads, scope])

  useEffect(() => {
    if (!open || scope.mode !== 'block') return
    if (scopedRoots.length === 0) {
      setViewThreadId(null)
      return
    }
    setViewThreadId((cur) => {
      if (cur && scopedRoots.some((r) => r.threadId === cur)) return cur
      return scopedRoots[0].threadId
    })
  }, [open, scope.mode, scopedRoots])

  useEffect(() => {
    if (!open || scope.mode !== 'page') return
    if (viewThreadId && !scopedRoots.some((r) => r.threadId === viewThreadId)) {
      setViewThreadId(null)
    }
  }, [open, scope.mode, scopedRoots, viewThreadId])

  const send = useCallback(() => {
    const a = author.trim()
    const t = text.trim()
    if (!t || !canPostGlobally) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    let threadId: string
    let parentId: string | null
    let openNewThread = false
    let tmap = threads

    if (replyTo) {
      const tm = threads[replyTo.threadId]
      if (tm?.resolved || tm?.deleted) return
      threadId = replyTo.threadId
      parentId = replyTo.parentId
    } else if (viewThreadId && scopedRoots.some((r) => r.threadId === viewThreadId)) {
      const root = scopedRoots.find((r) => r.threadId === viewThreadId)!
      const tm = threads[viewThreadId]
      if (tm?.resolved || tm?.deleted) return
      threadId = viewThreadId
      parentId = root.id
    } else {
      threadId = id
      parentId = null
      openNewThread = true
    }

    if (openNewThread) {
      const anchorKey = scope.mode === 'block' ? scope.anchorKey : WIKI_PAGE_COMMENT_ANCHOR
      const contextExcerpt =
        scope.mode === 'block' ? scope.excerpt : excerpt.trim() || null
      tmap = ensureThreadWithMeta(threadId, threads, {
        anchorKey,
        contextExcerpt,
      })
    } else {
      tmap = ensureThreadWithMeta(threadId, threads, {})
    }

    const row: AdvancedComment = {
      id,
      threadId,
      parentId,
      author: a || 'Аноним',
      authorId: deviceId,
      text: t,
      createdAt: Date.now(),
      likes: 0,
      likedBy: [],
    }

    persist([...comments, row], tmap)
    try {
      localStorage.setItem(AUTHOR_KEY, a)
    } catch {
      /* ignore */
    }
    setText('')
    setReplyTo(null)
    if (openNewThread) setViewThreadId(threadId)
  }, [
    author,
    text,
    canPostGlobally,
    replyTo,
    viewThreadId,
    scopedRoots,
    comments,
    threads,
    deviceId,
    persist,
    ensureThreadWithMeta,
    scope,
    excerpt,
  ])

  const repliesOf = useCallback(
    (tid: string) =>
      comments
        .filter((c) => c.threadId === tid && c.parentId !== null && !c.deleted)
        .sort((a, b) => a.createdAt - b.createdAt),
    [comments],
  )

  const activeThreadId =
    viewThreadId && scopedRoots.some((r) => r.threadId === viewThreadId) ? viewThreadId : null

  const activeRoot = useMemo(
    () => (activeThreadId ? scopedRoots.find((r) => r.threadId === activeThreadId) : undefined),
    [scopedRoots, activeThreadId],
  )

  const msgsEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || !activeThreadId) return
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [open, activeThreadId, comments])

  const currentThreadLocked =
    (!!replyTo && !!(threads[replyTo.threadId]?.resolved || threads[replyTo.threadId]?.deleted)) ||
    (!!viewThreadId && !!(threads[viewThreadId]?.resolved || threads[viewThreadId]?.deleted))

  const headerExcerpt = useMemo(() => {
    if (scope.mode === 'block') return scope.excerpt
    if (activeThreadId && activeRoot) {
      const tm = threads[activeThreadId]
      return threadDisplayName(activeRoot, tm)
    }
    return excerpt
  }, [scope, excerpt, activeThreadId, activeRoot, threads])

  if (!open) return null

  const inThreadView = scope.mode === 'page' ? !!activeThreadId : scopedRoots.length > 0

  return (
    <>
      <button type="button" className="wiki-drawer-backdrop" aria-label="Закрыть панель" onClick={onClose} />
      <aside className="wiki-comments-drawer wiki-comments-drawer--figma" aria-label="Комментарии">
        {editOpen ? (
          <div className="wiki-modal-root wiki-comment-edit-overlay" role="dialog" aria-modal="true">
            <button type="button" className="wiki-modal-backdrop" aria-label="Закрыть" onClick={() => setEditOpen(false)} />
            <div className="wiki-modal-card">
              <h2 className="wiki-modal-title">Изменить комментарий</h2>
              <textarea
                className="wiki-comments-drawer-ta"
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="wiki-modal-actions">
                <button type="button" className="secondary" onClick={() => setEditOpen(false)}>
                  Отмена
                </button>
                <button type="button" className="primary" onClick={saveEdit}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="wiki-comments-figma wiki-comments-figma--float wiki-comments-figma--drawer">
          <div className="wiki-comments-figma-head">
            <div className="wiki-comments-drawer-head-row">
              <h2 className="wiki-comments-figma-title">Комментарии</h2>
              <button type="button" className="wiki-drawer-close" onClick={onClose} aria-label="Закрыть">
                ×
              </button>
            </div>
            {headerExcerpt ? <p className="wiki-comments-figma-excerpt">{headerExcerpt}</p> : null}
          </div>

          {loadError ? (
            <div className="wiki-comments-drawer-error">
              <p>Не удалось загрузить комментарии</p>
              <button type="button" className="primary" onClick={reload}>
                Загрузить повторно
              </button>
            </div>
          ) : null}

          {!loadError && !canPostGlobally ? (
            <p className="wiki-comments-drawer-note">Комментирование только у создателя страницы.</p>
          ) : null}

          <div className="wiki-comments-figma-list">
            {scope.mode === 'page' && !activeThreadId ? (
              scopedRoots.length === 0 ? (
                <p className="wiki-comments-figma-empty">Нет комментариев</p>
              ) : (
                <ul className="wiki-thread-page-cards">
                  {scopedRoots.map((root) => {
                    const tm = threads[root.threadId]
                    const n = comments.filter((c) => c.threadId === root.threadId && !c.deleted).length
                    return (
                      <li key={root.threadId}>
                        <button
                          type="button"
                          className="wiki-thread-page-card"
                          onClick={() => {
                            setViewThreadId(root.threadId)
                            setReplyTo(null)
                          }}
                        >
                          <span className="wiki-thread-page-card-title">{threadDisplayName(root, tm)}</span>
                          <span className="wiki-thread-page-card-meta">
                            {n} {n === 1 ? 'сообщение' : n < 5 ? 'сообщения' : 'сообщений'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            ) : null}

            {inThreadView && activeThreadId && activeRoot ? (
              <>
                {scope.mode === 'page' ? (
                  <button
                    type="button"
                    className="wiki-thread-back wiki-thread-back--figma"
                    onClick={() => {
                      setViewThreadId(null)
                      setReplyTo(null)
                    }}
                  >
                    ← Ко всем обсуждениям
                  </button>
                ) : scopedRoots.length > 1 ? (
                  <button
                    type="button"
                    className="wiki-thread-back wiki-thread-back--figma"
                    onClick={() => setViewThreadId(scopedRoots[0]?.threadId ?? null)}
                  >
                    К первой ветке
                  </button>
                ) : null}
                {(() => {
                  const root = activeRoot
                  const tm = threads[root.threadId] ?? { id: root.threadId, resolved: false }
                  const locked = tm.resolved || !!tm.deleted
                  const reps = repliesOf(root.threadId)
                  const msgs = [root, ...reps].filter((x) => !x.deleted)
                  return (
                    <section className="wiki-thread-figma-thread" aria-label={threadDisplayName(root, tm)}>
                      <div className="wiki-thread-toolbar wiki-thread-toolbar--figma">
                        {tm.resolved ? <span className="wiki-badge wiki-badge--ok">Решено</span> : null}
                        {!tm.resolved && !tm.deleted ? (
                          <>
                            <button type="button" className="wiki-thread-action" onClick={() => resolveThread(root.threadId)}>
                              Пометить решённой
                            </button>
                            <button type="button" className="wiki-thread-action" onClick={() => deleteThread(root.threadId)}>
                              Удалить ветку
                            </button>
                          </>
                        ) : null}
                      </div>
                      <ul className="wiki-comments-figma-items">
                        {msgs.map((c) => (
                          <FigmaCommentRow
                            key={c.id}
                            c={c}
                            deviceId={deviceId}
                            locked={locked}
                            canPostGlobally={canPostGlobally}
                            menuFor={menuFor}
                            setMenuFor={setMenuFor}
                            likeToggle={likeToggle}
                            editComment={openEdit}
                            softDeleteComment={softDeleteComment}
                            onReply={() => {
                              setReplyTo({
                                threadId: c.threadId,
                                parentId: c.id,
                                label: c.author,
                              })
                              setMenuFor(null)
                            }}
                          />
                        ))}
                      </ul>
                      <div ref={msgsEndRef} className="wiki-thread-msgs-end" aria-hidden />
                    </section>
                  )
                })()}
              </>
            ) : null}

            {scope.mode === 'block' && scopedRoots.length === 0 ? (
              <p className="wiki-comments-figma-empty">Нет комментариев</p>
            ) : null}
          </div>

          {canPostGlobally ? (
            <>
              <p className="wiki-comments-figma-author-hint">
                Как{' '}
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="имя"
                  className="wiki-comments-figma-author-input"
                />
              </p>
              {replyTo ? (
                <p className="wiki-comments-drawer-reply-hint">
                  Ответ для <strong>@{replyTo.label}</strong>{' '}
                  <button type="button" className="wiki-linkish" onClick={() => setReplyTo(null)}>
                    отмена
                  </button>
                </p>
              ) : null}
              <div className="wiki-comments-figma-input-bar">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Новый комментарий"
                  className="wiki-comments-figma-field"
                  disabled={currentThreadLocked}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                />
                <button
                  type="button"
                  className="wiki-comments-figma-send"
                  title="Отправить"
                  aria-label="Отправить"
                  onClick={send}
                  disabled={currentThreadLocked || !text.trim()}
                >
                  ➤
                </button>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </>
  )
}
