# Modelo de Dados por Tela — Controle Financeiro PF + PJ

> Especificação técnica dos campos de cada formulário, para implementação. Complementa (não substitui) o modelo de domínio definido no Event Storming (`docs/event-storming/financas-pf-pj.md`).

## Convenção geral: campos são obrigatórios por padrão (atualizado — revertido de "validação permissiva")

A coluna **Obrigatório** de cada tabela abaixo reflete a regra atual do produto: **sim** por padrão, **não** só nas 3 exceções documentadas no Log de Decisões de UX — Rótulo (onde existe), campos de direcionamento/alocação (Para onde, Valor a alocar, os 4 baldes de Destinar o Lucro, Investimento/Conta como destino), e toggles/seletores com valor padrão pré-selecionado (Entidade, Classificação, Sub-tipo, Tipo, Cor, Recorrência). Interface marca cada campo obrigatório com asterisco (*) + legenda "Campo obrigatório".

### A legenda "* Campo obrigatório" 🟩

**Uma vez por tela ou diálogo que tenha algum campo obrigatório, no fim da área de campos. Nunca em
edição inline dentro de uma lista.**

Regra fechada em 2026-09-11, e ela precisou ser **escolhida, não descoberta** — o arquivo era
inconsistente. Medidas as 36 telas com campo obrigatório: 28 formulários principais traziam a
legenda, 2 não, e as 5 edições inline nunca traziam. Detalhe do Bloco e Detalhe do Consumo Livre têm
estrutura idêntica — lista em cima, bloco "Redirecionar" embaixo — e discordavam entre si.

**O porquê da exceção:** a legenda é o rodapé de um formulário. Uma linha de lista em edição não tem
rodapé, e repetir a frase em cada linha aberta seria ruído multiplicado. As cinco exceções são
nomeadas: Plano de Contas (editar categoria), Plano de Contas (bloco aberto), Conteúdo do bloco —
categorias (com e sem edição) e Categoria em edição.

**O que a regra corrigiu:** "Gastei um Valor" e "Direcionar Sobra" ganharam a legenda nos dois lados;
"Detalhe do Consumo Livre" ganhou no Figma, onde faltava (o código já tinha). No código, quatro
diálogos de confirmação também estavam fora e foram corrigidos: Marcar Pago, Marcar parcela paga,
Editar ocorrência e Marcar ocorrência paga.

**Achado no caminho, e corrigido junto:** o "Gastei um Valor" não mostrava **rótulo** nenhum no
código — só o nome acessível. O comentário dizia que "o frame não desenha rótulo visível", e isso
era verdade sobre o **Wireframe**; a Mockup acrescentou o `Campo` com "Valor *" ao aplicar a camada
visual. Pela ADR-0015 vale a Mockup, e o código seguia a camada anterior — a mesma classe de defeito
da P41. Sem o rótulo visível não havia asterisco, e a legenda explicaria um marcador invisível.

> **P20, decidido em 2026-09-09.** As cinco linhas de "Entidade" diziam
> `Default: vazio`, contradizendo a regra logo acima — a que lista Entidade
> entre os "toggles/seletores com valor padrão pré-selecionado". Os dois não
> podiam estar certos, e o tipo do domínio (`BankAccount.entity: Entity`) exige
> um valor. Corrigidas para **PF**, o único default de Entidade que alguma fonte
> escrevia (aba Despesa, linha 112 desta mesma tabela).

## Convenção geral: campos monetários usam máscara ativa (não placeholder)

Todo campo listado como **"numérico (moeda)"** neste documento usa **máscara de moeda ativa**, não um placeholder que desaparece ao digitar. Comportamento:

- O campo sempre inicia exibindo **"R$ 0,00"** — isso é o estado da máscara, não uma sugestão do valor esperado (o campo se comporta assim independente de o valor final ser R$ 10 ou R$ 500.000).
- A pessoa digita apenas números; cada dígito entra **da direita para a esquerda**, empurrando os dígitos anteriores. Ex.: digitar "1", "2", "0", "0", "0" resulta em "R$ 12,00".
- A vírgula dos centavos permanece sempre fixa no formato "R$ 0,00" — não existe estado intermediário de "zeros vazios esperando preenchimento" (ex.: não mostrar "R$ 000.000,00").
- Não há limite de tamanho pré-definido; o valor cresce conforme a pessoa digita.

