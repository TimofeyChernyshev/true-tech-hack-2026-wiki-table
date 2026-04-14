import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { Editor, JSONContent } from '@tiptap/core'

import { Collaboration } from '@tiptap/extension-collaboration'

import { useEditor, EditorContent } from '@tiptap/react'

import { WikiToolbar } from './WikiToolbar'

import { loadWikiDoc, persistWikiDocLocal } from './wikiDocStorage'

import { WikiHotkeysModal, WIKI_OPEN_HOTKEY_HELP } from './WikiHotkeysModal'

import { attachYjsBroadcastChannel, broadcastChannelName } from '../collab/yjsBroadcast'

import { wikiBaseExtensions } from './wikiEditorExtensions'

import { createWikiYDoc, encodeYDocBase64, wikiYStateStorageKey } from './wikiYdocBootstrap'

import { WikiBubbleMenu } from './WikiBubbleMenu'

import { ImageInsertModal } from './ImageInsertModal'

import { TimeMachineModal } from './TimeMachineModal'

import { WikiImageBubbleMenu } from './WikiImageBubbleMenu'

import {
  parsePageKeyFromHref,
  scheduleBacklinksReindex,
  WIKI_NAVIGATE_EVENT,
  type WikiNavigateDetail,
} from '../pages/wikiBacklinks'

import {

  forceRecordDocVersion,

  listDocVersions,

  maybeRecordDocVersion,

} from './docVersionsStore'

import { CommentAccessModal } from '../comments/CommentAccessModal'

import { CommentHistoryModal } from '../comments/CommentHistoryModal'

import { CommentsDrawer, type CommentsScope } from '../comments/CommentsDrawer'

import { WIKI_COMMENT_GUTTER_REFRESH } from '../comments/commentScopeConstants'

import {

  loadAccessMode,

  saveAccessMode,

} from '../comments/commentAdvancedStore'

import type { CommentAccessMode } from '../comments/commentAdvancedTypes'

import { CommentGutter, WIKI_COMMENT_OPEN_EVENT } from './commentGutter'

import { MwsTableInsertModal } from './MwsTableInsertModal'

import { MwsTableToolbar } from './MwsTableToolbar'

import { useMwsTableWsSync } from './useMwsTableWsSync'

