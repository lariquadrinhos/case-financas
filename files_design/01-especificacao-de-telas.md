# Especificação de Telas — Controle Financeiro PF + PJ

> Wireframe comentado: descrição funcional de cada tela do produto, sem o desenho visual. Serve como ponte entre o PRD e o design/desenvolvimento de fato.
>
> Legenda: 🟦 **PRD** = definido no documento de produto · 🟩 **Design** = decisão tomada nesta sessão, preenchendo lacuna do PRD

---

## 0. Barra Lateral (chrome global)

**Redesenho de 2026-10-01** 🟩 *pendente de design — diverge da Mockup 749:2.* Pedido do dono: o menu estava "ruim e pouco acessível, com muitos cliques e com scroll". O que mudou, e por quê:

- **Toda tela a um clique.** Os dois grupos recolhíveis viraram **títulos de seção fixos**, pequenos e em caixa alta: **Relatórios** (DRE, Balanço Patrimonial, Evolução Mensal, Indicadores Financeiros), **Lançamentos** (Revisão de Recorrentes, Histórico) e **Plano de Contas e Patrimônio** (os cinco cadastros). Nada abre nem fecha; "Plano de Contas e Patrimônio" nascia fechado e cada cadastro custava um clique a mais. Os três títulos são nomes do glossário.
- **Não há item "Início":** a marca "Bigorna", com o logo, é o caminho para a Home (o dono testou um item "Início" explícito no mesmo dia e o retirou: "o logo já seria o início").
- **A barra fica fixa na tela** (`sticky`, altura da janela) enquanto o conteúdo rola. Antes ela rolava junto, e numa tela longa o "+ Novo Lançamento" sumia. Numa janela mais baixa que a lista, é a barra que rola, não a página.
- **Linha de 32** em vez dos 36 da Mockup: com "Início" e as 12 telas sempre à vista, 36 estourava uma janela de 768 de altura.
- **O título da seção onde a pessoa está acende** na cor de estado, junto com o item ativo: diz onde ela está sem precisar ler item a item.
- **O alternador de tema fica ao lado da marca**, no topo, como na Mockup (uma versão no rodapé foi testada e revertida no mesmo dia).
- **Títulos de seção são rótulos, não itens** (dono: "precisa estar claro que não é clicável"): `label.xs` em caixa alta, cor terciária, sem hover nem cursor de mãozinha, com divisória e mais ar acima de cada seção. O título da seção que contém a tela atual acende na cor de estado. Uma versão em peso médio no tamanho do item foi testada e revertida: parecia um item em negrito.
- **Marca "Bigorna"** (glossário, 2026-10-01; a Mockup escrevia "Finanças PF+PJ") com o **logo**: uma bigorna de ferreiro, silhueta de 24×24 na cor do texto, à esquerda do nome. O título da aba do navegador é só "Bigorna". Decorativa, fora do nome do link. A mesma bigorna é o **favicon** (`src/app/icon.svg`), escura ou clara conforme o tema do sistema. Não existe no Figma. Os contadores de Pendências ao lado de "Início" e "Revisão de Recorrentes", testados no mesmo dia, saíram a pedido do dono ("ficou ruim").

A descrição abaixo é a da Mockup, anterior ao redesenho.

**Propósito:** 🟩 navegação principal do produto, fixa e sempre visível — não é uma tela, é a moldura em volta de quase todas as telas. Documentada aqui à parte porque, embora citada de passagem em outras seções deste documento (Home, Plano de Contas e Patrimônio), nunca tinha ganhado uma descrição própria e completa.

**Estrutura, de cima pra baixo:**
- **Marca "Finanças PF+PJ"** (sem espaços em volta do `+`), com o **Alternador de tema** (sol/lua) na mesma linha, empurrado pro extremo direito.
- Botão primário **"+ Novo Lançamento"**.
- **"Relatórios"** — grupo recolhível, expandido por padrão, com quatro filhos recuados (DRE, Balanço Patrimonial, Evolução Mensal, Indicadores Financeiros).
- Itens de nível raiz: **Revisão de Recorrentes**, **Histórico**.
- **"Plano de Contas e Patrimônio"** — segundo grupo recolhível, recolhido por padrão, com 5 sub-itens sempre visíveis e clicáveis (Plano de Contas, Contas Bancárias, Bens Materiais, Investimentos, Passivos) — mesmo padrão do grupo "Relatórios".

**Item ativo:** mesmo mecanismo visual de seleção usado nos controles segmentados do produto (fundo + cor de texto de estado), não uma cor inventada só pra navegação.

**Alternador de tema** 🟩 — controle manual de claro/escuro, ícones de sol (claro) e lua (escuro), mesma mecânica visual do Controle segmentado (trilho + item ativo em destaque). Ficou na barra lateral por ser o único elemento da interface hoje compartilhado por todas as telas — um controle de tema é global por natureza, e colocá-lo no cabeçalho de cada tela individual exigiria repetir o mesmo componente em 15 lugares, com risco real de inconsistência. Alternativas avaliadas e descartadas: seguir o sistema operacional automaticamente (sem controle manual), uma tela de Configurações dedicada (desproporcional pra uma única opção) e um híbrido de 3 estados Automático/Claro/Escuro (complexidade extra sem motivo concreto do produto). Ver doc02 pro histórico completo da decisão.

**Escopo — cobertura no Wireframe:** 🟩 o componente do Alternador de tema foi aplicado nas 26 telas "Desktop —" principais (a Início mais as outras 25, incluindo as 4 abas do Novo Lançamento e os 5 modais "sobre Início"). Ficaram de fora, deliberadamente: os estados "Vazio" (conta recém-criada, sem dado) e o estado "Home em Modo de Organização" — são variações de estado das mesmas telas, não telas novas, e replicar neles é trabalho pendente, não uma decisão em aberto.

---

## 1. Abertura do app

**Propósito:** rotear a pessoa para o lugar certo, sem exigir login.

**Comportamento:** 🟩
- Sem autenticação — abre direto no conteúdo.
- Verifica o estado dos dados:
  - Sem dados / onboarding incompleto → vai para **Onboarding**, retomando de onde parou.
  - Onboarding completo → vai direto para **Home**.

---

## 2. Onboarding 0 — Antes de começar

**Propósito:** 🟩 tela intermediária, antes do Onboarding 1, explicando a fronteira entre "configurar situação atual" (o que o onboarding faz) e "lançamentos/recorrência" (o que não faz, fica pro Novo Lançamento). Resolve uma dúvida recorrente sobre por que salário não entra no onboarding.

