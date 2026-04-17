import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModalShell } from './ModalShell'

describe('ModalShell', () => {
  it('не рендерит диалог при open=false', () => {
    const onClose = vi.fn()
    render(
      <ModalShell open={false} onBackdropClose={onClose} ariaLabelledBy="t">
        <h2 id="t">Title</h2>
      </ModalShell>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('рендерит диалог при open=true', () => {
    const onClose = vi.fn()
    render(
      <ModalShell open onBackdropClose={onClose} ariaLabelledBy="t2">
        <h2 id="t2">Title</h2>
      </ModalShell>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('modalShell-backdropClose')).toBeInTheDocument()
  })
})
