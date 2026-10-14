# ADR-0012 — SQLite com Drizzle, atrás de portas segregadas, e o contrato HTTP gerado dos schemas

- **Status:** aceita (decisão do dono, 2026-09-01)
- **Fecha:** hotspot H7 do Event Storming ("qual banco?"), que ADR-0007 §5 substituiu em forma mas
  não em conteúdo
- **Estende:** ADR-0007 §4 (repositório trocável) · ADR-0008 §3 (escopo de usuário) ·
  ADR-0009 (dado em repouso)

## Contexto

O CLAUDE.md §5 dizia, com razão para o momento em que foi escrito, que **não** havia banco: a
persistência era in-memory, e escolher banco antes de o motor de DRE (H10) dizer que forma o dado
precisa ter seria decidir sem informação.

Essa informação existe agora. O domínio está escrito e testado (118 testes), os agregados têm
`types.ts`, e o modelo de dados por tela (`files_design/03`) fixa campo, obrigatoriedade e default
de cada formulário. Três coisas ficaram claras ao escrever a camada de contrato:

1. O dado é **relacional e pequeno**: uma pessoa por instância, dezenas de lançamentos por mês.
2. O que precisa ser protegido não é volume, é **integridade**: um lançamento de pró-labore com
   categoria, ou um lançamento apontando para a conta de outra pessoa, é um DRE errado.
3. O produto é **privado e local** (ADR-0008 §1). Não há segundo serviço, segundo deploy nem
   operação de banco (ADR-0007 §1).

## Decisão

### §1 SQLite, arquivo local, via Drizzle

Um arquivo em `./.data/bigorna.db`. Sem servidor de banco, sem container, sem segunda peça para
subir junto com o app — coerente com o monolito de ADR-0007 §1 e com o ambiente privado de
ADR-0008 §1.

Drizzle porque o schema é TypeScript e as migrações são **arquivos SQL versionados** em
`drizzle/`, geradas por `npm run db:generate`. Nunca `db:push`: um schema que só existe na máquina
de alguém não tem diff para revisar, e a primeira coisa que um banco financeiro precisa é do
histórico escrito de como sua forma mudou.

### §2 O banco defende a si mesmo

O compilador protege o domínio; um `INSERT` escrito à mão, um script de migração ou um adaptador
futuro não passam pelo compilador. Por isso o schema carrega, em SQL:

- **Uma CHECK por natureza de lançamento.** `entries` achata a união discriminada num `kind` mais
  colunas anuláveis; as CHECKs dizem quais colunas precisam estar presentes e quais precisam ser
  nulas em cada `kind`. Um pró-labore com categoria é recusado pelo banco.
- **Chaves estrangeiras compostas `(user_id, <ref>_id)`.** Uma FK simples aceitaria um lançamento
  de uma pessoa apontando para a categoria de outra. Esta não aceita — é ADR-0008 §3 deixando de
  ser convenção e virando restrição.
- **Formato de data e de mês**, com `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`. Os
  relatórios fatiam o mês desta coluna como texto; um `20/07/2026` aqui cairia no mês `20/07/2`.
- **RESTRICT em tudo, `CASCADE` em nada.** Um Lançamento é um registro, não um detalhe de uma
  conta bancária: apagar a conta tem que falhar alto e deixar o app explicar.
- **`PRAGMA foreign_keys = ON` por conexão.** SQLite entrega isso desligado, o que faria de todo
  RESTRICT acima um comentário. Medido em `src/data/sqlite/schema.test.ts`.

### §3 Portas segregadas, e a mesma suíte de contrato para todo adaptador

`src/data/contracts/` tem um `Reader` e um `Writer` por agregado, nunca um repositório-deus: uma
tela que lista não é uma tela que apaga (SOLID/ISP). Toda função recebe `userId` como primeiro
parâmetro (ADR-0008 §3), e as portas falam tipos de domínio, nunca linhas do Drizzle.

`*.contract-test.ts` é uma suíte exportada como função, escrita **contra a porta**. O adaptador
SQLite a executa; um adaptador Postgres futuro executa a mesma, sem alteração. É o que transforma
"o repositório é trocável" (ADR-0007 §4) de intenção em afirmação com prova.

`src/data/index.ts` é o composition root, e o ESLint recusa `@/data/sqlite` em `src/app/**` e
`src/api/**`: o valor da porta some no instante em que um handler passa por cima dela.

### §4 O contrato HTTP são os schemas Zod; o OpenAPI é gerado

`src/api/contracts/` define requisição e resposta por recurso, e `docs/api/openapi.json` é
**gerado** deles e versionado. Um spec escrito à mão é uma segunda fonte da verdade, errada no
primeiro campo novo; gerado, ele vira o diff que mostra que o contrato mudou.

As convenções ficam em um lugar só (`src/api/http.ts` + `src/api/README.md`): `/api/v1`,
substantivo plural, dinheiro em inteiro de centavos, erro em `application/problem+json` (RFC 9457)
com `code` legível por máquina, e coleção em `{ data, meta: { total } }`.

Toda rota é construída com `handler()`, que chama `requireSession()` **antes** de qualquer parse,
valida params/query/body com Zod `.strict()` e mapeia erro de domínio para status por uma tabela
única. Autorização e validação deixam de ser algo que cada endpoint lembra de fazer.

## Consequências

- **`src/data/sqlite/schema.ts`**, **`client.ts`** e a migração `drizzle/0000_*.sql` passam a
  existir; `.data/` entra no `.gitignore`.
- **ADR-0009** é emendada: "criptografia em repouso" deixa de ser "não há repouso" e passa a
  descrever o que foi feito (permissão 0600, diretório 0700, fora de `public/`) e o que não foi.
- **`eslint.config.mjs`** ganha as regras de dependência de `src/data`, de `src/app`/`src/api`, e
  a regra do domínio passa a apontar para `src/domain/**` — ela apontava para `src/dominio/**`,
  que não existe, e portanto não cobria arquivo nenhum.
- **Fase 2** troca o corpo de `createSqliteRepositories` por outro adaptador, ou acrescenta um
  segundo, e roda as mesmas suítes de contrato.

## Explicitamente NÃO feito

- **Criptografia do arquivo** (SQLCipher). Depende de haver onde guardar a chave, o que depende de
  autenticação (ADR-0008). O que existe hoje é permissão de sistema de arquivos, e ADR-0009 diz
  contra o quê ela protege e contra o quê não.
- **Backup e restauração.** Não há rotina, e um arquivo copiado para outro lugar sai do alcance do
  `chmod 0600`.
- **Pool de conexão, réplica, migração de dados existentes.** Não há dado existente: esta é a
  migração 0000.
