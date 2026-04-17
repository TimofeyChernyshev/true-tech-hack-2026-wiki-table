import { useCallback, useState } from 'react'

import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'

import { LinkHrefModal } from './LinkHrefModal'

type Props = {
  editor: Editor | null
}

export function WikiBubbleMenu({ editor }: Props) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInitial, setLinkInitial] = useState('https://')

  const openLinkModal = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    setLinkInitial(prev && prev.length ? prev : 'https://')
    setLinkOpen(true)
  }, [editor])

  if (!editor) return null

  return (
    <>
      <LinkHrefModal
        open={linkOpen}
        initialHref={linkInitial}
        onClose={() => setLinkOpen(false)}
        onSave={(href) => {
          editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
        }}
        onRemove={() => {
          editor.chain().focus().extendMarkRange('link').unsetLink().run()
        }}
      />
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
          if (ed.isActive('image')) return false
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
          onClick={() => openLinkModal()}
        >
          🔗
        </button>
      </BubbleMenu>
    </>
  )
}