Essa convenção vale para todo campo do tipo moeda em qualquer tela deste documento (Novo Lançamento, Bens Materiais, Investimentos, Contas Bancárias, Passivos, Destinar o Lucro etc.) — não é repetida campo a campo abaixo.

---

## Onboarding — Contas Bancárias

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Legenda/cor | texto curto | sim | — | vazio |
| Entidade | enum: PF, PJ | não | — | PF |
| Saldo | numérico (moeda) | sim | formato numérico | vazio |

## Onboarding — Bens Materiais

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Nome | texto livre | sim | — | vazio |
| Entidade | enum: PF, PJ | não | — | PF |
| Valor inicial | numérico (moeda) | sim | formato numérico | vazio |

## Onboarding — Investimentos

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Nome | texto livre | sim | — | vazio |
| Entidade | enum: PF, PJ | não | — | PF |
| Valor inicial acumulado | numérico (moeda) | sim | formato numérico | vazio |

## Passivos (formulário completo, expandido por pedido do time de produto)

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Nome | texto livre | sim | — | vazio |
| Credor / Instituição | texto livre | sim | — | vazio |
| Entidade | enum: PF, PJ | não | — | PF |
| Classificação | enum: circulante, não circulante | não | sugerida por palavra-chave no nome; editável | inferida |
| Valor original da dívida | numérico (moeda) | sim | formato numérico | vazio |
| Valor da parcela | numérico (moeda) | sim | formato numérico | vazio |
| Número de parcelas | numérico (inteiro) | sim | formato numérico | vazio |
| Parcelas já pagas | numérico (inteiro) | sim | formato numérico; usado para pré-popular o histórico ao cadastrar uma dívida em andamento | 0 |
| Taxa de juros (a.m.) | numérico (percentual) | sim | formato numérico | vazio |
| Data de início | data | sim | formato de data | vazio |

## Detalhe do Passivo — objeto Parcela (gerado automaticamente a partir do formulário acima)

| Campo | Tipo | Observação |
|---|---|---|
| Número | inteiro sequencial | 1 até Número de parcelas |
| Data prevista | data | calculada a partir de Data de início + periodicidade mensal; **a parcela #1 vence na própria Data de início** (Figma `91:2`: `91:111` #12 = 10/07/2026 e o gráfico `91:61` com 12 barras a partir de `91:64` "Ago/25" põem a #1 no mês do início) |
| Valor previsto | numérico (moeda) | calculado por amortização, recalculado a cada reajuste de juros registrado (ver abaixo) |
| Status | enum: Prevista, Paga | — |
| Valor pago (real) | numérico (moeda) \| null | preenchido só quando status = Paga; pode divergir do previsto |
| Ação: Marcar Paga | ação | pede o valor real pago; gera entrada no histórico de eventos se divergir do previsto |

## Detalhe do Passivo — Registrar Reajuste de Juros

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Nova taxa de juros (a.m.) | numérico (percentual) | sim | formato numérico | vazio |
| Válida a partir de | data | sim | formato de data | vazio |

Ao confirmar, recalcula o valor previsto de todas as parcelas com status "Prevista" a partir da data informada. Parcelas já pagas nunca são alteradas retroativamente. Gera entrada no histórico de eventos.

## Evento (histórico/rastreabilidade) — objeto geral, não exclusivo de Passivo

