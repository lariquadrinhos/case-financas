<!--
Leia `CONTRIBUTING.md` e `CLAUDE.md` §8 antes de abrir. O título segue
Conventional Commits: <tipo>(escopo): <descrição>. Faça a branch a partir de
`main` (feat/…, fix/…, docs/…).
-->

## Resumo

<!-- O que este PR muda e por quê. Diga o problema, não só a solução. -->

## Fonte da verdade

<!-- A que isto se ancora? PRD (docs/prd/), Event Storming (docs/event-storming/,
     hotspot H1..H10), especificação de telas (files_design/01-…), glossário
     (files_design/04-…) ou o frame do Figma (docs/figma/frames/*.xml).
     Decisão não trivial vira ADR em docs/adr/. -->

- Rastreia para:
- ADR criada/emendada:

## Como testar

<!-- Passos para quem revisa reproduzir o comportamento. Se houve mudança de
     tela, diga qual frame do Figma serve de referência de fidelidade. -->

## Checklist

- [ ] Segue `CLAUDE.md` §8; TDD — o teste veio primeiro.
- [ ] O teste foi visto FALHANDO antes da correção.
- [ ] Domínio isolado de framework (a dependência aponta para dentro: `src/domain` ← `src/data` ← `src/features` ← `src/app`).
- [ ] Idioma: todo o código em inglês, domínio incluído; texto de tela e rotas em português; conceito novo registrado em `src/domain/GLOSSARY.md`.
- [ ] Nomes de interface conferidos no glossário (`files_design/04-glossario-de-nomenclatura.md`); nenhum termo renomeado sem registro.
- [ ] Nenhum valor literal de cor ou medida em componente — só token de `src/styles/tokens.css` (`make audit-tokens` verde).
- [ ] **LGPD: nenhum dado real de pessoa alguma em código, fixture, teste, print ou na descrição deste PR.** Fixture é 100% sintética.
- [ ] Log sem valor monetário e sem texto digitado — passa por `src/lib/log.ts`, nunca `console.log`.
- [ ] Nenhuma origem externa nova no cliente: sem CDN, sem fonte remota, sem analytics, sem recurso de terceiro (a CSP de `next.config.ts` continua sem exceção).
- [ ] Toda leitura de dado passa pela sessão (`src/server/session.ts`) e carrega `userId`, mesmo sem autenticação.
- [ ] Decisão não trivial registrada em ADR (`docs/adr/`).
- [ ] Varredura de documentação feita: `README.md`, `docs/ARCHITECTURE.md`, ADR, PRD e `files_design/` atualizados quando o comportamento mudou.
- [ ] `make check` verde e app verificado rodando (`make dev`), não só no teste.

## Autoria de IA

<!-- Se houve assistência de IA, declare modelo, harness e skills usadas, e
     inclua o trailer Co-Authored-By no commit. -->

- [ ] Assistido por IA — autoria declarada e trailer `Co-Authored-By:` presente.
