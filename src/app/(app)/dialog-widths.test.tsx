import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cents, month } from '@/domain/core'
import { CategoryDetailModal } from './inicio/_components/modals/category-detail-modal'
import { BlockDetailModal } from './inicio/_components/modals/block-detail-modal'
import { FlowDetailModal } from './inicio/_components/modals/flow-detail-modal'
import { DiscretionaryDetailModal } from './inicio/_components/modals/discretionary-detail-modal'
import { DiscretionaryConfigureModal } from './inicio/_components/modals/discretionary-configure-modal'
import { DiscretionaryExpenseModal } from './inicio/_components/modals/discretionary-expense-modal'
import { DirecionarPendenciaModal } from './inicio/_components/modals/direcionar-pendencia-modal'
import { RateAdjustmentDialog } from '@/components/patterns/rate-adjustment-dialog'
import { VenderBemMaterialDialog } from '@/features/plano-de-contas-e-patrimonio/screens/vender-bem-material-dialog'
import { DestinarOLucroDialog } from '@/features/relatorios/destinar-o-lucro-dialog'
import type { TangibleAsset } from '@/features/plano-de-contas-e-patrimonio/types'

/**
 * Largura de cada diálogo, medida contra o frame que o desenha.
 *
 * O DEFEITO que estes testes travam: `--width-dialog: 560px` e
 * `--width-dialog-wide: 720px` não vinham de frame nenhum — o comentário do
 * token dizia "No Mockup-page frame with a bound 'Diálogo' node was available
 * to sample directly". A alegação era falsa nas duas pontas: o Mockup tem
 * frames "Diálogo" (997:2505, 994:2372, 991:2204, 1000:2886 medidos por MCP) e
 * o Wireframe local já trazia os dez contêineres de modal com largura
 * explícita. Varredura dos 130 XML de docs/figma/frames/: o produto desenha
 * SETE larguras de diálogo — 320, 380, 420, 440, 460, 480 e 575 — e nenhuma
 * delas é 560 ou 720. Os dez diálogos abaixo estavam de +80 a +280px largos.
 *
 * Cada caso cita o node id do frame de onde a medida saiu. Wireframe e Mockup
 * concordam em todas as cinco larguras que deu para conferir nas duas páginas.
 */

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const JULY = month('2026-07')

const asset: TangibleAsset = {
  id: 'bem-sintetico-1',
  name: 'Bem Sintético',
  entity: 'PF',
  recordedValue: 10_000_000,
  soldOn: null,
}

function renderDialog(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  const dialog = document.querySelector('[role="dialog"]')
  if (dialog === null) throw new Error('nenhum [role="dialog"] no DOM')
  return dialog
}

/**
 * O jsdom não carrega o Tailwind, então `getComputedStyle().maxWidth` devolve
 * vazio para uma classe utilitária: a testemunha disponível é a classe que o
 * componente pôs no elemento, e o valor por trás dela é conferido no mesmo
 * arquivo, contra tokens.css. É por isso que o teste casa token E valor.
 */
function expectWidth(dialog: Element, token: string, width: number) {
  expect(dialog.className).toContain(`max-w-[var(${token})]`)
  expect(tokensCss).toMatch(new RegExp(`${token}:\\s*${width}px;`))
}

const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

describe('largura de diálogo — uma por frame', () => {
  it('Figma 345:1252 · Mockup 1000:2643 — Gastei um Valor mede 320 de largura', () => {
    const dialog = renderDialog(
      <DiscretionaryExpenseModal open onOpenChange={() => {}} month={JULY} />,
    )
    expectWidth(dialog, '--width-dialog-prompt', 320)
  })

  it('Figma 192:2 · Mockup 1000:2886 — Configurar Consumo Livre mede 380 de largura', () => {
    const dialog = renderDialog(
      <DiscretionaryConfigureModal open onOpenChange={() => {}} current={null} />,
    )
    expectWidth(dialog, '--width-dialog-compact', 380)
  })

  it('Figma 192:15 — Detalhe do Consumo Livre mede 420 de largura', () => {
    const dialog = renderDialog(
      <DiscretionaryDetailModal open onOpenChange={() => {}} month={JULY} config={null} />,
    )
    expectWidth(dialog, '--width-dialog-detail', 420)
  })

  it('Figma 103:22 — Adicionar Direcionamento mede 440 de largura', () => {
    const dialog = renderDialog(
      <DirecionarPendenciaModal open onOpenChange={() => {}} selection={null} />,
    )
    expectWidth(dialog, '--width-dialog-allocation', 440)
  })

  it('Figma 99:39 · Mockup 991:2204 — Vender Bem Material mede 460 de largura', () => {
    const dialog = renderDialog(
      <VenderBemMaterialDialog asset={asset} open onOpenChange={() => {}} />,
    )
    expectWidth(dialog, '--width-dialog-form', 460)
  })

  it('Figma 94:39 · Mockup 994:2372 — Registrar Reajuste de Juros mede 460 de largura', () => {
    const dialog = renderDialog(
      <RateAdjustmentDialog
        open
        onOpenChange={() => {}}
        liabilityId="passivo-sintetico-1"
        liabilityName="Passivo Sintético"
        currentRate={0.0085}
        plannedCountFrom={() => 0}
        onSuccess={() => {}}
      />,
    )
    expectWidth(dialog, '--width-dialog-form', 460)
  })

  it('Figma 183:2 — Detalhe da Categoria mede 480 de largura', () => {
    const dialog = renderDialog(
      <CategoryDetailModal open onOpenChange={() => {}} category={null} month={JULY} />,
    )
    expectWidth(dialog, '--width-dialog-narrow', 480)
  })

  it('Figma 189:23 — Detalhe do Bloco mede 480 de largura', () => {
    const dialog = renderDialog(<BlockDetailModal open onOpenChange={() => {}} block={null} />)
    expectWidth(dialog, '--width-dialog-narrow', 480)
  })

  it('Figma 349:252 — Detalhe do Fluxo mede 480 de largura', () => {
    const dialog = renderDialog(<FlowDetailModal open onOpenChange={() => {}} selection={null} />)
    expectWidth(dialog, '--width-dialog-narrow', 480)
  })

  it('Figma 27:29 · Mockup 997:2505 — Destinar o Lucro mede 575 de largura', () => {
    const dialog = renderDialog(
      <DestinarOLucroDialog
        month={JULY}
        netProfit={cents(1_040_000)}
        open
        onOpenChange={() => {}}
      />,
    )
    expectWidth(dialog, '--width-dialog-wide', 575)
  })

  it('nenhum diálogo usa uma largura que o Figma não desenha (560/720)', () => {
    // Declarações, não menções: o comentário do bloco cita 560/720 de
    // propósito, para que ninguém os reintroduza achando que eram medidos.
    const declarations = tokensCss.match(/^\s*--width-dialog[\w-]*:.*$/gm) ?? []
    expect(declarations.join('\n')).not.toMatch(/(?:560|720)px/)
    // As sete do Figma, mais UMA exceção declarada: `--width-dialog-list`, do
    // diálogo "Categorizar" (PRD v7.46, 2026-09-29), que não existe no Figma e
    // diz isso no próprio comentário do token. A guarda continua valendo contra
    // o defeito que ela trava — uma largura inventada passando por medida.
    const fromFigma = declarations.filter((d) => !d.includes('--width-dialog-list'))
    expect(fromFigma).toHaveLength(7)
    expect(tokensCss).toMatch(/Categorizar lançamentos \(PRD v7\.46\) — não está no Figma/)
  })
})
