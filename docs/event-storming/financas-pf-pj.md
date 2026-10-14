# Event Storming — Controle Financeiro PF + PJ

> Fonte: `docs/prd/financas-pf-pj.md` **v7** (2026-09-02). Terreno: **misto**. Para a espinha
> dorsal arquitetural (H1-H10, ADRs 0007-0012, 151 testes em 10 arquivos — domínio, `src/api`
> e `src/data/sqlite`, não só domínio) o terreno é **brownfield**:
> o código já existe, e este documento passa a mapear o que **já foi construído**, não mais uma
> hipótese. Para os conceitos que a v7 trouxe do corpo de design (Pendências, Eventos como
> vitrine na Home, Consumo Livre como widget, Redirecionamento como operação única, Organizar
> Home) o terreno continua **green field** — os tipos existem (`src/domain/discretionary-spending`,
> `src/domain/trace-events`), as regras ainda não. Conduzido pela Engenharia. Este documento
> alimenta as ADRs; ele **não** decide arquitetura — apenas mapeia eventos, atores, agregados e
> hotspots.
>
> **v2 desta sessão** — realinha o Event Storming à v7 do PRD, que reverteu a decisão de "DRE
> configurável" (H10) e acrescentou Pendências, Eventos, Passivo com cronograma, Venda de Bem
> Material com direcionamento, Destinação do Lucro com múltiplos itens e Organizar Home. A v1
> deste documento (ainda citada em `docs/ARCHITECTURE.md` e em comentários do código como
> `ADR-0001`..`ADR-0006`) fica preservada no histórico do git; o que muda de fato está descrito
> na seção "O que mudou desde a v1", ao final.
>
> **Revisão desta v2 contra o PRD v7 e o corpo de design** — a v2 foi percorrida caso a caso
> (UC1 a UC44) e no sentido inverso (evento → requisito). O resultado está em "Cobertura dos
> casos de uso", logo abaixo, e nas correções aplicadas: os comandos de leitura dos relatórios
> (visão, base Pago/Previsto, seletor de mês, os três drill-downs, a planilha do DRE, o
> Histórico), os casos degenerados de `files_design/08` que são regra de domínio, o
> Editar/Descartar das quatro listas de patrimônio, a criação de categoria a partir do Novo
> Lançamento, o seletor de mês da Revisão de Recorrentes, e a correção de quatro afirmações de
> "implementado e testado" que a suíte não sustenta.

## Legenda

- 🟧 **Evento de domínio** (fato consumado, no passado)
- 🟦 **Comando** (intenção que dispara um evento)
- 🟨 **Ator** (quem dispara o comando)
- 🟪 **Política / Automação** ("sempre que X, então Y" — feita pelo Sistema; o "policial" do
  domínio, que reage a um evento e garante que a regra seguinte aconteça)
- 🟩 **Read model / Projeção** (leitura derivada, não fonte da verdade)
- 🟥 **Hotspot** (ponto de dúvida/decisão — vira ADR ou pergunta)
- 🟫 **Agregado** (consistência transacional)

Atores do domínio: 🟨 **Pessoa usuária** (usuária única) e 🟨 **Sistema** (motor de recorrência,
motor de amortização/reajuste de Passivo, motor de eliminação intercompany, motor de Pendências,
gerador de Eventos de rastreabilidade).

---

## Cobertura dos casos de uso (UC1 a UC44 do PRD v7)

Percorrido caso a caso contra o PRD §4. Serve para duas coisas: provar que nenhum requisito
ficou sem comando/evento, e deixar visível o caminho inverso — qualquer evento deste documento
que não apareça nesta coluna precisa de fonte, ou é invenção.

| UC | Assunto | Onde está |
|---|---|---|
| UC1 | Despesa variável de cartão sem detalhar item a item | Fluxo B |
| UC2 | Previsto → Pago com data, que define o mês do DRE | Fluxo B |
| UC3 | Pró-labore nas 3 visões | Fluxo C |
| UC4 | Distribuição de lucro nas 3 visões | Fluxo C |
| UC5 | Aluguel recebido (PF) e dividendo externo, não intercompany | Fluxo B + Fluxo C (a exclusão) + Fluxo E (o dividendo) |
| UC6 | Destinação do lucro nas 4 categorias | Fluxo F |
| UC7 | DRE do mês, alternando as 3 visões | Fluxo G (comandos de leitura) |
| UC8 | Gasto de Consumo Livre entra como despesa no DRE | Fluxo H |
| UC9 | Evolução Mensal mês a mês | Fluxo G |
| UC10 | Indicadores Financeiros (ex.: meses de reserva) | Fluxo G |
| UC11 | Aporte em investimento, sem reavaliação | Fluxo E |
| UC12 | Venda de investimento ou bem material → ganho/perda | Fluxo E + Fluxo L |
| UC13 | Recorrência propagada como Previsto | Fluxo D |
| UC14 | Editar ocorrência: só esta vs. toda a série | Fluxo D |
| UC15 | Data de término da recorrência (parcelamento) | Fluxo D |
| UC16 | Editar plano de contas, criando categoria num bloco | Fluxo A |
| UC17 | Onboarding com salvar e continuar depois | Fluxo A |
| UC18 | IR como pagamento ou recebimento, orientado | Fluxo F |
| UC19 | Roteamento de abertura pelo estado do onboarding | Fluxo A |
| UC20 | "Antes de começar" e "Fazer depois" | Fluxo A |
| UC21 | Cadastro de dívida com parcelas já pagas | Fluxo K |
| UC22 | Detalhe do Passivo (saldo, taxa, parcelas, eventos) | Fluxo K + Fluxo J |
| UC23 | Reajuste de juros com recálculo prospectivo | Fluxo K |
| UC24 | Parcela paga com valor real e divergência | Fluxo K + Fluxo J |
| UC25 | Revisão de Recorrentes: mês anterior + parcelas na mesma lista | Fluxo D |
| UC26 | Pago a menos vira Pendência; pago a mais oferece 3 desfechos | Fluxo B + Fluxo I |
| UC27 | Home: um card por pendência, da mais antiga | Fluxo I |
| UC28 | 5 eventos mais recentes na Home | Fluxo J |
| UC29 | Entradas e Saídas: mês futuro e clique na linha | Fluxo G (comandos de leitura) |
| UC30 | Onde Está Meu Dinheiro: composição e redirecionamento | Fluxo G + Fluxo L (H12) |
| UC31 | Despesas por Categoria: detalhe, gasto rápido, ícone → Histórico | Fluxo G + Fluxo H |
| UC32 | Consumo Livre: verba, gasto só com valor, histórico, sobra, saldo | Fluxo H |
| UC33 | Organizar Home: reordenar, minimizar, persistir | Fluxo M |
| UC34 | DRE entre Pago e Previsto, com mês futuro | Fluxo G |
| UC35 | Planilha do DRE: marcar pago e corrigir sem sair do relatório | Fluxo G (comandos de leitura) → Fluxo B |
| UC36 | Dois aportes na mesma categoria, percentual, salvar com saldo | Fluxo F → Fluxo I (tipo 3) |
| UC37 | Venda de bem material dividida, com resto pendente | Fluxo L → Fluxo I (tipo 1) |
| UC38 | Plano de Contas e Patrimônio: editar conta, descartar investimento | Fluxo E + Fluxo K |
| UC39 | Histórico: filtrar, abrir e corrigir | Fluxo G (comandos de leitura) → Fluxo B |
| UC40 | Criar categoria no formulário, vendo as parecidas do bloco | Fluxo A + Fluxo B |
| UC41 | Tema e última visão persistidos | Fluxo M |
| UC42 | Indicadores Financeiros por mês; sem base de cálculo → travessão | Fluxo G (casos degenerados) |
| UC43 | Evolução Mensal 6 vs. 12 meses, só meses com dado real | Fluxo G |
| UC44 | Conta recém-criada: cada card explica o que vai aparecer | Fluxo G (casos degenerados) + Fluxo M |

**Sentido inverso — eventos sem requisito.** Uma varredura dos 🟧 deste documento contra o PRD
encontrou **um só** caso sem fonte de produto: **Lançamento excluído** (Fluxo B), marcado ali
com ⚠️. Todos os demais têm origem no PRD §1/§4/§5 ou em `files_design/01` e `03`. Os eventos
que existem **como comportamento de tela e não como decisão de modelagem tomada** estão marcados
onde aparecem — **Sobra do mês anterior registrada** (Fluxo H, P14) é o único.

---

## Fluxo A — Onboarding / Setup inicial

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Ver "Antes de começar" | — | Pessoa |
| Escolher "Fazer depois" | **Onboarding adiado** → vai direto para a Home em estado vazio | Pessoa |
| Escolher "Começar agora" | — | Pessoa |
| Inicializar plano de contas (a partir do modelo) | **Plano de contas inicializado** | Pessoa |
| Criar/editar categoria dentro de um bloco | **Categoria criada / renomeada** | Pessoa |
| Cadastrar conta bancária (nome + cor) | **Conta bancária cadastrada** | Pessoa |
| Cadastrar Bem Material (nome anterior: Ativo) | **Bem Material inicial cadastrado** | Pessoa |
| Cadastrar Investimento | **Investimento inicial cadastrado** | Pessoa |
| Cadastrar Passivo (formulário completo — ver Fluxo K) | **Passivo cadastrado** + **Cronograma de parcelas gerado** | Pessoa |
| Salvar progresso e sair | **Progresso de onboarding salvo** | Pessoa |
| Reabrir o app com onboarding incompleto | — | Sistema roteia para o passo onde parou |

🟪 O onboarding reaproveita as mesmas telas do dia a dia (Plano de Contas e Patrimônio); usa o
mesmo formulário completo de Passivo do dia a dia (nunca um formulário reduzido).

🟪 **Não existe comando "excluir categoria"** (PRD §5; files_design/01 §2): categoria não
utilizada apenas deixa de ser usada. Isto é invariante do agregado Plano de Contas, não uma
omissão de tela — nenhum evento "Categoria excluída" deve ser criado.

🟪 **O bloco 6 (D&A) é somente leitura — não aceita nenhuma categoria.** O Figma tem um frame
inteiro para isso (`51:32`, "Onboarding 1 — bloco D&A expandido (somente leitura)"): "Este bloco
não tem categorias: é sempre zero no MVP… Sem botão de criar categoria e sem Editar/Descartar".
É a contraparte estrutural de "D&A = 0 → EBITDA = EBIT" (Fluxo E): se uma categoria pudesse
nascer aqui, a igualdade deixaria de valer sem que ninguém tivesse decidido revertê-la. Os
outros 9 blocos aceitam categorias; este não. Já implementado
(`src/domain/chart-of-accounts/rules.ts` rejeita a criação nesse bloco).

