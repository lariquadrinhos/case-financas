import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContasBancariasPage from './page'

/**
 * Onboarding 2 — Contas Bancárias, linha "Adicionar conta".
 *
 * Mockup `1111:23` (Desktop — Onboarding 2, claro) e o gêmeo pós-onboarding
 * `921:35` (Desktop — Contas Bancárias, claro) medem a MESMA linha: os quatro
 * campos começam todos em y=0 — Campo `921:36` (x=0, h=64), Cor `921:40`
 * (x=352.5, h=54), Entidade `921:55` (x=596.5, h=64) e Campo `921:56`
 * (x=703.5, h=64). Ou seja: alinhamento pelo TOPO, com o campo "Cor" mais
 * baixo que os vizinhos (54 contra 64) e a fila de círculos em y=26.
 *
 * O Wireframe diz o mesmo em `29:51` (docs/figma/frames/
 * 29-39__onboarding-2-contas-bancarias.xml, linhas 44-77): `29:52` (h=61),
 * `36:2` (h=73), `29:56` (h=52) e `29:63` (h=61), todos em y=0.
 *
 * Com `items-end` o rodapé é que fica alinhado e a fila de 28px do "Cor" cai
 * ~10px abaixo do lugar desenhado (y≈36 em vez de y=26).
 */
vi.mock('@/features/plano-de-contas-e-patrimonio/bank-accounts', () => ({
  bankAccounts: {
    useList: () => ({ data: { data: [] }, isLoading: false, isError: false, refetch: () => {} }),
    useCreate: () => ({ mutate: () => {}, isPending: false, error: undefined }),
    usePatch: () => ({ mutate: () => {}, isPending: false, error: undefined }),
    useRemove: () => ({ mutate: () => {}, isPending: false, error: undefined }),
  },
}))

describe('Onboarding 2 — linha "Adicionar conta" (Figma 1111:23 / 921:35)', () => {
  it('alinha os quatro campos pelo topo (y=0 no frame), nunca pelo rodapé', () => {
    render(<ContasBancariasPage />)

    const row = screen.getByRole('radiogroup', { name: 'Cor' }).closest('.gap-16') as HTMLElement
    const classes = row.className.split(/\s+/)

    expect(classes).toContain('items-start')
    expect(classes).not.toContain('items-end')
  })

  it('mantém a ordem de leitura Nome da conta, Cor, Entidade, Saldo (x=0/352.5/596.5/703.5)', () => {
    render(<ContasBancariasPage />)

    const row = screen.getByRole('radiogroup', { name: 'Cor' }).closest('.gap-16') as HTMLElement
    const labels = Array.from(row.querySelectorAll('label')).map((label) =>
      label.textContent?.replace(' *', ''),
    )

    expect(labels).toEqual(['Nome da conta', 'Cor', 'Entidade', 'Saldo'])
  })
})
