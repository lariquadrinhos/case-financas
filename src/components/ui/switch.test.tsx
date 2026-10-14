import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Switch } from './switch'

describe('Switch — hover (2026-10-01)', () => {
  it('o trilho escurece no hover, para dizer que é clicável', () => {
    render(<Switch aria-label="Interruptor" />)
    expect(screen.getByRole('switch', { name: 'Interruptor' }).className).toContain(
      'hover:opacity-',
    )
  })
})
