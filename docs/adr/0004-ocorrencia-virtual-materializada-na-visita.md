# ADR-0004 — A ocorrência é gerada virtualmente e materializada na primeira visita ao mês

- **Status:** aceita (comportamento implementado; escrita em 2026-09-08, fechando a P18)
- **Fecha:** hotspot **H4** do Event Storming (materializar antecipadamente vs. gerar
  virtualmente; edição série vs. ocorrência) e a pergunta em aberto **P18**
- **Estende:** ADR-0001 §1 (relatório é projeção pura, e projeção não vira dado)

## Contexto

Uma recorrência é uma série sem fim previsto. Materializar tudo antecipadamente é impossível;
materializar nada impede a pessoa de editar ou descartar **uma** ocorrência sem mexer na série.

H4 pesava "previsibilidade e edição" contra "volume de dados", e a P18 permaneceu aberta porque o
código parecia responder duas coisas contraditórias: o motor gera virtualmente
(`src/domain/recurrence/engine.ts` diz isso no comentário) e a rota materializa
(`src/app/api/v1/occurrences/route.ts` diz isso no dela). As duas afirmações estão certas, e a
decisão é justamente a combinação — que nunca tinha sido escrita como uma coisa só.

## Decisão

### §1 O motor é puro e gera virtualmente

`generateOccurrences` não persiste, não sorteia e não lê relógio. Dado uma série e um mês, ele
diz o que aquela série produz — e produzir a mesma resposta duas vezes é propriedade dele, não
coincidência.

### §2 O id da ocorrência é derivado do par (série, mês)

`occurrenceIdOf(recurrence, month) = "${recurrenceId}:${month}"`. Uma série produz no máximo uma
ocorrência por mês, então o par já é a chave natural.

É essa derivação que costura §1 e §3: a ocorrência que o motor projeta e a que está guardada têm
**o mesmo id**, então uma pode ser reconhecida na outra sem tabela de correspondência. Sem isso,
"materializar de novo" criaria duplicata em vez de reencontrar o que já existe.

### §3 A visita ao mês materializa, com get-or-create idempotente

`GET /api/v1/occurrences?month=` cria uma linha por série aberta viva naquele mês, via
`occurrenceWriter.create`, que é get-or-create por (série, mês). Um mês já visitado — com
ocorrência já Paga, já editada ou já descartada — volta intocado.

Materializar **na visita**, e não antes, é o que resolve o trade-off de H4 nas duas pontas: o
volume cresce só com o que a pessoa realmente olhou, e a ocorrência existe como linha no momento
em que ela pode querer editá-la.

Não há `POST`: cliente nenhum cria ocorrência. A criação é efeito de leitura, e isso é declarado
na rota em vez de escondido.

### §4 Editar a série e editar a ocorrência são operações diferentes

`EditScope` distingue as duas. Editar a ocorrência mexe na linha materializada daquele mês;
editar a série mexe no template e vale dos próximos meses em diante. "Descartar" pula **esta**
ocorrência — a série segue normalmente no mês seguinte (Figma `34:2` nó 34:36).

Ocorrência já materializada e alterada nunca é reescrita por uma regeneração: §3 a devolve como
está.

### §5 A projeção de mês futuro no DRE NÃO materializa

O DRE de um mês futuro precisa das recorrências, mas pedir o DRE não pode criar dado. Então
`loadEntriesForMonths` (`_assemble.ts`) usa o que já está materializado e, **só** para série sem
ocorrência naquele mês, computa a mesma função pura em memória e joga fora depois da resposta.

Duas requisições independentes para o mesmo mês futuro nunca visitado calculam a mesma projeção —
é §1 que torna isso seguro. É também o que mantém ADR-0001 §1 de pé: relatório não escreve.

## Consequências

- `OccurrenceReader`/`OccurrenceWriter` existem como portas, e o `create` do adaptador **tem de
  ser** get-or-create; um `insert` puro quebraria §3 na segunda visita.
- A Revisão de Recorrentes pode oferecer ação por ocorrência sem antes "preparar" o mês: abrir a
  tela já o preparou.
- Um mês nunca visitado não tem linha de ocorrência. Relatório sobre ele funciona (§5), mas
  auditar o banco não mostra a série ali — o dado é o template, não a projeção.
- `src/data/contracts/recurrences.ts` tinha um comentário "OPEN QUESTION (P18, ADR-0004 not
  written yet)"; ele deixa de ser pergunta e passa a apontar para cá.

## Explicitamente NÃO feito

- **Materialização antecipada em lote** (gerar N meses à frente num job). Não há job, e §3 torna
  desnecessário.
- **Id sorteado pelo repositório.** Seria abrir mão de §2 e, com ele, da reconciliação entre
  projetado e guardado.
- **Recorrência com periodicidade diferente de mensal.** O produto tem uma só, e o par (série,
  mês) de §2 depende disso. Semanal ou anual reabre §2.
- **Ocorrência de parcela de Passivo.** Parcela não é ocorrência de recorrência: tem cronograma
  próprio, calculado por amortização (ADR-0005 §4). O que as duas compartilham é a tela de Revisão
  e o verbo "Descartar".