| Campo | Tipo | Observação |
|---|---|---|
| Data | data | timestamp do evento |
| Tipo | enum: Cadastro, Reajuste de juros, Parcela paga, Recorrência paga, Transferência | "Transferência" entrou em 2026-09-11 (ADR-0017 §3): mover valor entre duas posições muda dois números e não deixava rastro. O código tem um sexto, `Divergência de pagamento`, que esta linha não lista e cuja fonte é a nota `163:4` do Figma |
| Origem | referência | Passivo específico, Lançamento recorrente específico, ou — desde a ADR-0017 §3 — a conta/investimento de DESTINO de uma Transferência |
| Descrição | texto gerado automaticamente | ex.: "Taxa de juros reajustada de 0,80% para 0,85% a.m.", "Parcela #12 paga: previsto R$ 1.520,00, pago R$ 1.540,00", "Aluguel — pagamento com divergência: previsto R$ 1.500,00, pago R$ 1.300,00", "R$ 5.000,00 redirecionados de Nubank para Tesouro Direto" |

Gerado automaticamente por qualquer ação relevante (cadastro, reajuste, pagamento com ou sem divergência) — a pessoa não edita o histórico manualmente. Cada Passivo mostra seu próprio histórico completo em Detalhe do Passivo. Na Home, um card **"Eventos Recentes"** mostra só os últimos 5 eventos do produto inteiro (não um log completo) — sem tela dedicada de "ver tudo" por ora.

## Marcar Pago (ação, dentro de Revisão de Recorrentes)

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Valor pago | numérico (moeda) | sim | formato numérico | valor previsto da ocorrência |
| Data de pagamento | data | sim | formato de data | hoje |

Se Valor pago ≠ valor previsto, gera um Evento de divergência. Dois comportamentos diferentes conforme o sinal da diferença:
- **Valor pago < previsto:** a diferença fica como pendente — aparece como **um item próprio** no card de Pendências da Home (não somado com outras divergências), com botão "Pagar".
- **Valor pago > previsto:** a diferença **nunca vira Pendência**. A pessoa escolhe entre 3 opções: **Descontar da próxima ocorrência** (reduz o valor previsto do mês seguinte) · **Redirecionar o valor extra** (mesmo fluxo de destino de Venda de Bem Material: Investimento, Passivo ou Receita) · **Manter sem ação** (só gera o Evento, sem decisão pendente).

---

## Novo Lançamento — Aba Despesa

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Valor | numérico (moeda) | sim | formato numérico, mensagem em tempo real | vazio |
| Data de pagamento | data | sim | formato de data | hoje |
| Cartão de crédito | booleano (liga/desliga) — 🟩 2026-10-06, ADR-0021 | não (toggle com valor padrão) | — | desligado; ligado na compra de cartão vinda do Open Finance |
| Contabilizar em | mês (`YYYY-MM`, seletor de mês) — 🟩 2026-10-06, ADR-0021 | não | mês válido; igual ao mês do pagamento grava vazio (`null`) e acompanha a data | o mês da Data de pagamento |
| Status | enum: Previsto, Pago | não | — | Previsto (2026-10-01; era Pago) |
| Entidade | enum: PF, PJ | não | — | PF |
| Categoria | referência (busca/autocomplete; permite criar nova) | sim | — | vazio |
| Classificação | enum: circulante, não circulante | não | sugerida a partir da categoria; editável | inferida |
| Conta | referência (dropdown de Contas Bancárias) | sim | — | vazio |
| Recorrência | objeto (ver abaixo), **campo visível por padrão** | não | — | desligada |

Sem campo de Rótulo — a Categoria já identifica o lançamento.

"Cartão de crédito" e "Contabilizar em" existem **só na Despesa** (o servidor recusa os dois em outro tipo). A série criada pelo toggle de Recorrência leva "Cartão de crédito", nunca "Contabilizar em" — cada ocorrência fica no próprio mês (ADR-0021 §3).

## Novo Lançamento — Aba Receita

Mesmos campos e comportamento da aba Despesa, com estas diferenças:

| Campo | Diferença |
|---|---|
| Data do recebimento | rótulo do campo (não "de pagamento") |
| Status | enum: Previsto, **Recebido** (não "Pago") — default Previsto (2026-10-01; era Recebido) |

## Consumo Livre — widget (não é mais aba do Novo Lançamento)

**Configuração (Estado A, primeira vez):**

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Valor mensal | numérico (moeda) | sim | formato numérico | vazio |
| Conta de origem | referência (dropdown de Contas Bancárias) | sim | — | vazio |

