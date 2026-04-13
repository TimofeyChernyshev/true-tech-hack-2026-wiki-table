import * as Y from 'yjs'

const ORIGIN_BC = 'wiki-yjs-broadcast'

export function attachYjsBroadcastChannel(ydoc: Y.Doc, channelName: string): () => void {
  let ch: BroadcastChannel
  try {
    ch = new BroadcastChannel(channelName)
  } catch {
    return () => {}
  }

  const sendFull = () => {
    try {
      const u = Y.encodeStateAsUpdate(ydoc)
      ch.postMessage({ t: 'u', d: Array.from(u) })
    } catch {
      /* ignore */
    }
  }

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN_BC) return
    try {
      ch.postMessage({ t: 'u', d: Array.from(update) })
    } catch {
      /* ignore */
    }
  }

  const onMessage = (ev: MessageEvent) => {
    const m = ev.data as { t?: string; d?: number[] } | null
    if (!m?.t) return
    if (m.t === 'q') {
      sendFull()
      return
    }
    if (m.t === 'u' && m.d?.length) {
      try {
        Y.applyUpdate(ydoc, new Uint8Array(m.d), ORIGIN_BC)
      } catch {
        /* ignore */
      }
    }
  }

  ydoc.on('update', onDocUpdate)
  ch.addEventListener('message', onMessage)
  ch.postMessage({ t: 'q' })
  sendFull()

  return () => {
    ydoc.off('update', onDocUpdate)
    ch.removeEventListener('message', onMessage)
    ch.close()
  }
}

export function broadcastChannelName(pageKey: string, storageKey: string): string {
  return `wiki-yjs-${pageKey}::${storageKey}`
}
