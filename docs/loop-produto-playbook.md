# Playbook — Histórico replicável do Loop de Produto

Este documento é o **registro fiel, passo a passo, dos prompts** que conduziram este projeto — do zero até o documento vivo. Cada passo traz o **prompt dado**, as **perguntas de esclarecimento** que o Claude fez (com as respostas escolhidas) e o **artefato produzido**. Serve para: (a) reproduzir a mesma sequência em outro produto e (b) entender por que cada decisão existe.

Complementa a skill [`loop-produto`](../.claude/skills/loop-produto/SKILL.md): a skill é o conhecimento que o Claude carrega; este playbook é o traço real de como conduzimos.

> **Como reproduzir:** siga os passos na ordem, colando cada prompt e respondendo às perguntas de esclarecimento quando elas aparecerem. O Claude deve **parar e perguntar** em cada ambiguidade que mude o comportamento do produto — nunca avançar sobre palpite.

---

## Passo 1 · Criar a skill do processo

**Prompt dado:** "Dado todo o material e instruções abaixo, vamos construir um documento de instruções para esse projeto novo, a fim de criar uma habilidade que poderá ser usada em qualquer etapa do processo, refletindo os pensamentos e diretrizes do projeto. **Não assuma premissas e adicione isso como uma das principais diretrizes.**"

Acompanhado do material do método (looping de concepção: brainstorming + PRD; looping de desenvolvimento: Event Storming/DDD, ADR, Spec/SDD, Revisão) e de cinco artigos de referência para aplicar o cerne:

- Fable — _finding your unknowns_ (framework dos 4 quadrantes de incógnitas).
- 8dialogos — _a arte de fazer perguntas_ (tipos e intenção de perguntas).
- Addy Osmani — _loop engineering_ (loops pequenos, verificação, memória externa).
- PM3 — _PRD_ (elementos do documento).
- Claude — _artifacts in Claude Code_ (materializar artefatos como páginas vivas).

**Produzido:** a skill `loop-produto` — `SKILL.md` com a diretriz central "nunca assuma premissas" em destaque, + referências em `references/` (`perguntas.md`, `brainstorming.md`, `prd.md`, `event-storming.md`, `adr.md`, `spec.md`, `revisao.md`).

---

## Passo 2 · Ancorar a Spec em Spec Kit / brownfield

**Prompt dado:** "a de spec, quero que se baseie também no documento produzido no site: `epam.com/insights/ai/blogs/using-spec-kit-for-brownfield-codebase`".

**Produzido:** `references/spec.md` ampliado com o conteúdo do Spec Kit — **Constitution** como pré-requisito, ciclo Specify → Plan → Tasks → Implement → Verificar, e a distinção **green field × brown field** (specs de escopo restrito, os 5 riscos de brownfield, verificação dupla). Fonte da EPAM bloqueou fetch direto; conteúdo veio das discussões oficiais do `spec-kit` e guia correlato.

---

## Passo 3 · Fixar `/docs` como casa dos artefatos

**Prompt dado:** "Com a evolução do projeto, todas PRDs, ADRs e Specs deverão ser armazenadas como documentação do projeto `/docs`. Adicione isso."

**Produzido:** seção "Documentação do projeto (`/docs`)" no `SKILL.md` e convenções de caminho em cada referência: `docs/prd/<slug>.md` (editável, com changelog), `docs/adr/NNNN-titulo.md` (numeração imutável no nome), `docs/specs/<slug>/`, `docs/constitution.md`.

---

## Passo 4 · Brainstorming → PRD v1

**Prompt dado:** "O brainstorming foi realizado e todo material transcrito da reunião foi enviado para o time de produto, que deverá construir o PRD a partir dele" + **transcrição da reunião** (a pessoa descrevendo as entidades dela PF/PJ, fontes de renda, custos, investimentos como "caixa preta", desejo de DRE, e a fricção de preencher a planilha).

**Perguntas de esclarecimento (varredura de unknowns):**

| Pergunta                                            | Resposta escolhida                         |
| --------------------------------------------------- | ------------------------------------------ |
| Uso pessoal ou produto multiusuário?                | **MVP pessoal, produto depois**            |
| Entrada de dados manual ou com integração bancária? | **Manual no MVP, Open Finance no roadmap** |
| Contador usa o sistema ou é só um custo?            | **Só um dado de custo**                    |
| Plataforma?                                         | **Web responsivo**                         |

**Produzido:** `docs/prd/financas-pf-pj.md` **v1**, com os pontos não resolvidos listados explicitamente como "pontos em aberto" (não assumidos).

---

## Passo 5 · Incorporar a planilha de exemplo → PRD v2

