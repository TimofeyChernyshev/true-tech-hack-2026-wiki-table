import type { Editor, Range } from '@tiptap/core'

export type SlashItem = {
  title: string
  subtitle: string
  /** для фильтра по запросу */
  search: string
  run: (opts: { editor: Editor; range: Range }) => void
}

const allItems = (): SlashItem[] => [
  {
    title: 'Текст',
    subtitle: 'Обычный абзац',
    search: 'text paragraph параграф',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
  },
  {
    title: 'Заголовок 1',
    subtitle: 'Крупный заголовок',
    search: 'h1 heading заголовок',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
  },
  {
    title: 'Заголовок 2',
    subtitle: 'Подзаголовок',
    search: 'h2 heading заголовок',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
  },
  {
    title: 'Заголовок 3',
    subtitle: 'Меньший заголовок',
    search: 'h3 heading заголовок',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
  },
  {
    title: 'Маркированный список',
    subtitle: 'Список с точками',
    search: 'bullet list список',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Нумерованный список',
    subtitle: 'Список с номерами',
    search: 'ordered numbered список',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Цитата',
    subtitle: 'Выделенная цитата',
    search: 'quote blockquote цитата',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Блок кода',
    subtitle: 'Подсветка синтаксиса (lowlight)',
    search: 'code блок код javascript ts go',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock({ language: 'javascript' }).run()
    },
  },
  {
    title: 'Разделитель',
    subtitle: 'Горизонтальная линия',
    search: 'hr divider line разделитель',
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    title: 'Таблица',
    subtitle: 'Сетка 3×3 с заголовком',
    search: 'table grid таблица',
    run: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
    },
  },
  {
    title: 'Изображение',
    subtitle: 'Вставить по ссылке',
    search: 'image img картинка фото',
    run: ({ editor, range }) => {
      const url = window.prompt('URL изображения', 'https://')
      if (!url?.trim()) return
      editor.chain().focus().deleteRange(range).setImage({ src: url.trim() }).run()
    },
  },
]

export function filterSlashItems(_editor: Editor, query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  const items = allItems()
  if (!q) return items
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.search.toLowerCase().includes(q),
  )
}
