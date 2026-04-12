import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

type Props = {
  open: boolean
  onClose: () => void
  pageKey: string
  excerpt?: string
  /** Увеличить после смены «доступа», чтобы перечитать настройки */
  accessRevision?: number
}

function initialLetter(name: string): string {
  const t = name.trim()
  return t ? t[0]!.toUpperCase() : '?'
}

function avatarHue(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 13) % 360
  return `hsl(${h} 45% 72%)`
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Сегодня — только время; вчера — «Вчера, время»; старше — дата + время */
function formatMessageTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const t0 = startOfLocalDay(now)
  const tMsg = startOfLocalDay(d)
  const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (tMsg === t0) return timeStr
  const diffDays = Math.round((t0 - tMsg) / 86400000)
  if (diffDays === 1) return `Вчера, ${timeStr}`
  const dateOpts: Intl.DateTimeFormatOptions =
    d.getFullYear() !== now.getFullYear()
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' }
  return `${d.toLocaleDateString('ru-RU', dateOpts)}, ${timeStr}`
}

/** Название ветки — первая строка корневого сообщения */
function threadDisplayName(root: AdvancedComment): string {
  const line = root.text.trim().split(/\r?\n/)[0]?.trim() || 'Ветка без текста'
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

type MsgRowProps = {
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

function CommentMessengerRow({
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
}: MsgRowProps) {
  const mine = c.authorId === deviceId
  const [dragX, setDragX] = useState(0)
  const drag = useRef({ on: false, x0: 0, y0: 0, replied: false })

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || locked || !canPostGlobally) return
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { on: true, x0: e.clientX, y0: e.clientY, replied: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragX(0)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.x0
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    drag.current.on = false
    if (!drag.current.replied && dx >= 44) {
      drag.current.replied = true
      onReply()
    }
    setDragX(0)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return
    const dy = Math.abs(e.clientY - drag.current.y0)
    const dx = e.clientX - drag.current.x0
    if (dy > 22) {
      drag.current.on = false
      setDragX(0)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      return
    }
    if (dx > 0) setDragX(Math.min(dx, 64))
    else setDragX(0)
  }

  return (
    <div className={`wiki-msg-row${mine ? ' wiki-msg-row--mine' : ''}`}>
      <div
        className="wiki-msg-swipe"
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {dragX > 8 ? (
          <span className="wiki-msg-swipe-hint" aria-hidden>
            Ответить
          </span>
        ) : null}
        <article className={`wiki-msg-bubble${mine ? ' wiki-msg-bubble--mine' : ''}`}>
          <div className="wiki-msg-bubble-top">
            <div className="wiki-msg-bubble-user">
              {!mine ? (
                <div
                  className="wiki-msg-bubble-avatar"
                  style={{ background: avatarHue(c.author) }}
                  aria-hidden
                >
                  {initialLetter(c.author)}
                </div>
              ) : null}
              <div className="wiki-msg-bubble-meta">
                <span className="wiki-msg-bubble-name">{c.author}</span>
                <time dateTime={new Date(c.createdAt).toISOString()}>
                  {formatMessageTime(c.createdAt)}
                  {c.editedAt ? ' · изм.' : ''}
                </time>
              </div>
            </div>
            <div className="wiki-msg-bubble-actions">
              <button
                type="button"
                className={`wiki-msg-like${c.likedBy.includes(deviceId) ? ' is-on' : ''}`}
                title="Лайк"
                onClick={(e) => {
                  e.stopPropagation()
                  likeToggle(c.id)
                }}
              >
                {c.likes} ♥
              </button>
              <div className="wiki-msg-more-wrap">
                <button
                  type="button"
                  className="wiki-msg-more"
                  aria-expanded={menuFor === c.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuFor(menuFor === c.id ? null : c.id)
                  }}
                >
                  ···
                </button>
                {menuFor === c.id ? (
                  <div className="wiki-msg-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                    <button type="button" role="menuitem" onClick={() => editComment(c.id)}>
                      Изменить
                    </button>
                    <button type="button" role="menuitem" onClick={() => softDeleteComment(c.id)}>
                      Удалить
                    </button>
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
          <div className="wiki-msg-bubble-body">{renderBody(c.text)}</div>
        </article>
      </div>
    </div>
  )
}

const AUTHOR_KEY = 'wiki-comment-author'

export function CommentsDrawer({
  open,
  onClose,
  pageKey,
  excerpt = '',
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
  const [replyTo, setReplyTo] = useState<{ threadId: string; parentId: string; label: string } | null>(
    null,
  )
  const [loadError, setLoadError] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  /** null — список веток; иначе открыта одна ветка для обсуждения */
  const [viewThreadId, setViewThreadId] = useState<string | null>(null)

  const reload = useCallback(() => {
    try {
      setComments(loadCommentsAdvanced(pageKey))
      setThreads(loadThreads(pageKey))
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
    if (!open) setViewThreadId(null)
  }, [open])

  useEffect(() => {
    setViewThreadId(null)
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
      setThreads(nextT)
      saveCommentsAdvanced(pageKey, nextC)
      saveThreads(pageKey, nextT)
    },
    [pageKey],
  )

  const ensureThread = useCallback(
    (tid: string, cur: Record<string, ThreadMeta>) => {
      if (cur[tid]) return cur
      return {
        ...cur,
        [tid]: { id: tid, resolved: false },
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

  const editComment = useCallback(
    (id: string) => {
      const c = comments.find((x) => x.id === id)
      if (!c) return
      const n = window.prompt('Текст', c.text)
      if (n === null) return
      appendCommentAudit(pageKey, {
        id: newAuditId(),
        ts: Date.now(),
        kind: 'comment_edit',
        threadId: c.threadId,
        commentId: id,
        author: c.author,
        textBefore: c.text,
        textAfter: n,
      })
      persist(
        comments.map((x) =>
          x.id === id ? { ...x, text: n, editedAt: Date.now() } : x,
        ),
        threads,
      )
      setMenuFor(null)
    },
    [pageKey, comments, threads, persist],
  )

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

  const send = useCallback(() => {
    const a = author.trim()
    const t = text.trim()
    if (!t || !canPostGlobally) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    let threadId: string
    let parentId: string | null
    let openNewThread = false

    if (replyTo) {
      const tm = threads[replyTo.threadId]
      if (tm?.resolved || tm?.deleted) return
      threadId = replyTo.threadId
      parentId = replyTo.parentId
    } else if (viewThreadId && roots.some((r) => r.threadId === viewThreadId)) {
      const root = roots.find((r) => r.threadId === viewThreadId)!
      const tm = threads[viewThreadId]
      if (tm?.resolved || tm?.deleted) return
      threadId = viewThreadId
      parentId = root.id
    } else {
      threadId = id
      parentId = null
      openNewThread = true
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
    let tmap = ensureThread(threadId, threads)
    if (!tmap[threadId]) tmap = ensureThread(threadId, tmap)
    persist([...comments, row], tmap)
    try {
      localStorage.setItem(AUTHOR_KEY, a)
    } catch {
      /* ignore */
    }
    setText('')
    setReplyTo(null)
    if (openNewThread) setViewThreadId(id)
  }, [
    author,
    text,
    canPostGlobally,
    replyTo,
    viewThreadId,
    roots,
    comments,
    threads,
    deviceId,
    persist,
    ensureThread,
  ])

  const repliesOf = useCallback(
    (tid: string) =>
      comments
        .filter((c) => c.threadId === tid && c.parentId !== null && !c.deleted)
        .sort((a, b) => a.createdAt - b.createdAt),
    [comments],
  )

  const activeThreadId =
    viewThreadId && roots.some((r) => r.threadId === viewThreadId) ? viewThreadId : null

  const activeRoot = useMemo(
    () => (activeThreadId ? roots.find((r) => r.threadId === activeThreadId) : undefined),
    [roots, activeThreadId],
  )

  useEffect(() => {
    if (viewThreadId && !roots.some((r) => r.threadId === viewThreadId)) {
      setViewThreadId(null)
      setReplyTo(null)
    }
  }, [viewThreadId, roots])

  const msgsEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || !activeThreadId) return
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [open, activeThreadId, comments])

  const currentThreadLocked =
    (!!replyTo && !!(threads[replyTo.threadId]?.resolved || threads[replyTo.threadId]?.deleted)) ||
    (!!viewThreadId && !!(threads[viewThreadId]?.resolved || threads[viewThreadId]?.deleted))

  if (!open) return null

  return (
    <>
      <button type="button" className="wiki-drawer-backdrop" aria-label="Закрыть панель" onClick={onClose} />
      <aside
        className={`wiki-comments-drawer${activeThreadId ? ' wiki-comments-drawer--thread' : ''}`}
        aria-label="Комментарии"
      >
        <div className="wiki-comments-drawer-head">
          <h2 className="wiki-comments-drawer-title">Комментарии</h2>
          <button type="button" className="wiki-drawer-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {excerpt && !activeThreadId ? <p className="wiki-comments-drawer-excerpt">{excerpt}</p> : null}

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

        <div
          className={`wiki-comments-drawer-list${activeThreadId ? ' wiki-comments-drawer-list--thread' : ''}`}
        >
          {activeThreadId && activeRoot ? (
            <div className="wiki-comments-messenger-wrap">
              <button
                type="button"
                className="wiki-thread-back"
                onClick={() => {
                  setViewThreadId(null)
                  setReplyTo(null)
                }}
              >
                ← К списку веток
              </button>
              {(() => {
                const root = activeRoot
                const tm = threads[root.threadId] ?? { id: root.threadId, resolved: false }
                const locked = tm.resolved || !!tm.deleted
                const reps = repliesOf(root.threadId)
                const msgs = [root, ...reps].filter((x) => !x.deleted)
                return (
                  <section
                    key={root.threadId}
                    className={`wiki-thread wiki-thread--messenger${locked ? ' wiki-thread--locked' : ''}${tm.resolved ? ' wiki-thread--resolved' : ''}`}
                    aria-label={threadDisplayName(root)}
                  >
                    <h3 className="wiki-thread-messenger-title">{threadDisplayName(root)}</h3>
                    <div className="wiki-thread-toolbar">
                      {tm.resolved ? <span className="wiki-badge wiki-badge--ok">Решено</span> : null}
                      {!tm.resolved && !tm.deleted ? (
                        <>
                          <button
                            type="button"
                            className="wiki-thread-action"
                            onClick={() => resolveThread(root.threadId)}
                          >
                            Пометить решённой
                          </button>
                          <button
                            type="button"
                            className="wiki-thread-action"
                            onClick={() => deleteThread(root.threadId)}
                          >
                            Удалить ветку
                          </button>
                        </>
                      ) : null}
                    </div>
                    <div className="wiki-thread-msgs">
                      {msgs.map((c) => (
                        <CommentMessengerRow
                          key={c.id}
                          c={c}
                          deviceId={deviceId}
                          locked={locked}
                          canPostGlobally={canPostGlobally}
                          menuFor={menuFor}
                          setMenuFor={setMenuFor}
                          likeToggle={likeToggle}
                          editComment={editComment}
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
                      <div ref={msgsEndRef} className="wiki-thread-msgs-end" aria-hidden />
                    </div>
                  </section>
                )
              })()}
            </div>
          ) : roots.length === 0 ? (
            <p className="wiki-comments-drawer-empty">Пока нет веток</p>
          ) : (
            <ul className="wiki-thread-name-list">
              {roots.map((root) => (
                <li key={root.threadId}>
                  <button
                    type="button"
                    className="wiki-thread-name-btn"
                    onClick={() => {
                      setViewThreadId(root.threadId)
                      setReplyTo(null)
                    }}
                  >
                    {threadDisplayName(root)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canPostGlobally ? (
          <>
            <p className="wiki-comments-drawer-author">
              Как{' '}
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="имя"
                className="wiki-comments-drawer-author-inp"
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
            <div className="wiki-comments-drawer-inputrow">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Сообщение… Упоминания: @имя"
                rows={2}
                className="wiki-comments-drawer-ta"
                disabled={currentThreadLocked}
              />
              <button
                type="button"
                className="primary wiki-comments-drawer-send"
                onClick={send}
                disabled={currentThreadLocked}
              >
                Отправить
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}
