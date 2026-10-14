# CLAUDE.md — Bigorna

Este documento é a base do repositório. Ele diz **como** qualquer contribuinte,
humano ou IA, trabalha aqui. Nada volátil mora neste arquivo: decisão técnica
mutável vive em `docs/adr/`, regra de produto vive no PRD, nome de tela vive no
glossário. Se você precisou mudar este arquivo para caber uma verdade nova, quase
sempre a verdade nova pertence a outro documento.

> **NÃO ASSUMA PREMISSAS.** Se algo não está escrito nas fontes da verdade,
> pergunte à pessoa desenvolvedora. Ela é a âncora do projeto: **a IA propõe, ela
> decide, a ADR registra.** O que foi decidido é escrito; o que não foi escrito
> não foi decidido.

## 1. Resumo do projeto

Bigorna é uma aplicação web privada de controle financeiro pessoal e empresarial:
uma pessoa registra receitas, despesas e lucro das suas duas entidades (Pessoa
Física e Pessoa Jurídica) e lê DRE, Balanço, Evolução Mensal e Indicadores sobre o
mesmo conjunto de lançamentos. A fase atual entrega o domínio com regras puras e
testadas, o banco SQLite atrás de portas segregadas (ADR-0012), a API HTTP em
`/api/v1` com contrato OpenAPI gerado dos schemas Zod, e as telas fiéis ao Figma;
a fase 2 liga a autenticação (ADR-0008), sem mexer nas telas.

Antes de tocar em qualquer coisa, leia **`docs/prd/financas-pf-pj.md`** (o que o
produto é e as regras de negócio) e **`docs/event-storming/financas-pf-pj.md`** (o
domínio: eventos, agregados, hotspots H1..H10).

## 2. Fontes da verdade e precedência