**Conteúdo:**
- Título: "Antes de começar, vamos configurar seu Plano de Contas e Patrimônio"
- Texto (3 parágrafos curtos): o que esta etapa registra (situação atual: contas, bens, investimentos, dívidas) · que dá pra fazer depois, mas fazer agora deixa os relatórios certos desde o primeiro dia · que lançamentos e recorrências (salário, gastos do dia a dia) não fazem parte daqui, ficam em Novo Lançamento
- Botões: **"Fazer depois"** (secundário, pula pra Home) · **"Começar agora"** (primário, segue pro Onboarding 1)

## 3. Onboarding (5 telas em sequência)

**Propósito:** 🟦 configurar plano de contas e saldos iniciais antes do uso normal. Reaproveita as mesmas telas do dia a dia (não é fluxo isolado).

**Comportamento geral:** 🟦 permite salvar e continuar depois, a qualquer momento.

### 3.1 Plano de Contas
- Mostra os **10 blocos fixos** do DRE (Receita Bruta, Deduções da Receita, CSV, Despesas Administrativas, Despesas Pessoais/Consumo, D&A, Resultado Não Operacional, Resultado Financeiro, Impostos sobre o Lucro, Destinação do Lucro), já populados com categorias de exemplo. 🟦
- Ação: criar/editar categorias dentro de cada bloco (busca/autocomplete estilo "criar pasta"). 🟦/🟩
- Categoria não utilizada simplesmente não é usada — não existe ação de "excluir". 🟩
- Blocos são fixos; só as categorias dentro deles são editáveis. 🟩 (decisão de escopo — estrutura de blocos configurável é hotspot de arquitetura, fora do MVP de produto)

### 3.2 Contas Bancárias
Campos: legenda/cor · entidade (PF/PJ) · saldo. 🟦/🟩

### 3.3 Bens Materiais
Campos: nome (texto livre) · entidade · valor inicial. 🟩

### 3.4 Investimentos
Campos: nome (texto livre) · entidade · valor inicial acumulado. 🟩

### 3.5 Passivos
Campos: nome (texto livre) · entidade · classificação (circulante/não circulante — **sugerida automaticamente por palavra-chave, editável**) · valor. 🟩

---

## 4. Home (Dashboard)

**Propósito:** 🟩 painel de entrada, redesenhado a pedido do time de produto — prioriza pendências e visão visual do dinheiro, não histórico. Navegação principal já vive na barra lateral fixa (não confundir com o relatório "Evolução Mensal").

**Conteúdo:**
- Saudação. 🟩
- **Pendências** (banners de destaque, estilo alerta): 🟩
  - Valor a direcionar (de venda de Bem Material sem destino completo)
  - Recorrentes pendentes (valores "a definir" não preenchidos)
  - Saldo não alocado da Destinação do Lucro
  - Divergências de valor (previsto ≠ pago) — **um item por divergência**, com botão "Pagar"
- **Entradas e Saídas** (antigo "Mapa de Fluxo"): 🟩 de onde veio e pra onde foi o dinheiro no mês, com seletor de mês e as 3 visões (Consolidado/PF/PJ). Tabela de duas colunas, Entradas e Saídas, nome e valor, sem diagrama. Um diagrama Sankey de fontes → hub → destinos foi desenhado e testado, e descartado numa revisão posterior por não ler como fluxo rastreável — ver doc02 e doc07/08 pro raciocínio completo.
- **Onde Está Meu Dinheiro**: 🟩 treemap interativo, blocos proporcionais ao valor (Contas Bancárias, Investimentos, Dívidas/Passivos — Dívidas em tom diferenciado). Clicar num bloco permite redirecionar dinheiro pra outro lugar, a qualquer momento. Substitui a versão anterior em barra proporcional. Bens Materiais não entram (não são líquidos).
- **Despesas por Categoria**: 🟩 treemap interativo, blocos proporcionais ao gasto do mês por categoria (Casa, Carro, Pet, Consumo Livre...). Clicar num bloco abre o detalhe da categoria (lançamentos do mês) + formulário rápido de adicionar gasto (categoria e conta pré-preenchidas, só valor e data) — **exceto Consumo Livre**, que abre seu próprio painel (ver abaixo), nunca um formulário. **Ícone no cabeçalho do card 🟩**: separado dos blocos, abre o Histórico já filtrado pelo mês corrente — ação diferente (visão ampla de todos os gastos do mês, não só uma categoria), por isso o card ganha o ícone de card clicável (doc07) além do ícone de cada bloco.
- **Consumo Livre (widget)**: 🟩 substitui lançar gasto por gasto. Tem 3 estados (configurar, card normal, detalhe) + o popover de gasto rápido — ver seção dedicada "Consumo Livre (estados completos)" logo abaixo.
- **Eventos Recentes**: 🟩 card com os últimos 5 eventos de rastreabilidade (reajustes de juros, divergências entre previsto e pago, parcelas confirmadas) — não é um log completo, só os mais recentes.
- **Botão "Organizar Home"**: 🟩 ao lado da saudação, entra num modo de edição onde cada card ganha um handle de arrastar (reordenar) e um botão Minimizar. Ver seção dedicada "Organizar Home" mais abaixo.

Removidos da versão anterior: botão de destaque "Novo Lançamento" na área principal (continua na barra lateral) e prévia de últimos lançamentos.

**Princípio de nomenclatura:** 🟩 nomes literais e explícitos — nunca termos "convidativos" que exijam decodificação.

---

## 4a. Consumo Livre (estados completos)

**Propósito:** 🟩 gasto variável e imprevisível (mercado, lazer, miudezas do dia a dia), sem precisar lançar item por item — a pessoa define uma verba mensal, e só confirma quanto gastou, quando gastou.

**Estado A — Configurar (primeira vez):** valor mensal + conta de origem. Botão "Salvar".

**Estado B — Card no dashboard (padrão):** título + barra de progresso ("R$ 350 / R$ 500") + legenda "saindo da conta X, reabastece dia 1" + botão "Gastei um valor". Clicar em qualquer parte do card fora do botão abre o Estado C.

**Popover "Gastei um valor"** (ao clicar no botão): só o campo Valor + Confirmar. Sem categoria, sem conta, sem data — a barra atualiza na hora.

**Estado C — Detalhe (clicar no card):** histórico do mês (data + valor de cada gasto, com ação "Editar" por linha — é aqui que um lançamento de Consumo Livre é editado, nunca pelo Novo Lançamento), sobra do mês anterior registrada como uma linha explícita no histórico (não some silenciosamente), botão "Editar valor e conta" (reabre os 2 campos do Estado A), e bloco "Redirecionar saldo restante" (mesmo padrão "Para onde" + Valor usado no resto do produto).

