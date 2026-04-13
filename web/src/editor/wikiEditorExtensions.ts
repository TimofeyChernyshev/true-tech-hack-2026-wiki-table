import type { AnyExtension } from '@tiptap/core'

import StarterKit from '@tiptap/starter-kit'

import Placeholder from '@tiptap/extension-placeholder'

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'

import TextAlign from '@tiptap/extension-text-align'

import { TableCell } from '@tiptap/extension-table-cell'

import { TableHeader } from '@tiptap/extension-table-header'

import { Gapcursor } from '@tiptap/extension-gapcursor'

import Link from '@tiptap/extension-link'

import Image from '@tiptap/extension-image'

import { createLowlight, common } from 'lowlight'

import { SlashCommand } from './slashCommand'

import { MwsTable, MwsTableRow } from './mwsTable'

import { MwsWorkbenchPaste } from './mwsWorkbenchPaste'

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

    openOnClick: true,

    HTMLAttributes: {

      class: 'wiki-editor-link',

      rel: 'noopener noreferrer',

    },

  }),

  Image.configure({

    allowBase64: true,

    resize: {

      enabled: true,

      minWidth: 72,

      minHeight: 48,

      alwaysPreserveAspectRatio: true,

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
