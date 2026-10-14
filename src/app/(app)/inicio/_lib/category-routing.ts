/**
 * files_design/01 §4, "Despesas por Categoria": "Clicar num bloco abre o
 * detalhe da categoria ... exceto Consumo Livre, que abre seu próprio painel,
 * nunca um formulário." A category only counts as Consumo Livre when it is
 * BOTH the fixed system category AND named "Consumo Livre" — `isSystem` alone
 * is not enough, because other system categories may exist later, and this
 * rule must never accidentally swallow one of them into the wrong modal.
 */
export function isConsumoLivreCategory(category: {
  readonly isSystem: boolean
  readonly name: string
}): boolean {
  return category.isSystem && category.name === 'Consumo Livre'
}
