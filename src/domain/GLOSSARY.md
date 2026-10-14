# Glossário — termo do produto (pt-BR) → identificador no código (inglês)

> Toda a documentação deste projeto (PRD, Event Storming, especificação de telas, modelo de
> dados, glossário de nomenclatura) está em português, e o glossário do design é rigoroso:
> "Lançamento" e não "transação", "Bens Materiais" e não "Ativos", "Evolução Mensal" e não
> "Painel". O código, por decisão de ADR-0010, é em inglês.
>
> Esta tabela é a ponte. **É normativa**: ao implementar algo que a spec chama de X, use o
> identificador que está aqui. Se um conceito novo aparecer, acrescente a linha aqui antes de
> escrever o código, nunca depois.
>
> **Texto de interface continua em português**, palavra por palavra igual ao Figma. O idioma
> inglês vale para nome de tipo, função, variável, arquivo e pasta; não para o que a pessoa lê
> na tela.

## Agregados e entidades

| Produto (pt-BR)                           | Código (inglês)                                                           | Observação                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lançamento                                | `Entry`                                                                   | A raiz transacional. "Entry" é o termo contábil (journal entry); "Transaction" foi evitado pelo mesmo motivo que "transação" foi evitado em português                               |
| Recorrência                               | `Recurrence`                                                              | O template que gera ocorrências                                                                                                                                                     |
| Ocorrência                                | `Occurrence`                                                              | A instância mensal gerada pelo motor                                                                                                                                                |
| Categoria                                 | `Category`                                                                |                                                                                                                                                                                     |
| Bloco (do DRE)                            | `StatementBlock`                                                          | Os 10 blocos fixos                                                                                                                                                                  |
| Plano de Contas                           | `ChartOfAccounts`                                                         |                                                                                                                                                                                     |
| Conta Bancária                            | `BankAccount`                                                             |                                                                                                                                                                                     |
| Bem Material                              | `TangibleAsset`                                                           | Nunca `Asset` sozinho: "Ativo" no Balanço inclui contas e investimentos, e o design renomeou justamente para desambiguar                                                            |
| Investimento                              | `Investment`                                                              |                                                                                                                                                                                     |
| Passivo                                   | `Liability`                                                               |                                                                                                                                                                                     |
| Parcela                                   | `Installment`                                                             |                                                                                                                                                                                     |
| Reajuste de juros                         | `RateAdjustment`                                                          |                                                                                                                                                                                     |
| Evento (rastreabilidade)                  | `TraceEvent`                                                              | `Event` sozinho colide com o `Event` do DOM                                                                                                                                         |
| Destinação do Lucro                       | `ProfitAllocation`                                                        |                                                                                                                                                                                     |
| Item de Destinação                        | `AllocationItem`                                                          |                                                                                                                                                                                     |
| Transferência                             | `Transfer`                                                                | Move valor entre DUAS posições que existem (conta, investimento). É o que a tela chama de "Redirecionar valor" — ADR-0017 §1                                                        |
| Direcionamento                            | `Allocation`                                                              | Aplica a um destino um valor que CHEGA de um evento (lucro do mês, venda, sobra) — só o destino cresce. Era "o destino do dinheiro de uma venda"; generalizado pela ADR-0017 §1     |
| Pendente de Direcionamento                | `PendingAllocation`                                                       |                                                                                                                                                                                     |
| Consumo Livre                             | `DiscretionarySpending`                                                   | O rótulo na tela continua "Consumo Livre"                                                                                                                                           |
| Pendência (na Home)                       | `Pending` / `PendingItem`                                                 |                                                                                                                                                                                     |
| Divergência de pagamento a menor          | `PaymentDiscrepancy`                                                      | Pendência tipo 4 (Event Storming Fluxo I) — o único dos quatro tipos sem registro persistente antes desta rodada                                                                    |
| Open Finance                              | `OpenFinance`                                                             | O conceito do produto, não o fornecedor: o domínio nunca diz "Pluggy". O adaptador é `src/data/pluggy/` (ADR-0020)                                                                  |
| Posição vinculada                         | `OpenFinanceLink`                                                         | Atributo de Conta Bancária, Investimento ou Passivo: id opaco da conta no provedor + data do vínculo. Não é agregado                                                                |
| Transação bancária importada              | `ImportedTransaction`                                                     | O que o banco informou, antes de virar Lançamento, Transferência ou gasto de Consumo Livre. "Transação" aqui é o termo do banco, não do produto — o produto continua "Lançamento"   |
| Retrato do Open Finance                   | `OpenFinanceSnapshot`                                                     | O que a porta `OpenFinanceReader` devolve numa leitura: contas, saldos, transações, investimentos, empréstimos, já em `Cents` e `IsoDate`                                           |
| A categorizar                             | `UNCATEGORIZED_EXPENSE_CATEGORY_ID` / `UNCATEGORIZED_REVENUE_CATEGORY_ID` | Categoria de sistema onde chega o que vem do banco até a pessoa categorizar (PRD v7.46). Substituiu o de-para                                                                       |
| Classificação de transferência            | `TransferClassification`                                                  | `ProLabore` · `ProfitDistribution` · `CapitalContribution` (Aporte na PJ) · `Transfer` (Só transferência) — 2026-09-29                                                              |
| Verba do Consumo Livre                    | `DiscretionaryAllowanceKind`                                              | `Fixed` (valor fixo) · `SourceBalance` (saldo da conta)                                                                                                                             |
| Descrição (do lançamento)                 | `Entry.description`                                                       | Texto livre e opcional de qualquer lançamento; a importação o preenche com o texto do banco (PRD v7.47). Não é o Rótulo, que só existe onde não há Categoria                        |
| Cartão de crédito (da despesa ou receita) | `ExpenseEntry.isCreditCard`, `RevenueEntry.isCreditCard`                  | Despesa e, desde 2026-10-09, Receita (um estorno no cartão); uma marca, sem efeito em status, data ou mês. Ausente é `false`. A compra de cartão vinculado chega marcada (ADR-0021) |
| Contabilizar em                           | `ExpenseEntry.accountingMonth`                                            | Só Despesa; o mês (`Month`) em que ela entra nos relatórios. `null` é o mês da data de pagamento. Lido só por `accountingMonth()` (ADR-0021, emenda o PRD §5)                       |
| Confirmar (ação)                          | `POST /entries/{id}/payment` · `markAsPaid`                               | O botão que era "Marcar Pago" (dono, 2026-10-06: "receitas não são pagas"). O código continua `markAsPaid`: o status no domínio segue `Paid`                                        |
| Desfazer (ação)                           | `PATCH /entries/{id}` com `status: 'Planned'`                             | Pago → Previsto mantendo data e valor; recusado (`entries.paid_by_bank`) no que veio do banco (2026-10-06)                                                                          |
| Lançamento a categorizar (Pendência)      | `Uncategorized` (`PendingItemKind`)                                       | Uma por mês, com a contagem                                                                                                                                                         |

