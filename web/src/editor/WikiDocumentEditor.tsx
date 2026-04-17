import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { Editor, JSONContent } from '@tiptap/core'
import { Collaboration } from '@tiptap/extension-collaboration'
import { useEditor, EditorContent } from '@tiptap/react'

import { loadAccessMode, saveAccessMode } from '../comments/commentAdvancedStore'
import type { CommentAccessMode } from '../comments/commentAdvancedTypes'
import type { CommentsScope } from '../comments/CommentsDrawer'
import {
  parsePageKeyFromHref,
  scheduleBacklinksReindex,
  WIKI_NAVIGATE_EVENT,
  type WikiNavigateDetail,
} from '../pages/wikiBacklinks'
import { CommentGutter } from './commentGutter'
import { forceRecordDocVersion, listDocVersions } from './docVersionsStore'
import { WikiBubbleMenu } from './WikiBubbleMenu'
import { WikiEditorModals } from './WikiEditorModals'
import { WIKI_OPEN_HOTKEY_HELP } from './WikiHotkeysModal'
import { WikiImageBubbleMenu } from './WikiImageBubbleMenu'
import { WIKI_OPEN_AI_HINTS, WikiAiHintsModal } from './WikiAiHintsModal'
import { WikiToolbar } from './WikiToolbar'
import { MwsTableToolbar } from './MwsTableToolbar'
import { useMwsTableWsSync } from './useMwsTableWsSync'
import { useWikiEditorEffects } from './useWikiEditorEffects'
import { useWikiEditorPersistence } from './useWikiEditorPersistence'
import { createWikiYDoc } from './wikiYdocBootstrap'
import { wikiBaseExtensions } from './wikiEditorExtensions'
import { loadWikiDoc, persistWikiDocLocal } from './wikiDocStorage'

import 'tippy.js/dist/tippy.css'
import 'highlight.js/styles/github.css'
import './editor.css'

type LoadedProps = {
  storageKey: string
  pageKey: string
  excerpt: string
  autoSaveIntervalMs: number
  children?: ReactNode
  initialDoc: JSONContent
}

