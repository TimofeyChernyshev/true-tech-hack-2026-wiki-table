import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'

type Props = {
  editor: Editor | null
}

export function WikiBubbleMenu({ editor }: Props) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        onHide: () => undefined,
      }}
      shouldShow={({ editor: ed, state }) => {
        const { selection } = state
        if (selection.empty) return false
        if (ed.isActive('codeBlock')) return false
        return true
      }}
      className="wiki-bubble-menu"
    >
      <button
        type="button"
        className="wiki-bubble-btn"
        title="Жирный"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </button>
      <button
        type="button"
        className="wiki-bubble-btn"
        title="Курсив"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </button>
      <button
        type="button"
        className="wiki-bubble-btn"
        title="Подчёркнутый"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        U
      </button>
      <button
        type="button"
        className="wiki-bubble-btn"
        title="Зачёркнутый"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        S
      </button>
      <button
        type="button"
        className="wiki-bubble-btn"
        title="Ссылка"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('URL ссылки', prev ?? 'https://')
          if (url === null) return
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }}
      >
        🔗
      </button>
    </BubbleMenu>
  )
}
