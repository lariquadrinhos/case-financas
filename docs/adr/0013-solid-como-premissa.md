# ADR-0013 — SOLID é premissa de construção, com um mecanismo por letra

- **Status:** aceita (decisão do dono, 2026-09-04)
- **Estende:** ADR-0007 §4 (repositório trocável) · ADR-0008 §3 (escopo de usuário) ·
  ADR-0009 (segurança como premissa) · ADR-0012 (portas segregadas e contrato gerado)
- **Substitui:** a linha "Sem overengineering. SOLID, DRY, KISS." do `CLAUDE.md` §4, que
  nomeava os princípios sem dizer onde eles vivem neste repositório

## Contexto

Até esta rodada, SOLID aparecia no `CLAUDE.md` como uma sigla numa lista de boas intenções, ao
lado de DRY e KISS. Uma sigla numa lista não decide nada: não diz onde a regra vale, não diz o que
fazer quando ela conflita com a pressa, e não deixa rastro de ter sido violada.

O repositório mudou de tamanho nesta rodada. Deixou de ser domínio puro com persistência em
memória e passou a ter 39 arquivos de rota, 12 adaptadores SQLite, 34 portas de repositório e 718
testes. É exatamente nesse tamanho que os cinco princípios param de ser gosto e viram custo
mensurável: um repositório-deus com 60 métodos obriga todo teste a construir 60 dublês; um handler
que importa `src/data/sqlite` direto transforma "trocar de banco" em "auditar 39 arquivos".

O problema de escrever SOLID como princípio é que princípio não falha o build. Esta ADR segue a
mesma forma da ADR-0009: **para cada letra, o mecanismo concreto que já existe no código, e o que
acontece quando alguém o contorna.** Nenhuma das cinco seções abaixo descreve intenção — todas
apontam para um arquivo.

## Decisão

### §1 SRP — o handler faz quatro coisas, e a quinta mora em outro lugar

`src/api/handler.ts` define o invólucro com que **toda** rota de `src/app/api/**` é construída, e
ele fixa as responsabilidades em ordem: autorizar (`requireSession()`), parsear (`params`, `query`
e `body` com Zod), delegar, e mapear erro de domínio para status. O corpo que o autor da rota
escreve é só o `handle`, e ele delega e serializa.

O exemplo em que isso doeu e produziu código: os quatro relatórios de `/api/v1/reports/*` precisam
do mesmo patrimônio e do mesmo plano de contas — sete portas ao todo (cinco de patrimônio, duas do
plano de contas). Em vez de cada handler montar a sua composição, o que faria de cada rota um
handler **mais** um read model, essa montagem virou `src/app/api/v1/reports/_assemble.ts`
(`loadChartOfAccounts`, `loadEntriesForMonths`, `loadPatrimonio`). O corpo do handler de
`balance-sheet/route.ts` são três passos: chama `loadPatrimonio`, chama `computeBalanceSheet`,
devolve `ok(sheet)`.

O sublinhado no nome do arquivo não é estilo: é o que impede o Next.js de tratar `_assemble.ts`
como rota.

**Consequência de contornar:** um handler que também consulta, também calcula e também formata
precisa de banco no teste para verificar uma regra de arredondamento.

### §2 OCP — acrescentar um relatório, um erro ou um recurso não edita nada existente

Três aberturas concretas, todas já exercitadas nesta rodada:

1. **Um relatório novo** é um arquivo novo em `src/app/api/v1/reports/<nome>/route.ts` mais uma
   função pura em `src/domain/reports/`. Os quatro relatórios de hoje (`income-statement`,
   `balance-sheet`, `monthly-trend`, `indicators`) foram acrescentados assim, e nenhum deles tocou
   no handler do outro.
2. **Um erro de domínio novo** é uma linha em `DOMAIN_ERROR_STATUS` (`src/api/http.ts`), a tabela
   única que mapeia código para status HTTP. Nenhum handler tem `if` por código de erro; o
   invólucro consulta a tabela. Foi assim que `entries.unknown_reference → 404` entrou sem que
   `entries/route.ts` mudasse uma linha.