## Enums e valores

| Produto (pt-BR)                 | Código (inglês)                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Entidade                        | `Entity`                                                                                      |
| PF / PJ                         | `'PF'` / `'PJ'` — mantidos sem tradução: são categorias jurídicas brasileiras sem equivalente |
| Visão                           | `View`                                                                                        |
| Consolidado                     | `'Consolidated'`                                                                              |
| Status                          | `EntryStatus`                                                                                 |
| Previsto                        | `'Planned'`                                                                                   |
| Pago                            | `'Paid'`                                                                                      |
| Recebido                        | `'Paid'` — é rótulo de interface da aba Receita, não um terceiro estado                       |
| Classificação                   | `Classification`                                                                              |
| Circulante / Não circulante     | `'Current'` / `'NonCurrent'`                                                                  |
| Natureza                        | `EntryKind`                                                                                   |
| Receita                         | `'Revenue'`                                                                                   |
| Despesa                         | `'Expense'`                                                                                   |
| Pró-labore                      | `'ProLabore'` — sem tradução, é termo jurídico brasileiro                                     |
| Distribuição de lucro           | `'ProfitDistribution'`                                                                        |
| IR / Imposto de Renda           | `'IncomeTax'`                                                                                 |
| Pagamento / Recebimento (IR)    | `'Payment'` / `'Refund'`                                                                      |
| Tipo de valor: Fixo / A definir | `RecurrenceAmountKind`: `'Fixed'` / `'ToBeDefined'`                                           |
| Intercompany                    | `isIntercompany`                                                                              |
| Eliminação (no consolidado)     | `elimination`                                                                                 |