**Card minimizado fora do modo de organização:** se a pessoa minimizou o card (ver "Organizar Home"), ele aparece como uma linha fina (título + legenda + botão "Maximizar"), sempre com aparência ativa — dá pra restaurar a qualquer momento, sem precisar entrar no modo de organização.

---

## 5. Novo Lançamento

**Propósito:** 🟦 tela de maior prioridade do produto — fluxo de lançamento com fricção mínima.

**Estrutura:** formulário único, com 4 abas/chips no topo (1 toque, sem dropdown). 🟩
Ordem sugerida por frequência: **Despesa · Receita · Pró-labore e Distribuição · IR**. 🟩
*(Consumo Livre não é mais uma aba aqui — ver seção 4a, Consumo Livre: passou a ter widget próprio, sem formulário.)*

**Agrupamento visual dos campos** 🟩, resolvendo densidade alta de campos em sequência: cada aba organiza os campos em blocos com título pequeno em caixa alta + linha divisória entre eles. Despesa/Receita: **Informações Básicas** (Valor, Data, Status, Entidade) → **Categorização** (Categoria, Classificação, Conta) → **Recorrência**. Pró-labore: Informações Básicas → **Transferência** (Conta de origem/destino) → Recorrência. IR: Informações Básicas → Recorrência.

### 5.1 Aba Despesa
| Campo | Comportamento |
|---|---|
| Valor | numérico, máscara de moeda |
| Data de pagamento | pré-preenchida com hoje |
| Cartão de crédito | 🟩 *2026-10-06, decisão do dono, ADR-0021, pendente de design:* liga/desliga, **padrão desligado**. Só uma marca — ícone `icon/credit-card` ao lado do nome no Histórico e no DRE; não muda status, data nem mês. A compra de cartão vinculado ao Open Finance já chega ligada. A série leva a marca |
| Contabilizar em | 🟩 *2026-10-06, decisão do dono, ADR-0021, pendente de design:* seletor de mês ("Setembro/2026"), aberto no mês da Data de pagamento — num lançamento novo, o mês atual. Escolher outro mês põe a despesa no DRE, no Balanço, na Evolução Mensal e nos Indicadores desse mês (emenda o regime de caixa do PRD §5). A série **não** leva o campo |
| Status | Previsto/Pago — **padrão Pago** |
| Entidade | toggle PF/PJ — padrão PF |
| Categoria | busca/autocomplete; cria categoria nova inline sem sair do formulário |
| Classificação | circulante/não circulante — sugerida automaticamente, editável |
| Conta | dropdown das contas cadastradas |
| Recorrência | **visível por padrão**, bloco completo (toggle, tipo de valor, término) — sem Rótulo, já que a Categoria já identifica o lançamento |

### 5.1b Aba Receita — **não é espelho de Despesa**
Mesma estrutura geral, mas com diferenças reais:
| Campo | Diferença em relação a Despesa |
|---|---|
| Data do recebimento | rótulo muda (não "de pagamento") |
| Status | **Previsto / Recebido** (não "Pago") |
| Recorrência | visível por padrão, igual Despesa — receita recorrente (salário, aluguel recebido) é um caso muito comum |

### 5.2 Aba Pró-labore e Distribuição
Sub-tipo (Pró-labore / Distribuição de lucro) · Valor · Data (hoje) · **Status (Previsto/Pago, padrão Pago — PRD v7.40)** · **Conta de origem (PJ), opcional, com (i)** · **Conta de destino (PF)** · Recorrência (visível por padrão, sem Rótulo). Não pede entidade — afeta as duas por definição. 🟦/🟩
*(Pró-labore é tipicamente recorrente mês a mês — recorrência precisa estar disponível aqui, não só em Despesa/Receita. Contas de origem/destino explícitas porque é uma transferência real de dinheiro entre PJ e PF, sempre nesse sentido. A origem é opcional desde o PRD v7.37 / ADR-0018: o dinheiro pode cair direto na PF sem sair de uma conta PJ cadastrada; a lista traz "Sem conta de origem" como primeiro item.)*

### 5.3 Aba IR
Tipo (Pagamento/Recebimento) · Entidade · Valor · **Conta** · Data (hoje) · **Rótulo (opcional)** · **Recorrência (rotulada "Parcelar" nesta aba)** · texto de orientação fixo na tela. 🟦/🟩
*(IR não tem campo de Categoria — por isso mantém Rótulo, diferente das demais abas onde a Categoria já identifica o lançamento. Tem Recorrência porque IR pode ser parcelado — ex.: Imposto de Renda em até 8x — usando o campo Término como "quantas parcelas". Um único campo Conta, igual Despesa/Receita — representa "de onde sai" (Pagamento) ou "pra onde vai" (Recebimento), não precisa de dois campos como Pró-labore, que envolve duas entidades diferentes.)*

### 5.4 Campo de Recorrência (dentro de qualquer aba)
Toggle liga/desliga · Tipo de valor (fixo/a definir) · Término (data ou indefinida) · "Encerrar recorrência" (se editando uma já existente — para a série pra sempre, diferente de "Descartar" que pula só 1 mês). 🟦/🟩

### 5.5 Pós-salvamento
Mensagem de sucesso com 2 opções: 🟩
- **Lançar outro** → formulário limpo, mesma tela
- **Voltar** → retorna à origem (Home ou Histórico, dependendo de onde a pessoa veio)

### 5.6 Validação (princípio geral do produto) — **atualizado**
Valida **formato** (número, data) em tempo real durante a digitação. **Campos são obrigatórios por padrão** (marcados com asterisco * + legenda "Campo obrigatório"), exceto 3 categorias: Rótulo (onde existe), campos de direcionamento/alocação (viram Pendência se vazios), e toggles/seletores com valor padrão pré-selecionado (Entidade, Classificação, Sub-tipo, Tipo, Cor — nunca ficam vazios de qualquer forma). Obrigatoriedade trava no nível do registro individual sendo preenchido — não impede pular uma etapa inteira sem ter mexido nela (ver "Salvar e continuar depois" no onboarding). 🟩
*(Substitui a decisão original de "validação permissiva" — revertida a pedido de produto: a seriedade do app não combina com dado faltando.)*

---

## 6. Revisão de Recorrentes

**Propósito:** 🟦 checklist mensal das ocorrências que o motor de recorrência já gerou como "Previsto".

**Tela própria**, separada do Histórico (ação rápida, não lista genérica). 🟩 Atalho normal na Home, sem destaque de banner. 🟩 **Seletor de mês navegável** (← mês →) — antes era um texto fixo, agora dá pra rever como ficou um mês anterior. 🟩

