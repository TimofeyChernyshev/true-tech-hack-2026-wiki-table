import { useCallback, useId, useRef, useState } from 'react'

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif'
const MAX_BYTES = 12 * 1024 * 1024

function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`
}

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (dataUrl: string, widthHint?: number) => void
}

export function ImageInsertModal({ open, onClose, onConfirm }: Props) {
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [naturalW, setNaturalW] = useState(0)
  const [naturalH, setNaturalH] = useState(0)
  const revokeRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current)
      revokeRef.current = null
    }
    setFile(null)
    setPreview(null)
    setErr(null)
    setNaturalW(0)
    setNaturalH(0)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const onPick = useCallback(
    (f: File | null) => {
      setErr(null)
      if (!f) {
        reset()
        return
      }
      const ok =
        f.type === 'image/png' ||
        f.type === 'image/jpeg' ||
        f.type === 'image/jpg' ||
        f.type === 'image/gif'
      if (!ok) {
        setErr('Допустимы только PNG, JPG и GIF.')
        return
      }
      if (f.size > MAX_BYTES) {
        setErr('Файл слишком большой (макс. 12 МБ).')
        return
      }
      if (revokeRef.current) URL.revokeObjectURL(revokeRef.current)
      const url = URL.createObjectURL(f)
      revokeRef.current = url
      setFile(f)
      setPreview(url)
    },
    [reset],
  )

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget
    setNaturalW(el.naturalWidth)
    setNaturalH(el.naturalHeight)
  }, [])

  const confirm = useCallback(() => {
    if (!file || !preview) return
    const reader = new FileReader()
    reader.onload = () => {
      const r = reader.result
      if (typeof r !== 'string') return
      const w = naturalW > 720 ? 720 : naturalW || undefined
      onConfirm(r, w)
      handleClose()
    }
    reader.readAsDataURL(file)
  }, [file, preview, naturalW, onConfirm, handleClose])

  if (!open) return null

  return (
    <div className="wiki-modal-root" role="dialog" aria-modal="true" aria-labelledby={inputId + '-title'}>
      <button type="button" className="wiki-modal-backdrop" aria-label="Закрыть" onClick={handleClose} />
      <div className="wiki-modal-card">
        <h2 id={inputId + '-title'} className="wiki-modal-title">
          Вставка изображения
        </h2>
        <p className="wiki-modal-hint">Форматы: PNG, JPG, GIF</p>
        <label className="wiki-modal-file-label">
          <span className="wiki-modal-file-btn">Выбрать файл</span>
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="wiki-modal-file-input"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? (
          <p className="wiki-modal-meta">
            {file.name} · {formatBytes(file.size)}
            {naturalW > 0 ? ` · ${naturalW}×${naturalH} px` : null}
          </p>
        ) : null}
        {err ? <p className="wiki-modal-error">{err}</p> : null}
        {preview ? (
          <div className="wiki-modal-preview-wrap">
            <img
              src={preview}
              alt=""
              className="wiki-modal-preview-img"
              onLoad={onImgLoad}
            />
          </div>
        ) : null}
        <div className="wiki-modal-actions">
          <button type="button" className="secondary" onClick={handleClose}>
            Отмена
          </button>
          <button type="button" className="primary" disabled={!file} onClick={confirm}>
            Вставить
          </button>
        </div>
      </div>
    </div>
  )
}