**Prompt dado:** enviou `Meu DRE.xlsx` "que deverá ser usada como exemplo e clarificar a ideia geral" + respostas às lacunas: plano de contas exato (na planilha), mecânica de "fixar com desvio" adiada, fechamento mensal automático, múltiplos clientes PJ (não só a Turbi), contador não é ator principal.

**O que o Claude fez:** leu a planilha (abas MODELO, PAINEL, INDICADORES e um mês) — plano de contas de 10 blocos, Balanço, Indicadores, coluna de STATUS com `SUMIF "Pago"`.

**Perguntas de esclarecimento:**

| Pergunta                                                      | Resposta escolhida                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| DRE único (entidade como atributo) ou dois DREs por entidade? | **"Podemos ter os 3 — um DRE único e separado, como formas de visualização diferentes"** |
| Painel/Indicadores entram no MVP?                             | **Trazer para o MVP**                                                                    |
| Status Previsto/Pago vira requisito?                          | **Sim, faz parte do MVP**                                                                |

**Produzido:** PRD **v2** — plano de contas de referência completo, DRE em 3 visões, Painel/Indicadores no escopo, status Previsto/Pago, destinação do lucro em 4 categorias.

---

## Passo 6 · Lançamentos recorrentes → PRD v3

**Prompt dado:** "Tem coisas que serão cadastradas como recorrentes, e deverão já aparecer no mês seguinte, mas o valor poderá ser definido fixamente ou a definir."

**Produzido:** PRD **v3** — motor de recorrência (propagação automática para o mês seguinte como Previsto; valor **fixo** copiado ou **a definir** em branco). Marcada como lacuna nova: regras de encerramento/edição da recorrência.

---

## Passo 7 · Generalizar "a pessoa" e limpar o PRD → PRD v4

**Prompt dado:** "Quando nos referirmos à pessoa que valida o projeto, usar **'a pessoa'**, não pelo nome dela, porque será usado por outras pessoas. Remover a pessoa de stakeholder, **não quero nada de KPI**. O projeto foi realizado por **Larissa Quadros e a pessoa**. Pode remover os pontos em aberto, eu já os defini."

**Produzido:** PRD **v4** — toda referência trocada para "a pessoa", seção de KPIs removida, "pontos em aberto" removidos, autoria do brainstorming atribuída a Larissa Quadros e a pessoa.

---

## Passo 8 · 1ª rodada de revisão do time → PRD v5

**Prompt dado:** "Seguem orientações com resposta do time de produto" — 7 lacunas de alto impacto (relação intercompany PF↔PJ, regime de competência × caixa, plano de contas fixo/editável, conciliação de caixa, término/parcelamento de recorrência, onboarding/saldos iniciais, persistência/backup), 4 de segunda ordem (aporte × valorização, D&A, IR, tensão fricção × web) e 1 de estrutura (cronograma) — **cada uma já com a resposta do time**.

**Perguntas de esclarecimento (duas respostas do time se contradiziam):**

| Pergunta                                        | Resposta escolhida                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| O que significa "contabilizar no mês anterior"? | **"Quis dizer mês corrente, mas o usuário pode definir a data"**                                    |
| Consumo livre é despesa ou saldo?               | **"É dinheiro para uso livre; seu uso é despesa, mas nem tudo é gasto; rótulo é opção do usuário"** |

**Produzido:** PRD **v5** — eliminação intercompany, plano de contas editável, instalação local sem login com banco de dados, conciliação por conta, recorrência com término, realização só na venda, IR manual, onboarding reaproveitando telas.

---

## Passo 9 · 2ª rodada de revisão — corrigir inconsistências → PRD v6

**Prompt dado:** o time apontou que a v5 tinha **inconsistências** (A: consumo livre virou saldo e despesa ao mesmo tempo; B: D&A zerado × Painel exigindo EBITDA≠EBIT; C: pró-labore e distribuição tratados igual; D: competência × Previsto/Pago sem regra; E/F/G: passivos, backup, ciclo da recorrência) — "corrija as inconsistências, as respostas já foram dadas; se há dúvida, pergunte".

**Perguntas de esclarecimento (as duas que ainda eram genuinamente ambíguas):**

| Pergunta                                  | Resposta escolhida                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Consumo livre — despesa ou saldo, afinal? | **Linha de despesa no DRE** (fórmula "esperado − real" descartada)                      |
| Mês do DRE — competência ou pagamento?    | **"O usuário define a data que foi pago, e isso contabiliza no DRE"** (regime de caixa) |

