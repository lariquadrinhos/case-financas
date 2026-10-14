import { redirect } from 'next/navigation'
import { onboardingDestination, readOnboardingProgress } from '@/features/onboarding/progress'
import { requireSession } from '@/server/session'

/**
 * Abertura do app — PRD §5 "Roteamento de abertura" (UC19, UC20): "sem
 * autenticação, o app infere o estado sozinho — sem dados ou onboarding
 * incompleto leva ao onboarding, **retomando do passo em que parou**;
 * onboarding completo leva à Home. **O progresso do onboarding precisa
 * distinguir 'não iniciado', 'adiado pela pessoa' e 'em andamento'**." O mesmo
 * em files_design/01 §1 e §2 ("Fazer depois (secundário, pula pra Home)").
 *
 * O estado lido aqui é o dos três eventos que o Wireframe desenha com três
 * rótulos diferentes — "Fazer depois" (116:11, no Onboarding 0 = 116:2),
 * "Salvar e continuar depois" (29:36, nos cinco passos) e "Concluir" (29:235,
 * só no passo 5 = 29:180) —, não uma condição sobre os dados. Frame nenhum
 * enuncia condição de dado nenhuma, e a barra de cinco segmentos
 * (29:5..29:9) mais o rótulo "Passo N de 5" só fazem sentido se alguém
 * guardar em que passo a pessoa parou.
 *
 * Isto substitui uma contagem de linhas em 4 tabelas (Contas Bancárias, Bens
 * Materiais, Investimentos, Passivos), que errava dois casos medidos e
 * reproduzidos em `page.test.tsx`: quem clicava "Fazer depois" era jogado de
 * volta no Onboarding na visita seguinte, e quem clicava "Concluir" sem ter
 * nada a declarar — permitido, files_design/01 §3: "a obrigatoriedade trava no
 * nível do registro individual… não impede pular uma etapa inteira" — ficava
 * preso no Onboarding para sempre.
 */
export default async function RootPage() {
  const session = await requireSession()
  const progress = await readOnboardingProgress(session.userId)
  redirect(onboardingDestination(progress))
}