**Registrar gasto (popover "Gastei um valor", Estado B → clique no botão):**

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Valor gasto | numérico (moeda) | sim | formato numérico, nunca negativo | vazio |

Data = hoje (implícita, não perguntada) · Entidade = herdada da configuração (padrão PF) · Conta = a definida na configuração. Gera um Lançamento com Categoria fixa "Consumo Livre" (dentro do bloco Despesas Pessoais), do mesmo jeito que antes — só muda a interface de criação.

**Editar um lançamento já existente:** pelo histórico do widget (Estado C, ação "Editar" por linha) — Valor e, opcionalmente, Rótulo — **ou**, desde 2026-10-06, pelo formulário de lançamento, como qualquer despesa (dono: a tela que mandava "editar pelo widget, na Home" "não faz sentido"; o "Editar" do DRE nunca editava). Trocar a categoria no formulário tira o gasto do widget e o mantém como despesa da categoria nova. No widget, os campos editáveis são Valor, e opcionalmente Rótulo (**única aba/fluxo, junto com IR, que mantém Rótulo** — sem Categoria própria por item, o Rótulo ajuda a diferenciar entradas específicas se a pessoa quiser).

**Redirecionar saldo restante:** mesmo padrão "Para onde" (busca conta/investimento/dívida) + Valor já usado no resto do produto.

## Novo Lançamento — Aba Pró-labore e Distribuição

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Sub-tipo | enum: Pró-labore, Distribuição de lucro | não | — | vazio |
| Valor | numérico (moeda) | sim | formato numérico | vazio |
| Data | data | sim | formato de data | hoje |
| Status | enum: Previsto, Pago (PRD v7.40) | sim | — | Previsto (2026-10-01; era Pago) |
| Conta de origem (PJ) | referência (dropdown de Contas Bancárias, filtrado para PJ, com "Sem conta de origem") | não (ADR-0018) | — | vazio |
| Conta de destino (PF) | referência (dropdown de Contas Bancárias, filtrado para PF) | sim | — | vazio |
| Recorrência | objeto (mesmo formato de Despesa/Receita), **campo visível por padrão** | não | — | desligada |

Sem campo de entidade — o motor de eliminação intercompany aplica a lógica de PF/PJ/consolidado automaticamente a partir do sub-tipo. Sem Rótulo. Recorrência é especialmente relevante aqui, já que pró-labore costuma ser um valor fixo mensal. Conta de origem/destino são direcionais (sempre PJ → PF), já que é uma transferência real de dinheiro, não só um registro contábil. O destino é obrigatório; a origem é opcional desde a ADR-0018, para quando o dinheiro não sai de uma conta PJ cadastrada no app.

## Novo Lançamento — Aba IR

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Tipo | enum: Pagamento, Recebimento | não | — | vazio |
| Entidade | enum: PF, PJ | não | — | PF |
| Valor | numérico (moeda) | sim | formato numérico | vazio |
| Conta | referência (dropdown de Contas Bancárias) | sim | — | vazio |
| Data | data | sim | formato de data | hoje |
| Rótulo | texto livre | não | — | vazio |
| Recorrência (rótulo na tela: "Parcelar") | objeto (mesmo formato de Despesa/Receita), **campo visível por padrão** | não | — | desligada |

Um único campo Conta (igual Despesa/Receita) — representa "de onde sai" (Tipo = Pagamento) ou "pra onde vai" (Tipo = Recebimento). Diferente de Pró-labore, que precisa de dois campos porque envolve duas entidades (PJ e PF); IR envolve só uma entidade por vez.

**Mantém Rótulo** — diferente das demais abas, IR não tem campo de Categoria, então o Rótulo é o que permite diferenciar um lançamento do outro no Histórico. **Tem Recorrência** (rotulada como "Parcelar" nesta aba, mais literal para o contexto de IR parcelado em até várias vezes) — o campo Término (data da última ocorrência) já cobre a necessidade de "número de parcelas", sem precisar de um campo novo. **Exceção de default:** nesta aba, o toggle "Definir data de término" vem ligado por padrão (campo de data já visível) — diferente de Despesa/Receita/Pró-labore, onde vem desligado — porque parcelamento de IR sempre tem um número de parcelas conhecido de antemão. Interface exibe texto de orientação fixo (conteúdo a definir por Produto/Contabilidade).

