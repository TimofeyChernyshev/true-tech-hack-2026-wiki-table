import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { SlashItem } from './slashItems'

export type SlashMenuRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export type SlashMenuProps = Pick<
  SuggestionProps<SlashItem, SlashItem>,
  'items' | 'command'
>

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  function SlashMenu({ items, command }, ref) {
    const [selected, setSelected] = useState(0)

    useEffect(() => {
      // Сброс выделения при смене списка slash-команд (фильтр по запросу)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренный сброс UI при изменении items
      setSelected(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSelected((i) => (i + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSelected((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          const item = items[selected]
          if (item) command(item)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="slash-menu slash-menu--empty" role="listbox">
          <div className="slash-menu-empty">Нет команд</div>
        </div>
      )
    }

    return (
      <div className="slash-menu" role="listbox">
        {items.map((item, index) => (
          <button
            key={`${item.title}-${index}`}
            type="button"
            role="option"
            aria-selected={index === selected}
            className={`slash-menu-item${index === selected ? ' is-active' : ''}`}
            onClick={() => command(item)}
            onMouseEnter={() => setSelected(index)}
          >
            <span className="slash-menu-item-title">{item.title}</span>
            <span className="slash-menu-item-sub">{item.subtitle}</span>
          </button>
        ))}
      </div>
    )
  },
)