**Cada item da lista tem até 3 ações:** 🟦/🟩
- **Confirmar** (era "Marcar Pago" até 2026-10-06) — pede **Valor pago** (pré-preenchido com o valor esperado, editável) e a data (pré-preenchida hoje). Se o valor pago divergir do previsto, mostra aviso explícito e gera um Evento de rastreabilidade. Sem pergunta de série.
- **Editar** — 🟩 *2026-10-01, pendente de design:* abre o formulário do Novo Lançamento **já preenchido com a série** (título "Editar Recorrência"), com Descrição, Valor e os dados da série (categoria, conta, entidade, classificação), Status oculto e Data travada. No lugar do bloco Recorrência, "Aplicar esta mudança a: Só esta ocorrência (Mês/AAAA) / Toda a série (valores em aberto)". Só esta ocorrência muda o valor e a descrição daquele mês; categoria, conta e entidade mudam só com Toda a série, e os meses já pagos não mudam. O mesmo "Editar" vale na tabela do DRE. *Até 2026-10-01:* muda o **valor**; se a recorrência tem série, pergunta "só esta ocorrência ou toda a série (valores em aberto)?" (frame `34:2`, card `34:24` da coluna ② `34:21`: um campo só, `144:3` "Valor *", e as linhas `34:27`/`34:29`). Preencher o valor **não** muda o "Tipo de valor" da série: o tooltip `74:14` do frame `71:11` (textos `75:2`/`75:3`) define "A definir" como "o valor sofre alterações e deve ser informado a cada mês", então uma série "a definir" continua nascendo em branco no mês seguinte; trocar o tipo é feito no bloco RECORRÊNCIA do formulário (frame `262:873`, nó `67:8`).
- **Descartar** — pergunta 🟩 (2026-10-01) "Só este mês" ou "Deste mês em diante (mantém os anteriores)" (era "A série completa (encerra a recorrência)" até 2026-10-06: o efeito sempre foi este mês e os seguintes, e o nome sugeria apagar os anteriores). Só este mês remove só a ocorrência deste mês; disponível para qualquer recorrência (fixa ou a definir); a série continua normalmente no mês seguinte. A série completa descarta este mês e encerra a recorrência nele. A parcela de Passivo não tem a escolha.

**Parcelas de Passivo também aparecem nesta lista** 🟩, no mesmo formato — evita a pessoa checar lugares diferentes pra ver tudo pendente do mês. Diferença: o botão vira **"Editar juros"** e abre o fluxo de Registrar Reajuste de Juros, em vez de um campo de valor solto (o valor da parcela é calculado por amortização, não digitado pela pessoa).

Recorrências "a definir" sem valor preenchido aparecem com destaque visual (campo vazio/aviso).

---

## 7. Histórico

**Propósito:** 🟩 lista de lançamentos, filtrável, para conferência e edição.

**Filtros:** status (Previsto/Pago) · entidade (PF/PJ/consolidado) · mês · categoria · classificação · conta · recorrência. 🟦 (todos os campos do agregado Lançamento)

**Ações:**
- Botão **"+"** → abre Novo Lançamento vazio. 🟩
- Clicar em um item → abre Novo Lançamento **pré-preenchido** para edição completa, com o título **"Editar Lançamento"**. 🟩
- **Descartar** na linha (e no rodapé do modo de edição) → confirmação `34:34` ("Descartar "{nome}"?"), com "Encerrar a recorrência também" quando o lançamento é de uma série. Descartar o pagamento de uma ocorrência descarta aquele mês. Não abre a edição. (PRD v7.38, ADR-0019)
- Recorrente **Previsto** não aparece aqui: ele é a ocorrência do mês, na Revisão de Recorrentes, até ser pago (ADR-0019).
- 🟩 *2026-10-06, ADR-0021:* a despesa marcada "Cartão de crédito" mostra o ícone de cartão ao lado do nome, junto do de recorrente. O filtro de mês usa o "Contabilizar em" quando a despesa tem um.

---

## 8. Relatórios

**Propósito:** 🟦 telas de leitura, derivadas dos lançamentos — não fonte da verdade. *(Nota: o DRE deixou de ser só "Pagos" — ver 8.1 abaixo, agora tem toggle Pago/Previsto.)*

**Padrão comum aos 4 relatórios:** seletor de visão (Consolidado/PF/PJ), lembrando a última visão usada. 🟩

### 8.1 DRE
Cascata completa: Receita Bruta → Deduções → **Receita Líquida** → CSV → Despesas Administrativas → Despesas Pessoais → EBITDA → D&A (zero) → EBIT → Resultado Não Operacional → Resultado Financeiro → Impostos sobre o Lucro → **Lucro Líquido**. 🟩

**Correção de 2026-09-08 (P44), com a marcação trocada de 🟦 para 🟩 no mesmo ato:** o terceiro subtotal se chamava aqui "Lucro Bruto", mas o valor que ele carrega é Receita Bruta − Deduções, que na planilha de referência é a linha `(=) RECEITA LÍQUIDA` (fórmula `=C10-C16`, lida do arquivo). O Lucro Bruto da planilha é outra linha, `(=) LUCRO BRUTO` (`=C17-C26`), que desconta o CSV. **O produto fechou em 13 linhas de propósito** — a planilha tem dois subtotais a mais, Receita Líquida e EBT — então a compressão fica; o que estava errado era o nome que sobrou na linha. O Lucro Bruto de verdade continua calculado (`IncomeStatement.grossProfit`) e alimenta o indicador "Margem bruta", sem virar linha, porque indicador não exige linha.

A marcação era **🟦 (veio do PRD)** e não se sustentava: o PRD não define a cascata em lugar nenhum — não menciona "Lucro Bruto" nem "Receita Líquida", só a planilha que incorporou na v2. A ordem dos subtotais é decisão de design, e passa a estar marcada como tal.
Seletor de mês navegável, **agora também pra meses futuros** (antes só ← , ganhou →) — mês futuro mostra só lançamentos Previsto (gerados por recorrência/passivo), funcionando como projeção sem motor de simulação novo. 🟩
**Toggle "Pago / Previsto"** (abaixo do seletor de visão) controla a cascata inteira: "Pago" mostra o resultado calculado só com o que está confirmado como pago; **"Previsto" é a previsão completa do mês — o que já foi pago mais o que ainda está previsto** (dono, 2026-10-09: "quero minha previsão completa"; até então era só o previsto, e um mês meio pago mostrava só a metade que faltava). A lista de lançamentos de cada categoria segue a mesma regra. Em mês futuro, abre em "Previsto" por padrão. "Pago" nunca fica desativado (pode haver pagamento antecipado) — se não houver nada pago, mostra aviso em vez de travar. 🟩
**Botão "Ver previsão do mês" (PRD v7.40) 🟩 — REMOVIDO em 2026-10-01** a pedido do dono ("remove esse uma vez que já tem o Pago | Previsto"); o parâmetro `forecast` continua na API, sem controle na tela. *Como era:* ao lado do seletor de mês. Ligado, a cascata soma o pago e o previsto do mês, o toggle Pago/Previsto sai de cena (não se aplica) e uma linha explica: "Previsão do mês: o que já foi pago somado ao que ainda está previsto — como o mês deve fechar." Pago e Previsto seguem exclusivos quando o botão está desligado.

