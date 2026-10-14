/**
 * Empty-state copy — extracted VERBATIM from the Figma frames.
 *
 * The design team wrote each of these sentences deliberately (files_design/01
 * §15: a short title, a one-to-two-line message explaining what will appear
 * there, and an action button only when there is something immediate to do —
 * Evolução Mensal has none, because it only fills in with time).
 *
 * Do not paraphrase. If a message needs to change, it changes in the Figma
 * first. The `node` on each entry is the frame it came from, so the claim is
 * checkable: `cat docs/figma/frames/<node>*.xml`.
 *
 * Generated from docs/figma/frames/*__vazio-*.xml; kept in the repo rather than
 * generated at build time so a diff shows when copy changes.
 */

export interface EmptyStateCopy {
  /** The Figma node this copy came from, so fidelity can be re-checked. */
  readonly node: string
  readonly title: string
  readonly message: string
  /** Present only where the design offers an immediate action. */
  readonly action?: string
}

export const EMPTY_STATES = {
  /** Vazio — Plano de Contas (frame 305:1654, grupo interno "Vazio — Contas Bancárias") */
  PLANO_DE_CONTAS: {
    node: '311:1699',
    title: 'Nenhuma categoria cadastrada',
    message:
      'Nenhuma categoria personalizada criada ainda. Elas aparecem organizadas dentro de cada bloco conforme você lança ou cadastra algo.',
    action: '+ Criar categorias',
  },
  /** Vazio — Contas Bancárias */
  CONTAS_BANCARIAS: {
    node: '309:100',
    title: 'Nenhuma conta cadastrada',
    message: 'Adicione suas contas bancárias pra começar a organizar seu dinheiro.',
    action: '+ Adicionar',
  },
  /** Vazio — Bens Materiais */
  BENS_MATERIAIS: {
    node: '309:106',
    title: 'Nenhum bem cadastrado',
    message: 'Adicione imóveis, veículos ou outros bens de valor.',
    action: '+ Adicionar',
  },
  /** Vazio — Investimentos */
  INVESTIMENTOS: {
    node: '309:112',
    title: 'Nenhum investimento cadastrado',
    message: 'Adicione o valor acumulado dos seus investimentos.',
    action: '+ Adicionar',
  },
  /** Vazio — Passivos */
  PASSIVOS: {
    node: '309:118',
    title: 'Nenhuma dívida cadastrada',
    message: 'Adicione financiamentos ou dívidas que você queira acompanhar.',
    action: '+ Adicionar',
  },
  /** Vazio — Despesas por Categoria */
  DESPESAS_POR_CATEGORIA: {
    node: '309:11',
    title: 'Nenhuma despesa registrada',
    message: 'Assim que você lançar uma despesa, ela aparece aqui, organizada por categoria.',
    action: '+ Novo Lançamento',
  },
  /** Vazio — Onde Está Meu Dinheiro */
  ONDE_ESTA_MEU_DINHEIRO: {
    node: '309:17',
    title: 'Nada cadastrado ainda',
    message:
      'Cadastre suas contas, investimentos ou dívidas em Plano de Contas e Patrimônio pra ver onde seu dinheiro está.',
    action: 'Cadastrar agora',
  },
  /** Vazio — Eventos Recentes */
  EVENTOS_RECENTES: {
    node: '309:23',
    title: 'Nenhum evento ainda',
    message:
      'Reajustes de juros, divergências de pagamento e parcelas confirmadas aparecem aqui conforme forem acontecendo.',
  },
  /** Vazio — Pendências */
  PENDENCIAS: {
    node: '309:2',
    title: 'Tudo em dia',
    message:
      'Nenhuma pendência agora. Quando algo precisar da sua decisão (valor sem destino, recorrência sem valor, lucro sem destinar), aparece aqui.',
  },
  /** Vazio — DRE */
  DRE: {
    node: '309:47',
    title: 'Nada lançado ainda este mês',
    message:
      'O DRE mostra o resultado calculado a partir dos seus lançamentos. Registre uma receita ou despesa pra começar.',
    action: '+ Novo Lançamento',
  },
  /** Vazio — Balanço Patrimonial */
  BALANCO_PATRIMONIAL: {
    node: '309:53',
    title: 'Nada cadastrado ainda',
    message:
      'Cadastre suas contas, bens, investimentos ou dívidas pra ver seu Ativo, Passivo e Patrimônio Líquido.',
    action: 'Cadastrar agora',
  },
  /** Vazio — Evolução Mensal */
  EVOLUCAO_MENSAL: {
    node: '309:59',
    title: 'Ainda sem histórico suficiente',
    message:
      'A Evolução Mensal precisa de pelo menos 2 meses de dados pra desenhar a comparação. Volte aqui mais pra frente.',
  },
  /** Vazio — Mapa de Fluxo */
  MAPA_DE_FLUXO: {
    node: '309:5',
    title: 'Sem lançamentos este mês',
    message:
      'Registre uma receita ou despesa pra começar a ver de onde vem e pra onde vai o seu dinheiro.',
    action: '+ Novo Lançamento',
  },
  /** Vazio — Indicadores Financeiros */
  INDICADORES_FINANCEIROS: {
    node: '309:62',
    title: 'Não é possível calcular ainda',
    message:
      'Os indicadores dependem de dados no DRE e no Balanço. Cadastre e registre lançamentos pra ver os números aqui.',
    action: 'Cadastrar agora',
  },
  /** Vazio — Revisão de Recorrentes */
  REVISAO_DE_RECORRENTES: {
    node: '309:88',
    title: 'Nenhuma recorrência configurada',
    message:
      'Ative a recorrência num lançamento (despesa, receita, pró-labore...) pra ela aparecer aqui todo mês, pronta pra confirmar.',
    action: '+ Novo Lançamento',
  },
  /** Vazio — Histórico */
  HISTORICO: {
    node: '309:94',
    title: 'Nenhum lançamento ainda',
    message: 'Assim que você registrar seu primeiro lançamento, ele aparece aqui.',
    action: '+ Novo Lançamento',
  },
} as const satisfies Record<string, EmptyStateCopy>

export type EmptyStateKey = keyof typeof EMPTY_STATES