## Relatórios

| Produto (pt-BR)                 | Código (inglês)               |
| ------------------------------- | ----------------------------- |
| DRE                             | `IncomeStatement`             |
| Balanço Patrimonial             | `BalanceSheet`                |
| Evolução Mensal                 | `MonthlyTrend`                |
| Indicadores Financeiros         | `FinancialIndicators`         |
| Patrimônio Líquido              | `netWorth`                    |
| Lucro Líquido                   | `netProfit`                   |
| Receita Líquida                 | `netRevenue`                  |
| Lucro Bruto                     | `grossProfit`                 |
| Receita Bruta                   | `grossRevenue`                |
| Deduções da Receita             | `revenueDeductions`           |
| Custo dos Serviços/Produtos     | `costOfServices`              |
| Despesas Administrativas        | `administrativeExpenses`      |
| Despesas Pessoais/Consumo       | `personalExpenses`            |
| Depreciação e Amortização (D&A) | `depreciationAndAmortization` |
| Resultado Não Operacional       | `nonOperatingResult`          |
| Resultado Financeiro            | `financialResult`             |
| Impostos sobre o Lucro          | `profitTaxes`                 |
| Saldo devedor                   | `outstandingBalance`          |
| Saldo não alocado               | `unallocatedBalance`          |
| Amortização                     | `amortization`                |

## Núcleo

| Produto (pt-BR) | Código (inglês)                   |
| --------------- | --------------------------------- |
| Centavos        | `Cents`                           |
| Mês             | `Month` (sempre `"YYYY-MM"`)      |
| Data            | `IsoDate` (sempre `"YYYY-MM-DD"`) |
| Formatar moeda  | `formatMoney`                     |
| Formatar data   | `formatDate`                      |

## Telas e rotas

As rotas ficam em português, porque a URL é interface: `/inicio`, `/dre`, `/historico`,
`/balanco-patrimonial`, `/evolucao-mensal`, `/indicadores-financeiros`,
`/revisao-de-recorrentes`, `/plano-de-contas`, `/contas-bancarias`, `/bens-materiais`,
`/investimentos`, `/passivos`, `/onboarding`.

Os componentes e pastas de `src/features/` ficam em inglês: `entries/`, `reports/`,
`chart-of-accounts/`, `assets/`, `recurrence/`, `profit-allocation/`,
`discretionary-spending/`, `onboarding/`.

---

## Acrescentado na modelagem dos agregados (fase de tipos)

Conceitos que precisaram de nome ao escrever `types.ts` de cada módulo. Mesma regra: o termo
pt-BR é o da tela ou da spec; o identificador é o que o código usa.

### Plano de Contas