3. **Um recurso novo na especificação OpenAPI** é um `registry.registerPath(...)` no arquivo de
   contrato do recurso. `src/api/openapi.ts` itera `registry.definitions` e não conhece recurso
   nenhum pelo nome — `docs/api/openapi.json` é **gerado** dos schemas Zod (`npm run api:spec`), não
   escrito à mão.

**Consequência de contornar:** um `switch` por tipo de relatório dentro de um handler compartilhado
faz com que acrescentar o quinto relatório exija reabrir e re-testar os quatro anteriores.

### §3 LSP — todo adaptador roda a MESMA suíte, escrita contra a porta

`src/data/contracts/crud.contract-test.ts` exporta `describeCrudContract`, uma suíte escrita contra
`Reader<T, Id>` e `Writer<T, New, Id>` — **nunca** contra um adaptador. O adaptador importa a suíte
e a chama com uma fábrica. Hoje ela é chamada por `bank-accounts`, `entries`, `investments`,
`liabilities`, `pending-allocations`, `pending-items`, `recurrences` e `tangible-assets` em
`src/data/sqlite/*.repository.test.ts`.

O arquivo se chama `*.contract-test.ts` e não `*.test.ts` de propósito: o Vitest não o coleta
sozinho, porque ele é uma suíte para ser **chamada**, e chamá-la é obrigação do adaptador.

A invariante que mais importa está escrita no cabeçalho da própria suíte e é a que o teste comum do
adaptador não pega: **um repositório que ignora `userId` passa em todos os outros testes.** Por
isso a suíte cria dois usuários e verifica que nenhum enxerga o dado do outro. É a mesma garantia
que `e2e/user-scoping.spec.ts` cobra pela borda HTTP.

Onde a suíte genérica **não** cabe, isso está dito no cabeçalho do arquivo, não escondido:
`chart-of-accounts` (o `Writer` de bloco não tem `create`/`remove` e o de categoria não tem
`remove` — categoria é arquivada, nunca apagada), `profit-allocations` e `trace-events` (não há
`replace`; o id não é atribuído do mesmo jeito) e `discretionary-spending` (a configuração é um
singleton por pessoa e um gasto nasce de duas tabelas ao mesmo tempo). Os quatro têm suíte
própria, cobrindo as mesmas invariantes — atribuição de id, escopo de usuário, replace vs. merge.

E `src/data/sqlite/not-implemented.ts` é a recusa explícita de violar LSP por conveniência: uma
porta ainda sem adaptador é um `Proxy` que satisfaz o **tipo** e **lança** ao ser chamada. Um
substituto que devolvesse `[]` para tudo satisfaria o tipo e mentiria — uma tela lendo lista vazia
de uma porta que ninguém ligou é indistinguível de uma tela lendo uma porta corretamente vazia.

**Consequência de contornar:** "o repositório é trocável" vira afirmação sem prova, exatamente o
que ADR-0007 §4 prometeu que não seria.

### §4 ISP — `Reader` e `Writer` separados, e nunca a fatura inteira

`src/data/contracts/common.ts` define duas interfaces, não uma. Não existe `EntryRepository`
juntando leitura e escrita: existe `EntryReader` (`findById`, `list`, `count`, mais `search`,
`listByMonth`, `listByRecurrence`) e `EntryWriter`. São 34 portas em `Repositories`
(`src/data/index.ts`) — 17 pares.

Duas consequências práticas, ambas escritas no código:

- A tela de Histórico depende de `EntryReader` e **não consegue** apagar um lançamento por engano —
  o método não está no tipo que ela recebe.
- O dublê de teste de um leitor tem três métodos para implementar, não nove.

A regra tem uma segunda metade, no cabeçalho de `src/data/index.ts`: um handler faz
`const { entryReader } = getRepositories()` e **nunca** `function listEntries(repos: Repositories)`.
Uma função que recebe o registro inteiro depende de 34 portas para usar uma, e o teste dela precisa
construir 34 dublês. O registro é uma montagem, não uma dependência.