**Linha de bloco expansível (PRD v7.39, decisão do dono em 2026-09-23 — reverte, só para o TOTAL POR CATEGORIA, o "não embutida nos blocos" abaixo):** toda linha de bloco com movimento traz `icon/chevron-right` depois do nome; clicar abre uma sublinha por categoria do Plano de Contas com o total dela no mês (maior primeiro), e `icon/chevron-down` enquanto aberta. O que não tem categoria agrupa pelo tipo (Pró-labore, Distribuição de lucro, IR) ou pelo Passivo (parcelas, P6). A quebra obedece ao mesmo filtro Pago/Previsto e à mesma visão da cascata, e sempre soma a linha. Todas começam recolhidas; subtotal (=) e bloco zerado não têm seta. Os lançamentos um a um continuam só na planilha abaixo. 🟩

**Destinar o lucro só em Pago** 🟩 *2026-10-01:* o card "Destinar o lucro deste mês" (e o irmão "Sem lucro a destinar este mês") só aparece com a cascata em **Pago**. Em Previsto o lucro é projeção, e destinar projeção não faz sentido (dono). Durante a simulação do olhinho o bloco também some.

**Simulação "olhinho"** 🟩 *2026-10-01, pendente de design.* O olho fica **só na cascata**, nunca na tabela "Lançamentos deste mês" (correção do dono no mesmo dia). Ele aparece antes do nome de cada categoria de um bloco aberto e **na ponta direita** (depois do valor) de cada lançamento dentro de uma categoria aberta, e alterna entre "Ocultar do DRE" e "Mostrar no DRE". O que está oculto sai da cascata, dos subtotais e do Lucro Líquido, mas continua listado, esmaecido e riscado, para voltar. **Ocultar recalcula, nunca reordena:** as categorias de um bloco ficam na ordem do valor cheio, sem simulação (correção do dono). Quando há algo oculto, o **fim do card da cascata**, abaixo do Lucro Líquido e alinhado aos valores, mostra um texto discreto, "N ocultos · mostrar". O "mostrar" é um link que volta tudo. Sem nada oculto, não aparece nada. (Escolha do dono depois de três versões: um botão acima da cascata, que mexia a tela; um botão fixo na barra; e um texto no fim da barra.) A simulação vale só enquanto a pessoa está no DRE e não é gravada. Durante ela, "Destinar este Lucro" some, porque o lucro mostrado é hipotético.

**Entradas e saídas** 🟩 *2026-10-01, pendente de design:* a tabela "Lançamentos deste mês" se divide em dois grupos, **(+) Entradas** primeiro e **(−) Saídas** depois. Cada grupo tem um cabeçalho, e um grupo vazio não aparece. A direção é a do efeito no lucro na visão escolhida, a mesma regra da cascata: o pró-labore é entrada na PF e saída na PJ, e a parcela de Passivo é saída.

**Recorrência "a definir" em branco** 🟩 *2026-10-01:* o mês de uma série "a definir" que ainda não tem valor aparece em "Lançamentos deste mês", com **"A definir"** no lugar do valor e as mesmas ações (Confirmar — antes "Marcar Pago" —, Editar, Descartar). Não entra em nenhum número da cascata. Antes ficava de fora da lista, e a pessoa não via o que precisava preencher.

**Filtros "Recorrentes" e "Cartão"** 🟩 *2026-10-06, decisão do dono, ADR-0021, pendente de design:* dois botões liga/desliga na barra de controles, **à esquerda do seletor de mês** (dono, 2026-10-06). **Recalculam** a cascata e a tabela "Lançamentos deste mês" só com o que bate (os dois juntos exigem os dois); a parcela de Passivo sai com qualquer filtro. Com filtro e nada que bata, o card diz **"Nenhum lançamento com este filtro."** — e não o estado vazio de primeiro uso.

**"Exibir tudo" / "Recolher tudo"** 🟩 *2026-10-06, pendente de design:* botão secundário (contorno, seta para baixo; seta para cima em "Recolher tudo") no canto superior direito do card da cascata — o texto solto que veio antes "não parece um botão", e na barra de controles ficou longe do que abre ("melhor dentro", dono, 2026-10-06) — que abre (ou fecha) todos os blocos com movimento e todas as categorias deles. A lista de lançamentos de uma categoria mostra a **data do lançamento** — antes, "—" para tudo que não veio do banco — e os ícones de recorrente e de cartão.

**"Caixa do mês"** 🟩 *2026-10-09 (PRD v7.72); **desligado na tela desde a v7.74** ("ainda não tá como eu quero") — o que segue descreve o card guardado no código:* card abaixo da cascata, só no mês atual. Uma linha por Conta Bancária da visão (PF, PJ ou todas no Consolidado), com o olhinho que a tira do total enquanto a tela está aberta; depois "Saldo hoje", "(+) Ainda previsto" (entradas − saídas ainda Previstas no mês) e "(=) Saldo previsto no fim do mês". Legenda: "O saldo das contas hoje e o que ainda está previsto até o fim do mês. Fica fora da cascata: o DRE é resultado, o saldo é patrimônio." Abaixo, a seção **"Do início ao fim do mês"** (PRD v7.73): "Saldo no início do mês", "(+) Lucro Líquido do mês" (dica: "Previsão completa: o pago mais o previsto."), "(±) Fora do DRE" (dica: "O que mexeu no caixa e não é resultado: transferências, aportes, fatura do cartão, saldo editado à mão.") e "(=) Saldo previsto no fim do mês". Enquanto o extrato é lido: "Lendo o extrato do mês…"; se o banco não responder: "Não foi possível ler o extrato do mês agora; a ponte volta quando o banco responder."

**"Vincular ao banco"** 🟩 *2026-10-09 (PRD v7.70), pendente de design:* num lançamento feito à mão, "Lançamentos deste mês" (DRE), a linha do Histórico e o Editar Lançamento oferecem "Vincular ao banco". O diálogo lista as transações candidatas (descrição do banco, data, "No banco: …", valor; mesmo valor primeiro) e "Vincular" usa o valor e a data do banco, mantém categoria e descrição, e apaga o lançamento duplicado que a transação tinha criado. Sem candidatas, o diálogo diz por quê. Ligado, o Editar mostra "Vinculado a uma transação do banco." e o DRE passa a mostrar a descrição do banco na lista da categoria. No Histórico, toda linha abre a edição, Consumo Livre inclusive.

