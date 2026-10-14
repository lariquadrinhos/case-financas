import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BANK_SUGGESTION_SWATCHES } from '@/lib/bank-account-colours'
import { ColourSwatchPicker } from './colour-swatch-picker'

/**
 * A faixa de cor da conta, redesenhada em 2026-09-11.
 *
 * O cinza saiu da 6ª vaga — ele parecia uma cor escolhível quando na verdade
 * significava "nenhuma das cinco". No lugar entrou o gatilho de um color pick,
 * e o cinza passou a ser uma das seis cores DENTRO dele.
 *
 * A faixa continua com seis vagas porque a geometria é medida: seis círculos de
 * 28 com passo 40 fecham exatos 228px em quatro frames do Figma. É por isso que
 * a cor escolhida ocupa a vaga do gatilho em vez de expulsar um banco.
 */
function montar(props: Partial<React.ComponentProps<typeof ColourSwatchPicker>> = {}) {
  const onValueChange = vi.fn()
  const { unmount } = render(
    <ColourSwatchPicker
      swatches={BANK_SUGGESTION_SWATCHES}
      value="nubank"
      onValueChange={onValueChange}
      aria-label="Cor"
      {...props}
    />,
  )
  return { onValueChange, unmount }
}

describe('Faixa de cor — o gatilho do color pick', () => {
  it('mostra as cinco de banco e um gatilho, nunca o cinza solto', () => {
    montar()
    for (const s of BANK_SUGGESTION_SWATCHES) {
      expect(screen.getByRole('radio', { name: s.label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Escolher outra cor' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Cinza' })).not.toBeInTheDocument()
  })

  /**
   * Reversão de 2026-09-11: a janela mostrava as onze cores, as de banco
   * inclusive. Olhando o desenho, a repetição poluía — e não se perde nada
   * tirando-as, porque o painel abre ABAIXO do gatilho e a faixa continua
   * visível acima dele. Quem quer Nubank tem a bolinha à vista, um clique
   * adiante, sem precisar fechar a janela.
   */
  it('o color pick abre só com as SEIS extras — as de banco não se repetem', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Escolher outra cor' }))
    for (const rotulo of ['Verde', 'Verde-azulado', 'Ouro', 'Rosa', 'Marrom', 'Cinza']) {
      expect(await screen.findByRole('radio', { name: rotulo })).toBeInTheDocument()
    }
    // Uma só: a da faixa. Nenhuma cópia dentro da janela.
    expect(screen.getAllByRole('radio', { name: 'Roxo' })).toHaveLength(1)
  })

  it('escolher uma cor fecha o color pick e avisa quem chamou', async () => {
    const user = userEvent.setup()
    const { onValueChange } = montar()
    await user.click(screen.getByRole('button', { name: 'Escolher outra cor' }))
    await user.click(await screen.findByRole('radio', { name: 'Verde' }))
    expect(onValueChange).toHaveBeenCalledWith('green')
    expect(screen.queryByRole('radio', { name: 'Ouro' })).not.toBeInTheDocument()
  })

  it('com uma cor extra escolhida, a vaga do gatilho MOSTRA a cor — nenhum banco sai', () => {
    montar({ value: 'green' })
    for (const s of BANK_SUGGESTION_SWATCHES) {
      expect(screen.getByRole('radio', { name: s.label })).toBeInTheDocument()
    }
    const gatilho = screen.getByRole('button', { name: /Verde/ })
    expect(gatilho.style.backgroundColor).toContain('--bank-account-green')
  })

  /**
   * O tracejado é o que diz "esta vaga abre o color pick", e por isso vale nos
   * DOIS estados. A primeira versão punha um `+` num selo no canto quando havia
   * cor; desenhada no Figma e olhada, ela come um pedaço visível do círculo de
   * 28 e disputa atenção com a própria cor — a única informação que a bolinha
   * existe para dar. O tracejado não gasta área nenhuma.
   */
  /**
   * O tom do `+` sobre a cor é MEDIDO, não escolhido: claro por padrão, escuro
   * só onde o claro fica abaixo de 3:1. Hoje só o ouro (2,42 contra 7,51).
   *
   * E ele não usa `--color-text-inverse`: aquele inverte com o tema, e as cores
   * de conta não invertem — um `+` que virasse escuro no modo escuro ficaria
   * ilegível sobre um fundo que continuou o mesmo.
   */
  it('o `+` sobre a cor usa o tom que o contraste manda — claro, escuro só no ouro', () => {
    const { unmount } = montar({ value: 'green' })
    const verde = screen.getByRole('button', { name: /Verde/ }).querySelector('span')
    expect(verde?.getAttribute('style')).toContain('--bank-account-plus-light')
    unmount()

    montar({ value: 'gold' })
    const ouro = screen.getByRole('button', { name: /Ouro/ }).querySelector('span')
    expect(ouro?.getAttribute('style')).toContain('--bank-account-plus-dark')
  })

  it('o gatilho é tracejado com e sem cor escolhida, e engrossa quando carrega uma', () => {
    const { unmount } = montar()
    const vazio = screen.getByRole('button', { name: 'Escolher outra cor' })
    expect(vazio.className).toContain('border-dashed')
    expect(vazio.className).toContain('var(--stroke-hairline)')
    // Sem cor, o `+` aparece.
    expect(vazio.textContent).toContain('+')
    unmount()

    montar({ value: 'green' })
    const comCor = screen.getByRole('button', { name: /Verde/ })
    expect(comCor.className).toContain('border-dashed')
    expect(comCor.className).toContain('var(--stroke-swatch-selected)')
    // O `+` fica: sem ele nada diz que a vaga abre algo — foi o que a pessoa
    // que usa o app reparou faltando, no dia em que ele saiu.
    expect(comCor.textContent).toContain('+')
  })
})
