# ADR-0018 — A Conta de origem (PJ) do pró-labore e da distribuição passa a ser opcional

- **Status:** aceita (decisão do dono, 2026-09-23)
- **Enfraquece:** PRD §1, "O lançamento carrega conta de origem (PJ) e conta de destino (PF),
  ambas obrigatórias" — o CLAUDE.md §3 exige ADR para enfraquecer uma regra do PRD
- **Toca:** `files_design/01` §5.2 · `files_design/03` "Aba Pró-labore e Distribuição"

## Contexto

O PRD tratava pró-labore e distribuição de lucro como "uma transferência real de dinheiro entre as
duas entidades" e por isso exigia as duas contas. Medido no primeiro uso com dados reais, em
2026-09-23: a pessoa tinha quatro contas cadastradas, todas PF. A lista de "Conta de origem (PJ)",
filtrada para PJ, abria **vazia** — uma barra sem item nem mensagem — e o lançamento não podia ser
salvo.

O caso não é raro. O dinheiro nem sempre sai de uma conta PJ que a pessoa controla aqui: pode cair
direto na conta PF, e a conta da PJ pode simplesmente não estar no app.

## Decisão

1. **A Conta de origem (PJ) é opcional.** Sem ela, o lançamento guarda `sourceAccountId = null`.
2. **A Conta de destino (PF) continua obrigatória.** É onde o dinheiro cai; sem ela o lançamento
   não diz nada sobre caixa.
3. **O tratamento contábil não muda.** O DRE é derivado do tipo (pró-labore é despesa operacional
   da PJ e receita da PF; distribuição é bloco 10 na PJ e receita na PF; ambos eliminados no
   Consolidado), nunca das contas. Nenhuma linha de DRE, Balanço, Evolução Mensal ou Indicadores lê
   a conta de origem.
4. **Nenhum saldo muda por causa disso.** O saldo de Conta Bancária é mantido pela pessoa, não
   derivado de lançamento (PRD §1, `src/data/sqlite/bank-accounts.repository.ts`), e isso já valia
   com a origem obrigatória.
5. **Sem toggle.** Chegou a ser considerado um toggle para esconder a seção Transferência; o dono
   decidiu que o campo opcional basta.

## Como ficou

| Camada    | Mudança                                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domínio   | `ProLaboreEntry.sourceAccountId` e `ProfitDistributionEntry.sourceAccountId` viram `BankAccountId \| null`                                                                                                     |
| API       | `sourceAccountId` aceita `null` e, na criação, pode ser omitido (default `null`)                                                                                                                               |
| Banco     | migração `0011`: os CHECK `entries_intercompany_shape` e `recurrences_template_intercompany_shape` deixam de exigir a origem. SQLite não altera CHECK, então as duas tabelas são recriadas e os dados copiados |
| Tela      | "Conta de origem (PJ)" sem asterisco, com (i), e o item "Sem conta de origem" — que também dá conteúdo à lista de quem não tem conta PJ                                                                        |
| Histórico | sem origem, a coluna Conta mostra `— → destino`, o mesmo travessão de uma conta que não se encontra                                                                                                            |

**Migração verificada antes de tocar no banco real:** rodada numa cópia do banco com dados reais,
as 22 tabelas mantiveram o mesmo número de linhas, `integrity_check` deu `ok` e
`foreign_key_check`, zero violações. Todas as FKs que apontam para `entries` e `recurrences` são
`ON DELETE restrict`, então a recriação nunca apaga em cascata: no pior caso ela falha e é desfeita.

## Consequências

- Um pró-labore sem origem não aparece no filtro do Histórico por uma conta PJ — não há conta a
  filtrar. Aparece pela conta PF de destino.
- Se um dia o saldo passar a ser derivado de lançamento, a origem `null` significa "não debita
  nenhuma conta do app", e essa decisão tem de ser revisitada junto.