| Produto (pt-BR)            | Código (inglês)           | Observação                                                                                                               |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Efeito do bloco na cascata | `CascadeEffect`           | `'Add'` · `'Subtract'` (prefixo "(-)") · `'Signed'` (prefixo "(+/–)") · `'None'`                                         |
| Abaixo da linha (bloco 10) | `belowTheLine`            | Destinação do Lucro não reduz o lucro operacional                                                                        |
| Aceita categoria da pessoa | `acceptsUserCategories`   | Falso só em D&A, que é somente leitura                                                                                   |
| Rótulo do bloco no DRE     | `statementLabel`          | Só a cascata do DRE encurta: "D&A" lá, "Depreciação & Amortização (D&A)" no Plano de Contas. Fora da cascata, use `name` |
| Categoria do sistema       | `isSystem`                | "Consumo Livre", fixa dentro de Despesas Pessoais                                                                        |
| Categoria arquivada        | `archived`                | Não existe excluir (files_design/01 §3.1)                                                                                |
| Classificação sugerida     | `suggestedClassification` | Pré-seleciona Classificação no formulário                                                                                |

### Lançamento e Recorrência

| Produto (pt-BR)                           | Código (inglês)                            | Observação                                                                                 |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Conta de origem / de destino (Pró-labore) | `sourceAccountId` / `destinationAccountId` | Sempre PJ → PF; a origem pode ser `null` (ADR-0018)                                        |
| Rótulo                                    | `label`                                    | Existe só em IR e Consumo Livre                                                            |
| Filtros do Histórico                      | `EntryFilter`                              | Um campo por filtro; `null` = filtro não aplicado                                          |
| Modelo da recorrência                     | `RecurrenceTemplate`                       | O dado do Lançamento copiado mês a mês                                                     |
| Escopo da edição                          | `EditScope`                                | `'ThisOnly'` = "Só esta ocorrência" · `'WholeSeries'` = "Toda a série (valores em aberto)" |
| Ocorrência descartada                     | `discarded`                                | Pula só este mês; a série continua                                                         |
| Encerrada (recorrência)                   | `closedOn`                                 | "Encerrar recorrência", para a série pra sempre                                            |
| Término                                   | `endsOn`                                   | `null` = indefinida                                                                        |

### Patrimônio

| Produto (pt-BR)                 | Código (inglês)             | Observação                                                         |
| ------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| Cor da conta                    | `BankAccountColour`         | Token da paleta, nunca hex: cor é apresentação                     |
| Valor registrado (Bem Material) | `recordedValue`             | Sem depreciação mensal                                             |
| Valor acumulado (Investimento)  | `accumulatedValue`          | Saldo inicial + aportes, sem mark-to-market                        |
| Vendido em                      | `soldOn`                    | Realização do ganho/perda só na venda                              |
| Credor / Instituição            | `creditor`                  |                                                                    |
| Valor original da dívida        | `originalAmount`            |                                                                    |
| Valor da parcela                | `installmentAmount`         |                                                                    |
| Número de parcelas              | `installmentCount`          |                                                                    |
| Parcelas já pagas               | `installmentsAlreadyPaid`   |                                                                    |
| Taxa de juros (a.m.)            | `monthlyInterestRate`       | Fração decimal: `0.0085` = 0,85% a.m.                              |
| Nova taxa / Válida a partir de  | `newRate` / `effectiveFrom` | Reajuste de juros                                                  |
| Prevista / Paga (parcela)       | `'Planned'` / `'Paid'`      | Reusa `EntryStatus`; rótulo feminino em `LABEL_INSTALLMENT_STATUS` |
| Valor pago (real)               | `paidAmount`                | Pode divergir do previsto                                          |
| Parcela descartada              | `discarded`                 | Pula só este mês; cronograma e saldo devedor intactos              |
| Venda de Bem Material           | `AssetSale`                 | Ganho/perda é calculado, não armazenado                            |
| Tipo do Direcionamento          | `AllocationKind`            | `'Investment'` · `'Liability'` · `'Receita'` = `'Revenue'`         |
| Pendente / Direcionado          | `'Pending'` / `'Allocated'` | Status do Pendente de Direcionamento                               |
| Origem (do valor pendente)      | `AllocationOrigin`          | Hoje só a venda de um bem material                                 |