🟪 **Criar categoria é um comando de dois lugares**, não só do onboarding: a mesma
**Categoria criada** nasce também de dentro do Novo Lançamento, inline, sem sair do formulário
(PRD §5, UC40; files_design/01 §5 "Categoria — busca/autocomplete; cria categoria nova inline").
A busca é por **texto simples**; ao criar uma categoria sem correspondência, o sistema apresenta
as **categorias parecidas já existentes naquele bloco** antes da confirmação — é requisito
(PRD §5 e critério de liberação), não a sugestão de sinônimos, que ficou em `files_design/05` e
na seção 9.1 do PRD como **não requisito**.

🟥 **P10 e P11, ainda sem resposta:** a categoria de sistema "Consumo Livre" pode ser renomeada
ou descartada como as vizinhas, e recriar uma categoria arquivada restaura a antiga (com o
histórico) ou cria um registro novo? A segunda pergunta pressupõe um estado "arquivada" que
nenhuma fonte modela hoje — não inventar o ciclo de vida aqui.

🟥 **Progresso do onboarding precisa distinguir três estados** (PRD §5): "não iniciado",
"adiado pela pessoa" e "em andamento" — um só campo booleano `completed` não basta. Nenhum
`OPEN QUESTION` documenta essa distinção no código hoje; verificar antes de implementar
`src/data/contracts` do onboarding.

---

## Fluxo B — Lançamento do dia a dia

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Registrar lançamento como Previsto (Recebido/Pago não se aplica ainda) | **Lançamento previsto registrado** | Pessoa |
| Registrar lançamento já Pago/Recebido | **Lançamento pago registrado** | Pessoa |
| Marcar Previsto como Pago, informando **valor pago** (pré-preenchido com o previsto) e data | **Lançamento pago** | Pessoa |
| Editar lançamento (a partir do Histórico ou da planilha do DRE) | **Lançamento editado** | Pessoa |
| Criar categoria inline, sem sair do formulário (Fluxo A) | **Categoria criada** | Pessoa |
| Excluir lançamento ⚠️ | **Lançamento excluído** | Pessoa |

⚠️ **"Excluir lançamento" não tem fonte no PRD v7 nem no corpo de design.** Nem o Histórico
(files_design/01 §7, que oferece criar e editar) nem a Revisão de Recorrentes (que oferece
**Descartar a ocorrência**, coisa diferente) descrevem apagar um Lançamento já registrado. Está
listado aqui porque o contrato HTTP já escrito o expõe (`DELETE /api/v1/entries/{id}`,
`src/api/contracts/entries.ts`) — é uma decisão de engenharia herdada, não um requisito de
produto. Ou o PRD passa a declará-lo, ou o contrato perde a rota; não deixar as duas versões
conviverem sem que alguém tenha decidido.

🟪 **Sempre que** um lançamento entra na base "Pago" → as projeções (DRE, Entradas e Saídas,
Balanço Patrimonial, Indicadores Financeiros) refletem o novo estado no mês da data de
pagamento. Lançamentos **Previstos** entram só na base "Previsto" das mesmas telas — nunca se
somam com "Pago" (mudança da v7: v6 dizia que Previsto não entrava em relatório nenhum; agora
entra, na sua própria base — ver Fluxo G).

🟪 **Classificação circulante / não circulante é sugerida e permanece editável** (PRD §1): no
Lançamento a sugestão vem da **categoria**, no Passivo vem de **palavra-chave no nome**. Sugerir
nunca é decidir — a pessoa sobrescreve, e é por isso que errar a sugestão tem custo baixo.
🟥 **P7 e P8, ainda sem resposta:** nenhuma fonte lista as palavras-chave nem o mapeamento
categoria → classificação. `CLASSIFICATION_KEYWORDS`
(`src/domain/chart-of-accounts/rules.ts`) é uma **leitura das linhas do Balanço do próprio PRD**,
declarada como tal no comentário, não uma resposta inventada — mas continua sendo provisória.

🟪 **Divergência entre valor pago e valor previsto** (PRD §5, UC26 — **a política mais
importante desta rodada**, também descrita no Fluxo D e no Fluxo I):
- `valor pago < valor previsto` → gera **Evento de divergência** (Fluxo J) **e** cria uma
  **Pendência** própria daquela ocorrência (Fluxo I, tipo 4), com ação "Pagar". Nunca é somada
  com outra divergência — um item por ocorrência.
- `valor pago > valor previsto` → gera **Evento de divergência**, mas **nunca** cria Pendência.
  A pessoa escolhe, na hora, um entre três desfechos: **descontar da próxima ocorrência**
  (reduz o previsto do mês seguinte), **redirecionar o valor extra** (Fluxo H/L, mesmo conceito
  de Direcionamento) ou **manter sem ação** (só o Evento).
- `valor pago = valor previsto` → nenhum Evento, nenhuma Pendência.

🟫 Implementado hoje em `src/domain/entries/rules.ts` (`Underpaid`/`Overpaid`, campo
`becomesPending`) — a política de domínio já existe e tem teste (`rules.test.ts`); falta o
Evento de rastreabilidade (`Discrepancy`) ser efetivamente emitido a partir dela, e falta a
Pendência do tipo 4 ganhar um registro persistente (ver agregado `Pendência` mais abaixo).

*(Consumo Livre não nasce mais aqui — deixou de ser aba do formulário; ver Fluxo H.)*

---

## Fluxo C — Pró-labore e Distribuição (PF ↔ PJ)

*(nome da aba na v7; "intercompany" segue valendo como termo de domínio/motor de eliminação,
nunca como rótulo de tela — PRD §1)*

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Registrar pró-labore (conta de origem PJ + conta de destino PF) | **Pró-labore registrado** (intercompany) | Pessoa |
| Registrar distribuição de lucro (conta de origem PJ + conta de destino PF) | **Distribuição de lucro registrada** (intercompany) | Pessoa |

🟪 **Sempre que** um lançamento intercompany é projetado (`src/domain/entries/projection.ts`,
já implementado e testado, e registrado em ADR-0003 desde 2026-09-08):
- Visão **PJ**: pró-labore = despesa operacional (reduz lucro, bloco a definir — ver hotspot
  P1/H-novo abaixo); distribuição = apropriação do lucro (bloco 10, abaixo da linha).
- Visão **PF**: ambos = receita.
- Visão **consolidada**: ambos **eliminados**.
- Dividendos de investimentos **externos** NÃO são intercompany (receita comum, bloco 1, nunca
  eliminada) — distinção que `isIntercompany` no vocabulário já capta.

Nenhum campo de entidade: o sub-tipo (`ProLabore` / `ProfitDistribution`) já deriva o
tratamento nas três visões (`EntryKind`, `src/domain/core/vocabulary.ts`).

---

## Fluxo D — Recorrência

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Criar recorrência (fixa/a definir; com/sem término) | **Recorrência criada** | Pessoa |
| — | **Ocorrência de recorrência gerada** (Previsto, mês seguinte) | Sistema 🟪 |
| Editar ocorrência — "só esta" ou "toda a série (valores em aberto)" | **Ocorrência editada** / **Série alterada** | Pessoa |
| Descartar ocorrência do mês | **Ocorrência descartada** (série continua) | Pessoa |
| Encerrar recorrência | **Recorrência encerrada** (série parada para sempre) | Pessoa |
| Marcar ocorrência como paga (valor + data) | **Lançamento pago** (Fluxo B) — a ocorrência vira um Lançamento de verdade | Pessoa |

🟪 **Sempre que** o mês vira → o motor gera as ocorrências Previstas do próximo mês (fixa =
valor copiado; a definir = em branco), até a data de término, se houver — `generateOccurrences`
em `src/domain/recurrence/engine.ts`, puro e determinístico (não lê relógio; o chamador diz até
onde projetar).

🟪 **Critério de "só esta" vs. "toda a série" é o status, nunca o tempo** (`EditScope`,
`WholeSeries` alcança **também** uma ocorrência atrasada que continua Previsto — PRD §5,
files_design/02). A pergunta só aparece quando há mudança de valor/dado, nunca ao só confirmar
pagamento.

🟪 **Recorrência "a definir" sem valor preenchido** (`Occurrence.plannedAmount === null`) fica
Previsto e pendente — nasce uma **Pendência tipo 2** (Fluxo I); não bloqueia o fechamento do
mês. A pessoa decide, a qualquer momento, entre preencher o valor (resolve a Pendência) ou
descartar a ocorrência (também resolve, mas não converte a série para "fixo" — ver P13 em
`docs/PERGUNTAS-EM-ABERTO.md`, ainda sem resposta).

🟪 **Parcelas de Passivo aparecem na mesma lista de Revisão de Recorrentes** (PRD v7, UC25),
lado a lado com as ocorrências recorrentes — mesmo formato de linha, mas a ação de edição vira
**"Editar juros"** em vez de um campo de valor solto (o valor da parcela é calculado por
amortização, nunca digitado). Ver Fluxo K para o detalhe. Isto é uma composição de leitura entre
dois agregados (`Occurrence` e `Installment`) que hoje não têm um tipo-pai comum — anotado como
ponto de atenção na seção de Bounded Contexts.

🟩 **A Revisão de Recorrentes é um read model com seletor de mês navegável** (UC25;
files_design/01 §6: "antes era um texto fixo, agora dá pra rever como ficou um mês anterior").
Navegar para trás é consulta do que já aconteceu; navegar para frente devolve a mesma projeção
que alimenta o DRE (Fluxo G). Não é uma tela do mês corrente com um filtro — é a mesma lista
parametrizada por `Month`, o que faz dela mais um consumidor do H4.

🟥 **Hotspot H4 permanece aberto e sobe de prioridade na v7**: a v7 exige projetar ocorrências
**e** parcelas para meses futuros **arbitrários** (não só o mês seguinte), porque é disso que a
projeção do DRE, de Entradas e Saídas e dos Indicadores depende (PRD §5). `engine.ts` já
resolve isso de forma pura e sem relógio (`generateOccurrences(..., until)`), mas a decisão de
"materializar vs. gerar virtualmente" continuar sem ADR (P18) importa mais agora: cada tela de
relatório que abre um mês futuro paga o custo de recomputar a projeção inteira se ela for
sempre virtual.

---

## Fluxo E — Patrimônio: Investimentos e Bens Materiais

