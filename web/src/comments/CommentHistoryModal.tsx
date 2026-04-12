import { useMemo } from 'react'
import { loadCommentAudit, loadCommentsAdvanced, loadThreads } from './commentAdvancedStore'
import type { AdvancedComment, CommentAuditEvent } from './commentAdvancedTypes'

type Props = {
  open: boolean
  onClose: () => void
  pageKey: string
}

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function byThread(comments: AdvancedComment[]) {
  const m = new Map<string, AdvancedComment[]>()
  for (const c of comments) {
    const arr = m.get(c.threadId) ?? []
    arr.push(c)
    m.set(c.threadId, arr)
  }
  return m
}

function auditLabel(ev: CommentAuditEvent): string {
  switch (ev.kind) {
    case 'comment_edit':
      return 'Редактирование сообщения'
    case 'comment_delete':
      return 'Удаление сообщения'
    case 'thread_delete':
      return 'Удаление ветки'
    case 'thread_resolve':
      return 'Ветка помечена решённой'
  }
}

function clip(s: string, n: number) {
  const t = s.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

export function CommentHistoryModal({ open, onClose, pageKey }: Props) {
  const auditLog = useMemo(() => {
    if (!open) return []
    return loadCommentAudit(pageKey).sort((a, b) => b.ts - a.ts)
  }, [open, pageKey])

  const rows = useMemo(() => {
    if (!open) return []
    const threads = loadThreads(pageKey)
    const comments = loadCommentsAdvanced(pageKey)
    const map = byThread(comments)
    const out: { tid: string; meta: (typeof threads)[string]; list: AdvancedComment[] }[] = []
    for (const [tid, meta] of Object.entries(threads)) {
      if (!meta.resolved && !meta.deleted) continue
      out.push({ tid, meta, list: (map.get(tid) ?? []).sort((a, b) => a.createdAt - b.createdAt) })
    }
    out.sort((a, b) => (b.meta.resolvedAt ?? b.meta.deletedAt ?? 0) - (a.meta.resolvedAt ?? a.meta.deletedAt ?? 0))
    return out
  }, [open, pageKey])

  const deletedOnly = useMemo(() => {
    if (!open) return []
    return loadCommentsAdvanced(pageKey)
      .filter((c) => c.deleted)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [open, pageKey])

  if (!open) return null

  return (
    <div className="wiki-modal-root" role="dialog" aria-modal="true" aria-labelledby="wiki-ch-title">
      <button type="button" className="wiki-modal-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="wiki-modal-card wiki-modal-card--wide">
        <h2 id="wiki-ch-title" className="wiki-modal-title">
          История комментариев
        </h2>
        <p className="wiki-modal-hint">
          Журнал действий: правки, удаления, решённые и удалённые ветки. В основной панели удалённое не показывается.
        </p>

        <h3 className="wiki-modal-subtitle">Журнал</h3>
        {auditLog.length === 0 ? (
          <p className="wiki-modal-hint">Пока нет записей в журнале</p>
        ) : (
          <ul className="wiki-ch-audit">
            {auditLog.map((ev) => (
              <li key={ev.id} className="wiki-ch-audit-item">
                <div className="wiki-ch-audit-top">
                  <span className="wiki-ch-audit-kind">{auditLabel(ev)}</span>
                  <time className="wiki-ch-time">{formatWhen(ev.ts)}</time>
                </div>
                <div className="wiki-ch-audit-meta">
                  Ветка <code className="wiki-ch-code">{ev.threadId.slice(0, 14)}</code>
                  {ev.author ? (
                    <>
                      {' '}
                      · {ev.author}
                    </>
                  ) : null}
                </div>
                {ev.kind === 'comment_edit' && (ev.textBefore != null || ev.textAfter != null) ? (
                  <div className="wiki-ch-audit-diff">
                    <span className="wiki-ch-audit-was">Было: {clip(ev.textBefore ?? '', 180)}</span>
                    <span className="wiki-ch-audit-now">Стало: {clip(ev.textAfter ?? '', 180)}</span>
                  </div>
                ) : null}
                {ev.kind === 'comment_delete' && ev.textBefore ? (
                  <div className="wiki-ch-audit-snippet">Текст: {clip(ev.textBefore, 220)}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <h3 className="wiki-modal-subtitle">Архив веток</h3>
        {rows.length === 0 ? (
          <p className="wiki-modal-hint">Нет решённых или удалённых веток</p>
        ) : (
          <ul className="wiki-ch-list">
            {rows.map(({ tid, meta, list }) => (
              <li key={tid} className="wiki-ch-thread">
                <div className="wiki-ch-thread-badges">
                  {meta.resolved ? <span className="wiki-badge wiki-badge--ok">Решена</span> : null}
                  {meta.deleted ? <span className="wiki-badge wiki-badge--muted">Удалена</span> : null}
                  {meta.resolvedAt ? (
                    <time className="wiki-ch-time">{formatWhen(meta.resolvedAt)}</time>
                  ) : null}
                  {meta.deletedAt ? (
                    <time className="wiki-ch-time">{formatWhen(meta.deletedAt)}</time>
                  ) : null}
                </div>
                <ul className="wiki-ch-msgs">
                  {list.map((c) => (
                    <li
                      key={c.id}
                      className={`wiki-ch-msg${c.deleted ? ' wiki-ch-msg--deleted' : ''}`}
                    >
                      <strong>{c.author}</strong>{' '}
                      <time>{formatWhen(c.createdAt)}</time>
                      <div>{c.deleted ? '— удалено —' : c.text}</div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <h3 className="wiki-modal-subtitle">Удалённые сообщения</h3>
        {deletedOnly.length === 0 ? (
          <p className="wiki-modal-hint">Нет удалённых сообщений</p>
        ) : (
          <ul className="wiki-ch-msgs wiki-ch-msgs--flat">
            {deletedOnly.map((c) => (
              <li key={c.id} className="wiki-ch-msg wiki-ch-msg--deleted">
                <span className="wiki-ch-msg-thread">Ветка {c.threadId.slice(0, 12)}…</span>
                <strong>{c.author}</strong> <time>{formatWhen(c.createdAt)}</time>
                <div>— удалено —</div>
              </li>
            ))}
          </ul>
        )}

        <div className="wiki-modal-actions wiki-modal-actions--single">
          <button type="button" className="secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
