import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import type { Editor, JSONContent } from '@tiptap/core'

import { useEditor, EditorContent } from '@tiptap/react'

import StarterKit from '@tiptap/starter-kit'

import Placeholder from '@tiptap/extension-placeholder'

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'

import TextAlign from '@tiptap/extension-text-align'

import { TableCell } from '@tiptap/extension-table-cell'

import { TableHeader } from '@tiptap/extension-table-header'

import { Gapcursor } from '@tiptap/extension-gapcursor'

import Link from '@tiptap/extension-link'

import Image from '@tiptap/extension-image'

import { createLowlight, common } from 'lowlight'

import { SlashCommand } from './slashCommand'

import { WikiToolbar } from './WikiToolbar'

import { loadWikiDocWithRemoteFallback, saveWikiDoc } from './wikiDocStorage'

import { MwsTable, MwsTableRow } from './mwsTable'

import { MwsWorkbenchPaste } from './mwsWorkbenchPaste'

import { docHasMwsTables, refreshMwsTables } from './refreshMwsTables'

import { clearMwsPushStateForDst, pushMwsTableEditsFromDoc } from './pushMwsTableEdits'

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



const lowlight = createLowlight(common)



const wikiEditorExtensions = [

  StarterKit.configure({

    codeBlock: false,

    heading: { levels: [1, 2, 3] },

    undoRedo: { depth: 200, newGroupDelay: 500 },

    underline: {},

  }),

  CodeBlockLowlight.configure({

    lowlight,

    defaultLanguage: 'javascript',

  }),

  TextAlign.configure({

    types: ['heading', 'paragraph', 'blockquote'],

  }),

  Placeholder.configure({ placeholder: '' }),

  Gapcursor,

  Link.configure({

    openOnClick: true,

    HTMLAttributes: {

      class: 'wiki-editor-link',

      rel: 'noopener noreferrer',

    },

  }),

  Image.configure({

    allowBase64: true,

    resize: {

      enabled: true,

      minWidth: 72,

      minHeight: 48,

      alwaysPreserveAspectRatio: true,

    },

    HTMLAttributes: { class: 'wiki-editor-image' },

  }),

  MwsTable.configure({

    resizable: false,

    HTMLAttributes: { class: 'wiki-tiptap-table' },

  }),

  MwsTableRow,

  TableHeader,

  TableCell,

  MwsWorkbenchPaste,

  SlashCommand,

]



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

  const mwsRefreshLock = useRef(false)

  const mwsPushLock = useRef(false)

  const mwsPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mwsLastPushedTableContent = useRef<Map<string, string>>(new Map())

  const editorRef = useRef<Editor | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)



  const [imageOpen, setImageOpen] = useState(false)

  const [commentsOpen, setCommentsOpen] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)

  const [accessOpen, setAccessOpen] = useState(false)

  const [timeOpen, setTimeOpen] = useState(false)

  const [accessMode, setAccessMode] = useState<CommentAccessMode>(() => loadAccessMode(pageKey))

  const [accessRev, setAccessRev] = useState(0)

  const [versions, setVersions] = useState(() => listDocVersions(storageKey))



  const flushSave = useCallback(

    (ed: Editor) => {

      const json = ed.getJSON()

      saveWikiDoc(storageKey, json)

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



  const scheduleMwsPush = useCallback((ed: Editor) => {
    if (!docHasMwsTables(ed)) return
    if (mwsPushTimer.current) clearTimeout(mwsPushTimer.current)
    mwsPushTimer.current = setTimeout(() => {
      mwsPushTimer.current = null
      if (mwsPushLock.current) return
      mwsPushLock.current = true
      const docJson = ed.getJSON()
      void pushMwsTableEditsFromDoc(docJson, mwsLastPushedTableContent.current)
        .then(async () => {
          const cur = editorRef.current
          if (!cur || mwsRefreshLock.current) return
          await refreshMwsTables(cur, {
            addToHistory: false,
            onTableReplaced: (dstId) =>
              clearMwsPushStateForDst(mwsLastPushedTableContent.current, dstId),
          })
        })
        .catch((err) => console.warn('MWS: не удалось отправить правки таблицы', err))
        .finally(() => {
          mwsPushLock.current = false
        })
    }, 1800)
  }, [])

  const editor = useEditor({

    extensions: wikiEditorExtensions,

    content: initialDoc,

    editorProps: {

      attributes: {

        class: 'wiki-editor-prose',

        spellcheck: 'false',

      },

    },

    onUpdate: ({ editor: ed }) => {

      scheduleSave(ed)

      scheduleMwsPush(ed)

    },

  })

  useEffect(() => {
    editorRef.current = editor ?? null
  }, [editor])

  useEffect(() => {

    if (!editor || autoSaveIntervalMs <= 0) return

    const id = window.setInterval(() => {

      flushSave(editor)

    }, autoSaveIntervalMs)

    return () => clearInterval(id)

  }, [editor, autoSaveIntervalMs, flushSave])



  useEffect(() => {

    return () => {

      if (saveTimer.current) clearTimeout(saveTimer.current)

      if (mwsPushTimer.current) clearTimeout(mwsPushTimer.current)

    }

  }, [])



  const runQuietMwsRefresh = useCallback(() => {

    if (!editor || mwsRefreshLock.current) return

    if (!docHasMwsTables(editor)) return

    mwsRefreshLock.current = true

    void refreshMwsTables(editor, {
      addToHistory: false,
      onTableReplaced: (dstId) => clearMwsPushStateForDst(mwsLastPushedTableContent.current, dstId),
    })
      .catch(() => {})
      .finally(() => {
        mwsRefreshLock.current = false
      })

  }, [editor])



  useEffect(() => {

    if (!editor) return

    const intervalMs = 5000

    const id = window.setInterval(() => {

      if (document.visibilityState !== 'visible') return

      runQuietMwsRefresh()

    }, intervalMs)

    return () => clearInterval(id)

  }, [editor, runQuietMwsRefresh])



  useEffect(() => {

    if (!editor) return

    const onVis = () => {

      if (document.visibilityState !== 'visible') return

      runQuietMwsRefresh()

    }

    document.addEventListener('visibilitychange', onVis)

    return () => document.removeEventListener('visibilitychange', onVis)

  }, [editor, runQuietMwsRefresh])



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

      flushSave(editor)

    },

    [editor, flushSave],

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

  const [bootDoc, setBootDoc] = useState<JSONContent | null>(null)

  const [bootLoading, setBootLoading] = useState(true)



  useEffect(() => {

    let alive = true

    setBootLoading(true)

    setBootDoc(null)

    void loadWikiDocWithRemoteFallback(storageKey).then((doc) => {

      if (!alive) return

      setBootDoc(doc)

      setBootLoading(false)

    })

    return () => {

      alive = false

    }

  }, [storageKey])



  if (bootLoading || !bootDoc) {

    return (

      <>

        <WikiToolbar

          editor={null}

          onInsertImageFile={undefined}

          onOpenComments={undefined}

          onOpenCommentHistory={undefined}

          onOpenCommentAccess={undefined}

          onOpenTimeMachine={undefined}

        />

        <main className="wiki-main wiki-main--wide">

          <div className="wiki-main-inner">

            <div className="wiki-editor-wrap">

              <div className="wiki-editor-root wiki-editor-loading">Загрузка документа…</div>

            </div>

            {children}

          </div>

        </main>

      </>

    )

  }



  return (

    <WikiDocumentEditorLoaded

      key={storageKey}

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


