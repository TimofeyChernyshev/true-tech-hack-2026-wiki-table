import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/core'

import { getDefaultMwsRecordsWsBase, MwsRecordsWsClient } from './mwsRecordsWs'
import {
  applyRemoteRecordUpdates,
  cloneTableSnapshot,
  collectMwsTableSnapshots,
  diffTableSnapshots,
} from './mwsTableDataSync'

const PUSH_DEBOUNCE_MS = 450

/**
 * Синхронизация правок ячеек MWS-таблицы с бэкендом wiki-page по WebSocket (room type=records).
 * Бэкенд рассылает JSON []RecordUpdate и сохраняет в MWS Tables; бэкенд не меняется.
 */
export function useMwsTableWsSync(editor: Editor | null, editorRef: MutableRefObject<Editor | null>) {
  const applyingRemote = useRef(false)
  const lastSnap = useRef<Map<string, ReturnType<typeof cloneTableSnapshot>>>(new Map())
  const clients = useRef<Map<string, MwsRecordsWsClient>>(new Map())
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsBase = useRef(getDefaultMwsRecordsWsBase())

  const refreshSnapshots = useCallback((ed: Editor) => {
    const next = new Map<string, ReturnType<typeof cloneTableSnapshot>>()
    for (const t of collectMwsTableSnapshots(ed)) {
      const key = `${t.anchor.dstId}:${t.tablePos}`
      next.set(key, cloneTableSnapshot(t.snapshot))
    }
    lastSnap.current = next
  }, [])

  const flushPush = useCallback(() => {
    const ed = editorRef.current
    if (!ed || applyingRemote.current) return

    const tables = collectMwsTableSnapshots(ed)
    const dstIdsInDoc = new Set(tables.map((x) => x.anchor.dstId))

    for (const t of tables) {
      const key = `${t.anchor.dstId}:${t.tablePos}`
      if (!lastSnap.current.has(key)) {
        lastSnap.current.set(key, cloneTableSnapshot(t.snapshot))
        continue
      }
      const prev = lastSnap.current.get(key)!
      const diff = diffTableSnapshots(prev, t.snapshot)
      if (diff.length === 0) continue

      const { dstId, viewId, spaceId } = t.anchor
      let client = clients.current.get(dstId)
      if (!client) {
        client = new MwsRecordsWsClient(dstId, viewId, spaceId, wsBase.current, {
          onRecords: (records) => {
            const editorNow = editorRef.current
            if (!editorNow || !records.length) return
            applyingRemote.current = true
            try {
              applyRemoteRecordUpdates(editorNow, dstId, records)
              refreshSnapshots(editorNow)
            } finally {
              requestAnimationFrame(() => {
                applyingRemote.current = false
              })
            }
          },
        })
        client.connect()
        clients.current.set(dstId, client)
      }
      client.sendUpdates(diff)
    }

    refreshSnapshots(ed)

    for (const [id, cl] of clients.current) {
      if (!dstIdsInDoc.has(id)) {
        cl.disconnect()
        clients.current.delete(id)
      }
    }
  }, [editorRef, refreshSnapshots])

  const schedulePush = useCallback(() => {
    if (applyingRemote.current) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null
      flushPush()
    }, PUSH_DEBOUNCE_MS)
  }, [flushPush])

  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      if (applyingRemote.current) return
      schedulePush()
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor, schedulePush])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      for (const c of clients.current.values()) {
        c.disconnect()
      }
      clients.current.clear()
      lastSnap.current.clear()
    }
  }, [])
}
