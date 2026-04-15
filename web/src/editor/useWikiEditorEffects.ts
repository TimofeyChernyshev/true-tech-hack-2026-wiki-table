import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

import type { Editor } from '@tiptap/core'
import type { Doc } from 'yjs'

import { attachYjsBroadcastChannel, broadcastChannelName } from '../collab/yjsBroadcast'
import { WIKI_COMMENT_GUTTER_REFRESH } from '../comments/commentScopeConstants'
import type { CommentsScope } from '../comments/CommentsDrawer'
import { WIKI_OPEN_AI_HINTS } from './WikiAiHintsModal'
import { WIKI_OPEN_HOTKEY_HELP } from './WikiHotkeysModal'
import { WIKI_COMMENT_OPEN_EVENT } from './commentGutter'
import { encodeYDocBase64, wikiYStateStorageKey } from './wikiYdocBootstrap'
import { ensureCommentAnchorAtPosition } from './wikiCommentAnchor'

type Args = {
  saveTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  editor: Editor | null
  editorRef: MutableRefObject<Editor | null>
  autoSaveIntervalMs: number
  runScheduledAutosave: (ed: Editor) => void
  hotkeysOpen: boolean
  setHotkeysOpen: Dispatch<SetStateAction<boolean>>
  pageKey: string
  ydoc: Doc
  storageKey: string
  commentsOpen: boolean
  commentScope: CommentsScope
  setCommentScope: Dispatch<SetStateAction<CommentsScope>>
  setCommentsOpen: Dispatch<SetStateAction<boolean>>
  setAiHintsOpen: Dispatch<SetStateAction<boolean>>
}

export function useWikiEditorEffects({
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
}: Args) {
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
  }, [setHotkeysOpen])

  useEffect(() => {
    const onAi = () => setAiHintsOpen(true)
    window.addEventListener(WIKI_OPEN_AI_HINTS, onAi)
    return () => window.removeEventListener(WIKI_OPEN_AI_HINTS, onAi)
  }, [setAiHintsOpen])

  useEffect(() => {
    if (!hotkeysOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHotkeysOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkeysOpen, setHotkeysOpen])

  useEffect(() => {
    if (!editor) return
    const onRefresh = () => {
      const ed = editorRef.current
      if (!ed) return
      ed.view.dispatch(ed.state.tr.setMeta('commentGutterRefresh', true))
    }
    window.addEventListener(WIKI_COMMENT_GUTTER_REFRESH, onRefresh)
    return () => window.removeEventListener(WIKI_COMMENT_GUTTER_REFRESH, onRefresh)
  }, [editor, editorRef])

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
  }, [pageKey, editorRef, setCommentScope, setCommentsOpen])

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
    const ref = saveTimerRef
    return () => {
      const t = ref.current
      if (t) clearTimeout(t)
    }
  }, [saveTimerRef])
}