### Relatórios

| Produto (pt-BR)                                             | Código (inglês)                                                                       | Observação                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Linha do DRE                                                | `StatementLine`                                                                       | `kind: 'block' \| 'subtotal'`                                                                                             |
| Subtotal da cascata                                         | `StatementSubtotalKey`                                                                | `netRevenue` · `ebitda` · `ebit` · `netProfit`. `grossProfit` existe no `IncomeStatement`, mas não é linha impressa — P44 |
| Lançamentos deste mês (linha da tabela)                     | `IncomeStatementRow`                                                                  | Mostra Pago e Previsto juntos                                                                                             |
| Filtro Pago/Previsto do DRE                                 | `statusFilter`                                                                        | Controla a cascata inteira                                                                                                |
| Grupo do Balanço                                            | `BalanceSheetGroup`                                                                   | Total + composição                                                                                                        |
| Ativo/Passivo circulante e não circulante                   | `currentAssets` · `nonCurrentAssets` · `currentLiabilities` · `nonCurrentLiabilities` |                                                                                                                           |
| Posição em (data)                                           | `asOf`                                                                                | O Balanço é sempre o momento atual                                                                                        |
| Ponto da Evolução Mensal                                    | `MonthlyTrendPoint`                                                                   | Receita, EBITDA, EBIT, Lucro Líquido, PL                                                                                  |
| Intervalo da Evolução Mensal                                | `MonthlyTrendRange`                                                                   | `'LastSixMonths'` = "Últimos 6 meses" · `'LastYear'` = "Último ano"                                                       |
| Família de indicadores                                      | `IndicatorFamily`                                                                     | `Profitability` · `Liquidity` · `Leverage` · `NetWorthGrowth` · `FinancialQualityOfLife`                                  |
| Indicador / unidade                                         | `Indicator` / `IndicatorUnit`                                                         | `'%'` · `'x'` · `'months'` · `'BRL'` (este carrega `Cents`)                                                               |
| Margem bruta / EBITDA / EBIT / líquida                      | `grossMargin` · `ebitdaMargin` · `ebitMargin` · `netMargin`                           |                                                                                                                           |
| ROE / Taxa de poupança                                      | `returnOnEquity` · `savingsRate`                                                      |                                                                                                                           |
| Liquidez corrente / geral                                   | `currentRatio` · `generalLiquidityRatio`                                              |                                                                                                                           |
| Grau de endividamento / sobre PL / Comprometimento da renda | `debtRatio` · `debtToEquity` · `incomeCommitment`                                     |                                                                                                                           |
| Crescimento do PL / dos investimentos                       | `netWorthGrowth` · `investmentGrowth`                                                 |                                                                                                                           |
| Custo de vida mensal                                        | `monthlyCostOfLiving`                                                                 | Único indicador em `Cents`                                                                                                |
| Reserva de emergência                                       | `emergencyReserve`                                                                    | Em meses de custo                                                                                                         |
| Cobertura por renda passiva                                 | `passiveIncomeCoverage`                                                               |                                                                                                                           |
| Consumo livre / FCL                                         | `discretionaryOverFreeCashFlow`                                                       | FCL = fluxo de caixa livre                                                                                                |
| Eficiência de aporte                                        | `contributionEfficiency`                                                              |                                                                                                                           |

### Destinação do Lucro, eventos e Consumo Livre

