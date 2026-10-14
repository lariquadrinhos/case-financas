import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmActionButton } from './confirm-action-button'

/**
 * Figma `34:2` › `34:31` ("③ Descartar") › painel `34:34`, o único painel de
 * confirmação desenhado no arquivo inteiro:
 *   34:35 título-pergunta · 34:36 consequência ·
 *   34:37 botões, `34:38` "Cancelar" em x=0 ANTES de `34:40` "Descartar" em x=92.
 * files_design/02-log-de-decisoes-de-ux.md :91 manda as linhas de item das 4
 * telas de Patrimônio usarem "o mesmo estilo visual já usado na Revisão de
 * Recorrentes"; :92 fixa "Descartar" como termo único (nunca "Confirmar").
 *
 * O que este teste pega, e que o desenho anterior (dois botões `text` soltos
 * revelados na própria linha por `useState`) não fazia: não havia diálogo
 * nenhum, não havia título-pergunta, e a ordem era Descartar → Cancelar.
 */
describe('ConfirmActionButton — Figma 34:34 (a confirmação de "Descartar")', () => {
  it('abre o painel 34:34 com o título-pergunta 34:35, e não um segundo estado do botão da linha', async () => {
    const user = userEvent.setup()
    render(<ConfirmActionButton label="Descartar" itemName="Conta Corrente" onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Descartar "Conta Corrente"?')).toBeInTheDocument()
  })

  it('desenha 34:38 "Cancelar" ANTES de 34:40 "Descartar", nunca a ação destrutiva primeiro', async () => {
    const user = userEvent.setup()
    render(<ConfirmActionButton label="Descartar" itemName="Conta Corrente" onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    const dialog = await screen.findByRole('dialog')
    const labels = within(dialog)
      .getAllByRole('button')
      .map((node) => node.textContent)
    expect(labels).toEqual(['Cancelar', 'Descartar'])
  })

  it('files_design/02 :92 — o rótulo de confirmação é "Descartar", nunca "Confirmar"', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmActionButton label="Descartar" itemName="Academia" onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Confirmar' })).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Style guide 521:463 — a ação destrutiva não é botão "Texto"; é o par secundário/primário do 34:37', async () => {
    const user = userEvent.setup()
    render(<ConfirmActionButton label="Descartar" itemName="Academia" onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Descartar' })
    expect(confirm.className).toContain('bg-surface-inverse')
    expect(confirm.className).not.toContain('text-ink-negative')
  })

  it('34:36 — a linha de consequência aparece quando a fonte de design a escreve', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmActionButton
        label="Descartar"
        itemName="Academia"
        consequence="A série continua normalmente a partir do mês seguinte."
        onConfirm={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('A série continua normalmente a partir do mês seguinte.'),
    ).toBeInTheDocument()
  })

  /**
   * A recusa era MUDA, e isso foi medido lendo as quatro telas de Patrimônio e
   * este componente: `remove.error` não era renderizado em lugar nenhum. Três
   * dos quatro descartes podem voltar 409 (`*.in_use`, a FK RESTRICT traduzida
   * em src/api/http.ts), e o que a pessoa via era o diálogo fechar e a linha
   * continuar na tabela, sem uma palavra.
   *
   * O `detail` do 409 não serve de mensagem: `src/api/handler.ts` manda sempre
   * "A operação não pôde ser concluída.", genérico de propósito, porque o corpo
   * do problema não carrega dado da pessoa. Quem sabe o que bloqueia é a tela,
   * e por isso a frase vem por prop.
   */
  it('mantém o diálogo aberto e diz o motivo quando o descarte é recusado', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmActionButton
        label="Descartar"
        itemName="Nubank PF"
        blockedMessage="Não dá pra descartar: ainda há lançamento apontando para esta conta."
        onConfirm={() => Promise.reject(new Error('bank_accounts.in_use'))}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }))

    expect(
      await within(dialog).findByText(
        'Não dá pra descartar: ainda há lançamento apontando para esta conta.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fecha o diálogo quando o descarte dá certo', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmActionButton
        label="Descartar"
        itemName="Nubank PF"
        onConfirm={() => Promise.resolve()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
