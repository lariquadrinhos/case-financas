---
name: loop-produto
description: Guia o ciclo completo de concepção e desenvolvimento de produto deste projeto — brainstorming, PRD, Event Storming/DDD, ADR, spec (SDD) e revisão. Use em QUALQUER etapa do processo em que Negócio, Produto, Engenharia ou Design estejam envolvidos, seja para brainstormar uma ideia nova, escrever/editar um PRD, mapear eventos de domínio, registrar uma decisão de arquitetura, planejar/implementar uma spec, ou revisar um artefato de produto, design ou engenharia.
---

# Loop de Produto e Engenharia

Este projeto é conduzido por dois loops encadeados. O primeiro concebe a ideia; o segundo a transforma em software. Toda mudança relevante — de negócio, produto, design ou engenharia — deve passar por um desses loops, nunca ser feita "por fora".

```
LOOP 1 — Concepção          LOOP 2 — Desenvolvimento
Brainstorming → PRD    →    Event Storming/DDD → ADR → Spec (SDD) → Revisão
```

## Diretriz central: nunca assuma premissas

Esta é a regra mais importante deste documento e se aplica a **todas** as etapas abaixo, sem exceção. Antes de brainstormar, escrever um PRD, mapear eventos, registrar uma ADR ou implementar uma spec, torne explícitas as lacunas de conhecimento em vez de preenchê-las por conta própria.

Use o framework de quatro quadrantes para isso:

- **Known knowns** — o que já está explícito no pedido/documento.
- **Known unknowns** — lacunas que você já percebe e pode perguntar diretamente.
- **Unknown knowns** — suposições tão "óbvias" que ninguém as disse em voz alta (é aqui que a maioria dos erros mora). Torne-as explícitas e confirme.
- **Unknown unknowns** — pontos cegos. Peça, ou faça você mesmo, uma "blind spot pass": liste o que poderia estar faltando antes de seguir.

Antes de avançar de fase, faça essa varredura e devolva perguntas — não conclusões apressadas. Ao formular as perguntas, escolha estrutura e intenção deliberadamente (ver `references/perguntas.md` para o repertório completo): perguntas abertas para explorar, fechadas para confirmar, investigativas para desafiar pressupostos, esclarecedoras para fechar ambiguidade. Pratique escuta ativa e mente aberta — a pergunta certa vale mais que a resposta rápida.

Isso vale tanto para sessões humanas (Negócio/Produto/Engenharia/Design) quanto para qualquer interação com o Claude dentro deste projeto: forneça contexto (seu nível de expertise, em que ponto do raciocínio você está, familiaridade com o domínio) para que a resposta seja calibrada, e não genérica.

## Documentação do projeto (`/docs`)

Todo PRD, ADR e Spec produzido neste projeto é gravado em `/docs`, na raiz do repositório — nunca fica só na conversa, num Artifact avulso ou numa ferramenta externa não versionada. É isso que torna a evolução do projeto rastreável e sobrevivente à troca de pessoas e de sessões. Um artefato de qualquer etapa do loop só é considerado concluído quando está salvo em `/docs` no formato abaixo.

- `/docs/constitution.md` — documento único e vivo com os padrões e princípios arquiteturais do projeto (ver `references/spec.md`).
- `/docs/prd/<slug>.md` — um arquivo por produto/iniciativa. É editável in-place; ao alterar, adicione uma linha num changelog no topo do arquivo (data, versão, autor, resumo da mudança) em vez de apagar o histórico anterior.
- `/docs/adr/NNNN-titulo-curto.md` — um arquivo por ADR. A numeração sequencial e imutável vive no próprio nome do arquivo, o que garante a rastreabilidade exigida.
- `/docs/specs/<slug>/` — uma pasta por spec, contendo `spec.md` (specify), `plan.md` e `tasks.md`, conforme as fases descritas em `references/spec.md`.

