import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DocumentPageHeader } from './DocumentPageHeader'

describe('DocumentPageHeader', () => {
  it('отображает заголовок и подзаголовок', () => {
    const onTitle = vi.fn()
    const onSubtitle = vi.fn()
    const onAutosave = vi.fn()
    const onToggle = vi.fn()

    render(
      <DocumentPageHeader
        pagesSidebarOpen
        onToggleSidebar={onToggle}
        title="Заголовок"
        onTitleChange={onTitle}
        subtitle="Подзаголовок"
        onSubtitleChange={onSubtitle}
        autoSaveMs={10000}
        onAutoSaveMsChange={onAutosave}
      />,
    )

    expect(screen.getByTestId('documentPage-titleInput')).toHaveValue('Заголовок')
    expect(screen.getByTestId('documentPage-subtitleInput')).toHaveValue('Подзаголовок')

    fireEvent.change(screen.getByTestId('documentPage-titleInput'), { target: { value: 'Новый' } })
    expect(onTitle).toHaveBeenCalledWith('Новый')

    fireEvent.change(screen.getByTestId('documentPage-autosaveSelect'), { target: { value: '3000' } })
    expect(onAutosave).toHaveBeenCalledWith(3000)
  })
})