*(nome anterior do bloco: "Ativos" — ver Fluxo K para Passivo, que ganhou fluxo próprio na v7
por causa do cronograma de parcelas)*

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Registrar aporte em investimento | **Aporte em investimento registrado** (valor acumulado ↑) | Pessoa |
| Registrar dividendo recebido (investimento externo) | **Dividendo recebido** (receita, bloco 1, não intercompany) | Pessoa |
| Vender investimento | **Investimento vendido** → **Ganho/perda reconhecido** (não operacional) | Pessoa |
| Cadastrar Bem Material | **Bem Material cadastrado** | Pessoa |
| Vender Bem Material (ver Fluxo L para o direcionamento) | **Bem Material vendido** → **Ganho/perda reconhecido** (não operacional) | Pessoa |
| Atualizar saldo de conta bancária | **Saldo de conta atualizado** (mantido pela pessoa, nunca derivado dos lançamentos — exceto numa conta vinculada ao Open Finance, em que vem do banco: Fluxo N, ADR-0020) | Pessoa |
| Editar item cadastrado (conta bancária, bem material, investimento) | **Item de patrimônio editado** | Pessoa |
| Descartar item cadastrado (conta bancária, bem material, investimento) | **Item de patrimônio descartado** | Pessoa |

🟪 **Editar e Descartar existem nas quatro listas de Plano de Contas e Patrimônio** — Contas
Bancárias, Bens Materiais, Investimentos e Passivos (UC38; files_design/01 §12, "padrão visual
das 4 telas de lista … lista de itens já cadastrados, com Editar/Descartar"). **Descartar um
item de patrimônio ≠ vender**: descartar corrige um cadastro que não existe mais, sem
reconhecer ganho ou perda; vender é o Fluxo L, e é ele que reconhece resultado. Confundir os
dois é o caminho mais curto para um ganho/perda fantasma no Resultado Não Operacional.

🟪 **Sem** reavaliação mensal: investimentos (mark-to-market) e bens materiais (depreciação) só
reconhecem resultado **na venda**. D&A mensal = 0 → **EBITDA = EBIT** todo mês
(`src/domain/reports/income-statement.ts`, já implementado e testado).

---

## Fluxo F — Fechamento e Destinação do Lucro

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| — | **Lucro do mês apurado** | Sistema 🟪 (cascata do DRE, base Pago) |
| Adicionar item a uma das 4 categorias de destinação (repetível — múltiplos itens por categoria, novo na v7) | **Item de Destinação adicionado** | Pessoa |
| Remover/editar item de uma categoria de destinação | **Item de Destinação removido/editado** | Pessoa |
| Salvar a destinação, mesmo com saldo sobrando | **Lucro destinado** | Pessoa |
| Lançar IR (pagamento ou recebimento) | **IR lançado** | Pessoa |
| — | **Mês fechado** (automático, sem bloqueio — H8) | Sistema |

🟪 **Sempre que** a destinação é salva com **saldo não alocado > 0** → nasce uma **Pendência
tipo 3** (Fluxo I), com ação "Alocar agora". Salvar não é bloqueado pelo saldo sobrando —
files_design/01 §9 é explícito: "não bloqueia salvar com saldo sobrando". A Pendência
desaparece quando a pessoa volta e aloca o restante (ou quando um lucro maior no mês seguinte
não a afeta — cada mês tem sua própria decisão de destinação, `ProfitAllocation.month`).

🟪 **Lucro líquido negativo**: o card "Destinar este Lucro" não aparece; vira mensagem
informativa ("Sem lucro a destinar este mês"), sem oferecer alocação.

🟥 **P2, ainda sem resposta:** com lucro líquido **exatamente zero**, a tela mostra o card
(com toda porcentagem indefinida) ou a mensagem informativa do caso negativo? O domínio hoje
assume a segunda opção (`src/domain/profit-allocation/rules.ts`, `canAllocate`) só como
provisório — não inventar a resposta definitiva sem Produto.

🟪 **IR é um Lançamento com forma própria** (UC18, PRD §5): **uma conta** só (de onde sai ou para
onde vai), **rótulo opcional**, **sem campo de categoria** — junto com Consumo Livre, a única aba
sem categoria —, texto de orientação na interface, e recorrência rotulada **"Parcelar"**, em que
o campo de término cobre o número de parcelas e vem ligado por padrão. O conteúdo do texto de
orientação depende de Produto/Contabilidade (PRD §9.2) — a tela existe, o texto ainda não.

*(A distribuição de lucro da PJ — o 5º item do bloco 10 — não passa por aqui: é registrada pela
aba Pró-labore e Distribuição, Fluxo C, e apropriada direto no DRE da PJ.)*

---

## Fluxo G — Relatórios e Read Models (sob demanda)

🟩 Read models, recomputados a qualquer momento a partir dos Lançamentos e do Patrimônio —
nenhum é fonte da verdade (Event Storming original, mantido: H1 e H6).

| Relatório (nome v7) | Nome anterior | O que mudou na v7 |
|---|---|---|
| **DRE** | — | Ganhou o toggle **Pago/Previsto** controlando a cascata inteira, e navegação para **meses futuros** (projeção sem motor de simulação: só o que já está configurado em recorrência/parcela) |
| **Balanço Patrimonial** | "Balanço" | Sem mudança de conteúdo — continua foto do momento atual, sem seletor de mês, sem base Previsto |
| **Evolução Mensal** | "Painel" | Renomeado; toggle "Últimos 6 meses"/"Último ano", só meses com dado real |
| **Indicadores Financeiros** | "Indicadores" | Renomeado; ganha seletor de mês navegável (inclusive futuro) e o catálogo fechado de 18 indicadores — já implementado em `src/domain/reports/types.ts` (`INDICATOR_DEFINITIONS`), **não redefinir** |
| **Entradas e Saídas** | "Mapa de Fluxo" | Deixou de ser diagrama Sankey — o design testou e descartou por esconder qual fonte foi para qual destino (files_design/02, doc08 §5). Hoje é só uma **tabela de duas colunas** (Entradas / Saídas), fechada pela linha "Sobrou" na coluna de Saídas |
| **Onde Está Meu Dinheiro** | "Mapa de Posição" | Treemap de Contas + Investimentos + Dívidas (nunca Bens Materiais, por não serem líquidos); clicar num bloco permite **redirecionar** valor para outro bloco |
| **Despesas por Categoria** | — (novo) | Treemap do gasto do mês por categoria; clicar abre detalhe + lançamento rápido pré-preenchido (exceto o bloco Consumo Livre, que abre o painel do widget — Fluxo H) |
| **Histórico** | — | Lista filtrável de **todos** os Lançamentos; é a leitura de escrita do Fluxo B (criar e editar saem daqui) |
| **Revisão de Recorrentes** | — | Ocorrências do mês + parcelas de Passivo, com seletor de mês navegável (Fluxo D) |

⚠️ **Só os quatro primeiros são "Relatórios"** no vocabulário da v7 (o grupo da barra lateral:
DRE, Balanço Patrimonial, Evolução Mensal, Indicadores Financeiros — files_design/04). Entradas
e Saídas, Onde Está Meu Dinheiro e Despesas por Categoria são **cards da Home**; Histórico e
Revisão de Recorrentes são itens de nível raiz. Todos são read models do mesmo jeito, e é por
isso que estão na mesma tabela — mas chamá-los todos de "relatório" reintroduz um nome que o
glossário fechou de outro jeito.

### Comandos de leitura (o que a pessoa aciona sobre um read model)

Nenhum destes muda dado financeiro; todos parametrizam ou abrem uma projeção. Estavam
implícitos na v2 e são requisito explícito do PRD.

| Comando 🟦 | Efeito | Fonte |
|---|---|---|
| Alternar a visão Consolidado / PF / PJ | Reprojeta a cascata inteira; a estrutura de blocos é idêntica nas 3, só o filtro por entidade muda. **PF + PJ não somam o consolidado** (a eliminação intercompany é justamente a diferença) | UC7, PRD §5 |
| Alternar a base **Pago / Previsto** | Troca a base de cálculo de DRE, Entradas e Saídas e Indicadores Financeiros, **nunca somando as duas**. Balanço Patrimonial não tem esse toggle | UC34, PRD §5 |
| Navegar o seletor de mês (para trás e para frente) | Mês futuro contém só Previsto vindo de recorrência e parcela — isso **é** a projeção. Balanço Patrimonial não tem seletor de mês | UC29, UC34, UC42 |
| Marcar Pago / Editar **na planilha "Lançamentos deste mês" do DRE** | Dispara os comandos do Fluxo B sem sair do relatório. A planilha lista pago **e** previsto juntos, com o bloco do plano de contas por linha, e **não** tem filtro próprio — o filtro vive só no toggle da cascata | UC35, files_design/01 §9 |
| Clicar numa linha de **Entradas e Saídas** | Abre os Lançamentos que compõem aquele valor — **só consulta, sem ação de mover dinheiro**, diferente dos dois treemaps. Para mover, a pessoa usa Onde Está Meu Dinheiro | UC29, files_design/01 §13 |
| Clicar num bloco de **Onde Está Meu Dinheiro** | Abre a composição do valor + o bloco "Redirecionar valor" ("Para onde" + Valor) — Fluxo L / H12 | UC30 |
| Clicar num bloco de **Despesas por Categoria** | Abre os Lançamentos do mês naquela categoria + lançamento rápido com categoria e conta pré-preenchidas (só Valor e Data). **Exceção:** o bloco Consumo Livre abre o painel do widget, nunca um formulário | UC31, Fluxo H |
| Ícone no cabeçalho do card Despesas por Categoria | Abre o **Histórico já filtrado pelo mês corrente** — ação distinta de clicar num bloco | UC31, files_design/01 §4 |
| Alternar a Evolução Mensal entre "Últimos 6 meses" e "Último ano" | Só meses com dado real; **mês sem dado não vira zero** | UC43 |
| Filtrar o Histórico (status, entidade, mês, categoria, classificação, conta, recorrência) e abrir um Lançamento | Abre o formulário pré-preenchido (Fluxo B). **Exceção:** gasto de Consumo Livre não abre por aqui — é editado só no histórico do widget (Fluxo H) | UC39, PRD critérios |

🟪 **Sempre que** a base do relatório é "Pago" e não há lançamento pago no mês → exibe aviso,
nunca trava ("Pago" nunca fica indisponível, mesmo em mês futuro, por causa de pagamento
antecipado). Mesma regra vale para DRE, Entradas e Saídas e Indicadores Financeiros.

🟪 **Invariante de Entradas e Saídas**: total de entradas = total de saídas + "Sobrou". Uma
divergência é **erro de dado**, nunca um resultado a exibir (files_design/08 §5.2).

### Casos degenerados — regra de domínio vestida de regra visual

`files_design/08` está catalogado como documento de renderização, mas metade das linhas abaixo
decide o que a camada de cálculo **devolve**, não como a tela pinta. Elas entram aqui porque
implementá-las na borda significa cada tela reinventar a mesma decisão.

🟪 **Valor indefinido ≠ valor zero.** Divisão por zero (liquidez corrente com passivo circulante
zero) e histórico insuficiente (reserva de emergência numa instalação nova) devolvem
**indefinido**, exibido como travessão — nunca zero, nunca infinito, nunca erro de cálculo
(PRD §5; files_design/08 §10, §1). "Um valor que existe mas é zero é diferente de um valor que
não existe": o tipo de retorno do cálculo precisa carregar essa diferença (`number | null`, como
`percentOfProfit` já faz em `profit-allocation/rules.ts`), senão a distinção morre na fronteira.
Um ou dois indicadores nessa situação mostram travessão **individualmente**, com o resto da tela
funcionando; só a tela inteira sem base vira estado vazio (UC42).