Um Artifact do Claude Code continua sendo a forma recomendada de visualizar/compartilhar um artefato durante a sessão (ver Loop 1), mas ele é complementar, não substitui o arquivo correspondente em `/docs`.

## Papéis

Negócio, Produto, Engenharia e Design participam dos dois loops, mas a intensidade muda:

- **Brainstorming**: sempre em grupo, multidisciplinar. Não existe ideia certa ou errada nessa fase.
- **PRD**: multidisciplinar, mas tipicamente conduzido por Produto.
- **Event Storming/ADR**: conduzido pelo time de Engenharia (com Design quando a decisão toca experiência).
- **Spec**: trabalho em grupo, mas a execução/criatividade é individual — ver `references/spec.md`.
- **Revisão**: todos os papéis relevantes ao artefato revisam; é a etapa mais importante do loop de desenvolvimento e nenhum artefato é considerado pronto sem ela.

## Loop 1 — Concepção da ideia

### 1. Brainstorming

Sessão em grupo, multidisciplinar, sem julgamento de certo/errado. Técnicas disponíveis: brainstorming reverso, palavras aleatórias, 5 porquês, SCAMPER, Starbursting, post-its. Antes de fechar a sessão, aplique a varredura de unknowns acima.
→ Detalhes e como escolher a técnica: `references/brainstorming.md`

### 2. PRD (Product Requirement Document)

Descreve **requisitos e pontos de atenção**, nunca a solução técnica. É editável e versionado. PRD **não** é o lugar para registrar mudanças de negócio/produto já decididas — isso vai para uma ADR (loop 2). Estruture com: propósito e escopo, stakeholders, funcionalidades e problemas resolvidos, casos de uso, requisitos técnicos/usabilidade/suporte, cronograma, KPIs, critérios de liberação, fluxos de usuário.
→ Template completo e regras de versionamento: `references/prd.md`

Sempre que possível, materialize o PRD (e os artefatos que o sustentam) como um Claude Code Artifact — página viva, atualizável e compartilhável com o grupo — em vez de um texto estático perdido no histórico da conversa.

## Loop 2 — Desenvolvimento

### 3. Event Storming / DDD

Toda mudança que sai do PRD é mapeada em eventos e atores via Event Storming antes de virar ADR — isso produz ADRs mais concisas e assertivas. Conduzido pelo time de desenvolvimento. A abordagem muda conforme o terreno: green field explora possibilidades amplas; brown field mapeia o existente antes de propor mudança. Perguntas devem ter intenção clara (ver `references/perguntas.md`).
→ `references/event-storming.md`

### 4. ADR (Architecture Decision Record)

Toda decisão arquitetural é registrada em ADR: numerada para rastreabilidade, versionada, com justificativa clara do problema e da melhoria proposta. Alternativas descartadas aparecem no documento com seus trade-offs — nunca são omitidas.
→ Template: `references/adr.md`

### 5. Spec (SDD — Spec-Driven Development)

Dev e Design planejam, implementam e verificam em tarefas pequenas — quanto menor a tarefa, maior a assertividade. O trabalho é produzido em grupo, mas a execução é individual. Respeite o limite cognitivo humano (inferior ao de uma máquina): não acumule escopo além do que cabe na cabeça de quem está implementando. Separe quem cria de quem verifica sempre que possível, e automatize para acelerar o que você já entende — nunca para evitar pensar. Toda spec pressupõe uma **Constitution** (padrões e princípios do projeto) por trás dela, e a abordagem muda em green field (spec de ponta a ponta) vs. brown field (spec de escopo restrito ao delta, respeitando arquitetura e testes existentes).
→ `references/spec.md`

### 6. Revisão

Etapa mais importante do loop. Todo artefato — código, UI, UX, documento — é revisado contra boas práticas de engenharia, UI e UX antes de ser considerado concluído. Nenhum artefato "passa direto".
→ Checklist: `references/revisao.md`
