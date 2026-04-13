import { ResizableNodeView } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import Image from '@tiptap/extension-image'

/**
 * ResizableNodeView в @tiptap/extension-image не копирует width/height из узла в el.style при
 * onUpdate (только onResize/onCommit с ручками). Команды и setNodeMarkup обновляют attrs,
 * но картинка на экране меняется лишь после перезагрузки — синхронизируем DOM здесь.
 */
function syncImageDomFromNode(el: HTMLImageElement, node: PmNode) {
  const attrs = node.attrs as {
    src?: string | null
    alt?: string | null
    title?: string | null
    width?: number | string | null
    height?: number | string | null
  }
  const { src, alt, title, width, height } = attrs

  if (typeof src === 'string' && src.length > 0 && el.getAttribute('src') !== src) {
    el.setAttribute('src', src)
  }

  if (alt != null && String(alt) !== '') {
    el.setAttribute('alt', String(alt))
  } else {
    el.removeAttribute('alt')
  }

  if (title != null && String(title) !== '') {
    el.setAttribute('title', String(title))
  } else {
    el.removeAttribute('title')
  }

  const w = width != null && width !== '' ? Number(width) : NaN
  const h = height != null && height !== '' ? Number(height) : NaN

  if (Number.isFinite(w) && w > 0) {
    el.style.width = `${w}px`
  } else {
    el.style.removeProperty('width')
  }

  if (Number.isFinite(h) && h > 0) {
    el.style.height = `${h}px`
  } else {
    el.style.removeProperty('height')
  }
}

export const WikiImage = Image.extend({
  addNodeView() {
    if (!this.options.resize || !this.options.resize.enabled || typeof document === 'undefined') {
      return null
    }

    const { directions, minWidth, minHeight, alwaysPreserveAspectRatio } = this.options.resize

    return ({ node, getPos, HTMLAttributes, editor }) => {
      const el = document.createElement('img')

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value != null) {
          switch (key) {
            case 'width':
            case 'height':
              break
            default:
              el.setAttribute(key, String(value))
              break
          }
        }
      })

      el.src = HTMLAttributes.src

      const nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          el.style.width = `${width}px`
          el.style.height = `${height}px`
        },
        onCommit: (width, height) => {
          const pos = getPos()
          if (pos === undefined) {
            return
          }
          editor.chain().focus().setNodeSelection(pos).updateAttributes('image', { width, height }).run()
        },
        onUpdate: (updatedNode) => {
          if (updatedNode.type !== node.type) {
            return false
          }
          syncImageDomFromNode(el, updatedNode)
          return true
        },
        options: {
          directions,
          min: {
            width: minWidth,
            height: minHeight,
          },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
        },
      })

      const dom = nodeView.dom as HTMLElement

      dom.style.visibility = 'hidden'
      dom.style.pointerEvents = 'none'

      const reveal = () => {
        const pos = getPos()
        const fresh = pos != null ? editor.state.doc.nodeAt(pos) : null
        syncImageDomFromNode(el, fresh ?? node)
        dom.style.visibility = ''
        dom.style.pointerEvents = ''
      }

      el.onload = () => reveal()
      syncImageDomFromNode(el, node)
      if (el.complete) {
        reveal()
      } else {
        syncImageDomFromNode(el, node)
      }

      return nodeView
    }
  },
})