import { ensureCommentAnchorAtPosition } from './wikiCommentAnchor'

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

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const flushSave = useCallback(

    (ed: Editor) => {

      const json = ed.getJSON()

      persistWikiDocLocal(storageKey, json)

      scheduleBacklinksReindex()

      maybeRecordDocVersion(storageKey, json)

    },

    [storageKey],

  )



  const scheduleSave = useCallback(

    (ed: Editor) => {

      if (saveTimer.current) clearTimeout(saveTimer.current)

      saveTimer.current = setTimeout(() => {

        saveTimer.current = null

        flushSave(ed)

      }, 400)

    },

    [flushSave],

  )

  const runScheduledAutosave = useCallback(
    (ed: Editor) => {
      const json = ed.getJSON()
      persistWikiDocLocal(storageKey, json)
      scheduleBacklinksReindex()
      maybeRecordDocVersion(storageKey, json)
      try {
        localStorage.setItem(wikiYStateStorageKey(pageKey), encodeYDocBase64(ydoc))
      } catch {
        /* ignore */
      }
    },
    [storageKey, pageKey, ydoc],
  )

  const forceSaveAll = useCallback(
    (ed: Editor) => {
      const json = ed.getJSON()
      persistWikiDocLocal(storageKey, json)
      scheduleBacklinksReindex()
      try {
        localStorage.setItem(wikiYStateStorageKey(pageKey), encodeYDocBase64(ydoc))
      } catch {
        /* ignore */
      }
      maybeRecordDocVersion(storageKey, json)
    },
    [storageKey, pageKey, ydoc],
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
      const pageKey = parsePageKeyFromHref(href)
      if (pageKey) {
        window.dispatchEvent(
          new CustomEvent<WikiNavigateDetail>(WIKI_NAVIGATE_EVENT, { detail: { pageKey } }),
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

  useEffect(() => {

    if (!editor || autoSaveIntervalMs <= 0) return

    const id = window.setInterval(() => {

      runScheduledAutosave(editor)

    }, autoSaveIntervalMs)

    return () => clearInterval(id)

  }, [editor, autoSaveIntervalMs, runScheduledAutosave])

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onCap = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.altKey) return
      const k = e.key.toLowerCase()
      if (!e.shiftKey && (k === 'b' || k === 'i' || k === 'u' || k === 's')) {
        e.preventDefault()
        return
      }
      if (k === 'z' || k === 'y' || (e.shiftKey && k === 'z')) {
        e.preventDefault()
        return
      }
      if (!e.shiftKey && k === 'r') {
        e.preventDefault()
        return
      }
    }
    dom.addEventListener('keydown', onCap, true)
    return () => dom.removeEventListener('keydown', onCap, true)
  }, [editor])

  useEffect(() => {
    const onHelp = () => setHotkeysOpen(true)
    window.addEventListener(WIKI_OPEN_HOTKEY_HELP, onHelp)
    return () => window.removeEventListener(WIKI_OPEN_HOTKEY_HELP, onHelp)
  }, [])

  useEffect(() => {
    if (!hotkeysOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHotkeysOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkeysOpen])

  useEffect(() => {
    if (!editor) return
    const onRefresh = () => {
      const ed = editorRef.current
      if (!ed) return
      ed.view.dispatch(ed.state.tr.setMeta('commentGutterRefresh', true))
    }
    window.addEventListener(WIKI_COMMENT_GUTTER_REFRESH, onRefresh)
    return () => window.removeEventListener(WIKI_COMMENT_GUTTER_REFRESH, onRefresh)
  }, [editor])

  useEffect(() => {
    const h = (ev: Event) => {
      const e = ev as CustomEvent<{ pageKey: string; pos: number; excerpt: string }>
      if (e.detail?.pageKey !== pageKey) return
      const ed = editorRef.current
      if (!ed) return
      const anchor = ensureCommentAnchorAtPosition(ed, e.detail.pos)
      if (!anchor) return
      setCommentScope({ mode: 'block', anchorKey: anchor, excerpt: e.detail.excerpt || '' })
      setCommentsOpen(true)
    }
    window.addEventListener(WIKI_COMMENT_OPEN_EVENT, h as EventListener)
    return () => window.removeEventListener(WIKI_COMMENT_OPEN_EVENT, h as EventListener)
  }, [pageKey])

  useEffect(() => {
    const root = editor?.view.dom
    if (!root) return
    const clear = () => {
      root.querySelectorAll('.wiki-block--comment-active').forEach((el) => el.classList.remove('wiki-block--comment-active'))
    }
    if (!commentsOpen || commentScope.mode !== 'block') {
      clear()
      return () => clear()
    }
    clear()
    const el = root.querySelector(`[data-comment-anchor="${commentScope.anchorKey}"]`)
    el?.classList.add('wiki-block--comment-active')
    return () => {
      el?.classList.remove('wiki-block--comment-active')
    }
  }, [editor, commentsOpen, commentScope])

  useEffect(() => {
    return attachYjsBroadcastChannel(ydoc, broadcastChannelName(pageKey, storageKey))
  }, [ydoc, pageKey, storageKey])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const persistY = () => {
      try {
        localStorage.setItem(wikiYStateStorageKey(pageKey), encodeYDocBase64(ydoc))
      } catch {
        /* ignore */
      }
    }
    const onUp = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        persistY()
      }, 500)
    }
    ydoc.on('update', onUp)
    return () => {
      ydoc.off('update', onUp)
      if (timer) clearTimeout(timer)
      persistY()
    }
  }, [ydoc, pageKey])

  useEffect(() => {

    return () => {

      if (saveTimer.current) clearTimeout(saveTimer.current)

    }

  }, [])

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

        />

        <MwsTableToolbar editor={editor} />

      </div>

      <WikiBubbleMenu editor={editor} />

      <WikiImageBubbleMenu editor={editor} />

      <ImageInsertModal

        open={imageOpen}

        onClose={() => setImageOpen(false)}

        onConfirm={onImageConfirm}

      />

      <WikiHotkeysModal open={hotkeysOpen} onClose={() => setHotkeysOpen(false)} />

      <TimeMachineModal

        open={timeOpen}

        onClose={() => setTimeOpen(false)}

        versions={versions}

        onRestore={onRestoreVersion}

        onSnapshotNow={() => {

          snapshotNow()

          setVersions(listDocVersions(storageKey))

        }}

      />

      <CommentHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} pageKey={pageKey} />

      <CommentAccessModal

        open={accessOpen}

        onClose={() => setAccessOpen(false)}

        mode={accessMode}

        onSave={(m) => {

          saveAccessMode(pageKey, m)

          setAccessMode(m)

          setAccessRev((x) => x + 1)

        }}

      />

      <CommentsDrawer

        open={commentsOpen}

        onClose={() => {
          setCommentsOpen(false)
          setCommentScope({ mode: 'page' })
        }}

        pageKey={pageKey}

        excerpt={excerpt}

        scope={commentScope}

        accessRevision={accessRev}

      />

      <MwsTableInsertModal open={mwsOpen} editor={editor} onClose={() => setMwsOpen(false)} />

      <main className="wiki-main wiki-main--wide">

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


