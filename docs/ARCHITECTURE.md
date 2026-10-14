# Arquitetura

> Como o sistema é construído. O **que** ele faz está em `docs/prd/financas-pf-pj.md`; o
> **porquê** de cada decisão está em `docs/adr/`. Este documento é o mapa entre os dois.
>
> Quando este documento e o código discordarem, o código ganha e este documento está
> desatualizado. Corrija-o no mesmo PR.

## 1. Visão geral

Monolito web: um app Next.js 15 (App Router), TypeScript strict, sem serviço separado
(ADR-0007 §1, §2).

O produto substitui uma planilha de DRE. A ideia central é a mesma do PRD §5 e do hotspot H1:
**o Lançamento é a única fonte da verdade; todo relatório é uma projeção derivada, calculada
sob demanda.** Não há tabela de totais, não há fechamento manual, não há dado duplicado entre
as três visões (Consolidado, PF, PJ).

```
                       ┌──────────────────────────┐
   Novo Lançamento ───▶│                          │
   Onboarding      ───▶│        Lançamento        │  ◀── única fonte da verdade
   Motor de           ─▶│  (entidade, categoria,  │
   recorrência         │   conta, valor, data,    │
   Parcela de passivo ─▶│   status, classificação) │
                       └────────────┬─────────────┘
                                    │
                       projeções derivadas, sob demanda
                                    │
        ┌──────────────┬────────────┼───────────────┬──────────────────┐
        ▼              ▼            ▼               ▼                  ▼
       DRE          Balanço      Evolução      Indicadores        Home (Mapa de
    (3 visões)    Patrimonial     Mensal      Financeiros       Fluxo, treemaps)
```

Três propriedades que caem dessa forma e que o código precisa preservar:

- **Nenhum relatório é fonte de nada.** Apagar todos os relatórios e recalcular dá o mesmo
  resultado. Isso é o que permite editar um mês passado e recalcular em cascata (H8).
- **As 3 visões são o mesmo dado filtrado.** Um lançamento nunca é duplicado por entidade. A
  visão Consolidado aplica a eliminação intercompany (ADR-0003).
- **O cálculo é determinístico e puro.** Nenhuma função de relatório lê relógio, banco ou rede.

## 2. Contextos delimitados

Os seis do Event Storming, e a pasta de domínio de cada um:

| Contexto     | Pasta                               | Responsabilidade                                          |
| ------------ | ----------------------------------- | --------------------------------------------------------- |
| Configuração | `src/domain/chart-of-accounts`      | Os 10 blocos do DRE e as categorias dentro deles          |
| Lançamentos  | `src/domain/entries`                | O núcleo transacional e a eliminação intercompany         |
| Recorrência  | `src/domain/recurrence`             | Geração de ocorrências, edição série vs. ocorrência       |
| Patrimônio   | `src/domain/assets`                 | Contas, bens, investimentos, passivos, amortização, venda |
| Relatórios   | `src/domain/reports`                | DRE, Balanço, Evolução Mensal, Indicadores                |
| Onboarding   | `src/features/onboarding` (a criar) | Orquestra Configuração + Patrimônio no primeiro uso       |

Mais quatro que apareceram na implementação e não estavam no Event Storming:
`src/domain/profit-allocation` (Destinar o Lucro), `src/domain/trace-events` (rastreabilidade),
`src/domain/discretionary-spending` (Consumo Livre) e `src/domain/pending-items` (a Pendência
unificada, os 4 tipos do hotspot H13).

O núcleo compartilhado é `src/domain/core`: `Cents`, `IsoDate`, `Month`, os ids marcados e o
vocabulário. Todo contexto depende dele; nenhum contexto depende de outro contexto, exceto
`reports`, que depende de `entries`, `chart-of-accounts` e `assets` — o que é esperado, já que
relatório é projeção sobre eles.

## 3. Camadas e a regra de dependência

```
src/domain/     regras puras. Não sabe que existe React, Next, banco ou HTTP.
src/data/       fronteira de persistência: contracts/ (portas) + sqlite/ (adaptador) + index.ts
src/api/        o contrato HTTP: schemas Zod, OpenAPI gerado, convenções e o handler()
src/features/   casos de uso e componentes por funcionalidade
src/app/        App Router: rotas, layouts, Route Handlers e Server Actions
src/components/ ui/ (primitivos sobre Radix) · patterns/ (composições do produto)
src/lib/        cn.ts · log.ts
src/server/     session.ts — costura de sessão e escopo de usuário
src/styles/     tokens.css (fonte visual) · globals.css (ponte Tailwind)
```

