export type CommentAccessMode = 'all' | 'creator'

export type AdvancedComment = {
  id: string
  threadId: string
  parentId: string | null
  author: string
  authorId: string
  text: string
  createdAt: number
  editedAt?: number
  deleted?: boolean
  likes: number
  likedBy: string[]
}

export type ThreadMeta = {
  id: string
  resolved: boolean
  resolvedAt?: number
  deleted?: boolean
  deletedAt?: number
}

/** События для окна «История комментариев» (не показываются в основном списке) */
export type CommentAuditEvent = {
  id: string
  ts: number
  kind: 'comment_edit' | 'comment_delete' | 'thread_delete' | 'thread_resolve'
  threadId: string
  commentId?: string
  author?: string
  /** Для edit/delete сообщения */
  textBefore?: string
  textAfter?: string
}
