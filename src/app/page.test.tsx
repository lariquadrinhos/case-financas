import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redirect } from 'next/navigation'
import { getRepositories } from '@/data'
import RootPage from './page'

/**
 * Abertura do app — PRD §5 "Roteamento de abertura" (UC19/UC20): "sem dados ou
 * onboarding incompleto leva ao onboarding, retomando do passo em que parou;
 * onboarding completo leva à Home. O progresso do onboarding precisa
 * distinguir 'não iniciado', 'adiado pela pessoa' e 'em andamento'." Repetido
 * em files_design/01 §1 e §2 ("Fazer depois (secundário, pula pra Home)").
 *
 * O Wireframe desenha as três saídas que essa regra pressupõe: "Fazer depois"
 * (116:11, Onboarding 0 — Antes de começar), "Salvar e continuar depois"
 * (29:36, nos cinco passos) e "Concluir" (29:235, só no passo 5). Antes desta
 * correção `/` ignorava os três e contava linhas em 4 tabelas, o que produzia
 * dois defeitos medidos abaixo.
 */
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

vi.mock('@/server/session', () => ({
  requireSession: vi.fn().mockResolvedValue({
    userId: 'usuario-sintetico',
    allowedEntities: ['PF', 'PJ'],
    authenticated: false,
  }),
}))

vi.mock('@/data', () => ({ getRepositories: vi.fn() }))

function withProgress(progress: unknown) {
  const zero = { count: vi.fn().mockResolvedValue(0) }
  vi.mocked(getRepositories).mockReturnValue({
    bankAccountReader: zero,
    tangibleAssetReader: zero,
    investmentReader: zero,
    liabilityReader: zero,
    onboardingProgressReader: { find: vi.fn().mockResolvedValue(progress) },
  } as unknown as ReturnType<typeof getRepositories>)
}

beforeEach(() => {
  vi.mocked(redirect).mockClear()
})

describe('Abertura do app (PRD §5 — Roteamento de abertura)', () => {
  it('PRD §5 — "não iniciado" manda pro Onboarding 0 (Figma 116:2)', async () => {
    withProgress(null)
    await RootPage()
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('PRD §5 / UC19 — "em andamento" retoma do passo em que parou, não recomeça', async () => {
    withProgress({ status: 'InProgress', lastStep: 3 })
    await RootPage()
    expect(redirect).toHaveBeenCalledWith('/onboarding/bens-materiais')
  })

  it('PRD §5 / UC20 — "adiado pela pessoa" (Figma 116:11) cai na Home, não é recapturado', async () => {
    withProgress({ status: 'Dismissed', lastStep: null })
    await RootPage()
    expect(redirect).toHaveBeenCalledWith('/inicio')
  })

  it('PRD §5 — onboarding completo (Figma 29:235) vai pra Home mesmo sem nada a declarar', async () => {
    withProgress({ status: 'Completed', lastStep: 5 })
    await RootPage()
    expect(redirect).toHaveBeenCalledWith('/inicio')
  })
})