## Novo Lançamento — Objeto Recorrência (dentro de qualquer aba)

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Ativa | booleano | — | — | falso |
| Tipo de valor | enum: fixo, a definir | condicional (só se ativa) | — | fixo |
| Término | toggle "Definir data de término" (desligado por padrão) + campo de data condicional | sim | formato dd/mm/aaaa, só aparece se toggle ligado | desligado (sem data) |
| Encerrar (ação, só em edição) | ação | — | — | — |

A série começa no **mês do lançamento** (ADR-0019). Salvo como **Previsto**, o lançamento não é gravado: a ocorrência do mês o representa, com o valor digitado. Salvo como **Pago**, o lançamento é gravado e vinculado como a ocorrência paga do mês.

---

## Revisão de Recorrentes — item da lista

| Campo | Tipo | Observação |
|---|---|---|
| Ocorrência (referência) | referência a Lançamento | gerado pelo motor de recorrência, status Previsto — inclusive a do mês em que a série foi criada (ADR-0019) |
| Ação: Marcar Pago | ação | pede só a data de pagamento (default hoje) |
| Ação: Editar | ação | abre edição de valor/dados; se pertence a série, pergunta "só esta / série toda" |
| Ação: Descartar | ação | remove a ocorrência deste mês; disponível para fixo ou a definir |

---

## Histórico — filtros

| Filtro | Tipo | Fonte |
|---|---|---|
| Status | enum: Previsto, Pago | campo do Lançamento |
| Entidade | enum: PF, PJ, Consolidado | campo do Lançamento |
| Mês | seletor de mês/ano | derivado da data de pagamento |
| Categoria | referência | campo do Lançamento |
| Classificação | enum: circulante, não circulante | campo do Lançamento |
| Conta | referência | campo do Lançamento |
| Recorrência | booleano | vínculo de recorrência do Lançamento |

Ação: clicar em um item abre **Novo Lançamento** pré-preenchido com os dados daquele lançamento (mesmo formulário, mesmos campos acima) — **exceto lançamentos de Consumo Livre**, que são editados a partir do histórico do próprio widget de Consumo Livre na Home, não pelo Novo Lançamento (ver seção "Consumo Livre — widget").

---

## Destinar o Lucro

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Lucro líquido do mês | numérico (moeda), somente leitura | — | calculado pelo sistema | — |
| Aporte em Investimentos (card) | lista de Itens de Destinação (ver abaixo) | não | soma dos itens não pode exceder o lucro líquido | lista vazia |
| Reinvestimento de Dividendos (card) | lista de Itens de Destinação | não | idem | lista vazia |
| Consumo Extraordinário (card) | lista de Itens de Destinação (sem campo de destino, só nome + valor) | não | idem | lista vazia |
| Reserva em Caixa (card) | lista de Itens de Destinação (destino = Conta) | não | idem | lista vazia |
| Saldo não alocado | numérico (moeda), somente leitura | — | lucro líquido − soma de todos os itens de todos os cards, atualiza em tempo real | — |
| Percentual do lucro | numérico (%), somente leitura | — | calculado por item, por subtotal de card, e para o Saldo não alocado: valor ÷ lucro líquido | — |

## Objeto Item de Destinação (dentro de cada card de Destinar o Lucro)

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Nome/Destino | referência (Investimento existente ou criar novo, busca/cria inline) ou referência a Conta (no card Reserva em Caixa) ou texto livre (no card Consumo Extraordinário) | não | mesmo padrão de busca/criar categoria | vazio |
| Valor | numérico (moeda) | não | formato numérico | vazio |

Cada card permite múltiplos itens (ex.: aportar em Tesouro Direto **e** Ações XP dentro do mesmo "Aporte em Investimentos") — botão "+ Adicionar" específico do card soma um novo item à lista. Mesmo padrão de lista+adicionar usado em Venda de Bem Material.