🟪 **Limite de 6 blocos por faixa nas visões proporcionais**, com o excedente somado num bloco
**"Outras"**, que entra no ranking pelo valor somado e abre a lista completa. O mesmo critério de
excedente vale na tabela de Entradas e Saídas, com o rótulo **"Outros"** (PRD §5;
files_design/08 §2.7, §5.2). Quem agrega é o cálculo, não o componente — é ele que sabe o valor
somado que define o ranking.

🟪 **Item de valor zero não entra na área** do treemap, mas **aparece na lista do detalhe**;
soma zero é tratada como "nenhum item" (estado vazio). **Valor negativo não existe nesse
contexto**: se aparecer, é erro de dado a reportar, nunca a desenhar (files_design/08 §2.8).
Isso é um invariante de saída da projeção, não uma checagem de componente.

🟪 **Três respostas, e sucesso parcial.** Todo card e toda tela de dado distingue **dado
presente**, **ausência legítima de dado** e **falha** — e admite sucesso parcial: erro na série
do gráfico não impede a tabela de aparecer, quando os dados dela vieram (PRD §5;
files_design/08 §6). Consequência para a API: uma resposta de relatório precisa poder dizer
"tabela ok, série indisponível" sem ser um 500 inteiro. Vale para a Home de uma conta
recém-criada, em que cada card tem estado vazio próprio, explicando o que vai aparecer ali, com
botão de ação só quando existe ação imediata que resolve (UC44, UC20).

🟪 **Toda tela de gráfico tem a tabela do mesmo dado**, e é na tabela que ficam as ações por
item — barra e bloco de gráfico não são alvo de ação (PRD §5). O read model é um só, servindo às
duas leituras; não existe "dado do gráfico" separado do "dado da tabela".

🟪 **Onde Está Meu Dinheiro fecha com três totais** — o que se tem, o que se deve e o patrimônio
líquido resultante —, e o patrimônio líquido **é exibido inclusive quando negativo**, com sinal
de menos em estilo neutro, sem cor de julgamento (PRD §1 e critérios de liberação). Negativo aqui
é resultado legítimo, ao contrário do bloco de valor negativo do parágrafo acima, que é erro de
dado: são duas coisas diferentes com o mesmo sinal.

🟥 **Nota sobre H3 (regime de caixa)**: PRD §5 afirma que "o que posiciona um lançamento
Previsto num mês... não está definido por nenhuma fonte e está registrado na seção 9" — mas a
seção 9 da v7 (lida por inteiro nesta sessão) **não contém esse item**. É uma referência cruzada
quebrada no próprio PRD, não uma pergunta respondida em outro lugar; registrar de volta para
Produto, não inventar a resposta aqui. Dito isso, o domínio **já não tem essa ambiguidade
estrutural**: `Entry.date` é um único campo obrigatório, preenchido pela pessoa (padrão hoje),
igual para Previsto e para Pago — é sempre esse campo que decide o mês (`src/domain/entries/types.ts`).
A pergunta genuína que sobra é só sobre a **ocorrência projetada** por recorrência/parcela num
mês futuro arbitrário, que é território do Fluxo D/H4, não um buraco novo no tipo `Entry`.

---

## Fluxo H — Consumo Livre (novo na v7)

*(substituiu a aba "Consumo Livre" do Novo Lançamento — PRD v7, "Descartado deliberadamente")*

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Configurar verba mensal + conta de origem (1ª vez, Estado A) | **Configuração de Consumo Livre registrada** | Pessoa |
| Registrar gasto (popover "Gastei um valor" — só o campo Valor) | **Gasto de Consumo Livre registrado** | Pessoa |
| Editar um gasto (só pelo histórico do widget, Estado C — nunca pelo Novo Lançamento) | **Gasto de Consumo Livre editado** | Pessoa |
| Editar valor mensal / conta de origem | **Configuração de Consumo Livre editada** | Pessoa |
| Redirecionar saldo restante (conta, investimento ou dívida) | **Saldo de Consumo Livre redirecionado** | Pessoa |
| — | **Sobra do mês anterior registrada** (linha explícita no histórico) | Sistema 🟪 |

🟫 Cada gasto **é** um Lançamento de despesa de verdade — `DiscretionaryExpense.id` é um
`EntryId` (`src/domain/discretionary-spending/types.ts`) — sempre na categoria de sistema
"Consumo Livre", dentro de Despesas Pessoais/Consumo. **Nunca é ativo circulante**; continua
entrando no DRE como despesa (regra que atravessa da v6, reafirmada na v7).

🟪 **O rótulo nunca move o gasto de categoria** — é só um apelido no histórico do widget
(consequência da v7 explicitamente registrada no PRD, revertendo a promessa de recategorização
da v6). Isso muda a leitura de P15 em `docs/PERGUNTAS-EM-ABERTO.md`: o rótulo pode até existir
"ao lado" do lançamento, mas nunca substitui nem move a categoria fixa.

🟪 **Gasto acima do limite**: exibido pelo valor real, sem cor de alerta — não é política de
domínio (é renderização, files_design/08 §9.2), citado aqui só para não ser reintroduzido como
regra de negócio por engano.

🟥 **P14, ainda sem resposta — e a pergunta é de PERSISTÊNCIA, não de UI:** a sobra do mês
anterior é um **registro guardado** (algo que o motor de virada de mês escreve) ou um **valor
derivado** (calculado toda vez a partir do saldo anterior)? O tipo hoje
(`DiscretionaryExpense`) deliberadamente não modela a sobra — ela é sempre dinheiro saindo,
nunca entrando.

**O que NÃO está em aberto:** a linha existe e é desenhada. O frame `345:752` (Wireframe) tem o
nó `192:22` como PRIMEIRA linha do "Histórico deste mês" — h=33 contra h=40 das linhas de
gasto, sem botão "Editar" dentro —, com os textos literais `192:23` "+ Sobra de Junho,
adicionada ao saldo" e `192:24` "+ R$ 150,00"; o gêmeo no Mockup é a camada chamada `"Sobra"`,
nó `1005:3309` (h=36, sem `instance` de Botão), contra as camadas `"Hist"` (`1005:3312` e
seguintes, h=60, com Botão 71×44). O Detalhe do Consumo Livre renderiza essa linha hoje, com o
valor **derivado** (`leftoverOfMonth`, `src/domain/discretionary-spending/rules.ts`) e nada
persistido. Portanto o Evento "Sobra do mês anterior registrada" está listado na tabela acima
como o comportamento **observável na tela** — o que P14 ainda não decidiu é se existe um evento
de domínio escrito de verdade por trás dele.

🟥 **Redirecionar saldo restante usa o mesmo conceito de Direcionamento do Fluxo L** — ver
hotspot novo **H12** (Redirecionamento genérico) mais abaixo: o tipo `AllocationOrigin` hoje só
admite venda de Bem Material como origem.

---

## Fluxo I — Pendências (novo na v7)

**Pendência**: "conceito consultável, com tipo, valor, motivo, data de criação, referência à
origem e status" (PRD §5). Nasce e é encerrada **pelo sistema**, nunca criada manualmente pela
pessoa. **Um item por ocorrência, nunca um total agregado por tipo** — duas divergências de
recorrências diferentes geram duas Pendências.

| Tipo | Nasce quando | Ação | Resolvida quando |
|---|---|---|---|
| 1 — Valor de venda sem destino completo | Venda de Bem Material confirmada com `Restante > 0` (Fluxo L) | "Direcionar agora" | Direcionamento completa o valor (`PendingAllocation.status = 'Allocated'`) |
| 2 — Ocorrência "a definir" sem valor | Mês vira e a ocorrência gerada tem `plannedAmount = null` (Fluxo D) | "Revisar agora" | Pessoa preenche o valor **ou** descarta a ocorrência (as duas resolvem; nenhuma converte a série) |
| 3 — Saldo não alocado da Destinação do Lucro | Destinação salva com saldo > 0 (Fluxo F) | "Alocar agora" | Pessoa completa a alocação daquele mês |
| 4 — Divergência de pagamento a menor | `valor pago < valor previsto` ao marcar Pago (Fluxo B/D) | "Pagar" | Pessoa paga a diferença |

🟪 **A política mais importante do domínio nesta rodada** (repetida do Fluxo B por ser central):
**pagamento a menor sempre gera Pendência; pagamento a maior nunca gera Pendência** — a maior
oferece 3 escolhas no ato (descontar da próxima, redirecionar o extra, ou nada), nenhuma delas
fica pendente de resolução futura. É uma assimetria deliberada, não uma omissão: "sobra" nunca
vira cobrança.

🟪 **Ordenação**: mais antiga primeiro (data de criação da pendência) — mesmo critério do
Fluxo J (Eventos Recentes), mas em sentido cronológico oposto (Eventos: mais recente primeiro).
⚠️ O PRD §9.4 registra que esse "mais antiga primeiro" foi escolhido **ao formalizar a regra de
renderização, sem decisão anterior por trás**, e o próprio documento de design pede revisão.
Implementar como está é aceitável — inverter depois é uma linha —, mas não tratar como decidido.

🟪 **A lista é curta por construção** e não tem paginação nem "ver todas": um item some assim
que é resolvido (files_design/08 §9.1). Se a lista crescer sem parar, o defeito está na
resolução, não na tela.

