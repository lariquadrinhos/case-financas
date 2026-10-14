# ADR-0003 — Um lançamento, três leituras: a eliminação intercompany é projeção, nunca duplicação

- **Status:** aceita (comportamento implementado e testado; escrita em 2026-09-08)
- **Fecha:** hotspot **H2** do Event Storming (representação de intercompany + eliminação no
  consolidado)
- **Estende:** ADR-0001 §1 (o lançamento é o único fato guardado)

## Contexto

Pró-labore e distribuição de lucro movem dinheiro entre a PJ e a PF da mesma pessoa. Contabilmente
o mesmo evento é despesa de um lado e receita do outro, e no consolidado não é nada — se contasse
dos dois lados, a soma contaria o mesmo dinheiro duas vezes.

A saída óbvia seria gravar dois lançamentos, um em cada entidade, e marcar os dois para
eliminação. O PRD §5 fecha essa porta na frase que define o modelo: **"lançamento único por
transação, com entidade como atributo"**. O trade-off que H2 pesava é exatamente esse — fidelidade
contábil contra não duplicar.

## Decisão

### §1 A entidade de um intercompany não é um campo: é derivada da visão

Despesa, Receita e IR carregam `entity`. Pró-labore e Distribuição **não carregam** — carregam
conta de origem (PJ) e conta de destino (PF), que é a transferência real de dinheiro. Qual
entidade eles são depende de quem está olhando, e por isso não pode ser um campo.

### §2 `effectInView` é o único lugar que decide, e devolve papel + contribuição

Toda leitura passa por `effectInView(entry, view)`
(`src/domain/entries/projection.ts`), que devolve `Excluded` com um motivo
(`OtherEntity` ou `IntercompanyElimination`) ou `Included` com um **papel contábil** e uma
**contribuição em termos de lucro** (receita soma, despesa subtrai):

| Lançamento            | PF            | PJ                                      | Consolidado   |
| --------------------- | ------------- | --------------------------------------- | ------------- |
| Pró-labore            | receita bruta | despesa operacional                     | **eliminado** |
| Distribuição de lucro | receita bruta | apropriação (bloco 10, abaixo da linha) | **eliminado** |

A função devolve o **papel**, não o bloco: `entries` não pode importar `chart-of-accounts`
(regra de dependência do domínio), e resolver papel → bloco é trabalho do relatório
(`blockForRole`). É por isso que "em qual bloco o pró-labore cai na PJ" foi uma pergunta separada,
respondida só na P1: **Despesas Administrativas**.

Um segundo lugar que reimplementasse essa tabela é a falha que H2 avisa. Por isso o filtro de
Entidade do Histórico também roda `effectInView` — a tela não pode listar um pró-labore que o DRE
elimina.

### §3 A contribuição não é o número impresso

`contribution` é assinado em termos de lucro. A cascata imprime cada bloco na direção de leitura
dele — `(-) Deduções da Receita` é um número positivo sob um sinal de menos (Figma 11:2). Converter
um no outro é trabalho do relatório, porque só ele conhece o `CascadeEffect` do bloco (ADR-0002
§1). Somar valores impressos daria o sinal errado; os subtotais somam contribuições.

### §4 Dividendo de investimento externo NÃO é intercompany

É `Revenue` com Categoria no bloco 1, e nunca chega ao ramo de eliminação. A confusão é fácil —
"dividendo" soa como distribuição de lucro — e o PRD a desfaz explicitamente. Distribuição de
lucro é dinheiro saindo da PJ da própria pessoa; dividendo externo é dinheiro entrando de fora.

### §5 A consequência aritmética é declarada, não escondida

**PF + PJ não somam o Consolidado**, e isso é correto: o consolidado elimina os dois
intercompany. Uma tela que somasse as duas visões para conferir o consolidado estaria checando a
regra ao contrário.

## Consequências

- Existe uma única tabela de verdade sobre eliminação, e ela cabe numa função de trinta linhas com
  um `switch` exaustivo sobre `kind` — o compilador recusa um `kind` novo sem tratamento.
- O motivo da exclusão viaja junto (`OtherEntity` vs. `IntercompanyElimination`), o que permite a
  uma tela explicar por que um lançamento não aparece, em vez de simplesmente sumir com ele.
- A aba de formulário se chama **"Pró-labore e Distribuição"**; "intercompany" continua sendo termo
  de domínio, não rótulo de tela (PRD §5, `files_design/04`).

## Explicitamente NÃO feito

- **Dois lançamentos espelhados.** Nunca. É a alternativa que §1 recusa.
- **Campo `entity` no pró-labore.** Seria a mesma duplicação, escondida num campo.
- **Eliminação configurável.** Não há regra de eliminação em tabela: são dois `kind`, nomeados no
  `switch`.
- **Mais de uma PJ.** O modelo assume uma PF e uma PJ; `View` tem exatamente três valores. Suportar
  N empresas reabre §1 e §2 juntos, e está registrado como pergunta de produto no PRD §9.
