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

import {

  forceRecordDocVersion,

  listDocVersions,

  maybeRecordDocVersion,

} from './docVersionsStore'

import { CommentAccessModal } from '../comments/CommentAccessModal'

import { CommentHistoryModal } from '../comments/CommentHistoryModal'

import { CommentsDrawer } from '../comments/CommentsDrawer'

import {

  loadAccessMode,

  saveAccessMode,

} from '../comments/commentAdvancedStore'

import type { CommentAccessMode } from '../comments/commentAdvancedTypes'

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
    () => [...wikiBaseExtensions, Collaboration.configure({ document: ydoc })],
    [ydoc],
  )



  const [imageOpen, setImageOpen] = useState(false)

  const [commentsOpen, setCommentsOpen] = useState(false)

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

    },

    onUpdate: ({ editor: ed }) => {

      const json = ed.getJSON()

      persistWikiDocLocal(storageKey, json)

      scheduleSave(ed)

    },

  })

  useEffect(() => {

    if (!editor || autoSaveIntervalMs <= 0) return

    const id = window.setInterval(() => {

      runScheduledAutosave(editor)

    }, autoSaveIntervalMs)

    return () => clearInterval(id)

  }, [editor, autoSaveIntervalMs, runScheduledAutosave])

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

      <WikiToolbar

        editor={editor}

        onInsertImageFile={() => setImageOpen(true)}

        onOpenComments={() => setCommentsOpen(true)}

        onOpenCommentHistory={() => setHistoryOpen(true)}

        onOpenCommentAccess={() => {

          setAccessMode(loadAccessMode(pageKey))

          setAccessOpen(true)

        }}

        onOpenTimeMachine={openTimeMachine}

      />

      <WikiBubbleMenu editor={editor} />

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

        onClose={() => setCommentsOpen(false)}

        pageKey={pageKey}

        excerpt={excerpt}

        accessRevision={accessRev}

      />

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