function WikiDocumentEditorLoaded({
  storageKey,
  pageKey,
  excerpt,
  autoSaveIntervalMs,
  children,
  initialDoc,
}: LoadedProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const forceSaveAllRef = useRef<(ed: Editor) => void>(() => {})

  const [ydoc] = useState(() => createWikiYDoc(pageKey, initialDoc, wikiBaseExtensions))

  const extensions = useMemo(
    () => [
      ...wikiBaseExtensions,
      CommentGutter.configure({ pageKey }),
      Collaboration.configure({ document: ydoc }),
    ],
    [ydoc, pageKey],
  )

  const [imageOpen, setImageOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentScope, setCommentScope] = useState<CommentsScope>({ mode: 'page' })
  const [mwsOpen, setMwsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [accessMode, setAccessMode] = useState<CommentAccessMode>(() => loadAccessMode(pageKey))
  const [accessRev, setAccessRev] = useState(0)
  const [versions, setVersions] = useState(() => listDocVersions(storageKey))
  const [hotkeysOpen, setHotkeysOpen] = useState(false)
  const [aiHintsOpen, setAiHintsOpen] = useState(false)

  const { scheduleSave, runScheduledAutosave, forceSaveAll } = useWikiEditorPersistence(
    storageKey,
    pageKey,
    ydoc,
    saveTimerRef,
  )

  useEffect(() => {
    forceSaveAllRef.current = forceSaveAll
  }, [forceSaveAll])

  const handleWikiClick = useCallback(
    (view: { dom: HTMLElement }, _pos: number, event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return false
      const a = target.closest('a')
      if (!a || !view.dom.contains(a)) return false
      const href = a.getAttribute('href')
      if (!href) return false
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        return true
      }
      event.preventDefault()
      const pk = parsePageKeyFromHref(href)
      if (pk) {
        window.dispatchEvent(
          new CustomEvent<WikiNavigateDetail>(WIKI_NAVIGATE_EVENT, { detail: { pageKey: pk } }),
        )
        return true
      }
      if (/^mailto:/i.test(href)) {
        window.location.href = href
        return true
      }
      if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return true
      }
      return true
    },
    [],
  )

  const handleEditorKeyDown = useCallback((_view: unknown, event: Event) => {
    const e = event as KeyboardEvent
    const ed = editorRef.current
    if (!ed) return false
    const mod = e.ctrlKey || e.metaKey
    if (!mod || e.altKey) return false
    if (e.shiftKey && (e.key === 'r' || e.key === 'R')) return false
    if (!e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      forceSaveAllRef.current(ed)
      return true
    }
    if (!e.shiftKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault()
      return ed.chain().focus().setTextAlign('right').run()
    }
    if (e.shiftKey && (e.key === '?' || e.code === 'Slash')) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent(WIKI_OPEN_HOTKEY_HELP))
      return true
    }
    if (!e.shiftKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault()
      return ed.chain().focus().setTextAlign('left').run()
    }
    if (!e.shiftKey && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault()
      return ed.chain().focus().setTextAlign('center').run()
    }
    if (!e.shiftKey && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault()
      return ed.chain().focus().setTextAlign('justify').run()
    }
    if (!e.shiftKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault()
      return ed.chain().focus().toggleUnderline().run()
    }
    if (e.shiftKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent(WIKI_OPEN_AI_HINTS))
      return true
    }
    return false
  }, [])

  const editor = useEditor({
    extensions,
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed
    },
    onDestroy: () => {
      editorRef.current = null
    },
    editorProps: {
      attributes: {
        class: 'wiki-editor-prose',
        spellcheck: 'false',
      },
      handleKeyDown: handleEditorKeyDown,
      handleClick: handleWikiClick,
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      persistWikiDocLocal(storageKey, json)
      scheduleBacklinksReindex()
      scheduleSave(ed)
    },
  })

  useMwsTableWsSync(editor, editorRef)

  useWikiEditorEffects({
    saveTimerRef,
    editor,
    editorRef,
    autoSaveIntervalMs,
    runScheduledAutosave,
    hotkeysOpen,
    setHotkeysOpen,
    pageKey,
    ydoc,
    storageKey,
    commentsOpen,
    commentScope,
    setCommentScope,
    setCommentsOpen,
    setAiHintsOpen,
  })

  const onImageConfirm = useCallback(
    (dataUrl: string, widthHint?: number) => {
      editor?.chain().focus().setImage({ src: dataUrl, width: widthHint }).run()
    },
    [editor],
  )

  const onRestoreVersion = useCallback(
    (doc: JSONContent) => {
      if (!editor) return
      editor.chain().focus().setContent(doc).run()
      forceSaveAll(editor)
    },
    [editor, forceSaveAll],
  )

  const snapshotNow = useCallback(() => {
    if (!editor) return
    forceRecordDocVersion(storageKey, editor.getJSON())
    setVersions(listDocVersions(storageKey))
  }, [editor, storageKey])

  const openTimeMachine = useCallback(() => {
    setVersions(listDocVersions(storageKey))
    setTimeOpen(true)
  }, [storageKey])

  return (
    <>
      <div className="wiki-toolbar-wrap">
        <WikiToolbar
          editor={editor}
          onInsertImageFile={() => setImageOpen(true)}
          onOpenComments={() => {
            setCommentScope({ mode: 'page' })
            setCommentsOpen(true)
          }}
          onOpenMwsTable={() => setMwsOpen(true)}
          onOpenCommentHistory={() => setHistoryOpen(true)}
          onOpenCommentAccess={() => {
            setAccessMode(loadAccessMode(pageKey))
            setAccessOpen(true)
          }}
          onOpenTimeMachine={openTimeMachine}
          onOpenAiHints={() => setAiHintsOpen(true)}
        />
      </div>

      <MwsTableToolbar editor={editor} />
      <WikiBubbleMenu editor={editor} />
      <WikiImageBubbleMenu editor={editor} />

      <WikiAiHintsModal open={aiHintsOpen} onClose={() => setAiHintsOpen(false)} editor={editor} />

      <WikiEditorModals
        pageKey={pageKey}
        excerpt={excerpt}
        editor={editor}
        imageOpen={imageOpen}
        onImageClose={() => setImageOpen(false)}
        onImageConfirm={onImageConfirm}
        hotkeysOpen={hotkeysOpen}
        onHotkeysClose={() => setHotkeysOpen(false)}
        timeOpen={timeOpen}
        onTimeClose={() => setTimeOpen(false)}
        versions={versions}
        onRestoreVersion={onRestoreVersion}
        onTimeMachineSnapshot={() => {
          snapshotNow()
          setVersions(listDocVersions(storageKey))
        }}
        historyOpen={historyOpen}
        onHistoryClose={() => setHistoryOpen(false)}
        accessOpen={accessOpen}
        onAccessClose={() => setAccessOpen(false)}
        accessMode={accessMode}
        onAccessSave={(m) => {
          saveAccessMode(pageKey, m)
          setAccessMode(m)
          setAccessRev((x) => x + 1)
        }}
        commentsOpen={commentsOpen}
        onCommentsClose={() => {
          setCommentsOpen(false)
          setCommentScope({ mode: 'page' })
        }}
        commentScope={commentScope}
        accessRev={accessRev}
        mwsOpen={mwsOpen}
        onMwsClose={() => setMwsOpen(false)}
      />

      <main className="wiki-main wiki-main--wide" data-testid="wikiDocumentEditor-main">
        <div className="wiki-main-inner">
          <div className="wiki-editor-wrap">
            <EditorContent editor={editor} className="wiki-editor-root" />
          </div>
          {children}
        </div>
      </main>
    </>
  )
}

type Props = {
  storageKey?: string
  pageKey?: string
  excerpt?: string
  autoSaveIntervalMs?: number
  children?: ReactNode
}

export function WikiDocumentEditor({
  storageKey = 'wiki-doc-main',
  pageKey = 'main',
  excerpt = '',
  autoSaveIntervalMs = 10_000,
  children,
}: Props) {
  const bootDoc = useMemo(() => loadWikiDoc(storageKey), [storageKey])

  return (
    <WikiDocumentEditorLoaded
      key={`${storageKey}::${pageKey}`}
      storageKey={storageKey}
      pageKey={pageKey}
      excerpt={excerpt}
      autoSaveIntervalMs={autoSaveIntervalMs}
      initialDoc={bootDoc}
    >
      {children}
    </WikiDocumentEditorLoaded>
  )
}
