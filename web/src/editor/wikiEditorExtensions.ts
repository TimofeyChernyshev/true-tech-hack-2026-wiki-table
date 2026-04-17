import type { AnyExtension, ResizableNodeViewDirection } from '@tiptap/core'

import StarterKit from '@tiptap/starter-kit'

import Placeholder from '@tiptap/extension-placeholder'

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'

import TextAlign from '@tiptap/extension-text-align'

import { TableCell } from '@tiptap/extension-table-cell'

import { TableHeader } from '@tiptap/extension-table-header'

import { Gapcursor } from '@tiptap/extension-gapcursor'

import Link from '@tiptap/extension-link'

import { createLowlight, common } from 'lowlight'

import { SlashCommand } from './slashCommand'

import { MwsTable, MwsTableRow } from './mwsTable'

import { MwsWorkbenchPaste } from './mwsWorkbenchPaste'

import { WikiCommentAnchor } from './wikiCommentAnchor'

import { WikiImage } from './wikiImageExtension'

const imageResizeDirections: ResizableNodeViewDirection[] = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

const lowlight = createLowlight(common)

/**
 * Расширения без Collaboration: схема для Yjs и сам редактор.
 * undoRedo отключён — историю ведёт @tiptap/extension-collaboration (Yjs).
 */
export const wikiBaseExtensions: AnyExtension[] = [

  StarterKit.configure({

    codeBlock: false,

    heading: { levels: [1, 2, 3] },

    undoRedo: false,

    underline: {},

  }),

  WikiCommentAnchor,

  CodeBlockLowlight.configure({

    lowlight,

    defaultLanguage: 'javascript',

  }),

  TextAlign.configure({

    types: ['heading', 'paragraph', 'blockquote'],

  }),

  Placeholder.configure({ placeholder: '' }),

  Gapcursor,

  Link.configure({

    openOnClick: false,

    HTMLAttributes: {

      class: 'wiki-editor-link',

      rel: 'noopener noreferrer',

    },

  }),

  WikiImage.configure({

    inline: true,

    allowBase64: true,

    resize: {

      enabled: true,

      directions: imageResizeDirections,

      minWidth: 72,

      minHeight: 48,

      alwaysPreserveAspectRatio: false,

    },

    HTMLAttributes: { class: 'wiki-editor-image' },

  }),

  MwsTable.configure({

    resizable: false,

    HTMLAttributes: { class: 'wiki-tiptap-table' },

  }),

  MwsTableRow,

  TableHeader,

  TableCell,

  MwsWorkbenchPaste,

  SlashCommand,

]
