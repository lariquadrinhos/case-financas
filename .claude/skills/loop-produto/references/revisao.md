# Revisão

Etapa mais importante do loop de desenvolvimento. Nenhum artefato — código, tela, fluxo, documento — é considerado concluído sem passar por ela.

## Regra geral

Todo artefato produzido é validado. Não existe exceção por urgência: uma tarefa pequena mal revisada custa mais caro no ciclo seguinte do que o tempo economizado agora.

## O que revisar, por área

**Engenharia**

- A implementação corresponde à spec e à ADR que a originou?
- Boas práticas de engenharia de sistemas foram respeitadas (não só "funciona")?
- Alguma premissa não confirmada (unknown known) se infiltrou na implementação?

**UI**

- Consistência visual com o restante do produto.
- Estados de erro, vazio e carregamento — não só o caminho feliz.

**UX**

- O fluxo revisado ainda corresponde ao fluxo de usuário descrito no PRD?
- A solução resolve o problema descrito, ou apenas entrega a funcionalidade pedida?

## Como revisar

- Prefira que quem revisa não seja quem implementou (ver `references/spec.md`).
- Use perguntas investigativas e esclarecedoras (`references/perguntas.md`) em vez de aprovação automática.
- Se a revisão encontrar um desvio de escopo, volte para a fase correspondente (PRD, Event Storming ou ADR) em vez de "consertar por cima" na implementação.