### §5 DIP — o handler depende do tipo da porta; a fiação mora num arquivo só

`src/data/index.ts` é o **composition root**: o único lugar que amarra porta a adaptador
(`createSqliteRepositories(db)`), e o único que um handler importa. `setRepositories()` é a costura
que os testes usam para rodar contra `createInMemoryDatabase()` e que a fase 2 usa para ligar um
segundo adaptador.

Não é honra, é lint: `eslint.config.mjs` proíbe `@/data/sqlite` em `src/app/**` e em `src/api/**`
via `no-restricted-imports`, e proíbe `react`, `next`, `drizzle-orm`, `better-sqlite3`, `zod`,
`@/data/*`, `@/api/*`, `@/app/*`, `@/components/*`, `@/server/*` e `@/lib/*` dentro de
`src/domain/**`. O domínio recebe `Entry`, `Cents` e `IsoDate` — nunca uma linha do Drizzle. O
mapeamento linha↔agregado é do adaptador, e é a única coisa que muda quando o banco muda.

`computeBalanceSheet`, `computeIncomeStatement`, `computeMonthlyTrend` e
`computeFinancialIndicators` recebem tudo por parâmetro, inclusive o mês: o domínio não lê relógio
(`Date.now()`) nem sorteia (`Math.random()`). É o que torna 718 testes rodáveis sem congelar tempo
e sem subir banco.

**Consequência de contornar:** um único `import { db } from '@/data/sqlite'` num handler faz o
ESLint falhar o portão. Isso é deliberado: o valor inteiro da porta se perde no momento em que uma
rota passa por cima dela.

## Consequências

- **`CLAUDE.md` §4** deixa de dizer "SOLID, DRY, KISS" e passa a apontar para esta ADR, com uma
  frase por letra.
- **`docs/ARCHITECTURE.md` §4** já descrevia as portas segregadas e a suíte de contrato; agora §8
  registra esta ADR ao lado das outras.
- **Revisão de PR** ganha uma pergunta objetiva por letra, respondível olhando o diff: o handler
  faz só as quatro coisas? o recurso novo edita arquivo existente? o adaptador chama a suíte de
  contrato? a porta nova é um par Reader/Writer? algum arquivo de `src/app/**` ou `src/api/**` importa
  `@/data/sqlite`?
- **Nada precisou ser reescrito para esta ADR.** Ela documenta o que o código já faz — foi escrita
  depois de auditar os cinco contextos, não antes. Uma ADR que descreve um repositório imaginário é
  pior do que nenhuma.

## Explicitamente NÃO feito

- **Regra de ESLint para SRP e OCP.** As duas letras não têm mecanismo automático: nada mede
  "este handler faz coisa demais". O que existe é o invólucro `handler()`, que torna o caminho
  correto o mais curto, e a revisão de PR. LSP, ISP e DIP têm mecanismo (suíte de contrato,
  tipos separados, `no-restricted-imports`); SRP e OCP dependem de revisão, e dizer isso é mais
  honesto do que fingir cobertura.
- **Injeção de dependência por container.** `getRepositories()` é uma função com cache de processo,
  não um container de DI. Um container resolveria um problema que este repositório não tem — um
  monolito de um app só, com uma implementação por porta — e custaria uma indireção a mais em todo
  teste. DIP é sobre depender da abstração, não sobre ter framework de injeção.
- **Interface para tudo.** As funções puras do domínio (`computeIncomeStatement`,
  `buildInstallmentSchedule`) são funções, não estratégias por trás de uma interface. Não há segunda
  implementação prevista, e abstração criada para caso hipotético é dívida com juros
  (`CLAUDE.md` §4).
- **Quebrar `EntryReader` em portas ainda menores.** ISP é sobre o cliente não depender do que não
  usa, não sobre o menor tamanho possível. `search`, `listByMonth` e `listByRecurrence` estão no
  mesmo leitor porque são as três perguntas que as projeções fazem sobre a mesma fonte da verdade
  (`docs/ARCHITECTURE.md` §1), e o motivo está escrito no cabeçalho de
  `src/data/contracts/entries.ts`.
