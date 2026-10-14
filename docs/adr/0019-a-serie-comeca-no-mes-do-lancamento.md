# ADR-0019 — A série começa no mês do lançamento; recorrente Previsto é ocorrência, não lançamento

- **Status:** aceita (decisão do dono, 2026-09-23)
- **Revoga:** a leitura de PRD UC13 da v6 ("no mês seguinte ele aparece automaticamente como
  Previsto") como "a série começa no mês seguinte", e o comentário correspondente em
  `src/app/api/v1/entries/route.ts`
- **Estende:** ADR-0004 (ocorrência materializada por (série, mês)) · ADR-0014 (unidade de
  trabalho entre portas segregadas)

## Contexto

Até aqui, ativar a recorrência no Novo Lançamento gravava **o lançamento** e uma série que começava
**no mês seguinte**. O motivo era real: se a série começasse no mesmo mês, a Revisão de Recorrentes
listaria de novo o lançamento como Previsto, e marcá-lo Pago criaria um segundo lançamento no mesmo
mês — a dupla contagem do PRD §5.

O custo apareceu no primeiro uso com dados reais, em 2026-09-23. A pessoa lançou Contador, Academia,
Streaming e mais uma despesa para 15/10, Previstas e recorrentes. Na Revisão de Recorrentes de
outubro nenhuma delas aparecia; todas surgiam só em **novembro**. O lançamento de origem é um
lançamento, não uma ocorrência, e a Revisão só lista ocorrências. "Minhas recorrências estão
contando em novembro e deveriam estar em outubro."

## Decisão

1. **A série começa no mês do lançamento** (`startDate = data do lançamento`).
2. **Recorrente Previsto não grava lançamento avulso.** A série nasce com a ocorrência do mês
   materializada, Prevista, com o valor digitado — inclusive numa série "a definir", que só nasce
   em branco do mês seguinte em diante. É essa ocorrência que aparece na Revisão de Recorrentes e
   que o DRE Previsto projeta. O `POST /entries` responde com a ocorrência.
3. **Recorrente Pago grava o lançamento e o vincula** como a ocorrência paga do mês
   (`status = Paid`, `entryId = lançamento`), exatamente como "Marcar Pago" deixaria.
4. **A dupla contagem continua impossível**, agora por vínculo e não por calendário: a ocorrência
   é única por (série, mês) (ADR-0004); o DRE só projeta ocorrência Prevista **sem** `entryId`
   (`_assemble.ts`); e o domínio recusa pagar ocorrência que não está aberta
   (`recurrence.occurrence_not_open`).
5. **Tudo numa transação** (ADR-0014): série, ocorrência e lançamento nascem juntos ou não nascem.

## Consequências

- **Um recorrente Previsto não aparece no Histórico**, que lista lançamentos. Aparece na Revisão
  de Recorrentes e no DRE Previsto — como já acontecia com as ocorrências dos meses seguintes.
  Quando é marcado Pago, vira lançamento e passa a aparecer no Histórico.
- **Séries criadas antes desta decisão** são convertidas por `scripts/convert-series-adr0019.ts`
  (regra pura em `src/domain/recurrence/conversion.ts`): a série passa a começar no mês do
  lançamento de origem; origem Prevista vira a ocorrência do mês e sai como lançamento; origem Paga
  fica, vinculada à ocorrência paga. Simula por padrão (`--apply` grava), uma transação por série, e
  é idempotente. Rodado em 2026-09-23 no banco de uso: 4 de 4 séries convertidas, com backup antes
  e ensaio numa cópia.
- **"Encerrar recorrência" passa a descartar as ocorrências já materializadas depois de
  `closedOn`** que ainda estavam abertas (`occurrencesDiscardedByClosure`). Antes só gravava a
  data, e uma ocorrência de um mês posterior já visitado continuava na Revisão pedindo pagamento —
  medido ao encerrar a série duplicada do Contador. Vale para a rota de encerramento e para o
  Descartar lançamento.

## Junto desta decisão: "Descartar lançamento"

No mesmo relato, a pessoa não conseguia tirar os lançamentos criados por engano: nenhuma tela
chamava o `DELETE /entries/{id}`, e um lançamento pago pela Revisão respondia 409, preso pela
ocorrência (`occurrences.entry_id`, RESTRICT). Agora:

- **"Descartar"** no modo de edição do Novo Lançamento e na linha do Histórico, com a confirmação
  dos itens de cadastro (`ConfirmActionButton`). O verbo é o do glossário (files_design/04), nunca
  "Excluir".
- Descartar um lançamento que é o pagamento de uma ocorrência **descarta aquele mês** da série
  (`discarded`, pula só o mês), em vez de devolvê-lo a Previsto — senão a Revisão pediria de novo o
  pagamento que a pessoa acabou de apagar.
- A confirmação oferece **"Encerrar a recorrência também"**, desligado por padrão: encerrar e
  descartar continuam ações distintas (files_design/04), por isso é uma escolha explícita.
- Continua recusado (409) o lançamento pago com divergência, que tem Evento ou Pendência ligados a
  ele; a confirmação diz isso.
- Em edição, o título do modal passa a ser **"Editar Lançamento"**: com "Novo Lançamento" a pessoa
  leu a edição como criação de um segundo lançamento e fechou sem salvar.