**Produzido:** PRD **v6** — as 7 inconsistências corrigidas: consumo livre = só despesa; D&A=0 → EBITDA=EBIT; intercompany diferenciado; regime de caixa por data de pagamento; DRE ≠ passivos (sem baixa automática); backup = decisão de Engenharia; edição de recorrência e "a definir" pendente como opções do usuário.

---

## Passo 10 · Event Storming (markdown)

**Prompt dado:** "Bora para o event storming."

**O que o Claude fez:** invocou a skill `loop-produto`, tratou como **green field**, mapeou eventos (no passado), comandos, atores, políticas, agregados, bounded contexts e hotspots.

**Perguntas de esclarecimento:**

| Pergunta                               | Resposta escolhida                                          |
| -------------------------------------- | ----------------------------------------------------------- |
| Estrutura do DRE fixa ou configurável? | **Estrutura de blocos configurável** (elevou o hotspot H10) |
| Mês fechado é editável?                | **Sempre editável** (recálculo em cascata)                  |
| Passivos são manuais?                  | **100% manual**                                             |

**Produzido:** `docs/event-storming/financas-pf-pj.md` — 7 fluxos, agregados, bounded contexts, hotspots H1–H10 e backlog de 6 ADRs.

---

## Passo 11 · Event Storming vira artefato vivo (HTML)

**Prompt dado:** "Vamos concluir o event storming em um artefato, tal como foi feito em um mapa de contexto em HTML de outro projeto, ao invés de um markdown, explicando todo o contexto e **criando simuladores que ajudam o time a pensar** no produto e no domínio."

**O que o Claude fez:** estudou o HTML de referência (design system, legenda de post-its, hotspots com tooltip, simuladores embutidos) e recriou o padrão com paleta própria.

**Produzido:** `docs/event-storming/financas-pf-pj.html` com 5 simuladores: regime de caixa, eliminação intercompany, motor de recorrência, realização na venda e DRE configurável. Validado (tags, âncoras, `node --check`).

---

## Passo 12 · Tornar o HTML um documento vivo completo

**Prompt dado:** "Ficou ótimo, mas não está explicando tudo que tem no PRD. Minha ideia — assim como no arquivo que mandei — é isso ser um **documento vivo para todos os times trabalharem a partir dele**."

**Produzido:** HTML expandido para cobrir o PRD inteiro (14 seções): visão, escopo, stakeholders, o modelo financeiro (DRE explicado bloco a bloco, Balanço, Indicadores), as 8 regras de negócio com os 5 simuladores, funcionalidades, os 18 casos de uso, fluxos, requisitos e critérios de liberação — mais glossário financeiro/DDD via tooltip.

---

## Passo 13 · Auditar a planilha contra o que foi produzido

**Prompt dado:** "Dada a planilha, tem algo que esquecemos no PRD e no event storming? Se não, pensamos nos próximos passos. Senão, me diga e penso se vale atualizar."

**O que o Claude fez:** releu as **fórmulas** (não só os valores) e encontrou 4 divergências: (1) status "Pago" assimétrico — receita sempre conta, despesa só quando paga; (2) o Painel projeta meses futuros (forecast); (3) invariante "saldo não destinado deve ser zero"; (4) o "aporte em investimentos" da destinação é o mesmo que aumenta o saldo de investimentos. Reportou sem alterar, aguardando decisão.

---

## Passo 14 · Prompt replicável + planilha no repo

**Prompt dado:** "Se pudéssemos resumir tudo num prompt replicável futuramente, como faríamos? Adicione no repo. Também quero adicionar a planilha no repositório — onde você sugere?"

**Produzido:** a planilha em `docs/reference/meu-dre.xlsx` e a primeira versão deste playbook. (Corrigido no passo seguinte para ser fiel ao histórico real.)

---

## Aprendizados que a sequência revelou

- **Diretriz nº 1, presente do início ao fim:** nunca assumir premissas. Cada versão do PRD nasceu de uma varredura de unknowns e de perguntas com opções estruturadas, não de palpite.
- **Ler fórmula, não valor.** A planilha só revelou o status assimétrico, a invariante de fechamento e o elo destinação→investimento quando as fórmulas foram lidas (passos 5 e 13).
- **A contradição do time é sinal, não ruído.** "Consumo livre" e "regime de caixa" só fecharam quando o Claude apontou a contradição e perguntou de novo com opções (passos 8 e 9).
- **Artefato vivo > texto estático.** O `.md` é a fonte versionável; o HTML com simuladores (passos 11–12) é a camada a partir da qual os quatro times trabalham.
- **Marcar ambiguidade como hotspot** (passo 10) evitou, no green field, convergir cedo demais.