✅ **H13 resolvido nesta rodada** — `src/domain/pending-items/` é o agregado único (`PendingItem`,
discriminated union sobre os quatro tipos) e `collectPendingItems` é a consulta só, ordenada por
data, que a Home usa (`GET /api/v1/pending-items`). Estado de cada tipo:
- Tipo 1 → `PendingAllocation` (`src/domain/assets/types.ts`), completo; envolvido em
  `pendingItemFromAllocation`.
- Tipo 2 → continua sem tipo próprio persistido, por desenho: derivado direto de
  `Occurrence.plannedAmount === null` em `pendingItemFromOccurrence` — não há nada para persistir
  além da própria ocorrência.
- Tipo 3 → `UnallocatedProfitPendingItem` (`src/domain/profit-allocation/types.ts`), completo;
  envolvido em `pendingItemFromUnallocatedProfit`, que também resolve a falta de data própria desse
  tipo (usa o primeiro dia do mês — ver OPEN QUESTION no código).
- Tipo 4 → ganhou tipo próprio, `PaymentDiscrepancyPendingItem` (`src/domain/pending-items/types.ts`),
  com persistência (`payment_discrepancies`, schema.ts) e ação "Pagar"
  (`POST /api/v1/payment-discrepancies/{id}/payment`). A política "pago a menos sempre vira
  Pendência, pago a mais nunca vira" foi movida para `pendingItemFromPaymentOutcome`, chamada pelos
  dois handlers de pagamento (`POST /entries/{id}/payment`, `POST /occurrences/{id}/payment`), que
  também passaram a emitir o Evento de rastreabilidade correspondente (`Discrepancy` ou
  `RecurrencePaid`) — fechando a lacuna paralela em que `trace-events/rules.ts` existia sem nenhum
  chamador fora do próprio teste. `TraceEventOrigin` ganhou o variante `Entry` para cobrir a
  divergência de um lançamento avulso, sem Passivo nem Recorrência por trás.

---

## Fluxo J — Eventos de Rastreabilidade (novo na v7)

**Evento**: registro só de escrita, gerado pelo sistema, nunca editado pela pessoa
(`src/domain/trace-events/types.ts`, já implementado). Tipos: `Registration`, `RateAdjustment`,
`InstallmentPaid`, `RecurrencePaid`, `Discrepancy`.

| Evento gerador (em outro fluxo) | Evento de rastreabilidade emitido | Onde aparece |
|---|---|---|
| Passivo cadastrado (Fluxo K) | **Cadastro** (`RegistrationEventData`) | Log do Passivo + Home (se entre os 5 mais recentes) |
| Reajuste de juros registrado (Fluxo K) | **Reajuste de juros** (`RateAdjustmentEventData`) | idem |
| Parcela marcada como paga (Fluxo K) | **Parcela paga** (`InstallmentPaidEventData`) | idem |
| Ocorrência recorrente paga sem divergência | **Recorrência paga** (`RecurrencePaidEventData`) | Home (5 mais recentes) — sem tela de log dedicado à recorrência |
| Ocorrência/parcela paga com divergência (Fluxo B/D/K) | **Divergência** (`DiscrepancyEventData`) | idem |

