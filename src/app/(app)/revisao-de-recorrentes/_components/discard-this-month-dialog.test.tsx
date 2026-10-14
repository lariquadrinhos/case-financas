/**
 * "Descartar" de uma recorrência pergunta o alcance (pedido do dono,
 * 2026-10-01: "o descartar para recorrência também deveria mostrar só esse mês
 * ou a série completa"). A parcela de Passivo não tem a escolha.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscardThisMonthDialog } from './discard-this-month-dialog'

function renderDialog(offerWholeSeries: boolean) {
  const onConfirm = vi.fn()
  render(
    <DiscardThisMonthDialog
      open
      onOpenChange={() => {}}
      title="Recorrência sintética"
      isPending={false}
      isError={false}
      onConfirm={onConfirm}
      offerWholeSeries={offerWholeSeries}
    />,
  )
  return onConfirm
}

describe('DiscardThisMonthDialog — só este mês ou a série completa', () => {
  it('numa recorrência, "Só este mês" vem marcado e confirma sem encerrar a série', async () => {
    const user = userEvent.setup()
    const onConfirm = renderDialog(true)
    expect(screen.getByRole('radio', { name: 'Só este mês' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onConfirm).toHaveBeenCalledWith(false)
  })

  it('dono 2026-10-06 — "Deste mês em diante" encerra a série e diz que os anteriores ficam', async () => {
    const user = userEvent.setup()
    const onConfirm = renderDialog(true)
    // Era "A série completa (encerra a recorrência)": o efeito sempre foi este
    // mês e os seguintes, e o nome sugeria apagar os anteriores também.
    await user.click(
      screen.getByRole('radio', { name: 'Deste mês em diante (mantém os anteriores)' }),
    )
    expect(screen.getByText(/os meses anteriores continuam/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onConfirm).toHaveBeenCalledWith(true)
  })

  it('numa parcela de Passivo não há escolha', () => {
    renderDialog(false)
    expect(screen.queryByRole('radio')).toBeNull()
  })
})