**"Destinar o lucro deste mês" só no Consolidado** 🟩 *2026-10-09 (PRD v7.69):* o botão "Destinar este Lucro" aparece só na visão Consolidado, porque a destinação é um valor único consolidado (PRD §5). Em PF ou PJ, o card diz "A destinação é do resultado consolidado, PF e PJ juntos. Mude a visão para Consolidado para destinar." Com "Recorrentes" ou "Cartão" ligado, o card some.

**"Confirmar" numa conta vinculada** 🟩 *2026-10-09, decisão do dono (PRD v7.68, emenda da ADR-0020):* aparece como em qualquer outra linha. Quando a transação do banco chega com o mesmo valor, até 5 dias depois, ela se liga ao lançamento confirmado em vez de criar outro. Os diálogos de confirmação mostram o motivo de uma recusa, em vez de "Tente novamente".

**Total da tabela e grupos recolhidos** 🟩 *2026-10-06, pendente de design:* "Lançamentos deste mês" abre com **(+) Entradas** e **(−) Saídas** fechados (dono: "ao invés de mostrar tudo, deixa a pessoa clicar para ver"). O cabeçalho de cada grupo é o botão que abre as linhas e traz a quantidade e o total do grupo na coluna Valor; a tabela termina com **"Saldo"** (entradas − saídas), sempre do que está visível. O card tem o próprio **"Exibir tudo" / "Recolher tudo"**, no canto superior direito, que abre ou fecha os dois grupos.

**"Confirmar" e "Desfazer"** 🟩 *2026-10-06, decisão do dono, pendente de design:* "Marcar Pago" passa a se chamar **"Confirmar"** aqui e na Revisão de Recorrentes ("receitas não são pagas"); o diálogo também. Uma linha Paga ou Recebida ganha **"Desfazer"**: volta a Previsto com a data e o valor do pagamento; num mês de série, reabre a ocorrência; tira a Pendência de "pago a menos" daquele lançamento. Não aparece no que veio do banco — o extrato é o fato (ADR-0020).

**Planilha "Lançamentos deste mês"**, sempre visível abaixo da cascata (não expansível, não embutida nos blocos): colunas Lançamento (com a Descrição abaixo do nome, quando houver, e o ícone `icon/repeat` "Recorrente" ao lado do nome quando vem de uma série — também no Histórico), Status, Valor, com ações **Confirmar / Editar / Descartar** por linha ("Confirmar" era "Marcar Pago" até 2026-10-06). 🟩 *2026-10-01, pendente de design:* a coluna Bloco saiu e o Descartar entrou (pedido do dono); numa recorrência, Editar abre o formulário da série e Descartar pergunta só este mês ou a série completa. Mostra sempre tudo (pago + previsto juntos), sem filtro próprio — o filtro vive só no toggle da cascata. 🟩
Botão **"Destinar este lucro"** ao final, dentro de um card (não solto) com explicação ao lado. 🟩
**Lucro Líquido negativo (prejuízo):** mesmo estilo neutro das outras linhas, sinal de menos, sem cor de alerta. O card "Destinar este Lucro" desaparece e vira mensagem informativa ("Sem lucro a destinar este mês") — não oferece alocação de algo que não existe. 🟩 O critério é **resultado ≤ 0**, não só negativo: a nota `242:14` do frame `242:2` escreve a razão ("não faz sentido oferecer alocação de algo que não existe"), e com Lucro Líquido zero não existe valor a alocar. A mensagem tem sempre **duas linhas** (`242:11`: título `242:12` + legenda `242:13`), como o card positivo (`239:23` + `239:24`); com zero a legenda perde só a sentença que nomeia o prejuízo. 🟩

### 8.2 Balanço Patrimonial
Foto do momento atual (não é série histórica): Ativo Circulante/Não Circulante, Passivo Circulante/Não Circulante, Patrimônio Líquido = Ativos − Passivos. 🟦

### 8.3 Evolução Mensal
*(nome anterior: "Painel" — renomeado por ser mais literal)* 🟩
Formato: gráfico em cima + tabela detalhada embaixo. Série histórica mês a mês. 🟦/🟩
**Toggle de intervalo:** "Últimos 6 meses" / "Último ano" — mostra só os meses com dado real desde que a pessoa começou a usar (sem preencher meses vazios). 🟩

### 8.4 Indicadores Financeiros
5 famílias: Rentabilidade · Liquidez · Endividamento · Crescimento Patrimonial · Qualidade de Vida Financeira. 🟦
**Seletor de mês navegável** (← mês →), mesmo padrão do DRE. 🟩

**Catálogo de indicadores por família** 🟩 (preenchendo lacuna do PRD, que definia só as famílias — formato de cada um e regras de caso degenerado no doc08, seção 10):
- **Rentabilidade:** Margem bruta, Margem EBITDA, Margem EBIT, Margem líquida, ROE, Taxa de poupança.
- **Endividamento:** Grau de endividamento, Endividamento sobre PL, Comprometimento da renda.
- **Qualidade de Vida Financeira:** Custo de vida mensal, Reserva de emergência, Cobertura por renda passiva, Consumo livre / FCL, Eficiência de aporte.
- **Crescimento Patrimonial:** Crescimento do PL (mês), Crescimento dos investimentos (mês).
- **Liquidez:** Liquidez corrente, Liquidez geral.

Sem faixa de referência (bom/ruim) em nenhum indicador — decisão registrada no doc08, seção 10: definir limiar é conteúdo financeiro, não renderização, e fica como sugestão pro time de produto (doc05), não decisão do design.

---

## 9. Destinar o Lucro

**Propósito:** 🟦 dividir o lucro líquido do mês entre 4 categorias.

**Entrada:** botão dentro do DRE, dentro de um card com explicação ao lado (não solto). 🟩
**Escopo:** valor único, **consolidado** — não separado por entidade (exceção deliberada à regra geral de "entidade como atributo"). 🟩

**Estrutura: 4 cards, cada um suportando múltiplos itens** 🟩 (não é mais 1 campo = 1 valor):
- **Aporte em Investimentos** — lista de itens (ex.: aportar em Tesouro Direto **e** Ações XP no mesmo card), cada um com Investimento (busca/cria) + Valor. Botão "+ Adicionar investimento".
- **Reinvestimento de Dividendos** — mesma estrutura de Aporte.
- **Consumo Extraordinário** — lista de itens, só nome + valor (sem campo de destino, é gasto).
- **Reserva em Caixa** — lista de itens, cada um com Conta (existente) + Valor. Botão "+ Adicionar conta".