| Produto (pt-BR)                       | Código (inglês)         | Observação                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card de destinação                    | `AllocationBucket`      | `InvestmentContribution` = "Aporte em Investimentos" · `DividendReinvestment` = "Reinvestimento de Dividendos" · `ExtraordinaryConsumption` = "Consumo Extraordinário" · `CashReserve` = "Reserva em Caixa" |
| Nome/Destino do item                  | `AllocationDestination` | Investimento, Conta ou texto livre                                                                                                                                                                          |
| Tipo do evento                        | `TraceEventKind`        | `Registration` = "Cadastro" · `RateAdjustment` = "Reajuste de juros" · `InstallmentPaid` = "Parcela paga" · `RecurrencePaid` = "Recorrência paga" · `Discrepancy` = divergência previsto/pago               |
| Origem do evento                      | `TraceEventOrigin`      | Um Passivo ou uma Recorrência                                                                                                                                                                               |
| Valor mensal (Consumo Livre)          | `monthlyAmount`         | A verba do mês                                                                                                                                                                                              |
| Conta de origem (Consumo Livre)       | `sourceAccountId`       |                                                                                                                                                                                                             |
| Gasto de Consumo Livre                | `DiscretionaryExpense`  | Nunca negativo                                                                                                                                                                                              |
| Sobra do mês anterior (Consumo Livre) | `leftover`              | Linha explícita do histórico (frame `345:752`, nó `192:22`); derivada, não é um gasto (P14)                                                                                                                 |

---

## Acrescentado na camada de contrato (HTTP + persistência)

Conceitos que precisaram de nome ao escrever `src/api/` e `src/data/`. Os dois primeiros são
termos de produto que ainda não tinham identificador; o resto é vocabulário de infraestrutura,
listado aqui para que ninguém invente um segundo nome para a mesma coisa.

| Produto (pt-BR)                             | Código (inglês)        | Observação                                                                                  |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| Ganho/Perda (na venda de um bem)            | `gainOrLoss`           | Calculado, nunca guardado: valor de venda − valor registrado (files_design/03)              |
| Restante / valor pendente de direcionamento | `pendingAmount`        | O que sobra de uma venda depois dos Direcionamentos                                         |
| Porta de leitura / de escrita               | `Reader` / `Writer`    | Interfaces separadas por agregado (SOLID/ISP), em `src/data/contracts/`                     |
| Registro de portas (composition root)       | `Repositories`         | `src/data/index.ts` — o único lugar que amarra porta a adaptador                            |
| Envelope de lista                           | `ListEnvelope`         | `{ data, meta: { total } }` em toda coleção da API                                          |
| Janela de paginação / total                 | `Page` / `PagedResult` | `total` é a contagem **antes** da janela                                                    |
| Documento de erro (RFC 9457)                | `ProblemDetails`       | `application/problem+json`, com `code` legível por máquina                                  |
| Código de erro de domínio                   | `code`                 | snake_case, `namespace.motivo`; a tabela que o mapeia para status vive em `src/api/http.ts` |

---

## Acrescentado no roteamento de abertura (PRD §5)

O PRD §5 ("Roteamento de abertura") exige que o progresso do onboarding distinga três
estados, com estas palavras: "não iniciado", "adiado pela pessoa" e "em andamento" — mais o
"onboarding completo" que a mesma frase manda para a Home. Cada um deles tem um botão
desenhado no Wireframe, e é por isso que são estados e não uma contagem de linhas.

| Produto (pt-BR)             | Código (inglês)      | Observação                                                                                  |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| Progresso do Onboarding     | `OnboardingProgress` | `src/domain/onboarding/`; uma linha por pessoa                                              |
| Passo do Onboarding (1 a 5) | `OnboardingStep`     | A sequência dos frames 29:2 → 29:39 → 29:86 → 29:133 → 29:180                               |
| Não iniciado                | (ausência de linha)  | `OnboardingProgressReader.find` responde `null` — mesmo padrão do Estado A do Consumo Livre |
| Em andamento                | `InProgress`         | Gravado por "Salvar e continuar depois" (29:36), "Voltar" (29:33) e "Avançar" (29:38)       |
| Adiado pela pessoa          | `Dismissed`          | Gravado por "Fazer depois" (116:11), só no Onboarding 0 — por isso `lastStep` é anulável    |
| Concluído                   | `Completed`          | Gravado por "Concluir" (29:235), só no passo 5                                              |
