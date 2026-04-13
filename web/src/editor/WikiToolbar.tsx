import { useCallback, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'

import { LinkHrefModal } from './LinkHrefModal'

type Props = {
  editor: Editor | null
  onInsertImageFile?: () => void
  onOpenComments?: () => void
  /** Вставка таблицы по ссылке MWS Workbench (отдельно от обычной таблицы). */
  onOpenMwsTable?: () => void
  onOpenCommentHistory?: () => void
  onOpenCommentAccess?: () => void
  onOpenTimeMachine?: () => void
}

function TbBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`tb-btn${active ? ' tb-btn-on' : ''}`}
      disabled={disabled}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function WikiToolbar({
  editor,
  onInsertImageFile,
  onOpenComments,
  onOpenMwsTable,
  onOpenCommentHistory,
  onOpenCommentAccess,
  onOpenTimeMachine,
}: Props) {
  const ed = editor

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInitial, setLinkInitial] = useState('https://')

  const openLinkModal = useCallback(() => {
    if (!ed) return
    const prev = ed.getAttributes('link').href as string | undefined
    setLinkInitial(prev && prev.length ? prev : 'https://')
    setLinkOpen(true)
  }, [ed])

  return (
    <div className="wiki-toolbar" role="toolbar" aria-label="Форматирование">
      {ed ? (
        <LinkHrefModal
          open={linkOpen}
          initialHref={linkInitial}
          onClose={() => setLinkOpen(false)}
          onSave={(href) => {
            ed.chain().focus().extendMarkRange('link').setLink({ href }).run()
          }}
          onRemove={() => {
            ed.chain().focus().extendMarkRange('link').unsetLink().run()
          }}
        />
      ) : null}
      <div className="wiki-toolbar-nav">
        <button
          type="button"
          className="tb-nav"
          disabled={!ed || !ed.can().undo()}
          title="Отменить (Ctrl+Z)"
          aria-label="Отменить"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!ed) return
            ed.chain().focus().undo().run()
          }}
        >
          ↶
        </button>
        <button
          type="button"
          className="tb-nav"
          disabled={!ed || !ed.can().redo()}
          title="Повторить (Ctrl+Y / Ctrl+Shift+Z)"
          aria-label="Повторить"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!ed) return
            ed.chain().focus().redo().run()
          }}
        >
          ↷
        </button>
      </div>
      <div className="wiki-toolbar-sep" aria-hidden />
      <div className="wiki-toolbar-inner">
        <div className="tb-group">
          <TbBtn
            title="Жирный (Ctrl+B)"
            active={ed?.isActive('bold')}
            disabled={!ed || !ed.can().toggleBold()}
            onClick={() => ed?.chain().focus().toggleBold().run()}
          >
            B
          </TbBtn>
          <TbBtn
            title="Курсив (Ctrl+I)"
            active={ed?.isActive('italic')}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleItalic().run()}
          >
            I
          </TbBtn>
          <TbBtn
            title="Подчёркнутый (Ctrl+U)"
            active={ed?.isActive('underline')}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleUnderline().run()}
          >
            U
          </TbBtn>
          <TbBtn
            title="Зачёркнутый"
            active={ed?.isActive('strike')}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleStrike().run()}
          >
            S
          </TbBtn>
        </div>
        <div className="tb-group tb-group--compact" role="group" aria-label="Выравнивание">
          <TbBtn
            title="Влево (Ctrl+L)"
            active={ed?.isActive({ textAlign: 'left' })}
            disabled={!ed}
            onClick={() => ed?.chain().focus().setTextAlign('left').run()}
          >
            L
          </TbBtn>
          <TbBtn
            title="По центру (Ctrl+E)"
            active={ed?.isActive({ textAlign: 'center' })}
            disabled={!ed}
            onClick={() => ed?.chain().focus().setTextAlign('center').run()}
          >
            C
          </TbBtn>
          <TbBtn
            title="Вправо (Ctrl+R, не обновляет страницу)"
            active={ed?.isActive({ textAlign: 'right' })}
            disabled={!ed}
            onClick={() => ed?.chain().focus().setTextAlign('right').run()}
          >
            R
          </TbBtn>
          <TbBtn
            title="По ширине (Ctrl+J)"
            active={ed?.isActive({ textAlign: 'justify' })}
            disabled={!ed}
            onClick={() => ed?.chain().focus().setTextAlign('justify').run()}
          >
            J
          </TbBtn>
        </div>
        <div className="tb-group">
          <TbBtn
            title="Заголовок 1"
            active={ed?.isActive('heading', { level: 1 })}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            H1
          </TbBtn>
          <TbBtn
            title="Заголовок 2"
            active={ed?.isActive('heading', { level: 2 })}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </TbBtn>
          <TbBtn
            title="Заголовок 3"
            active={ed?.isActive('heading', { level: 3 })}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </TbBtn>
        </div>
        <div className="tb-group">
          <TbBtn
            title="Маркированный список"
            active={ed?.isActive('bulletList')}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleBulletList().run()}
          >
            •
          </TbBtn>
          <TbBtn
            title="Нумерованный список"
            active={ed?.isActive('orderedList')}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleOrderedList().run()}
          >
            1.
          </TbBtn>
          <TbBtn
            title="Цитата"
            active={ed?.isActive('blockquote')}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleBlockquote().run()}
          >
            ❝
          </TbBtn>
        </div>
        <div className="tb-group">
          <TbBtn
            title="Блок кода"
            active={ed?.isActive('codeBlock')}
            disabled={!ed}
            onClick={() => ed?.chain().focus().toggleCodeBlock({ language: 'javascript' }).run()}
          >
            {'</>'}
          </TbBtn>
          <TbBtn
            title="Горизонтальная линия"
            disabled={!ed}
            onClick={() => ed?.chain().focus().setHorizontalRule().run()}
          >
            —
          </TbBtn>
          <TbBtn
            title="Таблица 3×3"
            disabled={!ed}
            onClick={() =>
              ed?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            ⊞
          </TbBtn>
          <button
            type="button"
            className="tb-btn tb-btn-mws"
            disabled={!ed || !onOpenMwsTable}
            title="Таблица из MWS по ссылке workbench (tables.mws.ru)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onOpenMwsTable?.()}
          >
            MWS
          </button>
        </div>
        <div className="tb-group">
          <TbBtn
            title="Ссылка"
            active={ed?.isActive('link')}
            disabled={!ed}
            onClick={() => openLinkModal()}
          >
            🔗
          </TbBtn>
          <TbBtn
            title="Изображение (файл PNG/JPG/GIF)"
            disabled={!ed || !onInsertImageFile}
            onClick={() => onInsertImageFile?.()}
          >
            🖼
          </TbBtn>
        </div>
      </div>

      <div className="wiki-toolbar-side" role="group" aria-label="Комментарии и версии">
        {onOpenComments ? (
          <button
            type="button"
            className="tb-side"
            title="Комментарии"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenComments}
          >
            💬
          </button>
        ) : null}
        {onOpenCommentHistory ? (
          <button
            type="button"
            className="tb-side"
            title="История комментариев"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenCommentHistory}
          >
            📜
          </button>
        ) : null}
        {onOpenCommentAccess ? (
          <button
            type="button"
            className="tb-side"
            title="Доступ к комментариям"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenCommentAccess}
          >
            🔐
          </button>
        ) : null}
        {onOpenTimeMachine ? (
          <button
            type="button"
            className="tb-side"
            title="Машина времени"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenTimeMachine}
          >
            🕐
          </button>
        ) : null}
      </div>
    </div>
  )
}
