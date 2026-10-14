/**
 * The one-line example text under each collapsed block name — Figma 29:2
 * (`docs/figma/frames/29-2__onboarding-1-plano-de-contas.xml`), transcribed
 * word for word.
 *
 * Keyed by `order` (1-10), which `DEFAULT_BLOCKS` fixes for every user, rather
 * than derived from the categories actually seeded: the Figma caption is a
 * hand-picked, deliberately short sample ("Dividendos", not the full
 * "Dividendos/Rendimentos de investimentos externos"), not a mechanical join
 * of category names — computing it from live data would drift from what the
 * design specified the moment the wording of a category differs even slightly,
 * and it would also change under the person's feet as they rename or discard
 * categories, which the static line in the Mockup never does either.
 */
export const BLOCK_CAPTION_BY_ORDER: Record<number, string> = {
  1: 'Salário/Pró-labore, Aluguel recebido, Dividendos, Freelance...',
  2: 'DAS Simples, DARF Unificado, Taxa Fiscalização...',
  3: 'Assinaturas, ração/pet, academia, contador, internet...',
  4: 'Aluguel moradia, financiamento, plano de saúde, água, luz...',
  5: 'Alimentação, transporte, lazer, vestuário, consumo livre...',
  6: 'Sempre zero no MVP: somente leitura',
  7: 'Ganho/perda na venda de ativo ou investimento...',
  8: 'Juros de financiamento/cartão, rendimento de caixa...',
  9: 'IR (lançamento manual), outros impostos sobre lucro...',
  10: 'Aporte, reinvestimento, consumo extraordinário, reserva + extras...',
}
