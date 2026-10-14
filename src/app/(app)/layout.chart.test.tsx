import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import AppLayout from './layout'

vi.mock('@/components/patterns/sidebar', () => ({ Sidebar: () => null }))

/**
 * Toda tela autenticada precisa do plano de contas, e até 2026-09-14 ele era
 * semeado em UM lugar só: a visita a `/onboarding/plano-de-contas`.
 *
 * O caminho que quebrava não é obscuro, é DESENHADO: o "Fazer depois" do
 * Onboarding 0 (Wireframe `116:11`) leva direto para a Home — e a Home, o DRE,
 * a Evolução Mensal e os Indicadores todos pedem relatório. Sem blocos,
 * `requireBlock` lança `income_statement.missing_block` e as quatro telas
 * respondem 500. Medido em 2026-09-12 contra o banco de desenvolvimento, que
 * tinha 1 usuário e 0 blocos.
 *
 * Os 10 blocos não são cadastro que a pessoa digita — são fixos para todo mundo
 * (PRD §1 e §9.5, "os 10 blocos são fixos"). O onboarding existe para EDITAR as
 * categorias dentro deles, não para criar a estrutura. Por isso a garantia mora
 * no layout, que é por onde toda tela passa, e não numa das telas.
 */
describe('(app)/layout — garante o plano de contas antes de qualquer tela', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('semeia os 10 blocos quando a pessoa nunca passou pelo onboarding', async () => {
    const { statementBlockReader, categoryReader } = handle.repositories
    expect(await statementBlockReader.list(TEST_USER_ID)).toHaveLength(0)

    await AppLayout({ children: null })

    expect(await statementBlockReader.list(TEST_USER_ID)).toHaveLength(10)
    expect((await categoryReader.list(TEST_USER_ID)).length).toBeGreaterThan(0)
  })

  it('não reescreve um plano que a pessoa já editou', async () => {
    const { statementBlockReader, categoryReader, categoryWriter } = handle.repositories
    await AppLayout({ children: null })

    const antes = await categoryReader.list(TEST_USER_ID)
    const renomeada = { ...antes[0]!, name: 'Nome Escolhido Pela Pessoa' }
    await categoryWriter.replace(TEST_USER_ID, renomeada)

    await AppLayout({ children: null })

    expect(await statementBlockReader.list(TEST_USER_ID)).toHaveLength(10)
    const depois = await categoryReader.list(TEST_USER_ID)
    expect(depois.find((c) => c.id === renomeada.id)?.name).toBe('Nome Escolhido Pela Pessoa')
  })
})
