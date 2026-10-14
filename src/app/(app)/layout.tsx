import { Sidebar } from '@/components/patterns/sidebar'
import { requireSession } from '@/server/session'
import { ensureChartOfAccountsSeeded } from '@/features/onboarding/seed-chart'
import { OpenFinanceAutoSync } from '@/features/open-finance/open-finance-auto-sync'

/**
 * Shell of every authenticated screen — sidebar de 272px (Mockup, nós 936:1544
 * e 749:2 "Barra lateral") + área de conteúdo no restante, com recuo de 40px
 * nas laterais e no topo.
 *
 * Os 40 saem da Mockup, não do Wireframe: a área à direita da barra lateral é
 * `549:70` (Início dashboard) e `397:26` "Conteúdo" (DRE), ambas x=272 w=1168,
 * e nas duas TODO filho está em x=40 com width=1088 — 272 + 40 + 1088 + 40 =
 * 1440. Era `px-48` casado com `--width-content-max: 1066px`, o par do
 * Wireframe (barra lateral de 278: 278 + 48 + 1066 + 48 = 1440); com a barra
 * lateral já corrigida para 272 esse par deixava 6px de sobra à direita.
 *
 * A área de conteúdo é `bg-surface-canvas`, e a barra lateral ao lado é
 * `bg-surface-card`: no render 1:1 dos nós 549:44 (claro) e 738:258 (escuro) o
 * conteúdo mede #f7f8f8 / #0e1216 e a barra mede #ffffff / #161b21. O frame de
 * conteúdo 549:70 é transparente — quem carrega o canvas é a tela inteira
 * (549:44) —, então o token vai aqui, no wrapper.
 *
 * `requireSession()` is called here, once, so that every route under `(app)`
 * has a scoped session before it renders. Today it always succeeds; in phase 2
 * this is the single place that turns into a redirect to sign-in (ADR-0008).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  // O plano de contas existe para TODA pessoa, e a garantia mora aqui porque
  // este layout é por onde toda tela autenticada passa.
  //
  // Antes disto ele era semeado num lugar só — a visita a
  // `/onboarding/plano-de-contas` —, e o caminho que ficava sem ele não é
  // obscuro, é DESENHADO: o "Fazer depois" do Onboarding 0 (Wireframe `116:11`,
  // "pula pra Home") leva direto à Home, e Home, DRE, Evolução Mensal e
  // Indicadores todos pedem relatório. Sem blocos, `requireBlock` lança
  // `income_statement.missing_block` e as quatro telas respondem 500 — medido
  // em 2026-09-12 contra o banco de desenvolvimento, com 1 usuário e 0 blocos.
  //
  // Os 10 blocos não são cadastro que a pessoa digita: são fixos para todo
  // mundo (PRD §1 e §9.5). O onboarding existe para EDITAR as categorias
  // dentro deles, não para criar a estrutura — por isso semear aqui não invade
  // aquele passo, e `ensureChartOfAccountsSeeded` é idempotente: ela lê antes e
  // nunca reescreve um plano já começado.
  await ensureChartOfAccountsSeeded(session.userId)

  return (
    <div className="flex min-h-screen">
      {/* ADR-0020 §6: o app lê o banco ao abrir; o servidor limita a uma vez a cada 6h. */}
      <OpenFinanceAutoSync />
      <Sidebar />
      <div className="min-w-0 flex-1 bg-surface-canvas">
        {/* `id` is the target of the skip link below, so a keyboard user does
            not have to tab through the whole sidebar on every page. */}
        {/* `box-content`: `--width-content-max` é a largura da COLUNA medida no
            frame (1088), não da caixa com o recuo dentro. Sem ele o
            `box-sizing: border-box` do reset descontaria os 40 de cada lado
            e a coluna leria 1008. */}
        <main
          id="conteudo"
          className="mx-auto box-content max-w-[var(--width-content-max)] px-40 py-40"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
