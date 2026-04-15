import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'

import { ModalShell } from '../components/shared/ModalShell'

type Props = {
  open: boolean
  src: string
  onClose: () => void
  onApply: (dataUrl: string) => void
}

type Rect = { x: number; y: number; w: number; h: number }

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function isFullFrameRect(r: Rect | null, cw: number, ch: number): boolean {
  if (!r || cw < 4 || ch < 4) return false
  return r.x <= 2 && r.y <= 2 && r.w >= cw - 4 && r.h >= ch - 4
}

export function ImageCropModal({ open, src, onClose, onApply }: Props) {
  const dlgId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const interactRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [display, setDisplay] = useState({ w: 0, h: 0 })
  const [err, setErr] = useState<string | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ mode: 'draw' | 'move'; ox: number; oy: number; start: Rect } | null>(null)

  const resetView = useCallback(() => {
    setDisplay({ w: 0, h: 0 })
    setRect(null)
    setErr(null)
    dragRef.current = null
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (!open) {
      resetView()
      return
    }
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      setErr('Обрезка доступна для вставленных изображений (data URL). Внешние URL без CORS не поддерживаются.')
    } else {
      setErr(null)
    }
  }, [open, src, resetView])

  const syncLayoutFromImg = useCallback(() => {
    const el = imgRef.current
    if (!el) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    if (!cw || !ch) return
    setDisplay({ w: cw, h: ch })
    setRect((prev) => {
      if (prev && prev.w >= 4 && prev.h >= 4) {
        const x = clamp(prev.x, 0, Math.max(0, cw - 4))
        const y = clamp(prev.y, 0, Math.max(0, ch - 4))
        const w = clamp(prev.w, 4, cw - x)
        const h = clamp(prev.h, 4, ch - y)
        return { x, y, w, h }
      }
      return { x: 0, y: 0, w: cw, h: ch }
    })
  }, [])

  const onImgLoad = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => syncLayoutFromImg()))
  }, [syncLayoutFromImg])

  useEffect(() => {
    if (!open || !src) return
    const el = imgRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => syncLayoutFromImg())
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, src, syncLayoutFromImg])

  useEffect(() => {
    if (!open || !src) return
    const id = requestAnimationFrame(() => {
      syncLayoutFromImg()
      if (imgRef.current?.complete) {
        syncLayoutFromImg()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [open, src, syncLayoutFromImg])

  const displayToNatural = useCallback((r: Rect): Rect | null => {
    const el = imgRef.current
    if (!el) return null
    const dw = el.clientWidth
    const dh = el.clientHeight
    const nw = el.naturalWidth
    const nh = el.naturalHeight
    if (!dw || !dh || !nw || !nh) return null
    const sx = nw / dw
    const sy = nh / dh
    return {
      x: Math.round(r.x * sx),
      y: Math.round(r.y * sy),
      w: Math.round(r.w * sx),
      h: Math.round(r.h * sy),
    }
  }, [])

  const applyCrop = useCallback(() => {
    const img = imgRef.current
    if (!img || !img.naturalWidth || !img.naturalHeight || !rect) return
    const nr = displayToNatural(rect)
    if (!nr || nr.w < 2 || nr.h < 2) return
    const canvas = document.createElement('canvas')
    canvas.width = nr.w
    canvas.height = nr.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    try {
      ctx.drawImage(img, nr.x, nr.y, nr.w, nr.h, 0, 0, nr.w, nr.h)
      const dataUrl = canvas.toDataURL('image/png')
      onApply(dataUrl)
      onClose()
    } catch {
      setErr('Не удалось обрезать изображение.')
    }
  }, [rect, displayToNatural, onApply, onClose])

  const clientToRect = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current
    if (!img) return { x: 0, y: 0 }
    const b = img.getBoundingClientRect()
    const maxW = img.clientWidth || b.width
    const maxH = img.clientHeight || b.height
    return {
      x: clamp(clientX - b.left, 0, maxW),
      y: clamp(clientY - b.top, 0, maxH),
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (err) return
      const layer = interactRef.current
      if (!layer) return

      const img = imgRef.current
      const cw = img?.clientWidth ?? 0
      const ch = img?.clientHeight ?? 0
      if (cw < 2 || ch < 2) return

      e.preventDefault()

      const p = clientToRect(e.clientX, e.clientY)
      const full = isFullFrameRect(rect, cw, ch)

      const insideMove =
        rect &&
        !full &&
        p.x >= rect.x &&
        p.y >= rect.y &&
        p.x <= rect.x + rect.w &&
        p.y <= rect.y + rect.h

      if (insideMove && rect) {
        dragRef.current = { mode: 'move', ox: p.x, oy: p.y, start: { ...rect } }
      } else {
        dragRef.current = {
          mode: 'draw',
          ox: p.x,
          oy: p.y,
          start: { x: p.x, y: p.y, w: 0, h: 0 },
        }
        setRect({ x: p.x, y: p.y, w: 0, h: 0 })
      }

      setIsDragging(true)
      try {
        layer.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [clientToRect, rect, err],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d) return

      e.preventDefault()

      const img = imgRef.current
      const maxW = img?.clientWidth ?? 0
      const maxH = img?.clientHeight ?? 0
      if (!maxW || !maxH) return

      const p = clientToRect(e.clientX, e.clientY)

      if (d.mode === 'draw') {
        const x1 = d.ox
        const y1 = d.oy
        const x2 = p.x
        const y2 = p.y
        setRect({
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          w: Math.abs(x2 - x1),
          h: Math.abs(y2 - y1),
        })
      } else {
        const dx = p.x - d.ox
        const dy = p.y - d.oy
        let nx = d.start.x + dx
        let ny = d.start.y + dy
        nx = clamp(nx, 0, maxW - d.start.w)
        ny = clamp(ny, 0, maxH - d.start.h)
        setRect({ ...d.start, x: nx, y: ny })
      }
    },
    [clientToRect],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    setIsDragging(false)

    const layer = interactRef.current
    try {
      if (layer?.hasPointerCapture(e.pointerId)) {
        layer.releasePointerCapture(e.pointerId)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleGlobalPointerUp = (e: PointerEvent) => {
      dragRef.current = null
      setIsDragging(false)

      const layer = interactRef.current
      try {
        if (layer?.hasPointerCapture(e.pointerId)) {
          layer.releasePointerCapture(e.pointerId)
        }
      } catch {
        /* ignore */
      }
    }

    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
  }, [isDragging])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  /* clientWidth нужен до полного sync display; обновляется через onLoad/ResizeObserver */
  /* eslint-disable react-hooks/refs */
  const boxStyle =
    rect && (display.w > 0 || imgRef.current?.clientWidth)
      ? {
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
        }
      : undefined
  /* eslint-enable react-hooks/refs */

  return (
    <ModalShell open={open} onBackdropClose={onClose} ariaLabelledBy={dlgId} cardClassName="wiki-modal-card--wide">
      <h2 id={dlgId} className="wiki-modal-title">
        Обрезка изображения
      </h2>
      <p className="wiki-modal-hint">
        Зажмите и тяните область; уже выбранную рамку можно перетаскивать. Размер в тексте по-прежнему меняется ручками
        у края картинки.
      </p>
      {err ? <p className="wiki-modal-error">{err}</p> : null}
      <div ref={wrapRef} className={`wiki-crop-wrap ${isDragging ? 'wiki-crop-wrap--drag' : ''}`}>
        <img ref={imgRef} src={src} alt="Обрезка" className="wiki-crop-img" onLoad={onImgLoad} draggable={false} />
        {display.w > 0 && display.h > 0 ? (
          <div
            ref={interactRef}
            className="wiki-crop-interact"
            style={{ width: display.w, height: display.h }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ) : null}
        {boxStyle && !err ? <div className="wiki-crop-box" style={boxStyle as CSSProperties} /> : null}
      </div>
      <div className="wiki-modal-actions">
        <button
          type="button"
          className="secondary"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          data-testid="imageCropModal-cancelButton"
        >
          Отмена
        </button>
        <button
          type="button"
          className="primary"
          disabled={!!err || !rect || rect.w < 4 || rect.h < 4}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyCrop()}
          data-testid="imageCropModal-applyButton"
        >
          Применить обрезку
        </button>
      </div>
    </ModalShell>
  )
}