Escopo: valor único consolidado (não replicado por entidade). Rótulos dos campos de destino ("Conta", "Investimento") seguem os mesmos nomes já usados em Novo Lançamento e no onboarding, para consistência.

---

## Relatórios — parâmetros comuns

| Parâmetro | Tipo | Aplica-se a | Default |
|---|---|---|---|
| Visão | enum: Consolidado, PF, PJ | DRE, Balanço Patrimonial, Evolução Mensal, Indicadores Financeiros | última visão usada (persistida) |
| Mês | seletor de mês/ano | DRE | mês atual |

Balanço Patrimonial não usa seletor de mês — é sempre a posição do momento atual.

---

## Vender Bem Material

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Valor de venda | numérico (moeda) | sim | formato numérico | vazio |
| Data da venda | data | sim | formato dd/mm/aaaa | vazio |
| Ganho/Perda | numérico (moeda), somente leitura | — | calculado: valor de venda − valor registrado do bem | — |
| Direcionamentos | lista de objetos Direcionamento (ver abaixo) | não | soma dos valores não pode exceder o valor de venda | lista vazia |
| Restante (somente leitura) | numérico (moeda) | — | valor de venda − soma dos direcionamentos, atualiza em tempo real | valor de venda |

Ao confirmar: gera lançamento automático em Resultado Não Operacional (ganho/perda) e remove o bem da lista de Bens Materiais. Se "Restante" > 0 ao confirmar, esse valor entra no estado **pendente de direcionamento**.

## Objeto Direcionamento (dentro de Vender Bem Material)

| Campo | Tipo | Obrigatório | Validação | Default |
|---|---|---|---|---|
| Tipo | enum: Investimento, Passivo, Receita | sim (por item) | — | vazio |
| Destino | referência (Investimento ou Passivo existente, busca/cria inline) — não se aplica a Receita | condicional | mesmo padrão de busca/criar categoria (lista completa ao clicar, filtra ao digitar) | vazio |
| Campos de Receita | mesmos campos do formulário de Receita | condicional (só se Tipo = Receita) | Valor pré-preenchido com o valor alocado, editável | — |
| Valor a alocar | numérico (moeda) | sim (por item) | não pode exceder o Restante disponível no momento | vazio |

Cada Direcionamento tem ações Editar/Remover na lista do modal principal.

## Pendente de Direcionamento (objeto)

| Campo | Tipo | Observação |
|---|---|---|
| Origem | referência | ex.: venda de bem material específico |
| Valor | numérico (moeda) | valor a ser direcionado |
| Data de origem | data | quando o valor ficou pendente |
| Status | enum: Pendente, Direcionado | — |

Exibido em destaque (banner) na Home enquanto Status = Pendente. Ação "Direcionar agora" abre a mesma escolha de conta que aparecia no modal de venda.

## DRE — toggle Pago/Previsto e planilha de lançamentos

| Campo | Tipo | Observação |
|---|---|---|
| Filtro de status (cascata) | enum: Pago, Previsto | Controla o cálculo de toda a cascata (Receita Bruta → Lucro Líquido). Default: Pago em mês atual/passado; Previsto em mês futuro. Nunca desabilitado — se não houver dado no filtro escolhido, exibe aviso |
| Mês selecionado | data (mês/ano) | Navegável pra frente e pra trás. Mês futuro só tem lançamentos com Status = Previsto (gerados por recorrência e parcelas de passivo) |

**Tabela "Lançamentos deste mês"** (sempre visível, sem filtro próprio — mostra Pago + Previsto juntos):

| Campo | Tipo | Observação |
|---|---|---|
| Nome do lançamento | texto | — |
| Bloco | referência ao bloco do Plano de Contas | — |
| Status | enum: Pago, Previsto | mesmo Status do lançamento em si |
| Valor | numérico (moeda) | — |
| Ação: Marcar Pago | ação | só aparece se Status = Previsto; mesmo comportamento de Revisão de Recorrentes |
| Ação: Editar | ação | abre edição do lançamento, sem sair do DRE |