| Camada         | Pode importar                                             | Nunca importa                                                                       |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/domain`   | só ela mesma                                              | React, Next, Drizzle, Zod, `@/data`, `@/api`, `@/features`, `@/app`, `@/components` |
| `src/data`     | `@/domain`                                                | `@/api`, `@/features`, `@/app`, `@/components`                                      |
| `src/api`      | `@/domain`, `@/data` (as **portas**), `@/server`, `@/lib` | `@/data/sqlite`                                                                     |
| `src/features` | `@/domain`, `@/data`, `@/components`, `@/lib`             | `@/app`                                                                             |
| `src/app`      | tudo, menos `@/data/sqlite`                               | `@/data/sqlite`                                                                     |

**Não é honra: é lint.** `eslint.config.mjs` aplica `no-restricted-imports` sobre
`src/domain/**/*.ts`, sobre `src/data/**/*.ts` e sobre `src/app/**` + `src/api/**` (que não podem
importar `@/data/sqlite`). Se você precisou driblar a regra, a regra que você está escrevendo não é
de domínio, ou está no lugar errado.

O domínio também não pode ler relógio nem sortear: `Date.now()` e `Math.random()` não aparecem
lá. Uma função que precisa do mês atual o recebe por parâmetro. É o que torna todo cálculo
testável sem congelar o tempo.

## 4. Contrato dos repositórios

`src/data/contracts/` declara o que a aplicação exige — **portas pequenas e segregadas**, um
`Reader` e um `Writer` por agregado, nunca um repositório-deus. `src/data/sqlite/` é um
adaptador. `src/data/index.ts` é o **composition root**: o único lugar que amarra porta a
adaptador, e o único que um handler importa.

Quatro regras valem para todo contrato:

1. **Toda função recebe `userId` como primeiro parâmetro** (ADR-0008 §3). O ponto não é a
   filtragem de hoje: é não existir assinatura para mudar depois. Consulta sem escopo é erro de
   compilação.
2. **As portas falam tipos de DOMÍNIO** (`Entry`, `Cents`, `IsoDate`), nunca linhas do Drizzle.
   O mapeamento linha↔agregado é do adaptador, e é a única coisa que muda quando o banco muda.
3. **A entrada é validada por schema Zod na borda** (`src/api/contracts/`), escrito uma vez a
   partir de `files_design/03-modelo-de-dados-por-tela.md`.
4. **Todo adaptador passa a MESMA suíte de contrato** (`*.contract-test.ts`), escrita contra a
   porta e chamada com uma fábrica. É o que torna "trocar o repositório" uma afirmação com
   prova, e não uma intenção (SOLID/LSP).

A fase 2 acrescenta `src/data/<banco>/`, roda as mesmas suítes e troca uma linha no composition
root. Telas, features, domínio e testes de domínio não mudam (ADR-0007 §4).

Duas portas são **singleton por pessoa** e por isso fogem do par CRUD e da suíte
`describeCrudContract`: `DiscretionarySpendingConfig{Reader,Writer}` (Consumo Livre) e
`OnboardingProgress{Reader,Writer}` (`src/data/contracts/onboarding.ts`). Não têm id, não têm
lista e não têm remoção — `find` responde `null` quando nunca houve escrita, e `save` é sempre
um upsert. A suíte própria de cada uma cobre as mesmas invariantes (SOLID/LSP, ADR-0013 §"L").

A porta do onboarding existe porque o PRD §5 ("Roteamento de abertura") exige distinguir "não
iniciado", "adiado pela pessoa" e "em andamento": os três são eventos de fluxo — "Fazer depois"
(Figma 116:11), "Salvar e continuar depois" (29:36) e "Concluir" (29:235) — e nenhum deles é
derivável dos lançamentos.

### 4.1 O banco desta fase

SQLite via Drizzle, arquivo em `./.data/bigorna.db` (`.gitignore`, chmod 0600, `journal_mode=WAL`,
`foreign_keys=ON` por conexão). Migrações são **arquivos** em `drizzle/`, geradas por
`npm run db:generate` e versionadas.

O esquema defende o que o compilador não alcança: a tabela `entries` achata a união discriminada
num `kind` mais colunas anuláveis por variante, e uma **CHECK por natureza** diz quais precisam
estar presentes e quais precisam ser nulas. As chaves estrangeiras são **compostas**
(`user_id, <ref>_id`), de modo que um lançamento não consegue apontar para a categoria de outra
pessoa. Nada tem `ON DELETE CASCADE`: um Lançamento é um registro, não um detalhe de uma conta.

### 4.2 A borda HTTP

`src/api/` é o contrato. Os schemas Zod **são** o contrato e o `docs/api/openapi.json` é gerado
deles (`npm run api:spec`), então os dois não divergem. As convenções — `/api/v1`, substantivo
plural, dinheiro em centavos, erro em `application/problem+json` (RFC 9457), envelope
`{ data, meta }` — estão em [`src/api/README.md`](../src/api/README.md), numa página.

Toda rota é construída com `handler()`, que chama `requireSession()` antes de qualquer parse,
valida params/query/body com Zod e mapeia erro de domínio para status por uma tabela única. Um
handler que não usa o invólucro é defeito: autorização e validação deixam de ser algo que cada
endpoint lembra de fazer.

### 4.3 Os endpoints implementados

39 caminhos, 60 operações, todos sob `/api/v1`. A tabela abaixo é o mapa; o contrato completo
(parâmetros, corpo, resposta, códigos de erro) está em
[`docs/api/openapi.json`](api/openapi.json), **gerado** dos schemas Zod por `npm run api:spec`.
Toda operação exige sessão e é escopada por `userId` (ADR-0008 §3); todo erro é
`application/problem+json` (RFC 9457).

| Contexto        | Caminho                                     | Métodos                       | Para quê                                                                  |
| --------------- | ------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Lançamentos     | `/entries`                                  | `GET` `POST`                  | Histórico com os 7 filtros; Novo Lançamento                               |
| Lançamentos     | `/entries/{id}`                             | `GET` `PATCH` `DELETE`        | Ler, editar e remover um lançamento                                       |
| Lançamentos     | `/entries/{id}/payment`                     | `POST`                        | Marcar como pago (data e valor pagos)                                     |
| Configuração    | `/statement-blocks`                         | `GET`                         | Os 10 blocos do DRE                                                       |
| Configuração    | `/categories`                               | `GET` `POST`                  | Plano de Contas: listar e criar dentro de um bloco                        |
| Configuração    | `/categories/{id}`                          | `PATCH`                       | Renomear (nunca a categoria de sistema — P10)                             |
| Configuração    | `/categories/{id}/archive`                  | `POST`                        | Arquivar; categoria nunca é apagada                                       |
| Patrimônio      | `/bank-accounts`, `/bank-accounts/{id}`     | `GET` `POST` `PATCH` `DELETE` | Contas Bancárias                                                          |
| Patrimônio      | `/tangible-assets`, `/tangible-assets/{id}` | `GET` `POST` `PATCH` `DELETE` | Bens Materiais                                                            |
| Patrimônio      | `/tangible-assets/{id}/sale`                | `POST`                        | Vender: é a venda que realiza resultado (ADR-0005)                        |
| Patrimônio      | `/investments`, `/investments/{id}`         | `GET` `POST` `PATCH` `DELETE` | Investimentos                                                             |
| Patrimônio      | `/liabilities`, `/liabilities/{id}`         | `GET` `POST` `PATCH` `DELETE` | Passivos                                                                  |
| Patrimônio      | `/liabilities/{id}/installments`            | `GET`                         | A tabela de amortização calculada                                         |
| Patrimônio      | `/liabilities/{id}/rate-adjustments`        | `POST`                        | Reajuste de juros; parcela já paga nunca muda                             |
| Patrimônio      | `/installments/{id}/payment`                | `POST`                        | Marcar uma parcela como paga                                              |
| Recorrência     | `/recurrences`, `/recurrences/{id}`         | `GET` `POST`                  | As séries                                                                 |
| Recorrência     | `/recurrences/{id}/closure`                 | `POST`                        | Encerrar a série para sempre                                              |
| Recorrência     | `/occurrences`                              | `GET`                         | Revisão de Recorrentes de um mês                                          |
| Recorrência     | `/occurrences/{id}`                         | `PATCH`                       | Editar o valor da ocorrência (Figma `34:24`: um campo, `144:3` "Valor *") |
| Recorrência     | `/occurrences/{id}/payment`                 | `POST`                        | Pagar; divergência gera `TraceEvent`                                      |
| Recorrência     | `/occurrences/{id}/discard`                 | `POST`                        | Descartar só a ocorrência deste mês                                       |
| Destinação      | `/profit-allocations/{month}`               | `GET` `PUT`                   | Destinar o Lucro do mês (substitui, não mescla)                           |
| Direcionamento  | `/pending-allocations`                      | `GET`                         | Valores à espera de destino                                               |
| Direcionamento  | `/pending-allocations/{id}/allocations`     | `POST`                        | Direcionar agora; a soma tem de fechar exata                              |
| Pendências      | `/pending-items`                            | `GET`                         | A Pendência unificada, os 4 tipos, mais antiga primeiro                   |
| Pendências      | `/payment-discrepancies/{id}/payment`       | `POST`                        | Pagar a diferença de um pagamento a menor                                 |
| Rastreabilidade | `/trace-events`                             | `GET`                         | Eventos Recentes, do mais novo para o mais antigo                         |
| Consumo Livre   | `/discretionary-spending/config`            | `GET` `PUT`                   | Configurar o widget                                                       |
| Consumo Livre   | `/discretionary-spending/expenses`          | `GET` `POST`                  | Histórico do mês e "Gastei um valor"                                      |
| Consumo Livre   | `/discretionary-spending/expenses/{id}`     | `PATCH` `DELETE`              | Corrigir ou apagar um gasto pelo histórico                                |
| Relatórios      | `/reports/income-statement`                 | `GET`                         | DRE de um mês, numa visão                                                 |
| Relatórios      | `/reports/balance-sheet`                    | `GET`                         | Balanço Patrimonial na data informada                                     |
| Relatórios      | `/reports/monthly-trend`                    | `GET`                         | Evolução Mensal                                                           |
| Relatórios      | `/reports/indicators`                       | `GET`                         | Indicadores Financeiros (os 18 de `INDICATOR_DEFINITIONS`)                |

Os quatro relatórios são só leitura e não têm escrita nenhuma: relatório é projeção, não
registro (§1). Eles compartilham a montagem do read model em
`src/app/api/v1/reports/_assemble.ts` — o sublinhado impede o Next.js de tratá-lo como rota
(ADR-0013 §1).

## 5. Fluxos-chave

**Lançar uma despesa.** Formulário valida com Zod → `NewEntry` → repositório grava com escopo
de `userId` → as projeções da Home e do DRE recalculam na próxima leitura. Nenhum total é
atualizado, porque nenhum total é armazenado.

**Abrir o DRE de um mês.** `computeIncomeStatement({ entries, chart, view, month, statusFilter })`
filtra por mês contábil (o mês da data de pagamento), aplica `effectInView` para a visão pedida
e monta as 13 linhas da cascata. Mês futuro só tem Previsto, e por isso abre no filtro
"Previsto".

**Marcar uma recorrência como paga.** A ocorrência vira Lançamento com status Pago e a data
informada. Se o valor pago divergir do previsto, gera um `TraceEvent` — e o tratamento depende
do sinal: pago a menor vira Pendência; pago a maior nunca vira, e a pessoa escolhe entre
descontar da próxima, redirecionar o extra, ou não fazer nada.

**Registrar reajuste de juros.** Recalcula o valor previsto das parcelas ainda Previstas a
partir da data de validade. Parcela já paga nunca é alterada retroativamente.

**Editar um mês passado.** Permitido sempre (H8 está resolvido: não há bloqueio). O recálculo
cascateia para os meses seguintes, porque saldo de investimento e patrimônio são cumulativos.

## 6. Observabilidade

`src/lib/log.ts` é o único caminho de log, e registra QUE algo aconteceu, nunca O QUÊ. Valor
monetário, nome de conta, nome de categoria e texto digitado viram `[redacted]`. `console.log`
é erro de lint (ADR-0009 §3).

Não há telemetria, APM nem coletor de erro de terceiro. É consequência de ADR-0009 §5: nenhum
recurso externo no cliente. Para saber como o produto é usado, pergunta-se à pessoa.

## 7. Postura de segurança e LGPD

Detalhe completo em [`SECURITY.md`](../SECURITY.md) e ADR-0009. Em resumo:

- CSP por requisição com nonce, sem origem externa. `connect-src 'self'` é a linha que impede
  exfiltração mesmo por dependência comprometida.
- Cabeçalhos estáticos: `nosniff`, `DENY`, `no-referrer`, Permissions-Policy restritiva, HSTS
  em produção.
- Log sem PII e sem valor. Fixture sintética. `make audit-lgpd` no CI.
- Minimização: CPF, CNPJ, endereço e telefone não são coletados.
- Toda leitura de dado carrega `userId` desde o primeiro commit, mesmo sem autenticação.
- **Não mitigado hoje:** acesso de quem alcança a URL. Não há login (ADR-0008). A mitigação é
  operacional: o ambiente é privado.

## 8. Decisões registradas

| Decisão                    | Escolha                                                                                                                                               | ADR                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Fonte da verdade e cálculo | Lançamento único + projeções derivadas sob demanda; regime de caixa pela data de pagamento; mês sempre editável com recálculo em cascata              | ADR-0001 (H1, H3, H6, H8)     |
| Motor de DRE               | Dez blocos FIXOS; a estrutura do bloco é dado, a ordem da cascata é código                                                                            | ADR-0002 (H10)                |
| Intercompany               | Tipo próprio + regra de projeção por visão; dividendo externo não é intercompany                                                                      | ADR-0003 (H2)                 |
| Recorrência                | Geração virtual + materialização na primeira visita ao mês; edição série vs. ocorrência                                                               | ADR-0004 (H4)                 |
| Patrimônio                 | Resultado só na venda; dívida calculada por amortização (Price), sem baixa automática a partir de Lançamento                                          | ADR-0005 (H5, H9)             |
| Forma do sistema           | Monolito Next.js, 4 camadas, repositório trocável                                                                                                     | ADR-0007 §1–§5 (substitui H7) |
| Autenticação               | Ausente nesta fase, com costura de sessão pronta                                                                                                      | ADR-0008                      |
| LGPD e segurança           | Premissa, com mecanismos que falham o build                                                                                                           | ADR-0009                      |
| Idioma                     | Todo o código em inglês, rotas HTTP incluídas; só o texto de tela em português                                                                        | ADR-0010                      |
| Design tokens              | Figma como fonte única; valor literal falha o build                                                                                                   | ADR-0011                      |
| Persistência               | SQLite com Drizzle atrás de portas segregadas; contrato HTTP gerado dos schemas Zod                                                                   | ADR-0012 (fecha H7)           |
| SOLID                      | Premissa de construção, com um mecanismo por letra (invólucro, tabela de erro, suíte de contrato, portas em par, composition root)                    | ADR-0013                      |
| Unidade de trabalho        | Transação entre portas segregadas, sem repositório-deus                                                                                               | ADR-0014                      |
| Fidelidade visual          | A página Mockup substitui a medição empírica de tokens                                                                                                | ADR-0015                      |
| Histórico do Patrimônio    | Retrato mensal do PL gravado na mudança de patrimônio, decorando os escritores no composition root; o que veio antes segue reconstruído e marcado     | ADR-0016 (fecha P21)          |
| Mover valor                | "Redirecionamento" são DUAS operações: Transferência (duas posições, atômica, com Evento) e Direcionamento (credita um destino a partir de um evento) | ADR-0017 (responde H12)       |
| Início da série            | A série começa no mês do lançamento; recorrente Previsto é ocorrência, Pago é lançamento vinculado à ocorrência paga; lançamento pode ser descartado  | ADR-0019                      |
| Origem do pró-labore       | Conta de origem (PJ) opcional; destino (PF) obrigatório; o DRE vem do tipo, nunca das contas                                                          | ADR-0018                      |
| Open Finance               | Pluggy só no servidor, sob demanda, sem senha de banco; posição vinculada tem saldo e fato vindos do banco                                            | ADR-0020                      |
| Cartão e mês contábil      | Despesa marca "Cartão de crédito" e pode ter "Contabilizar em", que `accountingMonth()` lê antes da data; filtros do DRE recalculam a cascata         | ADR-0021 (emenda o PRD §5)    |