Cada card mostra o subtotal (valor + % do lucro) no cabeçalho. Cada item também mostra sua própria % do lucro, ao lado do valor. Clicar em "+ Adicionar X" expande um mini-formulário inline dentro do próprio card (Investimento/Conta + Valor + Cancelar/Adicionar) — mesmo padrão de lista+adicionar já usado em Venda de Bem Material.

**Saldo não alocado** em destaque (com % do lucro) — atualiza em tempo real, não bloqueia salvar com saldo sobrando. 🟩
**Pós-salvamento:** volta ao DRE. 🟩

**Lucro Líquido negativo (prejuízo):** o card inteiro de Destinar o Lucro desaparece do DRE e vira uma mensagem informativa ("Sem lucro a destinar este mês", com o valor do prejuízo) — não oferece alocação de algo que não existe. Vale para **resultado ≤ 0** pelo critério escrito na nota `242:14` do frame `242:2`; com zero a mensagem mantém as duas linhas e imprime só "Não há valor pra investir, guardar ou distribuir." 🟩

*(Nota: "distribuição de lucro da PJ", o 5º item do bloco 10, não entra aqui — é registrada via a aba Pró-labore e Distribuição do Novo Lançamento.)*

---

## 10. Plano de Contas e Patrimônio

*(nome anterior: "Editar cadastros", depois "Editar Plano de Contas e Patrimônio" — "Editar" removido porque a seção passou a guardar informação de análise, não só edição)* 🟩

**Comportamento:** 🟩 5 telas dedicadas, sempre visíveis como sub-itens na barra lateral (não mais um wizard de onboarding) — **Plano de Contas, Contas Bancárias, Bens Materiais, Investimentos, Passivos**. Cada uma reaproveita o conteúdo já validado no onboarding (mesmos campos, mesma lista de itens), mas com chrome de tela normal (sidebar completa, sem stepper, sem botões "Voltar/Avançar" de wizard).

**Padrão visual das 4 telas de lista** (Contas Bancárias, Bens Materiais, Investimentos, Passivos): dois cards, mesmo estilo (borda, fundo branco, cantos arredondados) — card "Adicionar X" (formulário) em cima, card "X cadastrados" (lista de itens já cadastrados, com Editar/Descartar) embaixo. Títulos dos dois cards com o mesmo peso visual.

**Plano de Contas:** mostra os 10 blocos fixos do DRE, cada um expansível (clicar no nome do bloco abre as categorias dentro dele). Sem card de formulário — categoria nova é criada inline dentro do bloco, ou a partir do Novo Lançamento.

**Card "Open Finance" (novo em 2026-09-29, ADR-0020; redesenhado no mesmo dia após o primeiro uso real)** 🟩 *pendente de design — não existe no Figma.* Em Contas Bancárias (contas correntes e cartões) e em Investimentos, abaixo do card da lista. **Cabeçalho:** título, "Sincronizado hoje, 18:05." (ou "Ainda não sincronizado.") com o resultado da última sincronização manual, "Reimportar" (com confirmação: refaz os lançamentos vindos do banco com a configuração atual, e edições feitas à mão neles se perdem), o interruptor **"Sincronizar ao abrir o app"** (2026-10-01, ligado por padrão; desligado, o app para de ler o banco sozinho, e o que já foi importado e os vínculos ficam) e "Sincronizar agora", que funciona com o interruptor ligado ou desligado. **Corpo:** as contas **agrupadas por banco**, em ordem alfabética, e uma linha compacta por conta com tipo e final dos dígitos, o nome do produto em cinza, o saldo no banco e **um único seletor**. Numa conta sem vínculo, o seletor diz "Vincular a…" e lista os cadastros, "+ Criar conta nova (PF)" e "+ Criar conta nova (PJ)" (ou "investimento novo"). Numa conta vinculada, mostra o cadastro e oferece "Desvincular". O cartão lista "Paga por …" e não tem "Criar". **Clicar na conta expande** a lista dos movimentos do mês que o banco informa: data, descrição, categoria da Pluggy, o que virou no Bigorna ("Consumo Livre", "Compra no cartão", "Transferência", "Pagamento de fatura", "Pagou um Previsto", "Lançamento", "Fora do DRE" ou "Não importado") e valor, buscados só quando a linha abre. As contas **sem vínculo e com saldo zero ficam recolhidas** atrás de "Mostrar N conta(s) zerada(s) sem vínculo". Várias contas do banco podem apontar para o mesmo cadastro, que recebe a soma dos saldos. Sem credenciais, o card explica o que falta configurar.



**Novo Lançamento — Descrição e rodapé (PRD v7.47/v7.48, 2026-09-29)** 🟩 *pendente de design; diverge de `877:1104`.* A **Descrição** é o primeiro campo, logo abaixo das abas, e vale para todas. O rodapé tem "Cancelar" e **um botão de salvar só**, "Salvar Lançamento". Na linha da legenda, a opção **"Lançar outro em seguida"** (Switch, desligada por padrão; 2026-10-01, no lugar do botão "Salvar e lançar outro"): desligada, salvar fecha; ligada, salvar limpa o formulário e o mantém aberto, com "Lançamento salvo com sucesso." como aviso, e a opção continua ligada para o próximo. Não aparece na edição. Na edição, "Descartar" vem antes de "Cancelar", na mesma linha. Quando falta um campo obrigatório, um resumo junto dos botões diz qual.

**Lançamentos a categorizar (PRD v7.46)** 🟩 *pendente de design.* O que vem do Open Finance chega em "A categorizar" (despesa ou receita). **Na Home**, uma Pendência por mês, "N lançamentos a categorizar", com a legenda "Vindos do banco em <mês>" e "Categorizar agora", que abre um diálogo com a lista: data, descrição real do banco, categoria da Pluggy ("No banco: …"), seletor de categoria e valor. **No DRE**, cada categoria de um bloco aberto também abre (terceiro nível) e mostra os lançamentos dela: data, descrição, marcas Recorrente/Cartão, valor e **"Editar"**. Desde 2026-10-06 não há seletor de categoria na linha do DRE (dono: "melhor a pessoa editar para escolher, ao invés de mostrar aqui"): o "Editar" abre o formulário do lançamento, onde a categoria se troca. O seletor na linha continua só no diálogo "Categorizar agora". Um lançamento feito à mão aparece como "<descrição ou categoria> · lançado à mão".

---

## 11. Vender Bem Material

