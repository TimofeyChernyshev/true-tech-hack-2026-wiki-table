import { useCallback, useEffect, useId, useMemo, useState } from 'react'

import type { Editor, JSONContent } from '@tiptap/core'

import { ModalShell } from '../components/shared/ModalShell'
import { fetchGptChat, fetchGptModels, type GptModelInfo } from '../api/gpt'

/** Событие открытия панели (в т.ч. Ctrl+Shift+A в редакторе). */
export const WIKI_OPEN_AI_HINTS = 'wiki-open-ai-hints'

type Props = {
  open: boolean
  onClose: () => void
  editor: Editor | null
}

const SYSTEM_WIKI = `Ты помощник при редактировании вики-страницы. Отвечай по-русски, по делу. Если нужно дать текст для вставки в документ, пиши обычным текстом или короткими абзацами, без обёртки в markdown, если пользователь не просил обратного.`

function selectionPlainText(editor: Editor): { text: string; empty: boolean } {
  const { from, to, empty } = editor.state.selection
  if (empty) return { text: '', empty: true }
  const text = editor.state.doc.textBetween(from, to, '\n')
  return { text, empty: text.trim().length === 0 }
}

function textBeforeCursor(editor: Editor, maxLen: number): string {
  const pos = editor.state.selection.from
  const start = Math.max(0, pos - maxLen)
  return editor.state.doc.textBetween(start, pos, '\n').trimEnd()
}

function plainTextToParagraphs(text: string): JSONContent[] {
  const t = text.replace(/\r\n/g, '\n').trimEnd()
  if (!t) return []
  return t.split(/\n{2,}/).map((block) => ({
    type: 'paragraph' as const,
    content: block.split('\n').flatMap((line, i) => {
      const nodes: JSONContent[] = []
      if (i > 0) nodes.push({ type: 'hardBreak' })
      nodes.push({ type: 'text', text: line })
      return nodes
    }),
  }))
}