| Documento                                         | Papel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/prd/financas-pf-pj.md`                      | **O produto.** Escopo, casos de uso, critérios de liberação e as regras de negócio imutáveis. É a v6; toda alteração entra pelo changelog no topo, nunca por edição silenciosa                                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/event-storming/financas-pf-pj.md`           | **O domínio.** Eventos, comandos, políticas, agregados, bounded contexts e os hotspots H1..H10 que viram ADR. Mapeia; não decide arquitetura                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `files_design/01-especificacao-de-telas.md`       | **O que cada tela faz.** Descrição funcional, tela a tela, com a marcação 🟦 PRD / 🟩 Design que diz de onde veio cada decisão                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `files_design/03-modelo-de-dados-por-tela.md`     | **Com que campos.** Tipo, obrigatoriedade, validação e default de cada campo de formulário. Complementa o Event Storming, não o substitui                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `files_design/04-glossario-de-nomenclatura.md`    | **O vocabulário fechado.** Todo nome de tela, botão e conceito, com o motivo da escolha. Consulte antes de renomear qualquer coisa                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/figma/INDEX.md` + `docs/figma/frames/*.xml` | **A fidelidade de estrutura.** 130 frames da página **Wireframe** do arquivo `7IZBeQV15kgZp7Shcqh4c8`, extraídos como árvore literal (ids, camadas, posição, tamanho, todo o texto). A API do Figma tem limite de chamadas: use os XML, não a API. **A fidelidade VISUAL é a página Mockup** (ADR-0015), que não tem extração offline — o Wireframe está congelado na v6 e carrega nomes que a v7 aposentou                                                                                                                                                                           |
| `docs/ARCHITECTURE.md`                            | **Como é construído.** Oito seções: visão geral, os contextos delimitados, as camadas e a regra de dependência, o contrato dos repositórios, os fluxos-chave, observabilidade, postura de LGPD e a tabela de decisões registradas (§8), que mapeia cada decisão à ADR e ao hotspot que a originou                                                                                                                                                                                                                                                                                     |
| `docs/adr/`                                       | **As decisões técnicas**, uma por arquivo, `NNNN-titulo-curto.md`, numeração imutável. **Vinte escritas: 0001 a 0005 (o domínio) e 0007 a 0021 (a infraestrutura e as decisões posteriores).** As cinco de domínio nasceram do backlog do Event Storming e foram escritas em 2026-09-08, depois do código — o defeito que elas corrigem é justamente esse: o número era citado em comentário e o arquivo não existia. **0006 fica vaga de propósito**: ADR-0007 a esvaziou ao pivotar de app empacotado para web privado, e renumerar quebraria citações. Não reaproveite esse número |
| `CLAUDE.md`                                       | Como trabalhar (este arquivo)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Precedência em caso de conflito: PRD > Event Storming > especificação de telas > ARCHITECTURE > ADR > CLAUDE.md.**

O design fica **depois do PRD** porque ele preenche lacuna, não cria produto: onde
a especificação de telas marca 🟩, ela está decidindo o que o PRD não decidiu — e
onde ela contraria um 🟦, quem está errado é ela. Mas o design fica **antes da
arquitetura** porque a tela é o requisito e a arquitetura é o meio: nenhuma
decisão técnica tem autoridade para simplificar um fluxo, remover um campo ou
renomear um botão porque implementar do jeito desenhado deu trabalho. Se o
desenho for de fato impossível ou caro demais, isso não se resolve no código —
volta para o design e para o PRD, e a mudança é registrada lá.

## 3. Regras de negócio imutáveis

As regras **não** são definidas aqui. Elas vivem no PRD, e o PRD é a única cópia.
Duas obrigações valem sobre elas:

- **O teste cita a regra pelo nome no título.** Exemplo:
  `it('PRD §5 — Previsto não entra no DRE', …)`. Um teste sem esse rastro protege
  um comportamento sem dizer qual, e a próxima pessoa não sabe se pode mudá-lo.
- **Enfraquecer uma regra exige ADR.** Não existe "flexibilizar temporariamente"
  em commit. Se a regra atrapalha, o caminho é registrar a decisão de mudá-la.

As cinco mais mal interpretadas, com a cláusula que resolve cada uma:

| Regra                                  | A cláusula                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regime de caixa pela data de pagamento | O mês contábil de um lançamento é o mês da **data de pagamento informada pela pessoa** — nunca a data de criação, nunca a data de vencimento, nunca "hoje". Exceção única: uma despesa com **"Contabilizar em"** escolhido entra no mês escolhido (ADR-0021)                                   |
| Previsto não entra no DRE              | Um lançamento **Previsto** é planejamento e é invisível para DRE, Balanço, Evolução Mensal e Indicadores; ele só passa a contar quando vira **Pago**                                                                                                                                           |
| Eliminação intercompany no consolidado | Pró-labore e distribuição de lucro são eliminados na visão **Consolidado** (na PJ, pró-labore é despesa operacional e distribuição é apropriação no bloco 10; na PF, ambos são receita). **Dividendo de investimento externo NÃO é intercompany**: é receita comum do bloco 1 e não se elimina |
| D&A sempre zero, logo EBITDA = EBIT    | Não há depreciação nem amortização mensal no MVP. A linha de D&A existe por fidelidade à estrutura do DRE e vale zero; portanto EBITDA e EBIT coincidem **todo mês**, e isso tem que estar consistente em DRE, Evolução Mensal e Indicadores                                                   |
| Realização de ganho só na venda        | Investimento e bem material não são reavaliados nem depreciados mês a mês. Ganho ou perda só é reconhecido no **lançamento de venda**, como resultado não operacional                                                                                                                          |

## 4. Princípios de engenharia

- **TDD por padrão:** vermelho → verde → refatorar. A mudança **começa** com um
  teste que falha. Escrever o teste depois testa o código que você escreveu, não a
  regra que você devia ter implementado.
- **Clean Architecture:** a dependência aponta para dentro e o framework fica na
  borda. `src/domain` não sabe que existe React, Next, banco ou HTTP — é por isso
  que entrar com SQLite (ADR-0012) não tocou em regra de negócio nenhuma, e por
  isso trocar de banco na fase 2 também não vai tocar. O ESLint impõe isso; ver §5.
- **Contrato antes de implementação:** defina a porta em `src/data/contracts` e o
  schema Zod da borda em `src/api/contracts` antes de escrever o adaptador ou a
  tela. Contrato depois vira o que a primeira implementação calhou de fazer.
- **SOLID é premissa, com mecanismo por letra — ADR-0013.** Não é sigla decorativa:
  cada letra tem um lugar no código, e a ADR aponta o arquivo.
  - **S** — um handler autoriza, parseia, delega e serializa. Nada mais; a
    montagem do read model mora fora dele (`src/app/api/v1/reports/_assemble.ts`).
  - **O** — relatório novo, erro de domínio novo e recurso novo na spec entram
    acrescentando (rota nova, linha em `DOMAIN_ERROR_STATUS`, `registerPath`),
    nunca editando handler existente.
  - **L** — todo adaptador roda a MESMA suíte escrita contra a porta
    (`src/data/contracts/*.contract-test.ts`); onde ela não cabe, o cabeçalho do
    arquivo diz por quê e a suíte própria cobre as mesmas invariantes.
  - **I** — portas pequenas e em pares `Reader`/`Writer`, nunca um
    repositório-deus; e ninguém recebe o registro inteiro para usar uma porta.
  - **D** — o handler depende do TIPO da porta, importa de `@/data` (composition
    root) e nunca de `@/data/sqlite`; o ESLint falha o portão se tentar.
- **Sem overengineering.** DRY e KISS continuam valendo: prefira o desenho mais
  simples que atende a regra. Abstração criada para um caso hipotético é dívida
  com juros — inclusive abstração feita "por SOLID" (ver ADR-0013,
  "Explicitamente NÃO feito").
- **Qualidade e segurança são premissas, não opções.** Não existe "depois a gente
  endurece". Ver §9.

## 5. Estrutura do projeto

```
src/
  domain/        regras puras, sem framework
    core/       money.ts · time.ts · ids.ts · vocabulary.ts
  data/          fronteira de persistência
    contracts/    as portas de repositório + as suítes de contrato (*.contract-test.ts)
    sqlite/       o adaptador desta fase (Drizzle + better-sqlite3) — ADR-0012
    fixtures/     dados sintéticos de desenvolvimento e de teste
    index.ts      composition root: o único lugar que amarra porta a adaptador
  api/            contrato HTTP: schemas Zod, handler(), registry OpenAPI
  features/       casos de uso e componentes por funcionalidade
  app/            App Router: rotas, layouts, Route Handlers (api/v1/**), Server Actions
  components/     ui/ (primitivos) · patterns/ (composições recorrentes)
  lib/            cn.ts (classes Tailwind) · log.ts (log estruturado)
  server/         session.ts — costura de sessão e escopo de usuário
  styles/         tokens.css (fonte visual) · globals.css (ponte Tailwind)
```

Regra de importação, do centro para fora:

| Camada         | Pode importar                                             | Nunca importa                                                                       |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/domain`   | só ela mesma                                              | React, Next, Drizzle, Zod, `@/data`, `@/api`, `@/features`, `@/app`, `@/components` |
| `src/data`     | `@/domain`                                                | `@/api`, `@/features`, `@/app`, `@/components`                                      |
| `src/api`      | `@/domain`, `@/data` (as **portas**), `@/server`, `@/lib` | `@/data/sqlite`                                                                     |
| `src/features` | `@/domain`, `@/data`, `@/components`, `@/lib`             | `@/app`                                                                             |
| `src/app`      | tudo, menos `@/data/sqlite`                               | `@/data/sqlite`                                                                     |

O bloqueio não é honra: está em `eslint.config.mjs`, como `no-restricted-imports`
sobre `src/domain/**/*.ts`, `src/data/**/*.ts` e `src/app/**` + `src/api/**`. Se
você precisou driblá-lo, a regra que você está escrevendo não é de domínio, ou
ela está no lugar errado. Ver ADR-0013 §5.

**O que NÃO está neste repositório, de propósito:**

- **Backend separado.** É um monolito: o servidor vive nos Route Handlers de
  `src/app/api/v1/**` e nas Server Actions do mesmo app. Não existe segundo
  serviço, segundo deploy, segunda linguagem.
- **Autenticação.** Não há login hoje — e é justamente por isso que o ambiente é
  privado e nunca exposto à internet. `src/server/session.ts` já entrega
  `userId` em toda leitura para que ligar Auth.js na fase 2 seja trocar o corpo
  de `getSession()`, sem tocar em nenhuma tela.

## 6. Convenções

**Idioma.** **Todo o código é em inglês** — tipo, função, variável, arquivo, pasta e
comentário. Isso vale inclusive para o domínio: `Entry`, `Recurrence`,
`computeIncomeStatement`, `Cents`, `IsoDate`, `Planned`, `Paid`.

**O texto que a pessoa lê na tela continua em português**, palavra por palavra igual
ao Figma, porque isso é interface e não código. As rotas também: `/inicio`, `/dre`,
`/historico` — a URL é interface.

Toda a especificação deste projeto está em português e o glossário do design é
rigoroso. A ponte entre as duas línguas é normativa e vive em
[`src/domain/GLOSSARY.md`](src/domain/GLOSSARY.md): "Lançamento" é `Entry`,
"Bens Materiais" é `TangibleAsset`, "Pró-labore" fica `ProLabore` porque não tem
tradução. **Conceito novo entra no glossário antes de entrar no código**, nunca
depois — é o que impede que a mesma coisa ganhe dois nomes em dois arquivos.

Documentação (este arquivo, README, ADRs) continua em português: quem a lê são as
mesmas pessoas que escreveram o PRD.

**Nomenclatura.** O glossário (`files_design/04`) manda. "Lançamento", nunca
"transação". "Bens Materiais", nunca "Ativos". "Evolução Mensal", nunca "Painel".
Nunca renomeie um conceito sem passar pelo glossário primeiro: cada nome de lá tem
o motivo escrito ao lado, e quase sempre o nome "melhor" que ocorreu a você já foi
considerado e descartado. Se o nome novo é mesmo melhor, o glossário muda antes do
código.

**Dinheiro.** Valor monetário é **sempre** `Cents`, inteiro. Nunca `number` em
reais. O motivo é aritmético, não estético: `0.1 + 0.2 !== 0.3` em ponto flutuante,
e a cascata do DRE soma dezenas de lançamentos antes de o total ser comparado com
o Balanço. Um centavo de erro por soma vira divergência visível na conferência do
mês. Converta na borda, com `fromReais`/`toReais` de `src/domain/core/money.ts`,
e formate para tela só com `formatMoney`.

**Datas.** Data é `IsoDate`, a string `"YYYY-MM-DD"`, sem hora e sem fuso. Mês é
`Month`, a string `"YYYY-MM"`, e é a chave de todo relatório mensal. O motivo é a
regra de caixa: o mês de um lançamento é o mês da data de pagamento que a pessoa
digitou. Guardar `Date` com hora reintroduz o bug clássico de um pagamento do dia
1º cair no mês anterior por causa de UTC-3 — e um DRE errado por um dia é um DRE
errado.

**Comentários.** O padrão é nenhum. Comente o **porquê**, nunca o quê, e cite a
fonte (`PRD §5`, `ADR-0009 §3`, `files_design/01 §8.1`). Um comentário que repete
o que a linha faz é ruído; um comentário que diz por que a linha é assim é a única
informação que a próxima pessoa não consegue redescobrir sozinha.

**Logs.** Estruturados, via `src/lib/log.ts`, e só isso: `log.info`, `log.aviso`,
`log.erro`. O log registra **que** algo aconteceu, nunca **o quê**. Nada de valor
monetário, nome de categoria, nome de conta, rótulo ou qualquer texto digitado pela
pessoa — só evento, resultado e identificador opaco. `console.log` é erro de lint
(`no-console`, com `console.error` liberado porque é por onde o logger emite).

**Tokens.** Nenhum hex e nenhum px em componente. Toda cor, espaço, raio, tamanho
de fonte e medida de layout vem de `src/styles/tokens.css`, exposta ao Tailwind por
`@theme inline` em `globals.css`. Na prática: `bg-superficie-card` funciona,
`bg-[#fff]` é proibido. `make audit-tokens` falha se um literal aparecer fora de
`src/styles/`. Os tokens marcados `[figma]` são literalmente as variáveis do
arquivo Figma e não mudam aqui sem mudar lá antes.

## 7. Filosofia de trabalho

- **Nunca assuma premissas** (topo deste documento). Pergunte; depois registre o
  que foi decidido.
- **Diagnostique por fato, nunca por dedução** (§7.1). Uma causa raciocinada é
  hipótese; só a medição é causa.
- **Uma ADR é para mudança arquitetural ou proposta nova, nada mais.** Não é para
  code review e não é para defeito em funcionalidade já mapeada: consertar o que
  uma decisão já prometia não é uma decisão nova. O raciocínio de uma correção vai
  para onde vai ser lido quando alguém mexer naquela linha de novo — o **comentário
  no código** (o porquê, com a medição que o provou) e o **PR**, nunca num arquivo
  numerado novo. Quando uma ADR existente descreve um comportamento que nunca
  funcionou, **emende aquela ADR** em vez de abrir outra: duas ADRs sobre o mesmo
  assunto significam que ninguém sabe mais qual vale. Estilo trivial vira regra de
  linter, não parágrafo de documento.
- **Nada é por acaso:** toda mudança se rastreia até o PRD, o Event Storming, o
  design ou uma ADR. Se não se rastreia, ela ainda não foi decidida.
- **Isto não é um experimento:** trate todo código como código de produção, mesmo
  o que hoje só serve fixture sintética.
- **O processo tem casa:** brainstorming, PRD, Event Storming, ADR e spec seguem a
  skill `loop-produto` (`.claude/skills/loop-produto/SKILL.md`) e o traço real em
  `docs/loop-produto-playbook.md`. Artefato de qualquer etapa só está pronto quando
  está salvo em `docs/`.

### 7.1 Fatos antes de dedução — como depurar e como mudar

**Uma explicação plausível não é um diagnóstico.** Antes de afirmar uma causa,
mudar uma linha por causa dela ou dizer à pessoa desenvolvedora o que está
acontecendo, **VÁ OLHAR**. A dedução serve para decidir _onde_ olhar; ela nunca é o
achado.

**Onde está o fato, por tipo de pergunta:**

| Pergunta                                 | A testemunha — leia, não deduza                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| «o componente renderizou o que eu acho?» | o **DOM real**: um teste de Playwright, `@testing-library` ou o inspetor do navegador. O JSX que você leu é a intenção, não o resultado          |
| «por que esse estilo não aplicou?»       | **`getComputedStyle`** no elemento. Especificidade lida no arquivo CSS é palpite; a cascata resolvida é fato                                     |
| «esse dado chegou?»                      | a aba **Network** e o **retorno real do repositório** (imprima o objeto que a função devolveu). Não a assinatura do tipo                         |
| «esse cálculo está certo?»               | **rode a função com a entrada concreta, num teste**. Uma cascata de DRE conferida de cabeça é uma conta feita de cabeça                          |
| «esse arquivo / rota / símbolo existe?»  | `ls`, `grep`, `curl -I`. Nunca "deveria se chamar…"                                                                                              |
| «o cabeçalho de segurança está lá?»      | `curl -I http://localhost:3000` com o app rodando. Nunca `next.config.ts` — o arquivo é o que você pediu, a resposta é o que o servidor entregou |

**Três regras que decorrem disso:**

1. **Uma correção carrega a medição dela.** O comentário no código diz o porquê
   **com o número** ("soma 3 lançamentos e fecha 1 centavo abaixo do Balanço",
   "o dia 31 caía em 3 de março"). Comentário que só descreve o código é ruído; a
   medição é o fato que a próxima pessoa precisa e não consegue re-derivar.
2. **Um teste para um defeito precisa ter sido visto FALHANDO sem a correção.**
   Desative a correção, rode, veja ficar vermelho, recoloque a correção. **Um teste
   verde que nunca poderia ter sido vermelho é uma afirmação, não uma garantia — e
   é pior que teste nenhum, porque é acreditado.**
3. **Quando a tela e o dado discordam, o dado é a testemunha.** A tela é derivada:
   DRE, Balanço, Evolução Mensal e Indicadores são projeções sobre os lançamentos
   Pagos. O lançamento é o que aconteceu; o número na tela é uma opinião do
   cálculo sobre ele.

**E diga qual é.** "Eu medi X" e "eu acho X" são frases diferentes. Quando o fato
não estiver disponível, **nomeie a suposição** sob a qual você está seguindo —
nunca apresente uma dedução na voz de um achado.

## 8. Como planejar uma tarefa

1. Leia o PRD e o Event Storming na parte que a tarefa toca, e a tela em
   `files_design/01` e `03`. Se a tarefa mexe em pixel, abra o XML do frame em
   `docs/figma/frames/` pelo `docs/figma/INDEX.md`.
2. Confira o vocabulário em `files_design/04` antes de nomear qualquer coisa nova.
3. Se algo não estiver escrito, **pergunte** — não assuma. E se a tarefa nasce de
   um **defeito**, pegue o fato primeiro (§7.1): o DOM medido, o estilo computado,
   o retorno real do repositório. Não abra o editor sobre uma hipótese.
4. Liste os cenários de teste, incluindo cada regra do PRD tocada, nomeada no
   título do teste.
5. Defina o contrato antes da implementação: a interface em `src/data/contracts`,
   o schema Zod da borda, os tipos do domínio.
6. Escreva o teste que falha. Rode-o e **veja o vermelho**.
7. Implemente o mínimo que faz passar.
8. Refatore; comente só o porquê, com a fonte e a medição.
9. **Se — e só se — a mudança for arquitetural ou uma proposta nova**, registre em
   `docs/adr/NNNN-titulo-curto.md`. Correção, achado de revisão e defeito em
   funcionalidade já mapeada não ganham ADR: o comentário no código e a descrição
   do PR carregam o raciocínio.
10. **Varredura de documentação:** para cada comportamento adicionado ou alterado,
    avalie e atualize o PRD (via changelog), a especificação de telas, o glossário,
    a ADR tocada, `docs/ARCHITECTURE.md` e o `README.md`. Documentação estrutural
    nunca é opcional — a próxima sessão começa por ela.
11. Rode **`make check`** (tipos + lint + testes unitários) e as auditorias
    `make audit-tokens`, `make audit-lgpd` e `make audit-deps`; **e suba o app de
    verdade** (`make dev`) para ver a tela que você mudou funcionando. Teste verde
    com a tela quebrada é o caso que a regra 2 do §7.1 existe para impedir.

Toolchain: Node **^20.19 ou ≥ 22.12** — é o piso do vite 7, não uma escolha nossa;
um Node 20.9 instala e quebra só na hora de rodar. `.nvmrc` fixa 24, e
`make require-node` falha cedo e diz como consertar. `make help` lista todos os
alvos.

## 9. LGPD e segurança da informação

Os dados deste produto são financeiros, pessoais e empresariais: quanto a pessoa
ganha, quanto deve, onde guarda, em que gasta. Por definição, dado sensível para o
titular. LGPD aqui é premissa desde o primeiro commit, não um item de conformidade
para o fim. O repositório e o ambiente são **privados** — e como não há
autenticação nesta fase (§5), essa privacidade é a única barreira que existe.

As regras duras, cada uma com o motivo:

- **Nenhum dado real de pessoa alguma entra no repositório. Fixture é sintética,
  sempre.** Um repositório é copiado, clonado e versionado para sempre; dado real
  commitado não é removível de verdade, nem com rewrite de histórico. O caminho
  mais curto entre "só para testar" e um vazamento é um commit.
- **Log nunca registra valor monetário, nome de categoria, nome de conta, rótulo
  nem qualquer texto digitado.** Só evento e identificador opaco. Log é copiado
  para terminal, arquivo, CI e ferramenta de terceiro sem ninguém pensar no
  assunto — é a via de exfiltração mais fácil de abrir por descuido. Use
  `src/lib/log.ts`; `console.log` é proibido por lint.
- **Nenhum recurso de terceiro no cliente:** sem analytics, sem fonte de CDN, sem
  pixel, sem script externo, sem imagem remota. Cada origem externa numa página de
  finanças pessoais é alguém que recebe, no mínimo, o Referer e o padrão de uso. A
  CSP em `next.config.ts` já bloqueia (`default-src 'self'`, `connect-src 'self'`);
  a regra existe para que ninguém tente e depois peça exceção na CSP.
- **Minimização:** não colete campo que nenhuma tela usa. Dado que não existe não
  vaza, não precisa de base legal e não precisa ser apagado depois.
- **Toda leitura de dado passa por `getSession()` e carrega `userId`**, mesmo
  sem login hoje. É o que garante que a fase 2 seja trocar o corpo de uma função,
  em vez de auditar cada consulta do sistema procurando qual esqueceu o escopo.
- **Segredo nunca no repositório.** `.env` e `.env.*` estão no `.gitignore` (só
  `.env.example` é versionado, e ele contém nome de variável, nunca valor).
- **Print de tela e transcrição com dado real não vão para issue, PR nem log de
  agente.** Reproduza com fixture sintética; uma reprodução sintética basta para
  descrever o defeito. O Playwright já está configurado com `video: 'off'` e
  screenshot só em falha pelo mesmo motivo.
- **Nunca faça cópia de backup do banco** (`.data/bigorna.db`), nem antes de uma
  migração, sincronização ou conversão de dados. Decisão do dono em 2026-10-01.
  Cada cópia é mais um arquivo com dado financeiro real no disco, esquecido depois
  da tarefa que o justificou. Se a mudança parecer arriscada, diga isso e pergunte;
  não copie o banco por conta própria.
