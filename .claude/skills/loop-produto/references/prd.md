# PRD — Product Requirement Document

## O que o PRD é (e não é)

O PRD descreve **requisitos e pontos de atenção do processo** — não como a solução deve ser construída tecnicamente (isso é papel da ADR/spec, no loop de desenvolvimento). É o documento que orienta todos os envolvidos com precisão sobre finalidade, funcionalidades, público-alvo e recursos.

- **Editável e versionado.** Novas versões substituem/complementam as anteriores; mantenha histórico.
- **Não registra mudanças de negócio ou de produto já decididas.** Uma mudança de rumo depois que o PRD existe vira uma ADR, não uma edição silenciosa do PRD.
- Todo conteúdo do PRD nasce do brainstorming e pode ser sustentado por artefatos/exemplos que ajudem a explicar o produto (protótipos, diagramas, fluxos).

## Estrutura

1. **Propósito e escopo** — o que este produto/mudança é e, igualmente importante, o que não é.
2. **Stakeholders envolvidos** — quem decide, quem é consultado, quem é informado.
3. **Funcionalidades e quais problemas resolvem** — cada funcionalidade amarrada a um problema real, não a uma feature por si só.
4. **Casos de uso do produto** — cenários concretos de uso.
5. **Requerimentos técnicos, de usabilidade e de suporte** — restrições e expectativas, sem prescrever a solução.
6. **Cronograma** — marcos, não necessariamente datas rígidas.
7. **KPIs do projeto** — como o sucesso será medido.
8. **Critérios de liberação** — o que precisa ser verdade para lançar.
9. **Fluxos de usuário** — a jornada, ponta a ponta.

## Antes de escrever ou editar

Rode a varredura de unknowns (`references/perguntas.md`). Um PRD escrito sobre premissas não confirmadas é a fonte mais comum de retrabalho no loop 2.

## Onde fica

`/docs/prd/<slug>.md` — um arquivo por produto/iniciativa, na raiz do repositório. Ao editar uma versão existente, edite in-place e registre a mudança num changelog no topo do arquivo:

```
## Changelog
- v3 — 2026-07-11 — <autor> — <resumo da mudança>
- v2 — ...
- v1 — ...
```

Não crie um arquivo novo por versão — o PRD é um documento vivo, e o changelog é o que preserva o histórico sem fragmentar o conteúdo.
