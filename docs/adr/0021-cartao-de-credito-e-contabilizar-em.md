# ADR-0021 — "Cartão de crédito" e "Contabilizar em" na despesa

- **Status:** aceita (decisões do dono em 2026-10-06; implementada no mesmo dia)
- **Emenda:** PRD §5, regime de caixa ("o mês contábil é o mês da data de pagamento… não há regime
  de competência paralelo") · ADR-0001 (o Lançamento é a fonte da verdade — ganha dois campos)
- **Estende:** ADR-0020 (a compra que vem de um cartão vinculado chega marcada) · ADR-0019 (a
  série leva a marca de cartão, não o mês contábil)
- **Responde:** em parte a §9.1 do PRD, "Período financeiro customizável" — não com um período
  novo, mas com uma escolha por lançamento

## Contexto

O dono pediu, em sessão em 2026-10-06, duas coisas na despesa:

- **Saber se ela é do cartão**, para enxergar na listagem o que passou pelo cartão, ao lado do
  ícone de recorrente.
- **Escolher o mês em que ela é contabilizada** ("Contabilizar em: Setembro/2026"), "que é uma
  data diferente" da data de pagamento. O caso concreto é a compra no cartão: comprada em
  setembro, paga na fatura de outubro, e o dono quer ver o gasto no DRE de setembro.

O segundo pedido contraria uma regra imutável do PRD §5 ("o mês contábil de um lançamento pago é o
mês da data de pagamento… Não há regime de competência paralelo"). Pelo CLAUDE.md §3, enfraquecer
uma regra do PRD exige ADR — esta.

As respostas que decidiram o desenho (perguntas feitas em sessão):

- "Contabilizar em" **manda nos relatórios**: DRE, Balanço, Evolução Mensal e Indicadores — não é
  só informativo.
- A compra que vem de um **cartão vinculado** chega marcada "Cartão de crédito".
- "Cartão de crédito" **só marca e mostra o ícone**: não escolhe qual cartão e não muda status nem
  data.
- Os dois campos ficam **logo depois da Data de pagamento** no formulário de Despesa.
- No DRE, os filtros "Recorrentes" e "Cartão" **recalculam a cascata**, em vez de só esconder
  linhas.

## Decisão

### §1 Dois campos, só na Despesa

`ExpenseEntry` ganha:

- `isCreditCard?: boolean` — "Cartão de crédito". Ausente é `false`. Uma marca: nenhuma regra lê.
- `accountingMonth?: Month | null` — "Contabilizar em". `null` ou ausente é o mês da data de
  pagamento.

Só a Despesa: o pedido foi "um campo nas despesas", e Receita, Pró-labore e IR não têm o caso que o
motivou. O schema Zod da borda recusa os dois campos nos outros tipos (422).

No banco, `entries.is_credit_card` (inteiro, padrão 0) e `entries.accounting_month` (texto
`YYYY-MM`, nulo), com índice `(user_id, accounting_month)`; e
`recurrences.template_is_credit_card` (migração `0021_card_and_accounting_month`).

### §2 Uma regra para o mês

`accountingMonth(entry)` (`src/domain/entries/rules.ts`) continua sendo a regra inteira: o
"Contabilizar em" da despesa quando há um; senão, o mês da data de pagamento. Todo relatório já lia
o mês por ela, e por isso DRE, Evolução Mensal e Indicadores passaram a respeitar o campo sem
mudança própria. O repositório traduz a mesma regra em SQL (`inAccountingMonth`) para
`listByMonth` e para o filtro de mês do Histórico, e confere de novo pela função do domínio.

O campo é guardado à parte da data, e não como uma data de pagamento "falsa", para que corrigir a
data de pagamento nunca mova um mês que a pessoa escolheu — e para que "Desfazer" um pagamento e
"Confirmar" de novo não o percam.

O formulário guarda `null` quando o mês escolhido é o próprio mês do pagamento: o padrão acompanha
a data se ela mudar.

### §3 A série leva o cartão, não o mês

`templateFromEntry` e o schema do modelo da série tiram `accountingMonth`: copiado para a série,
ele empilharia todas as ocorrências naquele único mês. `isCreditCard` vai para o modelo e chega a
cada mês pago.

### §4 Open Finance

A decisão `CardPurchase` do `planImport` cria a despesa com `isCreditCard: true`; tudo o mais que o
banco traz chega sem a marca e sem "Contabilizar em" — o mês do pagamento, como antes.

### §5 Filtros do DRE recalculam

`computeIncomeStatement` aceita `only: { recurring?, creditCard? }`: a cascata e a lista
"Lançamentos deste mês" são calculadas só com os lançamentos que batem (os dois juntos exigem os
dois). A parcela de Passivo não é série nem cartão e sai com qualquer filtro. A rota
`/reports/income-statement` recebe `recurring` e `creditCard` (`'true'|'false'`). É a mesma
natureza da simulação do olhinho: uma leitura, nada gravado.

## Consequências

- **O DRE deixa de fechar com o extrato do mês** quando há despesa com "Contabilizar em" diferente
  do mês do pagamento — por escolha da pessoa. A conferência com o banco passa a ser feita com o
  campo em mente.
- **O Balanço não muda por isso**: os saldos de conta continuam sendo o que está no banco ou o que a
  pessoa informou; o campo só move a despesa entre meses de resultado.
- **A Pendência "N lançamentos a categorizar"** continua pelo mês da regra (`listByMonth`).

## Emenda (2026-10-09): a receita também tem "Cartão de crédito"

O dono lançou um estorno como receita e notou: "um estorno pode ser no cartão, como foi o caso
desse". A marca passa a existir também em `RevenueEntry` — mesma coluna `entries.is_credit_card`,
mesma regra (só marca, sem efeito em status, data ou mês) — e o filtro "Cartão" do DRE passa a
incluir a receita marcada. O "Contabilizar em" continua só na Despesa: ninguém pediu para a
receita, e o PRD §5 só foi enfraquecido onde houve pedido.

## Explicitamente NÃO feito

- **Cartão como cadastro** (qual cartão, limite, fatura como dívida). A marca é sim/não. A P47 do
  PRD (fatura como dívida) continua aberta.
- **CHECK no SQLite** para "só Despesa" e para o formato `YYYY-MM`: acrescentar CHECK exige
  reconstruir a tabela `entries` com os dados reais dentro. O schema Zod da borda e o tipo do
  domínio garantem as duas coisas.
- **"Contabilizar em" na série**, em Receita, Pró-labore e IR.
- **Período financeiro customizável** (PRD §9.1): continua sem decisão; esta ADR não muda o mês
  calendário.