export function WikiAiHintsModal({ open, onClose, editor }: Props) {
  const baseId = useId()
  const [models, setModels] = useState<GptModelInfo[]>([])
  const [modelId, setModelId] = useState('')
  const [instruction, setInstruction] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSendErr(null)
    ;(async () => {
      try {
        const list = await fetchGptModels()
        if (cancelled) return
        setModels(list)
        if (list.length > 0) {
          setModelId((prev) => (prev && list.some((m) => m.id === prev) ? prev : list[0]!.id))
        }
      } catch (e) {
        if (!cancelled) {
          setModels([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const canUseEditor = Boolean(editor)

  const applyPreset = useCallback(
    (kind: 'summarize' | 'continue' | 'polish') => {
      if (!editor) return
      const { text, empty } = selectionPlainText(editor)
      if (kind === 'summarize') {
        if (empty || !text.trim()) {
          setInstruction('Кратко перескажи следующий фрагмент вики-страницы (вставь свой текст в ответ):\n\n')
          return
        }
        setInstruction(`Кратко перескажи следующий фрагмент:\n\n${text.trim()}`)
        return
      }
      if (kind === 'continue') {
        const ctx = textBeforeCursor(editor, 3500)
        if (!ctx) {
          setInstruction('Продолжи мысль в том же стиле, как будто это одна вики-страница. Контекста перед курсором мало — предложи логичное продолжение раздела.')
          return
        }
        setInstruction(
          `Ниже фрагмент текста страницы до курсора. Продолжи его естественно, 2–6 предложений, без повторения заголовков.\n\n---\n${ctx}\n---`,
        )
        return
      }
      if (empty || !text.trim()) {
        setInstruction('Сделай стиль этого абзаца более деловым и ясным (вставь исправленный вариант):\n\n')
        return
      }
      setInstruction(`Сделай стиль следующего фрагмента более деловым и ясным, сохрани смысл:\n\n${text.trim()}`)
    },
    [editor],
  )

  const send = useCallback(async () => {
    const q = instruction.trim()
    if (!q || busy) return
    setBusy(true)
    setSendErr(null)
    setReply('')
    try {
      const res = await fetchGptChat({
        model: modelId || undefined,
        systemPrompt: SYSTEM_WIKI,
        temperature: 0.45,
        maxTokens: 1800,
        messages: [{ role: 'user', content: q }],
      })
      setReply(res.message.content.trim())
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Ошибка запроса')
    } finally {
      setBusy(false)
    }
  }, [instruction, busy, modelId])

  const insertBlocks = useCallback(
    (blocks: JSONContent[], replaceSelection: boolean) => {
      if (!editor || blocks.length === 0) return
      const chain = editor.chain().focus()
      if (replaceSelection && !editor.state.selection.empty) {
        chain.deleteSelection()
      }
      if (!replaceSelection) {
        chain.insertContent({
          type: 'paragraph',
          content: [{ type: 'hardBreak' }, { type: 'hardBreak' }],
        })
      }
      chain.insertContent(blocks).run()
      onClose()
    },
    [editor, onClose],
  )

  const onInsertAfter = useCallback(() => {
    const blocks = plainTextToParagraphs(reply)
    if (blocks.length === 0) return
    insertBlocks(blocks, false)
  }, [reply, insertBlocks])

  const onReplaceSelection = useCallback(() => {
    if (!editor) return
    const blocks = plainTextToParagraphs(reply)
    if (blocks.length === 0) return
    insertBlocks(blocks, true)
  }, [editor, reply, insertBlocks])

  const selEmpty = editor ? selectionPlainText(editor).empty : true

  const modelOptions = useMemo(
    () =>
      models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name || m.id}
          {m.provider ? ` (${m.provider})` : ''}
        </option>
      )),
    [models],
  )

  return (
    <ModalShell
      open={open}
      onBackdropClose={onClose}
      ariaLabelledBy={baseId + '-t'}
      rootClassName="wiki-ai-hints-modal-root"
      cardClassName="wiki-modal-card--wide"
    >
      <h2 id={baseId + '-t'} className="wiki-modal-title">
        AI-подсказки (MWS GPT)
      </h2>
      <p className="wiki-modal-hint">
        Запросы идут на сервис <code className="wiki-ai-hints-code">/api/v1/gpt/chat</code>. Убедитесь, что контейнер{' '}
        <code className="wiki-ai-hints-code">gpt</code> запущен и заданы ключи MWS.
      </p>



      <div className="wiki-ai-hints-row">
        <label className="wiki-ai-hints-label" htmlFor={baseId + '-model'}>
          Модель
        </label>
        <select
          id={baseId + '-model'}
          className="wiki-ai-hints-select wiki-doc-title-input"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={!models.length || busy}
        >
          {models.length === 0 ? <option value="">—</option> : modelOptions}
        </select>
      </div>

      <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Быстрые шаблоны</p>
      <div className="wiki-ai-hints-presets" role="group" aria-label="Шаблоны запроса">
        <button
          type="button"
          className="secondary wiki-ai-hints-preset"
          disabled={!canUseEditor || busy}
          onClick={() => applyPreset('summarize')}
        >
          Кратко пересказать выделение
        </button>
        <button
          type="button"
          className="secondary wiki-ai-hints-preset"
          disabled={!canUseEditor || busy}
          onClick={() => applyPreset('continue')}
        >
          Продолжить до курсора
        </button>
        <button
          type="button"
          className="secondary wiki-ai-hints-preset"
          disabled={!canUseEditor || busy}
          onClick={() => applyPreset('polish')}
        >
          Деловой стиль
        </button>
      </div>

      <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Запрос</p>
      <textarea
        className="wiki-ai-hints-textarea wiki-doc-title-input"
        rows={6}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Опишите задачу или выберите шаблон выше…"
        disabled={busy}
        aria-label="Текст запроса к AI"
      />

      {sendErr ? <p className="wiki-ai-hints-error">{sendErr}</p> : null}

      <div className="wiki-modal-actions wiki-ai-hints-actions-send">
        <button type="button" className="secondary" onClick={onClose} disabled={busy}>
          Закрыть
        </button>
        <button type="button" className="primary" onClick={() => void send()} disabled={busy || !instruction.trim()}>
          {busy ? 'Отправка…' : 'Спросить AI'}
        </button>
      </div>

      {reply ? (
        <>
          <p className="wiki-modal-subtitle wiki-modal-subtitle--tight">Ответ</p>
          <pre className="wiki-ai-hints-reply">{reply}</pre>
          <div className="wiki-modal-actions">
            <button
              type="button"
              className="secondary"
              onClick={onInsertAfter}
              disabled={!editor || busy}
              data-testid="wikiAiHints-insertAfter"
            >
              Вставить после курсора
            </button>
            <button
              type="button"
              className="primary"
              onClick={onReplaceSelection}
              disabled={!editor || busy || selEmpty}
              data-testid="wikiAiHints-replaceSelection"
            >
              Заменить выделение
            </button>
          </div>
        </>
      ) : null}
    </ModalShell>
  )
}
