# ADR-0001 — O Lançamento é a fonte da verdade, e todo relatório é uma projeção pura sobre ele

- **Status:** aceita (comportamento implementado desde o início; escrita em 2026-09-08)
- **Fecha:** hotspots **H1** (lançamento único + projeções derivadas), **H3** (regime de caixa),
  **H6** (projeções sob demanda) e **H8** ("mês fechado") do Event Storming
- **Estendida por:** ADR-0003 (como um lançamento lê em cada visão) · ADR-0004 (de onde vem o
  lançamento de uma recorrência) · ADR-0005 (o que o patrimônio acrescenta à cascata)

## Contexto

Esta ADR foi escrita **depois** do código, e isso é o defeito que ela corrige. O número 0001 já
era citado em oito arquivos — `src/domain/core/money.ts`, `core/time.ts`, `src/api/http.ts`,
`src/data/sqlite/schema.ts`, entre outros — antes de o arquivo existir. Quem lesse
"ADR-0001 §5" não tinha onde chegar.

O comportamento, porém, nunca esteve em dúvida: o PRD §5 é explícito, e o Event Storming marcou
H1, H3, H6 e H8 como resolvidos por implementação. O que faltava era o registro, e o risco de não
o ter é concreto: quatro decisões distintas viviam espalhadas em comentário, e nada dizia que elas
formam **uma** decisão só — mexer numa mexe nas outras.

## Decisão

### §1 O Lançamento é o único fato guardado; relatório nenhum é

Existe uma tabela de Lançamentos e nenhuma tabela de DRE, Balanço, Evolução Mensal ou Indicadores.
Todo relatório é uma função pura sobre os lançamentos do período, recomputada a cada requisição:
`computeIncomeStatement`, `computeBalanceSheet`, `computeMonthlyTrend`,
`computeFinancialIndicators`. Nenhum cache, nenhuma tabela de projeção, nenhum job de
consolidação.

O que isso compra é a propriedade que o produto mais precisa: **é impossível o DRE discordar dos
lançamentos**, porque não há segunda cópia para divergir. Corrigir um lançamento de três meses
atrás corrige, no mesmo instante, o DRE daquele mês, a Evolução Mensal inteira e todos os
indicadores derivados.

O que isso custa é recomputar. Para o volume deste produto — uma pessoa, dezenas de lançamentos
por mês — o custo é irrelevante, e essa é a premissa que uma futura mudança de escala teria de
derrubar antes de introduzir cache.

### §2 O mês contábil é o da data de pagamento informada pela pessoa

`accountingMonth(entry) = monthOf(entry.date)` — uma função de uma linha, e é a regra inteira
(`src/domain/entries/rules.ts`). Não existe data de criação, data de lançamento nem segundo
candidato. **Não há regime de competência paralelo** (PRD §5).

O Lançamento carrega **um** campo de data, obrigatório, o mesmo para Previsto e para Pago. Um
Previsto guarda a data em que se espera pagar; ao virar Pago, a pessoa informa a data real e o
lançamento muda de mês se for o caso. É por isso que a data é um campo só e não dois: dois campos
criariam a pergunta "qual deles manda?", que é exatamente a pergunta que esta seção existe para
não deixar nascer.

### §3 Previsto e Pago são exclusivos, e o filtro dirige a cascata inteira

`entersIncomeStatement(entry, statusFilter) = entry.status === statusFilter`. Com o filtro em
Pago, o DRE mostra só o que é fato; com o filtro em Previsto, só o que é plano. **"Previsto" não é
"Pago mais o que ainda vem"** — os dois são leituras alternativas do mesmo mês, não camadas
somáveis.

Isso é uma reversão explícita da v6 do PRD, registrada na v7 (A): o DRE deixou de ser calculado
apenas sobre Pagos e ganhou o toggle. A regra "Previsto não entra no DRE" continua verdadeira no
sentido que importa — um plano não vira resultado sozinho —, mas agora a pessoa pode pedir para
ver o plano.

### §4 Nenhum mês é fechado, e "recalcular" é recomputar

Não há bloqueio de edição de mês passado, não há trava de fechamento, não há reabertura. Editar um
lançamento antigo é uma operação normal, e o efeito em cascata é automático porque §1 garante que
não há nada armazenado para invalidar.

A contrapartida é declarada: **o número que a pessoa viu num mês pode mudar depois**, se ela mesma
editar aquele mês. O produto não promete imutabilidade histórica; promete que a tela sempre reflete
os lançamentos de agora.

### §5 Dinheiro é inteiro de centavos; data e mês são strings sem fuso

`Cents` é um `number` inteiro marcado, nunca reais em ponto flutuante. O motivo é aritmético e não
estético: `0.1 + 0.2 !== 0.3`, e a cascata soma dezenas de lançamentos antes de o total ser
comparado com o Balanço — um centavo de erro por soma vira divergência visível na conferência do
mês. A conversão acontece só na borda, com `fromReais`/`toReais`, e a formatação só com
`formatMoney`.

`IsoDate` é `"YYYY-MM-DD"` e `Month` é `"YYYY-MM"`, ambas strings, sem hora e sem fuso. Guardar um
`Date` com hora reintroduz o bug clássico de um pagamento do dia 1º cair no mês anterior por causa
de UTC−3 — e, por §2, o mês é o dado que decide tudo. Um DRE errado por um dia é um DRE errado.

Na fronteira HTTP e no banco valem os mesmos tipos: inteiro de centavos e texto para data
(`src/api/contracts/common.ts`, `src/data/sqlite/schema.ts`).

## Consequências

- Os relatórios não têm invalidação de cache, porque não há cache. Qualquer proposta de
  performance precisa reabrir §1, não contorná-lo.
- O domínio **não lê relógio**: `defaultStatusFilterFor(month, currentMonth)` recebe o mês atual
  por parâmetro, e toda função de mês idem. Quem lê relógio é a borda (`src/api/clock.ts`).
- Uma projeção de mês futuro (recorrências, parcelas) é calculada em memória e **jogada fora**
  depois da resposta — ela não vira dado, pelo mesmo §1. Ver `_assemble.ts`.
- `savingsRate`, `grossMargin` e os demais indicadores leem os subtotais do DRE já computado, em
  vez de somarem lançamentos de novo. Uma segunda soma seria uma segunda fonte da verdade.

## Explicitamente NÃO feito

- **Regime de competência.** Nenhum campo, nenhuma tela, nenhuma segunda visão. Acrescentá-lo é
  mudar §2, não configurar algo.
- **Fechamento de mês com bloqueio.** H8 foi decidido como "sem bloqueio", e §4 é essa decisão.
- **Cache ou tabela de projeção.** Nem `materialized view`, nem tabela de saldo mensal, nem
  snapshot. O Balanço é a única projeção que olha "agora" em vez de um mês, e mesmo ele é
  recomputado.
- **Histórico imutável de relatório.** O produto não guarda "o DRE como estava em julho". O
  histórico que existe é o de **eventos** (`TraceEvent`), que registra que algo aconteceu — não o
  resultado que estava na tela.
