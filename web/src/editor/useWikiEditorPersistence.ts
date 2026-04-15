import { useCallback, type MutableRefObject } from 'react'

import type { Editor } from '@tiptap/core'
import type { Doc } from 'yjs'

import { scheduleBacklinksReindex } from '../pages/wikiBacklinks'
import { maybeRecordDocVersion } from './docVersionsStore'
import { persistWikiDocLocal } from './wikiDocStorage'
import { encodeYDocBase64, wikiYStateStorageKey } from './wikiYdocBootstrap'

export function useWikiEditorPersistence(
  storageKey: string,
  pageKey: string,
  ydoc: Doc,
  saveTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
) {
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
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        flushSave(ed)
      }, 400)
    },
    [flushSave, saveTimerRef],
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

  return { flushSave, scheduleSave, runScheduledAutosave, forceSaveAll }
}
