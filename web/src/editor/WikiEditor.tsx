import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { SlashCommand } from './slashCommand'
import 'tippy.js/dist/tippy.css'
import 'highlight.js/styles/github.css'
import './editor.css'

const lowlight = createLowlight(common)

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    heading: { levels: [1, 2, 3] },
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'javascript',
  }),
  Placeholder.configure({
    placeholder:
      'Начните вводить содержимое или нажмите / чтобы использовать команды',
  }),
  SlashCommand,
]

export function WikiEditor() {
  const editor = useEditor({
    extensions,
    content:
      '<p></p>',
    editorProps: {
      attributes: {
        class: 'wiki-editor-prose',
        spellcheck: 'false',
      },
    },
  })

  return (
    <div className="wiki-editor-wrap">
      <EditorContent editor={editor} className="wiki-editor-root" />
    </div>
  )
}
