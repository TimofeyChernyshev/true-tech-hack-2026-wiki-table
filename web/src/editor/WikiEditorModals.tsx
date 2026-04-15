import type { Editor, JSONContent } from '@tiptap/core'

import { CommentAccessModal } from '../comments/CommentAccessModal'
import { CommentHistoryModal } from '../comments/CommentHistoryModal'
import { CommentsDrawer, type CommentsScope } from '../comments/CommentsDrawer'
import type { CommentAccessMode } from '../comments/commentAdvancedTypes'
import { ImageInsertModal } from './ImageInsertModal'
import { MwsTableInsertModal } from './MwsTableInsertModal'
import { TimeMachineModal } from './TimeMachineModal'
import { WikiHotkeysModal } from './WikiHotkeysModal'
import type { DocVersionEntry } from './docVersionsStore'

type Props = {
  pageKey: string
  excerpt: string
  editor: Editor | null
  imageOpen: boolean
  onImageClose: () => void
  onImageConfirm: (dataUrl: string, widthHint?: number) => void
  hotkeysOpen: boolean
  onHotkeysClose: () => void
  timeOpen: boolean
  onTimeClose: () => void
  versions: DocVersionEntry[]
  onRestoreVersion: (doc: JSONContent) => void
  onTimeMachineSnapshot: () => void
  historyOpen: boolean
  onHistoryClose: () => void
  accessOpen: boolean
  onAccessClose: () => void
  accessMode: CommentAccessMode
  onAccessSave: (m: CommentAccessMode) => void
  commentsOpen: boolean
  onCommentsClose: () => void
  commentScope: CommentsScope
  accessRev: number
  mwsOpen: boolean
  onMwsClose: () => void
}

export function WikiEditorModals({
  pageKey,
  excerpt,
  editor,
  imageOpen,
  onImageClose,
  onImageConfirm,
  hotkeysOpen,
  onHotkeysClose,
  timeOpen,
  onTimeClose,
  versions,
  onRestoreVersion,
  onTimeMachineSnapshot,
  historyOpen,
  onHistoryClose,
  accessOpen,
  onAccessClose,
  accessMode,
  onAccessSave,
  commentsOpen,
  onCommentsClose,
  commentScope,
  accessRev,
  mwsOpen,
  onMwsClose,
}: Props) {
  return (
    <>
      <ImageInsertModal open={imageOpen} onClose={onImageClose} onConfirm={onImageConfirm} />
      <WikiHotkeysModal open={hotkeysOpen} onClose={onHotkeysClose} />
      <TimeMachineModal
        open={timeOpen}
        onClose={onTimeClose}
        versions={versions}
        onRestore={onRestoreVersion}
        onSnapshotNow={onTimeMachineSnapshot}
      />
      <CommentHistoryModal open={historyOpen} onClose={onHistoryClose} pageKey={pageKey} />
      <CommentAccessModal open={accessOpen} onClose={onAccessClose} mode={accessMode} onSave={onAccessSave} />
      <CommentsDrawer
        open={commentsOpen}
        onClose={onCommentsClose}
        pageKey={pageKey}
        excerpt={excerpt}
        scope={commentScope}
        accessRevision={accessRev}
      />
      <MwsTableInsertModal open={mwsOpen} editor={editor} onClose={onMwsClose} />
    </>
  )
}
