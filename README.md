<div align="center">

# Bigorna

**Um lançamento. Três visões. Quatro relatórios.**

Controle financeiro pessoal e empresarial na mesma tela: a Pessoa Física e a
Pessoa Jurídica de uma mesma pessoa, sem cadastro duplicado e sem planilha.
Feito para quem fecha o próprio mês e precisa ver o resultado das duas entidades
junto e separado, com o mínimo de esforço para lançar.

Versão pública do repositório do produto, parte do portfólio de Larissa Quadros. Não há release, download nem instância pública.

[O que é](#o-que-é) · [Como funciona](#como-funciona) · [As telas](#as-telas) · [Estado atual](#estado-atual) · [Rodando](#rodando) · [Segurança](#segurança-e-privacidade) · [Documentação](#documentação)

</div>

---

## O que é

Antes deste repositório existia uma planilha: `Meu DRE.xlsx`, uma aba por mês,
plano de contas de dez blocos, Painel e Indicadores calculados à mão. Ela
funcionava. O problema nunca foi o relatório, foi a entrada: **o custo maior era
discriminar lançamento variável** — abrir a fatura do cartão, separar item por
item, decidir a categoria de cada um, repetir todo mês. A planilha de origem é a
referência do que o produto precisa reproduzir; ela não está nesta cópia pública,
porque traz as finanças reais de quem a usava.

Bigorna substitui essa planilha. Reproduzir os relatórios é o piso, não o
objetivo: se lançar aqui der o mesmo trabalho que lançar lá, o produto falhou. Por
isso o fluxo de **Novo Lançamento** é o requisito de maior prioridade do PRD, e
qualquer requisito novo que aumente a fricção dele é questionado antes de ser
aceito. Daí também o **Consumo Livre**: uma verba mensal com um popover de um
campo só, para o gasto miúdo que não vale o custo de ser categorizado.

O produto é de uma pessoa que tem duas entidades. A PF e a PJ não são dois
cadastros: são um atributo do mesmo lançamento. É isso que permite ver o
consolidado sem nunca digitar nada duas vezes.

## Como funciona

```
  ENTRADA                       FONTE DA VERDADE                 LEITURA (derivada, sob demanda)
  ───────                       ────────────────                 ───────────────────────────────

  Novo Lançamento ─┐
  Consumo Livre   ─┤      ┌────────────────────────┐      ┌──────────────────────────────┐
  Recorrência     ─┼────► │       LANÇAMENTO       │ ───► │       FILTRO DE VISÃO        │
  Onboarding      ─┤      │                        │      │                              │
  Venda de bem    ─┘      │  entidade   PF | PJ    │      │  Consolidado   PF + PJ, sem  │
                          │  natureza · categoria  │      │                intercompany  │
                          │  classificação · conta │      │  PF            só PF         │
                          │  data · Previsto|Pago  │      │  PJ            só PJ         │
                          └────────────────────────┘      └───────────────┬──────────────┘
                                                                          │
              ┌───────────────────┬───────────────────┬───────────────────┴───┐
              ▼                   ▼                   ▼                       ▼
     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
     │       DRE       │ │     Balanço     │ │    Evolução     │ │   Indicadores   │
     │                 │ │   Patrimonial   │ │     Mensal      │ │   Financeiros   │
     │  cascata do mês │ │  foto de hoje   │ │  série mês a mês│ │   5 famílias    │
     └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

**Só o Lançamento é escrito.** Ele carrega a entidade (PF ou PJ) como atributo,
nunca como cadastro paralelo. Junto com ele vivem os cadastros de contexto que o
onboarding preenche — plano de contas, contas bancárias, bens materiais,
investimentos e passivos. Não existe tabela de "DRE de julho": existe o conjunto
de lançamentos, e o DRE de julho é uma pergunta feita a ele.

**Os quatro relatórios são projeções de leitura, calculadas sob demanda.** Nenhum
total é digitado, nenhum mês precisa ser fechado à mão. O mês contábil de um
lançamento é o mês da **data de pagamento** que a pessoa informou (regime de
caixa); um lançamento `Previsto` é planejamento e não entra na cascata até virar
`Pago`. Como consequência direta, editar um mês antigo é permitido e recalcula em
cascata os meses seguintes — saldos de investimento e patrimônio são acumulados.

**A visão consolidada elimina os lançamentos intercompany.** Pró-labore e
distribuição de lucro atravessam as duas entidades: na visão da PJ o pró-labore é
despesa operacional (reduz o lucro) e a distribuição é apropriação abaixo da
linha; na visão da PF os dois são receita; no consolidado os dois somem, senão o
mesmo dinheiro seria contado duas vezes. Dividendo de investimento externo é
receita comum e **não** é eliminado — é a confusão mais fácil de cometer aqui.

**DRE e passivo são planos separados.** Registrar uma despesa não constrói nem
baixa um passivo: o saldo devedor do financiamento e a fatura do cartão são
mantidos pela pessoa, à parte. É o que permite um parcelamento em 12x aparecer
como 12 despesas mensais sem virar dupla contagem com a dívida.

## As telas

O desenho completo está no Figma, a especificação funcional em
[`files_design/01-especificacao-de-telas.md`](files_design/01-especificacao-de-telas.md) e a
camada visual em [`files_design/07-style-guide.md`](files_design/07-style-guide.md). São 130
frames extraídos, contando estados vazio e carregando de cada uma; as telas de verdade são estas,
com a rota real de cada uma.

| Tela                                     | Rota                                                                                       | O que faz                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Onboarding 0 — Antes de começar**      | `/onboarding`                                                                              | Explica a fronteira entre configurar a situação atual e lançar o dia a dia. Responde por que salário não entra aqui                             |
| **Onboarding 1 a 5**                     | `/onboarding/{plano-de-contas, contas-bancarias, bens-materiais, investimentos, passivos}` | Wizard linear de 5 passos, com indicador de Progresso. Reaproveita as telas do dia a dia; salva e continua depois                               |
| **Home**                                 | `/inicio`                                                                                  | Hub de entrada: Pendências, Entradas e Saídas, Onde Está Meu Dinheiro, Despesas por Categoria, Consumo Livre e Eventos Recentes                 |
| **Organizar Home**                       | `/inicio` (modo)                                                                           | Modo de edição da própria Home para reordenar e minimizar cards                                                                                 |
| **Detalhe de bloco / categoria / fluxo** | `/inicio` (3 modais)                                                                       | Abre a composição de um bloco dos treemaps ou de Entradas e Saídas, sem sair da Home                                                            |
| **Consumo Livre**                        | `/inicio` (3 modais)                                                                       | Configurar, "Gastei um valor" de um campo só, e Detalhe com o histórico do mês                                                                  |
| **Novo Lançamento**                      | `/novo-lancamento`                                                                         | O fluxo de maior prioridade. Formulário único com 4 abas: Despesa, Receita, Pró-labore e Distribuição, IR                                       |
| **Revisão de Recorrentes**               | `/revisao-de-recorrentes`                                                                  | Checklist mensal do que o motor de recorrência gerou como Previsto. Marcar Pago, Editar, Descartar. Parcelas de passivo entram na mesma lista   |
| **Histórico**                            | `/historico`                                                                               | Lista de todos os lançamentos, filtrável por status, entidade, mês, categoria, classificação, conta e recorrência                               |
| **DRE**                                  | `/dre`                                                                                     | Cascata de Receita Bruta a Lucro Líquido, com seletor de mês (inclusive futuro), toggle Pago/Previsto e a planilha de lançamentos do mês abaixo |
| **Balanço Patrimonial**                  | `/balanco-patrimonial`                                                                     | Foto do momento: ativo e passivo, circulante e não circulante, patrimônio líquido                                                               |
| **Evolução Mensal**                      | `/evolucao-mensal`                                                                         | Série histórica mês a mês, barras agrupadas em cima e tabela embaixo. Só meses com dado real                                                    |
| **Indicadores Financeiros**              | `/indicadores-financeiros`                                                                 | Os 18 indicadores do catálogo do doc08 §10, em 5 famílias. Divisão por zero mostra travessão, nunca `NaN`                                       |
| **Plano de Contas**                      | `/plano-de-contas`                                                                         | Os 10 blocos fixos do DRE, expansíveis; categorias criadas e editadas dentro deles                                                              |
| **Contas Bancárias**                     | `/contas-bancarias`                                                                        | Legenda/cor, entidade e saldo de cada conta                                                                                                     |
| **Bens Materiais**                       | `/bens-materiais`                                                                          | Imóvel, veículo, equipamento: nome, entidade e valor. É daqui que sai a venda                                                                   |
| **Vender Bem Material**                  | `/bens-materiais` (modal)                                                                  | Calcula ganho/perda e direciona o dinheiro recebido para vários destinos. O que sobrar vira pendência na Home                                   |
| **Investimentos**                        | `/investimentos`                                                                           | Valor acumulado por investimento. Sem reavaliação mensal                                                                                        |
| **Passivos**                             | `/passivos`                                                                                | Financiamentos, cartões e empréstimos, com classificação sugerida por palavra-chave                                                             |
| **Detalhe do Passivo**                   | `/passivos/{id}`                                                                           | Análise de uma dívida: dados, curva do saldo devedor, parcelas e histórico de eventos                                                           |
| **Registrar Reajuste de Juros**          | `/passivos/{id}` (modal)                                                                   | Nova taxa e data de validade; recalcula a amortização do passivo                                                                                |
| **Destinar o Lucro**                     | `/dre` (modal)                                                                             | Divide o lucro do mês em aporte, reinvestimento, consumo extraordinário e reserva. Salda a pendência de saldo não alocado na Home               |

## Estado atual

**O produto é navegável de ponta a ponta.** Deixou de ser "backend com uma casca": as 20 rotas de
tela e o modal de Destinar o Lucro existem, consomem a API de verdade pelos contratos Zod de
`src/api/contracts/`, e cada uma tem estado vazio, carregando e erro. O que falta agora é o login.

| Existe                                                                                                                                                                                                            | Não existe                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Next.js 15 (App Router), TypeScript `strict`, Tailwind v4, React 19                                                                                                                                               | Login, autenticação, sessão real (ADR-0008)                    |
| Domínio puro em `src/domain`, com ESLint impedindo que ele conheça banco, HTTP ou framework                                                                                                                       | Multiusuário (o dado já é escopado por `userId`, mas há um)    |
| **Banco SQLite via Drizzle** (`./.data/bigorna.db`), migrações versionadas em `drizzle/`                                                                                                                          |                                                                |
| **39 rotas HTTP / 60 operações** em `src/app/api/v1/**`, todas com sessão e validação Zod                                                                                                                         | Integração bancária, Open Finance, importação da planilha      |
| **`docs/api/openapi.json` gerado dos schemas Zod** — o contrato não diverge do código                                                                                                                             | Criptografia em repouso (ADR-0009, "Explicitamente NÃO feito") |
| Portas de repositório segregadas + suíte de contrato que todo adaptador roda (ADR-0013)                                                                                                                           | Storybook (o script existe; o pacote não está instalado)       |
| **20 rotas de tela** navegáveis: Home + 6 modais, Novo Lançamento, os 4 relatórios, Histórico, Revisão de Recorrentes, as 5 telas de Plano de Contas e Patrimônio, Detalhe do Passivo e os 6 passos de Onboarding | Telemetria, analytics, qualquer recurso de terceiro            |
| **Design system do `files_design/07`**: 38 tokens de cor claro/escuro, coleção Escala, Geist self-hosted, 12 primitivos e 30 padrões                                                                              | Versão mobile — a sidebar não colapsa porque não foi desenhada |
| Treemap e barras agrupadas em **SVG próprio**, seguindo o algoritmo do `files_design/08`                                                                                                                          | Biblioteca de gráfico, de ícone ou fonte de CDN (por decisão)  |
| **851 testes** unitários, de componente e de rota, verdes, mais e2e de Playwright                                                                                                                                 |                                                                |
| Cabeçalhos de segurança com CSP por nonce, logger sem PII, seed 100% sintético e determinístico                                                                                                                   |                                                                |

A camada visual foi trocada nesta rodada. Os tokens medidos à mão da fase anterior foram
substituídos pelos 38 tokens nomeados do `files_design/07-style-guide.md`, que chegou depois e é a
fonte da verdade agora — decisão registrada em
**[ADR-0015](docs/adr/0015-o-style-guide-substitui-a-medicao-empirica-de-tokens.md)**, com
`docs/DESIGN.md` reescrito do zero para descrever o sistema real.

O banco é SQLite por decisão registrada (**ADR-0012**), não por acaso: o dado é relacional e
pequeno — uma pessoa por instância — e o que precisa de proteção não é volume, é integridade. O
esquema defende o que o compilador não alcança: chave primária composta `(user_id, id)` em toda
tabela, chaves estrangeiras compostas (um lançamento não consegue apontar para a categoria de
outra pessoa) e `CHECK` por natureza de lançamento.

Trocar SQLite por outro banco continua sendo trocar uma linha no composition root
(`src/data/index.ts`): as portas falam tipos de domínio, e todo adaptador roda a mesma suíte de
contrato. Isso é afirmação com prova, não intenção — ver **ADR-0013 §3**.

Enquanto não houver login, o ambiente é privado. Isso não é postura provisória relaxada — é o
oposto: `src/server/session.ts` já carrega um `userId` em toda leitura e em toda escrita, para que
a fase 2 não precise reescrever tela nenhuma.

## Rodando

Requer **Node >= 20.9** (`.nvmrc` fixa a 24). Node 18 não serve: o Tailwind v4 e o
npm 11 exigem runtime mais novo. O Makefile falha cedo e diz o conserto, em vez de
deixar o erro aparecer como falha obscura de compilação:

```
$ make require-node

  Node 18.20.8 é velho demais. Este projeto exige >= 20.9.

  Conserto:  nvm install 24 && nvm use 24     (ou)  brew install node@24
```

Com o Node certo:

```bash
make install    # instala as dependências
make seed       # cria ./.data/bigorna.db e popula o cenário sintético
make dev        # localhost:3000
make check      # o portão local antes de qualquer commit
```

### Open Finance (Pluggy)

Opcional. Sem isto o app funciona como sempre funcionou (ADR-0020).

1. Conecte os bancos da PF e da PJ no [Meu Pluggy](https://meu.pluggy.ai). A senha do banco fica
   lá: o Bigorna nunca a vê.
2. Copie `.env.example` para `.env` e preencha `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e
   `PLUGGY_ITEM_IDS` (os ids das conexões, separados por vírgula). O `.env` nunca é commitado.
3. `make dev`, cadastre as Contas Bancárias e os Investimentos e vincule cada conta do banco no
   card **Open Finance** dessas telas.

O app sincroniza ao abrir, no máximo a cada 6 horas. "Sincronizar agora" no card força a
sincronização.

### O banco e o cenário sintético

O banco é um arquivo, criado na primeira abertura. Ele fica em `./.data/bigorna.db`
— fora de `src/` e de `public/`, no `.gitignore`, com `chmod 0600` aplicado a cada
abertura (ADR-0009). `DATABASE_PATH` troca o caminho.

```bash
npm run db:generate   # gera uma migração em drizzle/ a partir de src/data/sqlite/schema.ts
npm run db:migrate    # aplica as migrações pendentes
npm run db:seed       # popula o cenário sintético (= make seed)
```

`make seed` é **idempotente e determinístico**: roda duas vezes e o estado final é
o mesmo, porque `seed()` reseta os dados do usuário antes de recriá-los. O cenário
é o dashboard da Home do Figma mais as adições da v7 (passivo com cronograma
completo, Consumo Livre com sobra do mês anterior), ancorado no mês semente
`2026-07`. **Todo dado ali é inventado** — nenhum nome, valor, conta, CPF ou CNPJ
real (ADR-0009 §1, verificado por `make audit-lgpd`).

O seed não imprime valor monetário nem nome digitado: só contagens e
identificadores opacos, e em `stderr`, no mesmo espírito de `src/lib/log.ts`.

### A API

A API vive em `/api/v1` dentro do mesmo app (não há segundo serviço). O contrato é
gerado dos schemas Zod, nunca escrito à mão:

```bash
npm run api:spec   # regenera docs/api/openapi.json a partir de src/api/contracts/**
```

Se o `openapi.json` mudar depois de você mexer num schema, isso é o esperado — o
diff é a revisão do contrato. Se ele mudar sem você ter mexido em schema nenhum,
algo está errado. A lista dos 39 caminhos está em `docs/ARCHITECTURE.md` §4.3.

Os alvos disponíveis:

```
$ make help
  audit-deps         Vulnerabilidades conhecidas nas dependências
  audit-lgpd         Falha se houver PII em fixture ou console.log em src/ (ADR-0009)
  audit-tokens       Falha se algum componente tiver cor ou medida literal (ADR-0011)
  audit              Roda as duas auditorias de repositório
  build              Compila para produção
  check              Portão local: tipos + lint + formato + testes + auditorias
  clean              Remove artefatos de build e teste
  dev                Sobe o servidor de desenvolvimento em localhost:3000
  fmt-check          Verifica formatação sem alterar arquivo
  fmt                Formata com Prettier
  help               Mostra este menu
  install            Instala dependências
  lint               ESLint em todo o projeto
  node_modules       Instala dependências quando o manifesto muda
  require-node       Falha cedo se o Node for velho demais, com a instrução de conserto
  seed               Popula ./.data/bigorna.db com o cenário sintético de desenvolvimento
  start              Sobe o build de produção
  storybook          Storybook do design system em localhost:6006
  test-unit          Vitest — domínio, regras puras e componentes
  test               Testes que rodam em qualquer máquina (unitários)
  typecheck          Verifica os tipos sem emitir
```

Duas observações sobre esse menu:

- O Makefile também define `test-e2e` e `test-e2e-install` (Playwright). Eles não
  aparecem acima porque o filtro do menu não aceita dígito no nome do alvo, e
  `e2e` tem um. Rodam normalmente.
- `make storybook` só funcionará quando o Storybook entrar nas dependências de
  desenvolvimento; hoje o `package.json` tem o script, não o pacote.

`make test` roda apenas o que roda em qualquer máquina. O Playwright fica fora
porque depende de baixar browser.

## Segurança e privacidade

**Segurança é premissa, não opção.** O dado deste app é financeiro, pessoal e
empresarial. A LGPD vale desde o primeiro commit, e não a partir do dia em que
houver usuário de verdade.

- **Ambiente privado.** Sem login na fase 1, qualquer pessoa com
  acesso à URL veria tudo. Por isso o ambiente não é exposto à internet, e
  `src/app/layout.tsx` marca as páginas como `noindex`.
- **Nenhum terceiro no cliente.** Sem analytics, sem fonte de CDN, sem pixel, sem
  SDK externo. A fonte é a do sistema.
- **CSP sem origem externa** em `next.config.ts`: `default-src 'self'` e
  `connect-src 'self'` bloqueiam exfiltração por fetch ou WebSocket mesmo se uma
  dependência for comprometida. Junto vão HSTS em produção, `Referrer-Policy:
no-referrer`, `X-Frame-Options: DENY`, `nosniff` e uma `Permissions-Policy` que
  desliga câmera, microfone, geolocalização e pagamento.
- **Log sem PII.** `src/lib/log.ts` registra que algo aconteceu, nunca o quê:
  valor, nome de categoria, nome de conta e qualquer texto digitado ficam de
  fora, e chaves sensíveis são substituídas por `[omitido]`. `console.log` é erro
  de ESLint em `src/` justamente para que este seja o único caminho.
- **Fixture 100% sintética.** Nenhum dado real entra no repositório. `make
audit-lgpd` falha se encontrar CPF, CNPJ ou `console.log`.
- **Costura de sessão desde já.** `src/server/session.ts` entrega um `userId`
  em toda leitura, mesmo sem autenticação, para que nenhuma consulta exista fora
  de escopo de usuário e a fase 2 seja uma troca de provedor, não uma reforma.

O Playwright não grava vídeo e só tira screenshot em falha, pelo mesmo motivo.

Política de reporte em [`SECURITY.md`](SECURITY.md). A decisão completa de LGPD e
postura de segurança está na ADR-0009, em [`docs/adr/`](docs/adr/) — é ela que o
código cita em `next.config.ts` e em `src/lib/log.ts`.

## Documentação

| Documento                                                                                                    | O que cobre                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/prd/financas-pf-pj.md`](docs/prd/financas-pf-pj.md)                                                   | O produto: propósito, escopo, casos de uso, plano de contas de referência e critérios de liberação. Versão viva, com changelog (v7)                                                    |
| [`docs/event-storming/financas-pf-pj.md`](docs/event-storming/financas-pf-pj.md)                             | O domínio: eventos, comandos, políticas, agregados, bounded contexts e os hotspots H1 a H10 que viram ADR                                                                              |
| [`docs/adr/`](docs/adr/)                                                                                     | As decisões técnicas, uma por arquivo, numeração imutável. O código aponta para elas pelo número — `ADR-0009` em `next.config.ts`, `ADR-0007` no ESLint, `ADR-0015` em `tokens.css`    |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                               | Como é construído: camadas, portas de repositório, os 39 endpoints, fluxo de dados e a fronteira da fase 2                                                                             |
| [`docs/api/openapi.json`](docs/api/openapi.json)                                                             | O contrato HTTP, **gerado** dos schemas Zod por `npm run api:spec`. Nunca editar à mão                                                                                                 |
| [`docs/PERGUNTAS-EM-ABERTO.md`](docs/PERGUNTAS-EM-ABERTO.md)                                                 | O que as fontes da verdade não respondem e que **não foi inventado**: cada pergunta com o que o código assumiu e o que muda quando a resposta vier                                     |
| [`docs/DESIGN.md`](docs/DESIGN.md)                                                                           | Como se parece e se comporta: os 38 tokens, tipografia, componentes, gráfico e formato de dado. Reescrito do zero sobre o `files_design/07` (ADR-0015). Leia antes de desenhar UI nova |
| [`files_design/00-leia-primeiro.md`](files_design/00-leia-primeiro.md)                                       | Porta de entrada do design, com a ordem de leitura dos nove documentos                                                                                                                 |
| [`files_design/01-especificacao-de-telas.md`](files_design/01-especificacao-de-telas.md)                     | O "o quê" de cada tela, sem o desenho. Ponte entre PRD e implementação                                                                                                                 |
| [`files_design/02-log-de-decisoes-de-ux.md`](files_design/02-log-de-decisoes-de-ux.md)                       | O "porquê", em ordem cronológica. Histórico do raciocínio, não estado atual                                                                                                            |
| [`files_design/03-modelo-de-dados-por-tela.md`](files_design/03-modelo-de-dados-por-tela.md)                 | O "com quê": campos exatos, obrigatoriedade e validação de cada tela                                                                                                                   |
| [`files_design/04-glossario-de-nomenclatura.md`](files_design/04-glossario-de-nomenclatura.md)               | O vocabulário fechado. Consulte antes de renomear qualquer coisa                                                                                                                       |
| [`files_design/05-sugestoes-para-o-time-de-produto.md`](files_design/05-sugestoes-para-o-time-de-produto.md) | O que ainda depende de decisão de produto, não de design                                                                                                                               |
| [`files_design/06-roteiro-de-prototipo.md`](files_design/06-roteiro-de-prototipo.md)                         | As 33 ações do teste de usabilidade e a rota de cada uma no app                                                                                                                        |
| [`files_design/07-style-guide.md`](files_design/07-style-guide.md)                                           | O guia visual: tokens, tipografia, espaçamento e os estados de cada componente                                                                                                         |
| [`files_design/08-regras-de-renderizacao-de-dados.md`](files_design/08-regras-de-renderizacao-de-dados.md)   | Como cada dado aparece na tela, incluindo os casos degenerados — divisão por zero, lista vazia, valor ausente. São regra de domínio disfarçada de regra visual                         |
| [`docs/figma/INDEX.md`](docs/figma/INDEX.md)                                                                 | Índice dos 130 frames. Cada `.xml` em `frames/` é a árvore literal de um frame, com todo o texto da tela — **é a fonte de fidelidade, não a API do Figma**                             |
| [`docs/loop-produto-playbook.md`](docs/loop-produto-playbook.md)                                             | O traço real dos prompts que conduziram o projeto, passo a passo, com as perguntas e respostas de cada etapa                                                                           |
| [`.claude/skills/loop-produto/SKILL.md`](.claude/skills/loop-produto/SKILL.md)                               | O processo em si: brainstorming, PRD, Event Storming, ADR, spec e revisão                                                                                                              |
| [`CLAUDE.md`](CLAUDE.md)                                                                                     | Como trabalhar neste repositório: fontes da verdade, precedência, princípios                                                                                                           |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                                                                         | O fluxo de contribuição: TDD, Conventional Commits, quando abrir uma ADR                                                                                                               |
| [`SECURITY.md`](SECURITY.md)                                                                                 | Modelo de ameaça e como reportar uma vulnerabilidade                                                                                                                                   |

## Desenvolvimento

A dependência aponta para dentro: `app` → `features` → `dados` → `dominio`. O
domínio não conhece ninguém. Isso não é convenção de boa vontade, é regra de
ESLint: importar React, Next ou qualquer camada de fora dentro de `src/domain`
falha o lint.

```
src/
  app/          rotas do App Router: layout, páginas e, na fase 2, os Route Handlers
  features/     uma pasta por tela: composição, estado de tela e chamadas de dados
  components/
    ui/         primitivas do design system, sem regra de negócio
    patterns/    composições que se repetem entre telas
  data/
    contracts/  as interfaces de repositório — o que as camadas de cima podem pedir
    memory/    a implementação in-memory da fase 1, trocável por banco na fase 2
    fixtures/   dados sintéticos para desenvolver e testar. Nunca dado real
  domain/
    core/     dinheiro, tempo, identificadores e o vocabulário fechado do produto
  lib/          utilitário sem domínio: `cn` de classes, `log` estruturado
  server/       o que só roda no servidor. Hoje: a costura de sessão
  styles/       tokens.css (fonte visual única) e globals.css
docs/           PRD, Event Storming, ADRs, extração do Figma, planilha de origem
files_design/   a documentação de design, do fluxo às telas
e2e/            testes de Playwright
```

O esqueleto de camadas veio antes do código, de propósito: assim a primeira tela
já nasce no lugar certo, em vez de ser movida depois.

**Idioma.** Todo o código é em inglês, domínio incluído — `Entry`, `Recurrence`,
`computeIncomeStatement`. O texto de tela e as rotas continuam em português, porque
são interface. A tradução entre o vocabulário do produto e os identificadores é
normativa e está em [`src/domain/GLOSSARY.md`](src/domain/GLOSSARY.md).

**Valor literal é erro.** Nenhum componente carrega hex ou px solto: tudo vem de
`src/styles/tokens.css`, e `make audit-tokens` falha se alguém esquecer.

## Contribuindo

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md) para o fluxo (TDD, Conventional
Commits, quando uma decisão vira ADR) e [`CLAUDE.md`](CLAUDE.md) para como
trabalhar neste código — vale igual para pessoa e para agente.

Uma regra acima das outras, herdada do processo: **não assuma premissas.** Se a
resposta não está no PRD, no Event Storming, nas ADRs ou na documentação de
design, pergunte a quem decide e registre o que foi decidido. Palpite que vira
código é dívida que ninguém sabe que tem.

## Licença

Proprietário. Todos os direitos reservados.

Este repositório é aberto para leitura e não acompanha licença de código aberto. Nada aqui
está liberado para uso, cópia, modificação ou redistribuição sem autorização
expressa do titular.