**Propósito:** 🟦 registrar a venda de um bem, calcular ganho/perda, e decidir o destino do dinheiro recebido.

**Entrada:** ação na lista de Bens Materiais, ao lado de Editar/Descartar. 🟩

**Modal:** valor de venda + data + Ganho/Perda calculado automaticamente (venda − valor registrado, lançado em Resultado Não Operacional). 🟦/🟩

**Direcionamento do valor, com múltiplos destinos:** 🟩 resumo sempre visível ("Direcionado: R$ X de R$ Y · Restante: R$ Z"), lista dos direcionamentos já adicionados (Editar/Remover cada um), botão "+ Adicionar Direcionamento" que abre a escolha de tipo — **Investimento** (busca/cria + valor), **Passivo** (busca/cria + valor, ex.: amortização extraordinária), ou **Receita** (abre o formulário de Receita já existente, valor pré-preenchido). Se sobrar valor não direcionado, vira uma **Pendência** na Home, com botão "Direcionar agora".

Ao confirmar: remove o bem da lista de Bens Materiais.

---

## 12. Detalhe do Passivo (análise de dívida)

**Propósito:** 🟩 acompanhar a evolução de uma dívida específica ao longo do tempo, não só o cadastro inicial.

**Entrada:** botão "Analisar" na lista de Passivos (ao lado de Descartar). 🟩

**4 cards, mesmo padrão visual (borda, fundo branco, título):**
- **Informações da Dívida** — Valor original, Saldo devedor atual, Taxa de juros atual, Parcelas (pagas/total), lado a lado. **"Saldo devedor atual" é o principal em aberto** — o valor presente das parcelas ainda Previstas descontadas à taxa vigente —, nunca a soma nominal delas: no frame (Wireframe `91:2`, card `338:2`, linha `91:44`) o nó `91:50` lê "R$ 178.400,00" ao lado do `91:47` "Valor original R$ 320.000,00", com 348 parcelas de R$ 1.520,00 (`91:104`) por pagar; a soma nominal daria R$ 528.960,00, maior que o valor original, e o valor presente à taxa de cadastro 0,80% a.m. (`91:145`) dá R$ 178.128,97. É o mesmo número da coluna "Saldo devedor" da lista de Passivos (`40:2` nó `90:67`) e da linha do Balanço. 🟩
- **Evolução da Dívida** — gráfico do saldo devedor caindo ao longo do tempo, calculado automaticamente por amortização, recalculado a cada reajuste de juros registrado. A série é a mesma grandeza do card: começa no **valor original** e cai até zero — no frame, a barra Ago/25 (`91:63`) tem 120px e a de Jul/26 tem 67,2px, razão 0,560 contra 178.400/320.000 = 0,5575. 🟩
- **Parcelas** — lista no mesmo padrão de Revisão de Recorrentes (data prevista, valor previsto, status, ação "Marcar Paga"/"Editar juros").
- **Histórico de eventos (rastreabilidade)** — log cronológico: cadastro da dívida, cada reajuste de juros, cada parcela paga (com divergência se houver).

**Ações no cabeçalho, mesmo peso visual** (nenhuma é "mais importante" que a outra): "Editar dados cadastrais" e "Registrar reajuste de juros" (abre modal: nova taxa + data de validade, com legenda de aviso sobre o recálculo).

---

## 13. Onde Está Meu Dinheiro / Despesas por Categoria — detalhe de bloco

**Propósito:** 🟩 ver o que compõe o número de um bloco do treemap, sem sair da Home.

**Onde Está Meu Dinheiro (clicar num bloco):** mostra a composição do valor (ex.: Investimentos = Tesouro Direto + Ações XP) + bloco "Redirecionar valor" ("Para onde" busca qualquer outro bloco do mapa + Valor + Redirecionar).

**Despesas por Categoria (clicar num bloco):** mostra os lançamentos do mês naquela categoria (nome, entidade, status, valor) + formulário rápido de adicionar gasto (categoria e conta pré-preenchidas, só Valor e Data).

**Entradas e Saídas (clicar numa linha da tabela):** mostra os lançamentos que compõem aquele valor — **só consulta, sem ação de mover** (diferente dos dois acima, que permitem redirecionar/editar). Pra mover dinheiro, a pessoa usa Onde Está Meu Dinheiro. *(Antes o clique era num bloco do diagrama Sankey; a tela de destino, "Desktop — Detalhe do Fluxo", continua a mesma, só muda o gatilho.)*

---

## 14. Organizar Home

**Propósito:** 🟩 deixar a pessoa reordenar e ocultar cards da Home, de acordo com o que é mais importante pra ela.

**Entrada:** botão "Organizar Home", ao lado da saudação. 🟩

**Modo de organização:** cada card ganha um **handle de arrastar** (ícone de 6 pontinhos) pra reordenar, e um botão **"Minimizar"**. O conteúdo de cada card fica visualmente desativado (opacidade reduzida), sinalizando que só arrastar/minimizar funcionam nesse modo — evita clique acidental em botões normais do card. Botão "Concluir" (preenchido, peso visual maior que os outros) sai do modo.

**Card minimizado colapsa no próprio lugar** (não vai pra uma lista separada) — vira uma linha fina (título + legenda + "Maximizar"). Fora do modo de organização, esse "Maximizar" continua sempre ativo (sem opacidade reduzida, sem handle de arrastar) — a pessoa restaura o card a qualquer momento, sem precisar reabrir o modo de organização.

---

## 15. Estados vazio e carregando

**Propósito:** 🟩 cobrir o que a pessoa vê antes de ter qualquer dado (conta recém-criada) e durante o carregamento — necessário pra prototipagem e teste de usabilidade, não só pros mockups com dado de exemplo.

**Estado vazio:** título curto + mensagem de 1-2 linhas explicando o que vai aparecer ali + botão de ação quando fizer sentido levar a pessoa direto pra resolver (ex.: "+ Novo Lançamento", "Cadastrar agora"). Sem botão quando não há ação imediata (ex.: Evolução Mensal, que só populua com o tempo).

**Estado carregando:** blocos cinza (esqueleto) do mesmo formato do conteúdo real, sem texto.

**Cobertura:** Home (todos os cards juntos, já que é o que uma conta nova mostra de verdade), DRE, Balanço Patrimonial, Evolução Mensal, Indicadores Financeiros, Revisão de Recorrentes, Histórico, Plano de Contas, Contas Bancárias, Bens Materiais, Investimentos, Passivos, Onboarding (telas de "adicionar item" sem os exemplos pré-preenchidos). Consumo Livre não precisou de estado vazio novo — o Estado A "Configurar" já cobre esse caso.

---
