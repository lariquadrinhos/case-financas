/**
 * O progresso do Onboarding.
 *
 * PRD §5, "Roteamento de abertura", pede exatamente estes estados, com estas
 * palavras: "O progresso do onboarding precisa distinguir **'não iniciado'**,
 * **'adiado pela pessoa'** e **'em andamento'**" — mais o "onboarding
 * completo" que a mesma frase manda pra Home. files_design/01 §1 e §2 dizem o
 * mesmo em termos de tela.
 *
 * Os três eventos que mudam esse estado estão DESENHADOS, cada um com rótulo
 * próprio, e é por isso que eles são estados distintos e não uma contagem de
 * linhas:
 *   - "Fazer depois"              — Figma 116:11, só no Onboarding 0 (116:2)
 *   - "Salvar e continuar depois" — Figma 29:36, nos cinco passos, sem exceção
 *   - "Concluir"                  — Figma 29:235, só no passo 5 (29:180)
 * O design não daria dois rótulos diferentes ao mesmo comportamento: sair para
 * voltar depois (`InProgress`) e desistir para ir pra Home (`Dismissed`) são
 * coisas diferentes, e a barra de cinco segmentos (29:5..29:9) mais o rótulo
 * "Passo N de 5" existem justamente para dizer onde a pessoa parou.
 *
 * Minimização (ADR-0009 §4): só o estado do fluxo e o número do passo. Nada
 * aqui é dado financeiro, e nenhum campo a mais é coletado.
 */

/** Os cinco passos do wizard — files_design/01 §3, Figma 29:2, 29:39, 29:86, 29:133, 29:180. */
export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export const ONBOARDING_STATUS = ['InProgress', 'Dismissed', 'Completed'] as const

/**
 * `InProgress` — entrou no wizard e ainda não concluiu; `lastStep` diz onde retomar.
 * `Dismissed`  — clicou "Fazer depois" (116:11) antes de começar.
 * `Completed`  — clicou "Concluir" (29:235) no passo 5.
 *
 * Não existe `NotStarted`: a ausência de registro JÁ é essa resposta, do mesmo
 * jeito que a configuração do Consumo Livre usa `null` para o Estado A
 * (src/data/contracts/discretionary-spending.ts).
 */
export type OnboardingStatus = (typeof ONBOARDING_STATUS)[number]

export interface OnboardingProgress {
  readonly status: OnboardingStatus
  /**
   * O passo em que a pessoa está. `null` quando o estado foi alcançado sem
   * passo nenhum — o único caso é "Fazer depois", que é clicado no Onboarding
   * 0 (116:2), a tela que o Wireframe desenha SEM barra de progresso.
   */
  readonly lastStep: OnboardingStep | null
}
