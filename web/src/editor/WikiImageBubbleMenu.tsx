import { useCallback, useEffect, useRef, useState } from 'react'

import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'

import { ImageCropModal } from './ImageCropModal'
import { applyImageAttrsAtPos, findImageNodePos } from './wikiImageNode'

type Props = {
  editor: Editor | null
}

export function WikiImageBubbleMenu({ editor }: Props) {
  const [cropOpen, setCropOpen] = useState(false)
  const [cropSrc, setCropSrc] = useState('')
  const [cropHint, setCropHint] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [widthStr, setWidthStr] = useState('')
  const [heightStr, setHeightStr] = useState('')
  const imagePosRef = useRef<number | null>(null)

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  const closeCropModal = useCallback(() => {
    revokeBlob()
    setCropOpen(false)
    setCropSrc('')
    setCropHint(null)
  }, [revokeBlob])

  const syncSizeFields = useCallback(() => {
    if (!editor?.isActive('image')) return
    const a = editor.getAttributes('image') as { width?: number | null; height?: number | null }
    setWidthStr(a.width != null && a.width !== undefined ? String(a.width) : '')
    setHeightStr(a.height != null && a.height !== undefined ? String(a.height) : '')
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const on = () => {
      const typingSize =
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.classList.contains('wiki-image-bubble-input')
      if (typingSize) return
      if (editor.isActive('image')) {
        imagePosRef.current = findImageNodePos(editor)
      } else {
        imagePosRef.current = null
      }
      syncSizeFields()
      if (!editor.isActive('image')) setCropHint(null)
    }
    editor.on('selectionUpdate', on)
    editor.on('transaction', on)
    on()
    return () => {
      editor.off('selectionUpdate', on)
      editor.off('transaction', on)
    }
  }, [editor, syncSizeFields])

  useEffect(() => () => revokeBlob(), [revokeBlob])

  const openCrop = useCallback(async () => {
    if (!editor) return
    setCropHint(null)
    const pos = findImageNodePos(editor)
    if (pos == null) {
      setCropHint('Кликните по картинке, чтобы выделить узел (позиция не найдена).')
      return
    }
    imagePosRef.current = pos
    const s = editor.getAttributes('image').src as string | undefined
    if (!s) {
      setCropHint('Нет адреса изображения.')
      return
    }

    revokeBlob()

    if (s.startsWith('data:') || s.startsWith('blob:')) {
      setCropSrc(s)
      setCropOpen(true)
      return
    }

    if (s.startsWith('http://') || s.startsWith('https://')) {
      try {
        const r = await fetch(s, { mode: 'cors' })
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setCropSrc(url)
        setCropOpen(true)
      } catch {
        setCropHint('Не удалось загрузить картинку по ссылке (часто из‑за CORS). Вставьте файл с диска или data URL.')
      }
      return
    }

    setCropHint('Обрезка поддерживается для data URL, blob и доступных по CORS https-ссылок.')
  }, [editor, revokeBlob])

  const onCropApply = useCallback(
    (dataUrl: string) => {
      if (!editor) return
      const pos = imagePosRef.current ?? findImageNodePos(editor)
      if (pos == null) return
      editor.view.focus()
      applyImageAttrsAtPos(editor, pos, { src: dataUrl, width: null, height: null })
      closeCropModal()
    },
    [editor, closeCropModal],
  )

  const applyPixelSize = useCallback(() => {
    if (!editor) return
    const pos = imagePosRef.current ?? findImageNodePos(editor)
    if (pos == null) return
    const w = widthStr.trim() === '' ? null : Number(widthStr)
    const h = heightStr.trim() === '' ? null : Number(heightStr)
    if (w !== null && (!Number.isFinite(w) || w < 1)) return
    if (h !== null && (!Number.isFinite(h) || h < 1)) return
    editor.view.focus()
    applyImageAttrsAtPos(editor, pos, { width: w, height: h })
  }, [editor, widthStr, heightStr])

  const resetSize = useCallback(() => {
    if (!editor) return
    const pos = imagePosRef.current ?? findImageNodePos(editor)
    if (pos == null) return
    editor.view.focus()
    applyImageAttrsAtPos(editor, pos, { width: null, height: null })
    setWidthStr('')
    setHeightStr('')
  }, [editor])

  if (!editor) return null

  return (
    <>
      <BubbleMenu
        editor={editor}
        options={{
          placement: 'top',
          onHide: () => undefined,
        }}
        shouldShow={({ editor: ed }) => ed.isActive('image')}
        className="wiki-bubble-menu wiki-image-bubble-menu"
      >
        <button
          type="button"
          className="wiki-bubble-btn"
          title="Обрезать изображение"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void openCrop()}
        >
          ✂
        </button>
        <span className="wiki-image-bubble-sep" aria-hidden />
        <label className="wiki-image-bubble-dim">
          <span className="wiki-image-bubble-dim-label">Ш</span>
          <input
            type="number"
            min={24}
            step={1}
            className="wiki-image-bubble-input"
            value={widthStr}
            onChange={(e) => setWidthStr(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="px"
            title="Ширина в px (пусто — по содержимому)"
            aria-label="Ширина изображения, пиксели"
          />
        </label>
        <label className="wiki-image-bubble-dim">
          <span className="wiki-image-bubble-dim-label">В</span>
          <input
            type="number"
            min={24}
            step={1}
            className="wiki-image-bubble-input"
            value={heightStr}
            onChange={(e) => setHeightStr(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="px"
            title="Высота в px (пусто — по содержимому)"
            aria-label="Высота изображения, пиксели"
          />
        </label>
        <button
          type="button"
          className="wiki-bubble-btn wiki-bubble-btn--narrow"
          title="Применить ширину и высоту (растяжение)"
          onMouseDown={(e) => {
            e.preventDefault()
            applyPixelSize()
          }}
        >
          ↔
        </button>
        <button
          type="button"
          className="wiki-bubble-btn wiki-bubble-btn--narrow"
          title="Сбросить размер (как вставлено)"
          onMouseDown={(e) => {
            e.preventDefault()
            resetSize()
          }}
        >
          ↺
        </button>
        {cropHint ? <span className="wiki-image-bubble-hint">{cropHint}</span> : null}
      </BubbleMenu>

      <ImageCropModal open={cropOpen} src={cropSrc} onClose={closeCropModal} onApply={onCropApply} />
    </>
  )
}