🟪 **Cada Passivo mostra o log completo**; a Home mostra só os **5 mais recentes do produto
inteiro**, mais recente primeiro. Não existe, por ora, tela de log completo (PRD §1, "fora de
escopo" — decisão deliberada, não lacuna).

🟪 **P19, respondida (medida no Figma).** `TraceEventOrigin` admite `{ kind: 'Recurrence' }` e a
tela existe: é o card **"Eventos Recentes"** da Home, onde o evento de origem Recorrência é a
**primeira** das cinco linhas — Wireframe `150:8` dentro do card `150:2` (frame `5:2`), "Aluguel
pago com divergência: previsto R$ 1.500,00, pago R$ 1.300,00 (R$ 200,00 pendente)"; Mockup
`549:282` dentro de `549:276`. `files_design/03` já dizia o mesmo por escrito ("Origem: Passivo
específico, **ou Lançamento recorrente específico**").

O que não existe é tela de **log completo por recorrência**: o card "Histórico de eventos
(rastreabilidade)" só é desenhado em "Desktop — Detalhe do Passivo" (`91:133`..`91:145`), e não há
frame "Detalhe da Recorrência" no `docs/figma/INDEX.md` nem no Mockup. Isso é o mesmo "fora de
escopo" do parágrafo acima (PRD §1) — decisão deliberada, não lacuna.

---

## Fluxo K — Passivo como Plano de Parcelas (ampliado na v7, UC21-24)

*(v6/H9 dizia "100% manual"; a v7 reverte parcialmente — ver reassessment de H9 abaixo)*

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Cadastrar Passivo (formulário completo: nome, credor, entidade, classificação, valor original, valor da parcela, nº de parcelas, parcelas já pagas, taxa a.m., data de início) | **Passivo cadastrado** | Pessoa |
| — | **Cronograma de parcelas gerado** (calculado por amortização; parcelas já pagas pré-marcadas) | Sistema 🟪 |
| — | **Evento de Cadastro registrado** (Fluxo J) | Sistema 🟪 |
| Marcar parcela como paga (valor real) | **Parcela paga** | Pessoa |
| — (se `valor pago ≠ valor previsto`) | **Evento de divergência registrado** (Fluxo J) | Sistema 🟪 |
| Registrar reajuste de juros (nova taxa + data de validade) | **Reajuste de juros registrado** | Pessoa |
| — | **Parcelas Previstas recalculadas a partir da data de validade** (parcelas já Pagas nunca mudam) | Sistema 🟪 |
| — | **Evento de Reajuste registrado** (Fluxo J) | Sistema 🟪 |
| Editar dados cadastrais do Passivo | **Passivo editado** | Pessoa |
| Descartar Passivo (na lista, ao lado de "Analisar") | **Passivo descartado** | Pessoa |
| Consultar Detalhe do Passivo (informações, evolução do saldo, parcelas, eventos) | — (leitura) | Pessoa |

🟪 **A separação de planos continua valendo** (H9, parte que a v7 NÃO reverte): registrar uma
despesa não constrói nem baixa um Passivo. O cronograma passou a ser **calculado**, não que o
Passivo passou a alimentar o DRE.

🟪 **As mesmas parcelas alimentam a Revisão de Recorrentes** (Fluxo D) e a **projeção de meses
futuros** do DRE/Entradas e Saídas/Indicadores (Fluxo G) — um Passivo cadastrado hoje já aparece
como despesa prevista em todo mês futuro coberto pelo cronograma, sem nenhum lançamento manual.

🟫 Já implementado em `src/domain/assets/types.ts` e `src/domain/assets/installments.ts`
(`buildInstallmentSchedule`, `applyRateAdjustment`, `outstandingBalance`). ✅ **A lacuna de
verificação foi fechada em 2026-09-11**: quando esta linha foi escrita não existia
`src/domain/assets/*.test.ts` — hoje existem três, entre eles
`amortisation.validation.test.ts`, que confronta a forma fechada com a simulação mês a mês.
Continua aberta só a lacuna FINANCEIRA (H11): se Price é o método dos contratos, que ninguém
daqui pode assinar.

✅ **As quatro foram respondidas — o registro abaixo é de 2026-09-04 e ficou como histórico.** P4 pelo Figma na mesma sessão; P5 pela medição do frame `91:2` (PRD v7.5); P3 por decisão de produto em 2026-09-08 (Price confirmado) e validada por engenharia em 2026-09-11; P6 por decisão de produto em 2026-09-08 (a parcela conta no DRE, em Despesas Administrativas, mas não vira Lançamento). O texto original segue abaixo porque ele registra o RACIOCÍNIO de cada uma quando ainda estavam abertas:
- P3 — **mudou de pergunta**. Que o quarto número (valor da parcela) possa divergir do calculado
  não é lacuna: a nota de design `164:2` (texto `164:4`) registra "escolhemos a (A) [o sistema
  calcula a amortização] por pedido explícito de produto", e nenhum frame exibe o valor declarado
  de volta — a linha da lista tem só Saldo devedor e Parcelas (`40:2` `90:66`/`90:67` e
  `90:69`/`90:70`; Mockup `933:1416` `934:71` a `934:75`) e o card do `91:2` tem quatro itens
  (`91:47`, `91:50`, `91:53`, `91:56`). `installmentAmount` é dado cadastral declarado e não
  participa do cálculo — decisão, não provisório. O que a MESMA nota deixa aberto é a **fórmula**:
  "precisa ser validada por alguém de backend/financeiro". PRD v7.6.
- ~~P4~~ — **respondida, não assumida**: a parcela #1 vence na própria data de início. Wireframe `91:2`
  "Desktop — Detalhe do Passivo": `91:56` "12 / 360 pagas", `91:111` #12 = 10/07/2026 e o gráfico
  `91:61` com 12 barras a partir de `91:64` "Ago/25" põem a #1 no mês do início. PRD v7.4.
- P5 — "saldo devedor" é a soma nominal das parcelas restantes (hoje) ou só o principal?
- P6 — marcar uma parcela como paga cria um Lançamento no DRE? Hoje: **não** — mas é a pergunta
  que mais ameaça a separação de planos, porque a parcela paga é saída real de dinheiro.

Nenhuma tinha resposta inventada no domínio enquanto esteve aberta: cada função carregava o
comentário `OPEN QUESTION` correspondente. **Os marcadores foram retirados em 2026-09-11**, quando
as perguntas fecharam — um marcador que diz "em aberto" sobre coisa decidida manda a próxima pessoa
reabrir discussão fechada. `grep -rn "OPEN QUESTION" src/` hoje não devolve nada, e é isso que ele
deve devolver.

---

## Fluxo L — Venda de Bem Material com Direcionamento (ampliado na v7, UC37)

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Vender Bem Material (valor + data) | **Bem Material vendido** | Pessoa |
| — | **Ganho/Perda reconhecido** (venda − valor registrado; Resultado Não Operacional) | Sistema 🟪 |
| Adicionar Direcionamento (Investimento / Passivo / Receita) — repetível | **Direcionamento adicionado** | Pessoa |
| Editar/remover um Direcionamento antes de confirmar | **Direcionamento editado/removido** | Pessoa |
| Confirmar a venda | **Venda confirmada** → Bem sai da lista de Bens Materiais | Pessoa |
| — (se `Restante > 0` ao confirmar) | **Pendente de Direcionamento criado** (Fluxo I, tipo 1) | Sistema 🟪 |
| "Direcionar agora" (a partir da Pendência) | **Direcionamento adicionado** (reabre o mesmo fluxo) | Pessoa |

🟪 A soma dos Direcionamentos **nunca excede** o valor de venda — cada novo item só aceita até o
`Restante` daquele momento (`src/domain/assets/types.ts`, `AssetSale.allocations`).

🟫 Já implementado (`Allocation`, `AllocationKind`, `PendingAllocation`). O ganho/perda é
**calculado, nunca guardado** (`gainOrLoss` — glossário, camada de contrato).

🟥 Ver hotspot novo **H12**: o mesmo padrão "Para onde + Valor" se repete em Onde Está Meu
Dinheiro (Fluxo G), no saldo restante de Consumo Livre (Fluxo H), no saldo não alocado da
Destinação do Lucro (Fluxo F) e no valor pago a mais (Fluxo B) — mas `AllocationOrigin` hoje é
"a one-variant union on purpose" (comentário do próprio código), modelada só para venda de Bem
Material. PRD v7 é explícito: **"existe um só conceito de mover valor... precisa ser tratado
como uma operação única"**. Generalizar isso é decisão de arquitetura, não só mais um `case`.

---

## Fluxo M — Organizar Home e Preferências (novo na v7, UC33/UC41)

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Entrar em modo de organização | **Modo de organização ativado** | Pessoa |
| Arrastar um card para nova posição | **Ordem de cards alterada** | Pessoa |
| Minimizar um card | **Card minimizado** | Pessoa |
| Maximizar um card (dentro ou fora do modo) | **Card maximizado** | Pessoa |
| Concluir | **Modo de organização encerrado** + **Layout da Home persistido** | Pessoa |
| Alternar tema claro/escuro | **Tema alterado e persistido** | Pessoa |
| Trocar a visão do relatório (Consolidado/PF/PJ) | **Última visão persistida** | Pessoa |

🟪 Funciona **inclusive numa Home vazia** (conta recém-criada, zero dado) — reordenar e
minimizar não dependem de haver conteúdo. Card minimizado colapsa no próprio lugar (nunca vai
para lista separada) e continua restaurável fora do modo de organização.

🟪 **Nenhuma dessas escolhas afeta dado financeiro** (PRD §5) — é por isso que elas formam um
agregado pequeno e separado, não um apêndice do Lançamento ou do Passivo.

🟥 **Conceito novo, ainda sem entrada no glossário nem em `types.ts`**: as "Preferências da
pessoa" (tema, última visão, layout da Home) não têm hoje um nome de domínio reservado em
`src/domain/GLOSSARY.md`. Por ADR-0010 §3 ("conceito novo entra no glossário antes do código"),
este é um bloqueio real antes de escrever `src/domain/preferences/types.ts` — não inventar o
nome aqui; é uma frase de uma linha que falta no glossário, não uma decisão de arquitetura.

---

## Fluxo N — Importação do Open Finance (novo na v7.41, ADR-0020)

*(a pessoa conecta os bancos no Meu Pluggy, fora do app; o Bigorna só lê)*

| Comando 🟦 | Evento 🟧 | Ator |
|---|---|---|
| Vincular conta do Open Finance a uma Conta Bancária, Investimento ou Passivo | **Posição vinculada ao Open Finance** | Pessoa |
| Desvincular | **Posição desvinculada do Open Finance** | Pessoa |
| Sincronizar (sob demanda, P53) | **Retrato do Open Finance lido** | Sistema 🟪 |
| — | **Saldo de posição atualizado pelo banco** | Sistema 🟪 |
| — | **Transação bancária importada** | Sistema 🟪 |
| — | **Sincronização do Open Finance falhou** | Sistema 🟪 |

🟪 **O que cada transação importada vira** (ADR-0020 §4): saída da conta de origem do Consumo
Livre → gasto de Consumo Livre (Fluxo H); transação que casa com um Previsto → o Previsto vira
Pago (Fluxo D; regra de casamento em P49); par saída/entrada entre duas contas vinculadas →
Transferência (ADR-0017); compra no cartão → Lançamento de despesa Previsto, categoria pelo
de-para, Pago quando a fatura é paga; pagamento da fatura → liquida os Previstos do cartão e
**nunca** vira gasto de Consumo Livre.

🟪 **Idempotência:** a mesma transação do provedor (pelo id dela) importada duas vezes não gera
segundo evento. É a guarda contra a dupla contagem do PRD §5.

🟪 **Numa posição vinculada, lançamento Pago manual é recusado** a partir da data do vínculo, e o
saldo deixa de ser editável: o banco é a testemunha do fato. Previstos continuam manuais.

🟪 **Pró-labore e distribuição continuam manuais** (Fluxo C). Um PIX PJ → PF é Transferência; a
eliminação intercompany só enxerga o que a pessoa lançou como pró-labore ou distribuição.

🟫 A **Posição vinculada** não é agregado novo: é um atributo da Conta Bancária, do Investimento
ou do Passivo (o id opaco da conta no provedor + a data do vínculo). A **Transação bancária
importada** também não é agregado — ela vira Lançamento, Transferência ou gasto de Consumo Livre,
e o que se guarda dela é só o id do provedor (idempotência) e a descrição do banco (detalhe).

🟥 **Hotspots abertos** (PRD 9.2): P46 (saldo devedor do banco × amortização calculada), P47
(fatura em aberto como dívida), P48 (registro manual no widget de Consumo Livre com conta
vinculada), P49 (casamento com Previsto), P50 (onde se vincula), P51 (conteúdo do de-para), P52
(entrada que não casa com nada), P53 (gatilho da sincronização).

---

## Agregados / Entidades 🟫 — estado real, não mais hipótese

| Agregado | Código | Estado |
|---|---|---|
| Lançamento | `Entry` (`src/domain/entries`) | ✅ Implementado e testado |
| Recorrência / Ocorrência | `Recurrence` / `Occurrence` (`src/domain/recurrence`) | ⚠️ Implementado (`engine.ts` completo), **sem teste**; H4 (materializar vs. virtual) segue sem ADR |
| Plano de Contas / Bloco | `ChartOfAccounts` / `StatementBlock` (`src/domain/chart-of-accounts`) | ✅ Implementado; comentário do código ainda cita H10 como "aberto" — **stale**, ver reassessment de H10 |
| Conta Bancária | `BankAccount` (`src/domain/assets`) | ⚠️ Só tipos, sem teste |
| Bem Material | `TangibleAsset` (`src/domain/assets`) | ⚠️ Só tipos, sem teste |
| Investimento | `Investment` (`src/domain/assets`) | ⚠️ Só tipos, sem teste |
| Passivo | `Liability` (`src/domain/assets`) | ⚠️ Implementado (formulário completo da v7), sem teste |
| **Parcela** (novo nesta rodada, tipos já existiam) | `Installment` (`src/domain/assets`) | ⚠️ Tipos + `buildInstallmentSchedule`, **sem teste**; validação da fórmula pendente (H11) |
| **Reajuste de Juros** (novo nesta rodada) | `RateAdjustment` (`src/domain/assets`) | ✅ Tipo existe; a regra de recálculo prospectivo já tem função dedicada |
| **Direcionamento** (novo nesta rodada) | `Allocation` (`src/domain/assets`) | ⚠️ Tipo existe, mas escopado só à venda de Bem Material (`AllocationOrigin`) — H12 pede generalização |
| **Item de Destinação** (novo nesta rodada) | `AllocationItem` (`src/domain/profit-allocation`) | ⚠️ Implementado (`rules.ts` completo), **sem teste**; suporta múltiplos itens por categoria de destinação (v7) |
| **Configuração de Consumo Livre** (novo nesta rodada) | `DiscretionarySpendingConfig` (`src/domain/discretionary-spending`) | ✅ Tipo existe; regras (`rules.ts`) ainda não escritas |
| Gasto de Consumo Livre | `DiscretionaryExpense` (`src/domain/discretionary-spending`) | ✅ Tipo existe; a sobra do mês anterior é **exibida** (linha `192:22`/Mockup `1005:3309`, derivada por `leftoverOfMonth`) e não é um `DiscretionaryExpense`; persistir vs derivar segue em P14 |
| **Evento** (novo nesta rodada) | `TraceEvent` (`src/domain/trace-events`) | ✅ Tipos e regras de emissão completos (`rules.ts`); wired nos dois handlers de pagamento (`POST /entries/{id}/payment`, `POST /occurrences/{id}/payment`) e no cadastro/reajuste/parcela de Passivo |
| **Pendência** (novo nesta rodada) | `PendingItem` (`src/domain/pending-items`) | ✅ **H13 resolvido.** Discriminated union sobre os 4 tipos, com `collectPendingItems` como read model único; tipo 4 ganhou registro próprio (`PaymentDiscrepancyPendingItem`) — ver Fluxo I |
| Período Mensal | — (implícito em `Month`) | ✅ Fechamento é derivado, sem registro próprio — H8 resolvido |
| **Preferências** (tema, última visão, layout da Home) | — | ❌ Sem nome de domínio ainda — ver Fluxo M |

---

## Bounded contexts

1. **Configuração** — Plano de Contas, Contas Bancárias.
2. **Lançamentos** — núcleo transacional / escrita (`Entry`, motor de eliminação intercompany).
3. **Recorrência** — automação/agendamento (`Recurrence`, `Occurrence`); consome eventos de
   Lançamentos (uma ocorrência paga vira um `Entry`) e alimenta Relatórios (projeção).
4. **Patrimônio** — Bens Materiais, Investimentos, **Passivo com cronograma de parcelas e
   reajuste de juros** (ampliado na v7), Direcionamento, Pendente de Direcionamento.
5. **Relatórios** — projeções / leitura (CQRS-lite): DRE, Balanço Patrimonial, Evolução Mensal,
   Indicadores Financeiros, Entradas e Saídas, Onde Está Meu Dinheiro, Despesas por Categoria.
6. **Onboarding** — orquestra Configuração + Patrimônio no primeiro uso.
7. **Pendências e Rastreabilidade** *(novo na v7)* — contexto de leitura que observa eventos dos
   contextos 2 a 5 (Lançamentos, Recorrência, Patrimônio, Destinação do Lucro) e produz dois
   agregados pequenos e cross-cutting: **Pendência** e **Evento**. Não tem escrita própria — é
   populado por política, nunca por comando direto da pessoa (a pessoa só resolve, nunca cria
   uma Pendência ou um Evento).
8. **Preferências da Instância** *(novo na v7)* — tema, última visão usada, layout da Home.
   Contexto minúsculo, sem intersecção com dado financeiro (PRD §5) — existe separado
   justamente para não vazar para dentro de nenhum agregado financeiro.

🟥 **Ponto de atenção arquitetural**: o contexto 7 lê de dentro dos contextos 2, 3, 4 e 5 para
existir. Se cada um desses contextos emitir Pendência/Evento por conta própria (hoje é o caso:
`profit-allocation/rules.ts` já tem `pendingItemFor`, `assets/types.ts` já tem
`PendingAllocation`), o contexto 7 nunca ganha existência de código própria — continua sendo
"um tipo por origem", e a Home precisa saber de todos eles. Isso é exatamente o hotspot **H13**.

---

## Hotspots 🟥 → reavaliação honesta desta sessão

| # | Decisão | Trade-off central | Status **nesta sessão** |
|---|---|---|---|
| H1 | Lançamento único como fonte da verdade + projeções derivadas (CQRS-lite) | Simplicidade/consistência vs. performance de leitura | ✅ **Implementado e testado** (`src/domain/entries`, `src/domain/reports/income-statement.ts`, 151 testes). ADR-0001 **escrita em 2026-09-08**, depois do comportamento, e cobrindo H1, H3, H6 e H8 juntos. O que já estava em produção — a ADR que falta é documentação, não decisão pendente |
| H2 | Representação de intercompany + eliminação no consolidado | Fidelidade contábil vs. "lançamento único, nunca duplicado" | ✅ **Implementado e testado** (`entries/projection.ts`, `entries/rules.ts`, citado como `ADR-0003` em comentário e teste). **ADR-0003 escrita em 2026-09-08** |
| H3 | Regime de caixa por data de pagamento; o que filtra Previsto/Pago | Clareza do modelo vs. edição histórica | ✅ **Resolvido no tipo** (`Entry.date` único, obrigatório, mesmo campo para Previsto e Pago). ✅ **A extensão da v7 também está fechada — verificado em 2026-09-11, e as três ressalvas desta linha estavam vencidas.** (1) "Não tem regra escrita em `src/domain/reports`": tem — `defaultStatusFilterFor` (`income-statement.ts`) decide o padrão por mês, "Pago em mês atual/passado, Previsto em mês futuro", citando `files_design/01` §8.1; e `entersIncomeStatement` (`entries/rules.ts`) decide o que a cascata soma, fixando o ponto que importa — **os dois status são exclusivos, não cumulativos**: "Previsto" não é "Pago mais o que ainda vem". (2) "Referência quebrada à seção 9": a §9 existe (a própria v7 a criou), e a citação do §5 era sobre a P6, respondida na v7.10. (3) O toggle vale nas TRÊS telas que o PRD nomeia, e a forma difere por desenho, não por esquecimento: só o DRE tem controle porque só a barra dele desenha duas instâncias segmentadas (`701:50` entidade + `701:57` Pago/Previsto); em Indicadores e em Entradas e Saídas o valor é DERIVADO do mês, como `files_design/08` §10 manda. **O que faltava de verdade era uma guarda**, não uma regra: o comportamento de tela que completa o par — a escolha manual da pessoa gruda ao navegar entre meses, em vez de o padrão sobrescrevê-la — não tinha teste, e é o que quebra em silêncio. Coberto agora em `dre/page.test.tsx`, com a mutação que remove a trava derrubando o teste |
| H4 | Motor de recorrência: materializar vs. gerar virtualmente; edição série vs. ocorrência | Previsibilidade/edição vs. volume de dados | ✅ **Fechado por ADR-0004, escrita em 2026-09-08** (e com ela a P18). O motor gera virtualmente (§1) e a visita ao mês materializa, com get-or-create pelo id derivado do par série+mês (§2, §3) — as duas afirmações que pareciam contraditórias no código eram as duas metades da mesma decisão. **Prioridade sobe na v7**: agora precisa cobrir meses futuros arbitrários, e as mesmas parcelas de Passivo entram na mesma lista (Fluxo D) |
| H5 | Realização só na venda (sem mark-to-market/D&A mensal) | Simplicidade vs. rastreabilidade de base/custo | ⚠️ **Modelado, não testado** (`AssetSale`, `TangibleAsset.soldOn`, ganho/perda calculado em `src/domain/assets`, que não tem arquivo de teste). O que *está* testado é só a consequência no DRE: D&A = 0 → EBITDA = EBIT (`income-statement.test.ts`). **ADR-0005 escrita em 2026-09-08**, e ela nomeia essa falta de teste em vez de escondê-la |
| H6 | Projeções sob demanda vs. materializadas | Determinismo/simplicidade vs. custo de recálculo | ✅ **Resolvido por implementação**: todo relatório é uma função pura sobre os dados (nenhum cache, nenhuma tabela de projeção). A v7 aumenta o **volume** do recálculo (mês futuro, toggle Pago/Previsto) mas não muda a decisão |
| H7 | Stack de persistência local + banco de dados; empacotamento | A definir | ✅ **Resolvido — mas não como o hotspot original previa.** ADR-0007 pivotou de "app desktop empacotado" para "web privado" (decisão do dono, não do Event Storming), e ADR-0012 escolheu SQLite/Drizzle. **A ADR-0006 originalmente reservada para H7 foi explicitamente esvaziada** por ADR-0007 §título ("a numeração 0006 fica vaga de propósito") |
| H8 | Significado de "mês fechado"; bloqueio de meses fechados | — | ✅ **Resolvido, sem mudança na v7**: sem bloqueio; "fechamento" é virada/consolidação automática |
| H9 | Passivos mantidos manualmente, separados do DRE | — | ⚠️ **Parcialmente revertido pela v7 — precisa de reescrita, não de "aberto" nem de "resolvido" liso.** O que continua valendo: nenhuma baixa automática a partir de Lançamentos (a separação de planos é regra viva, P6 confirma que ainda não foi decidido o contrário). O que mudou: o cronograma de parcelas deixou de ser 100% manual e passou a ser **calculado por amortização** (Fluxo K). A ADR-0005 reservada (H5, H9) precisa nascer já com essa distinção, não repetir "100% manual" |
| **H10** | Motor de DRE dirigido por configuração (blocos/fórmulas configuráveis) | Flexibilidade total vs. complexidade do motor | ❌→**Fechado para o MVP por decisão de produto, não por ADR.** PRD v7 §1 e §9.5 são explícitos: **os 10 blocos são fixos**; só as categorias dentro deles são editáveis. A v6/v1 deste documento tinha elevado isso ao hotspot de maior risco (ADR-0002) — a v7 reverte essa premissa e o próprio PRD reconhece a divergência ("a ADR de maior risco do backlog pode deixar de ser necessária no MVP"). **Ação concreta que sobra**: o comentário em `src/domain/chart-of-accounts/types.ts` ainda descreve H10 como "aberto" e cita um motor configurável futuro — está **desatualizado** frente à v7 e deveria ser corrigido numa próxima passada de engenharia (fora do escopo desta sessão, que é só o Event Storming). **H10 deixa de ser o hotspot de maior risco do backlog — ver H11** |

### Hotspots novos, levantados nesta sessão

| # | Decisão | Trade-off central | Status |
|---|---|---|---|
| **H11** | Fórmula de amortização e de reajuste de juros do Passivo (P3, P4, P5, P6) | Fidelidade financeira vs. simplicidade de implementação | ⚠️ **Metade fechada em 2026-09-11: a validação de ENGENHARIA existe; a do financeiro não.** O PRD §5 pede as duas ("validada por Engenharia e por quem responde pela parte financeira"), e só a primeira é trabalho que se faz aqui dentro. Ela está em `src/domain/assets/amortisation.validation.test.ts`: a forma fechada é confrontada com a simulação mês a mês `saldo × (1+i) − parcela`, que não compartilha código com ela. Resultado medido — com a PMT exata o resíduo é 1e-6 centavos (precisão de máquina) nos quatro cenários; com as parcelas arredondadas a centavo o resíduo fica em 535 de um teto teórico de 1038 (0,80% a.m.) e 537 de 1180 (0,85%), ou seja é arredondamento e não fórmula; o reajuste de juros preserva o principal com diferença de 0 a 34 centavos em 348 parcelas, nos dois sentidos e no limite de taxa zero. Duas mutações (juros simples no lugar de Price, e off-by-one no expoente) derrubam 15 dos 24 testes. **O que continua aberto é o que o PRD nomeia e ninguém aqui pode assinar:** se Price é o método que o contrato de cada dívida de fato usa. Isso é conferência de quem responde pelo financeiro, não de engenharia. Herdou de H10 o lugar de hotspot de maior risco. Não é hipótese: o próprio PRD §5 exige validação externa antes da implementação ("a fórmula de amortização e de juros precisa ser validada por Engenharia e por quem responde pela parte financeira") e §9.2 chama P6 de "a pergunta com maior risco contábil desta lista". A escolha da fórmula (Price hoje) é a P3 na sua forma atual: o design mandou validá-la com backend/financeiro (`164:4`) e os números dos frames não a decidem — 348 × R$ 1.520,00 = R$ 528.960,00 contra o saldo devedor de R$ 178.400,00 desenhado ao lado, e Price sobre R$ 320.000,00 em 360 meses dá R$ 2.855,64 a 0,85% a.m. É o tipo de inconsistência que só aparece quando alguém faz a conta com dado de verdade |
| **H12** | Redirecionamento como operação única, atravessando Onde Está Meu Dinheiro, Consumo Livre, Destinação do Lucro, Venda de Bem Material e pagamento a maior | Um conceito de domínio genérico e reutilizável vs. cinco implementações específicas que já divergiram (o código já tem `Allocation`/`AllocationOrigin`, mas só para venda de Bem Material) | ⚠️ **Respondido pela ADR-0017 (2026-09-11); implementado pela metade.** A medição das cinco origens mostrou que elas **não são a mesma operação**: só em Onde Está Meu Dinheiro os dois lados são posições que existem (conta tem `balance`, investimento tem `accumulatedValue`). Nas outras três o lado de origem não encolhe — lucro do mês, dinheiro de venda e sobra são valores que chegam; na venda os R$ 45.000 nunca entram em conta nenhuma. Daí **duas** operações, com os nomes que o produto já usa: **Transferência** (duas posições, atômica) e **Direcionamento** (`Allocation` generalizado, credita o destino). **FEITO:** `POST /api/v1/transfers` dentro de `withTransaction`, `src/domain/transfer`, e o Detalhe do Bloco migrado — o defeito de dinheiro sumindo (N+1 `PATCH` do cliente, "se uma falhar as anteriores já aconteceram") deixou de existir. **§4 feito em 2026-09-11, com emenda medida:** a venda de bem credita o destino (e isso consertou o PL caindo R$ 300.000 numa venda), a sobra do Consumo Livre virou Transferência a partir de `config.sourceAccountId`, e a Destinação do Lucro continua só registrando — creditá-la inflaria o Balanço porque o agregado não tem conta de origem. Destino Passivo passou a ser recusado (422) nas três, em vez de no-op silencioso. **§5 feito em 2026-09-11:** "Descontar da próxima ocorrência" reduz o previsto do mês seguinte, com três recusas para as bordas que o modelo admite e a fonte não cobre; "Redirecionar o valor extra" é recusado com razão contábil escrita (o dinheiro extra já saiu da conta, e o caso que justificaria a opção — amortização extraordinária numa parcela — não é alcançável de onde ela está). **§3 feito em 2026-09-11, fechando o hotspot:** toda Transferência grava um Evento, escrito dentro de `applyTransfer` para que as duas rotas o gravem sem precisar lembrar. Custou o quinto valor na linha "Tipo" do `files_design/03`, a conta/investimento de destino na linha "Origem", duas colunas novas em `trace_events` (migração 0009, que o drizzle-kit gerou quebrada e foi corrigida) e as 40 legendas da Mockup que enumeram os tipos. **H12 fechado** — o que sobra dele são duas decisões de PRODUTO nomeadas na ADR: a conta de origem da Destinação do Lucro (§4.1) e a amortização extraordinária (§4.2/§5) |
| **H13** | Pendência unificada — um read model só, ordenado por data, através dos 4 tipos | Um agregado novo (`Pending`/`PendingItem`, já **nomeado** no glossário) vs. a Home fazer a junção sozinha toda vez | ✅ **Resolvido nesta rodada, como previsto — não precisou de ADR.** `src/domain/pending-items/` traz o discriminated union e `collectPendingItems`; `GET /api/v1/pending-items` é a consulta única que a Home chama, montada no handler a partir de `listByStatus`/`list`/`listAll` de cada contexto (2 a 5) — a junção continua acontecendo fora do domínio puro (não há IO em `src/domain`), mas agora num lugar só, não replicada por tela |

---

## Políticas centrais desta rodada (resumo, sem repetir o texto dos fluxos)

🟪 **Pagamento a menor sempre gera Pendência; a maior nunca gera, e oferece 3 escolhas.**
(Fluxo B/I, UC26 — releia ali para o desfecho completo.)

🟪 **Toda ausência de destino completo, não bloqueia salvar — vira Pendência.** Vale para venda
de Bem Material (Fluxo L), Destinação do Lucro (Fluxo F) e recorrência "a definir" (Fluxo D).
Nenhuma dessas telas trava a pessoa por causa de um campo de direcionamento vazio — é a
exceção de obrigatoriedade nº 2 das 3 declaradas no PRD §5.

🟪 **Nenhum evento de rastreabilidade é editável pela pessoa** (Fluxo J) — todos nascem de uma
política do sistema reagindo a um comando de outro fluxo, nunca de um comando direto sobre
`TraceEvent`.

---

## O que mudou desde a v1 deste documento

- **H10 deixou de ser o hotspot de maior risco.** A v1 (fiel à v6 do PRD) tinha resolvido a
  "pergunta de domínio" como "cascata configurável" e elevado isso a ADR-0002. A v7 reverte essa
  premissa explicitamente. **H11 (fórmula de amortização) assume o lugar.**
- **H9 deixa de ser "resolvido, 100% manual"** e passa a "parcialmente revertido": o cronograma
  de parcelas é calculado; a ausência de baixa automática a partir de Lançamentos continua.
- **H3 ganha uma extensão não resolvida** (toggle Pago/Previsto + projeção de mês futuro), que
  não existia quando H3 foi fechado na v1.
- **H4 sobe de prioridade** sem mudar de status (segue aberto) — o volume que ele precisa
  cobrir cresceu.
- **Seis fluxos novos** (H a M) cobrem Consumo Livre, Pendências, Eventos, Passivo com
  cronograma, Venda de Bem Material com direcionamento e Organizar Home — nenhum existia na v1.
- **Sete agregados novos foram nomeados** (Pendência, Evento, Parcela, Reajuste de Juros,
  Direcionamento, Item de Destinação, Configuração de Consumo Livre) — dos quais seis já têm
  tipo escrito em `src/domain`, incluindo Pendência (`src/domain/pending-items`, H13 resolvido
  nesta rodada), e um está escopado de menos (Direcionamento — H12).
- **Nomenclatura**: toda menção a "Mapa de Fluxo", "Painel", "Mapa de Posição", "Ativos",
  "Balanço" e "Indicadores" foi substituída pelos nomes da v7 (Entradas e Saídas, Evolução
  Mensal, Onde Está Meu Dinheiro, Bens Materiais, Balanço Patrimonial, Indicadores Financeiros)
  em todo este documento. **A divergência que esta linha apontava acabou em 2026-09-11**: o glossário
  fechava "Mapa de Fluxo" como nome final e passou a fechar "Entradas e Saídas", com o nome
  antigo movido para a lista de termos aposentados. Um resíduo interno foi
  corrigido: "balde" (calco de `AllocationBucket`) virou **categoria de destinação**, que é como
  o PRD e a tela nomeiam as quatro.

## O que a revisão contra a v7 corrigiu nesta v2

- **Comandos de leitura dos relatórios** (Fluxo G): visão Consolidado/PF/PJ, base Pago/Previsto,
  seletor de mês, a planilha "Lançamentos deste mês" do DRE, o clique numa linha de Entradas e
  Saídas (só consulta), os dois drill-downs de treemap, o ícone que leva ao Histórico filtrado, o
  toggle 6/12 meses e o filtro do Histórico. Cobrem UC7, UC29, UC30, UC31, UC34, UC35, UC39,
  UC43 — que a v2 tratava só como linha descritiva de tabela, sem comando.
- **Casos degenerados como regra de domínio** (Fluxo G): indefinido ≠ zero, limite de 6 blocos
  com "Outras"/"Outros", item zero fora da área mas na lista, negativo como erro de dado,
  três respostas com sucesso parcial. Cobrem UC42 e UC44.
- **Histórico e Revisão de Recorrentes entram como read models** — estavam ausentes da tabela.
- **Editar/Descartar nas quatro listas de patrimônio** (UC38), com a distinção declarada entre
  descartar (corrige cadastro, sem resultado) e vender (reconhece ganho/perda).
- **Criar categoria a partir do Novo Lançamento e mostrar as categorias parecidas** (UC40), mais
  o invariante "não existe excluir categoria" e as perguntas P10/P11.
- **Seletor de mês navegável na Revisão de Recorrentes** (UC25) e a forma própria do IR (UC18).
- **Bloco D&A somente leitura** (Figma `51:32`): o único dos 10 blocos que não aceita categoria.
  Faltava, e é o que sustenta estruturalmente o EBITDA = EBIT.
- **Classificação sugerida e editável, com P7/P8 anexadas** — a política estava ausente.
- **"Excluir lançamento" marcado como sem fonte de produto** — é o único evento da v2 sem
  requisito correspondente, e existe só porque o contrato HTTP já o expõe.
- **Quatro afirmações de "implementado e testado" corrigidas**: `src/domain/recurrence`,
  `src/domain/assets` (incluindo `installments.ts` e H5) e `src/domain/profit-allocation` não
  têm arquivo de teste na suíte de 151. O texto dizia o contrário.

---

## Saída → backlog de ADRs (ordem sugerida)

**Convenção que se mantém**: os números `ADR-0001` a `ADR-0006` estão **reservados** desde a v1
(citados em comentário por `src/domain/core/money.ts`, `time.ts`, `entries/rules.test.ts`,
`assets/installments.ts` etc. — ver `CLAUDE.md` §"Fontes da verdade"). `ADR-0007` a `ADR-0012`
já foram escritas, cobrindo decisões que a v1 deste documento não previa (monolito Next.js,
sessão sem login, LGPD, idioma, tokens, SQLite/Drizzle). **Nenhum número reservado é reaproveitado
para outra decisão** — a numeração seguinte disponível é `ADR-0013`.

Da mais urgente para a mais tardia:

- **ADR-0013 (H11, NOVA, maior risco do backlog)** — Fórmula de amortização e de reajuste de
  juros do Passivo. Precisa de validação por quem responde pela parte financeira **antes** de
  ser escrita; enquanto isso, `installments.ts` continua com as quatro `OPEN QUESTION` (P3-P6)
  registradas em código e em `docs/PERGUNTAS-EM-ABERTO.md`.
- **ADR-0004 (H4)** — Motor de recorrência: materialização vs. virtual; edição série vs.
  ocorrência; agora também cobrindo parcelas de Passivo na mesma lista e projeção de meses
  futuros arbitrários. Sobe de prioridade nesta sessão.
- **ADR-0014 (H12, NOVA)** — Redirecionamento como operação única entre dois agregados
  (atomicidade de "move de um lado, credita o outro"), generalizando o `Allocation` que hoje só
  serve à venda de Bem Material.
- **ADR-0005 (H5, H9)** — Patrimônio: modelagem de Bem Material/Investimento/Passivo e
  realização de resultado só na venda; **reescrever a parte de H9** para refletir "cronograma
  calculado, baixa automática ainda não" em vez de "100% manual".
- **ADR-0001 (H1, H3, H6, H8)** — Arquitetura de dados e cálculo: já implementada; a ADR que
  falta é documentar a decisão que já está em produção, e **acrescentar a extensão da v7**
  (toggle Pago/Previsto, projeção de mês futuro) que H3 não cobria na v1.
- **ADR-0003 (H2)** — Representação de intercompany e eliminação no consolidado: já
  implementada; ADR pendente é só documentação.
- ~~**ADR-0002 (H10)**~~ — **Não recomendada para o MVP.** Motor de DRE configurável foi
  revertido pelo PRD v7; o número segue reservado (não reaproveitar), mas escrevê-la agora
  documentaria uma decisão que o produto não tomou. Reabrir só se "estrutura de blocos
  configurável" voltar ao roadmap — hoje está listada como fora de escopo (PRD §1).
- ~~**ADR-0006 (H7)**~~ — **Vazia de propósito**, conforme a própria ADR-0007 declara.
- ~~**H13 (Pendência unificada)**~~ — **Resolvido sem ADR, como previsto.** Era trabalho de
  modelagem de domínio, não uma decisão arquitetural com alternativas concorrentes —
  `src/domain/pending-items/` está escrito e testado.
