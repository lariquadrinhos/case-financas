# 08 — Regras de Renderização de Dados

> Endereçado a quem vai implementar. O doc 07 diz **como as coisas se parecem**; este diz **como o desenho é calculado** quando o layout nasce do dado e não da mão de alguém.

---

## Por que este documento existe

Um mockup de gráfico é **um quadro de um filme**. Ele prova que as regras ficam boas com aqueles números específicos. Não diz nada sobre o que acontece quando a pessoa tem doze categorias em vez de seis, uma só, ou nenhuma.

Sempre que o layout é gerado a partir de dado, a entrega de design deixa de ser uma imagem e vira **um conjunto de regras**. É isso que está aqui.

**Regra zero:** se você abrir a tela e o resultado não bater com o Figma, confira este documento antes de assumir que errou. Os mockups da página **Style guide** foram desenhados com os mesmos algoritmos descritos aqui, alimentados com os dados de exemplo que estão em cada seção. Se as regras forem seguidas, bate.

---

## 1. Números e moeda

- Localidade **pt-BR**: ponto separa milhar, vírgula separa decimal.
- Prefixo `R$` com **um espaço** antes do número: `R$ 22.400,00`.
- **Centavos sempre**, inclusive quando são zero.
- **Exceção única: dentro de marca de gráfico.** Rótulo em cima de barra, valor dentro de bloco de treemap e rótulo de eixo omitem centavos, porque ali o número é para comparar grandeza, não para conferir. Um valor em tabela, mesmo ao lado do gráfico, mantém os centavos.
- Negativo usa o sinal `−` (menos tipográfico) antes do `R$`, e **nunca parênteses nem cor**.
- Todo número em coluna usa **figuras tabulares** (`font-variant-numeric: tabular-nums`) e alinhamento à direita.

---

## 2. Treemap

Usado em **Despesas por Categoria** e nas duas faixas de **Onde Está Meu Dinheiro**.

### 2.1 Algoritmo

**Squarified treemap**, não o algoritmo ingênuo de fatiar em linhas. Com `d3-hierarchy`:

```
d3.treemap()
  .tile(d3.treemapSquarify)   // é o padrão da biblioteca
  .size([largura, altura])
  .paddingInner(2)
  .round(true)
```

O squarify busca deixar cada bloco o mais próximo possível de um quadrado. Isso não é estética: retângulo comprido e fino é difícil de comparar por área e não cabe rótulo.

> **Atenção:** o algoritmo ingênuo (fatiar em fileiras) dá um desenho bem diferente e igualmente "proporcional ao valor". Se o resultado não parecer o do Figma, confira o `tile` antes de qualquer outra coisa.

### 2.2 Ordenação

**Decrescente por valor.** A ordem define duas coisas: a posição do bloco e qual passo da rampa ele recebe. Nunca ordenar por nome, por data de criação, nem manter a ordem que o backend devolveu.

### 2.3 Contêiner

| Uso | Largura | Altura |
|---|---|---|
| Despesas por Categoria | acompanha o card | fixa, 210px |
| Onde Está Meu Dinheiro, faixa de ativos | acompanha o card | fixa, 150px |
| Onde Está Meu Dinheiro, faixa de dívidas | **proporcional** (ver abaixo) | fixa, 60px |

A faixa de dívidas usa a **mesma escala de largura** da faixa de ativos:

```
largura_dividas = largura_ativos * (total_dividas / total_ativos)
```

limitada a no máximo a largura da faixa de ativos. Quando as dívidas passam dos ativos, a faixa ocupa a largura toda e o rodapé mostra Patrimônio Líquido negativo.

E nunca abaixo de **120px** (ver §2.11): proporcional, mas legível.

### 2.4 Folga, contorno e arredondamento

- **2px entre blocos vizinhos** (`paddingInner(2)`). Não há folga na borda externa do contêiner.
- **Todo bloco tem contorno de 1px em `color/border/control`, por dentro** (`strokeAlign: inside`, ou `box-sizing: border-box` no CSS). Isso é obrigatório: o passo mais claro da rampa tem só 1,5 de contraste contra o card branco e sumiria sem o contorno, levando junto a folga de 2px.
- Calcule em ponto flutuante e **arredonde só no fim**. A sobra de arredondamento vai para o **último bloco de cada fileira**, para que ele encoste na borda.
- Cantos: `4px` em todos os blocos.

### 2.5 A rampa

Os tokens `color/chart/ramp-1` a `color/chart/ramp-6` (doc 07). São **seis tons claros**, usados na ordem no modo claro e na ordem inversa no modo escuro — em ambos, o maior é o de maior contraste contra a superfície.

O elemento recebe o passo pela **posição no ranking**, e os passos se **espalham pela rampa inteira**, não pelos primeiros N:

```
passo(i) = arredondar(1 + i * 5 / (N - 1))     // i de 0 a N-1
passo(0) = 1                                    // quando N = 1
```

Exemplos: N=6 → 1,2,3,4,5,6 · N=5 → 1,2,4,5,6 · N=3 → 1,4,6 · N=2 → 1,6

**Por quê:** usar os N primeiros passos deixaria dois ou três elementos quase da mesma cor quando há poucas categorias. Espalhar mantém o contraste entre vizinhos em qualquer quantidade.

**Esta fórmula vale para todo elemento que recebe a rampa por ranking** — hoje, só o bloco de treemap. A fita de Sankey e a barra de cascata do DRE, que também usavam essa rampa, foram removidas numa revisão posterior (ver seções 4 e 5 abaixo); a fórmula continua documentada aqui porque volta a valer se algum gráfico novo precisar de cor por ranking.

**Cor do texto:** `color/text/on-block` em todos os seis passos, nos dois modos, sem exceção. É o único token do sistema com o mesmo valor nos dois modos, e existe justamente por isso: os blocos são claros no claro e no escuro.

**Cuidado:** isso vale só para bloco **preenchido** com a rampa. Bloco vazado (dívida) tem o fundo do card, que muda entre os modos, e usa `color/text/primary` e `color/text/secondary` normais.

### 2.6 Rótulo dentro do bloco

O bloco mostra, nesta ordem de sacrifício — nome e valor alinhados no **topo** do bloco (recuo de 10px, mesma altura da seta), nunca centralizados na vertical (Figma, frame 5-2, `Faixa - Ativos`):

| Condição | O que aparece |
|---|---|
| padrão | nome na primeira linha, valor na segunda |
| largura < 120px | some a seta |
| altura < 56px | some o valor, fica só o nome |
| largura < 64px **ou** altura < 32px | nada, bloco liso |

**Ícone `↗`, regra única com o ícone de card (🟩 revisão):** ancorado no **canto superior direito do bloco** — mesmo recuo de 12px/10px usado pro nome, nunca colado ao fim do texto do nome. É a mesma regra geométrica do ícone de card clicável (doc07, componente Card): a posição é sempre a mesma, só o contêiner muda de tamanho (bloco ou card inteiro). **Corrige a versão anterior desta regra**, que colocava a seta logo depois do nome, na mesma linha — em blocos largos (ex.: "Casa" ocupando quase a fileira inteira) isso fazia a seta aparecer perto do nome e longe da borda real do bloco, uma posição diferente da usada no ícone de card. Nome e ícone agora ocupam posições independentes: o nome corta com reticências antes de encostar no ícone, nunca empurra a posição dele.

Recuo interno: 12px nas laterais e 10px em cima e embaixo; cai para 10px lateral quando o bloco é estreito e 8px vertical quando tem menos de 70px de altura.

O nome **nunca quebra em duas linhas** dentro do bloco: se não couber, corta com reticências.

### 2.7 Limite de blocos

**Seis blocos visíveis por faixa.** A partir do sétimo, todos os excedentes somam num bloco chamado **"Outras"**, que entra no ranking pelo valor somado como qualquer outro. Clicar em "Outras" abre a lista completa.

### 2.8 Casos degenerados

| Situação | Comportamento |
|---|---|
| nenhum item | estado vazio do card (doc 02), sem desenhar contêiner |
| um item só | ocupa o contêiner inteiro, passo 1 da rampa |
| valor zero | **não entra** no treemap; aparece só na lista do detalhe |
| valor abaixo de R$ 0,50 🟩 | **tratado como zero.** O bloco omite centavos (§1), então escreveria "R$ 0" — e o piso do §2.10 ainda lhe daria 6,5% da área. Medido em 2026-09-23: uma conta com R$ 0,03 saía do tamanho de uma de R$ 2.128 |
| valor negativo | não existe neste contexto; se vier, é erro de dado e deve ser reportado, não desenhado |
| soma zero | tratar como "nenhum item" |

### 2.9 Interação

O **bloco inteiro é o alvo de clique**, não a seta. A seta é pista visual, e some em bloco estreito justamente porque não é ela que recebe o toque.

**Hover 🟩:** o bloco inteiro reage ao passar o mouse, sinalizando que é clicável — sem informação nova, só destaque visual. Dois ajustes simultâneos, aplicados a *qualquer* bloco (preenchido com a rampa ou vazado, dívida): sobreposição de **8% preto** (`multiply`, opacidade 0,08) por cima do bloco inteiro, e o contorno passa de `color/border/control` para `color/border/strong`. O overlay preto funciona igual nos dois modos porque escurece a cor que já está ali, seja qual for o passo da rampa — não é um token novo, é uma operação sobre o que já existe. Cursor: `pointer`.

**Sem tooltip no hover, de propósito.** A informação do bloco (nome, valor) já aparece em texto dentro dele quando cabe (regra 2.6); quando não cabe, o caminho é abrir o **detalhe do bloco** (clique, doc 01 seção 13), não duplicar a informação num tooltip por cima.

**Foco (teclado) 🟩:** o bloco inteiro é o alvo, igual o clique. Anel de 2px em `color/border/focus`, por fora (`strokeAlign: outside`), substituindo o contorno normal de `color/border/control` enquanto o foco estiver ali — mesmo mecanismo usado no anel de foco do Botão e dos demais componentes (doc07). Sem sombreado nem sobreposição adicional; só o anel.

**Mesmo princípio, um nível acima 🟩:** quando o *card inteiro* (não um bloco dentro dele) é clicável, ele usa o ícone equivalente no cabeçalho em vez de dentro de cada bloco — ver "Ícone de card clicável" no doc07, seção Biblioteca de componentes. As duas regras podem coexistir no mesmo card quando ele tem **duas ações diferentes e não conflitantes**: os blocos abrem o detalhe daquele valor específico, e o card (ícone no cabeçalho) abre uma visão mais ampla do mesmo dado. **Despesas por Categoria** é esse caso — ver doc01, seção 4. **Onde Está Meu Dinheiro** não: lá o card em si não navega pra lugar nenhum, só os blocos, então não leva o ícone de cabeçalho.

---

### 2.10 Piso de área 🟩

**Todo bloco recebe no mínimo 6,5% da área do contêiner**, seja qual for o valor dele. A diferença
sai de quem está acima do piso, proporcionalmente.

**Nasceu de um teste com pessoa real, em 2026-09-11.** Alguém com R$ 200.000 em investimentos e
~R$ 2.000 espalhado no resto tinha 99,01% do dinheiro num bloco só. Na faixa de ativos (1018×150), o
algoritmo puro devolvia:

| bloco | fatia | tamanho |
|---|---|---|
| Investimentos | 99,01% | 1007×150 |
| Nubank | 0,59% | **9×89** |
| Itaú PJ | 0,25% | **9×35** |
| Bradesco | 0,15% | **9×22** |

Nove pixels de largura: **inclicável** — a WCAG 2.5.8 pede alvo de 24×24 — e ainda **cego**, porque a
escada de sacrifício do §2.6 esconde o rótulo abaixo de 64 de largura. Três lascas em branco.

**Por que 6,5%:** é o piso que devolve ~66 de largura nesse caso, ou seja, passa dos 64 e o bloco
volta a mostrar o nome. Um piso menor (2,5%) daria os 25 que a WCAG pede e deixaria o bloco cego — a
pessoa veria que há algo ali sem saber o quê, o que resolve metade do problema.

**Só piso, sem teto.** Um teto só morde quando há poucos blocos, e aí ele mente feio: com dois
blocos de 95% e 5% reais, um teto de 70% desenharia 70/30, e a pessoa veria um terço do dinheiro
fora do investimento. O limite do maior bloco existe, mas nasce da soma dos pisos — nunca de um
número inventado: com 4 blocos o maior não passa de 76%, com 2 não passa de 93,5%.

**O piso mexe na ÁREA, nunca no valor.** O bloco continua escrevendo o número verdadeiro; é ele que
carrega o fato quando a área deixa de carregar. Trocar o valor faria o card mentir por escrito, que é
pior do que mentir por tamanho.

**Onde não age:** dados equilibrados. Com 40/30/20/10 o desenho é idêntico ao de antes da regra — o
piso só existe onde há distorção. Com seis blocos no máximo (§2.7) ele nunca é impossível: 6 × 6,5%
dá 39% do contêiner.

### 2.11 Largura mínima da faixa de dívidas 🟩

**A faixa de dívidas nunca fica mais estreita que 120px**, mesmo quando a proporção do §2.3 dá
menos. Numa tela mais estreita que isso, ocupa a largura disponível.

**Medido em 2026-09-23:** dívida de 2,4% dos ativos, numa faixa de 1046px, dava **25px** de largura.
Abaixo de 64, a escada do §2.6 esconde tudo, e "O que você deve" mostrava uma caixa vazia: o mesmo
bloco cego que o §2.10 corrigiu na área, agora na largura.

**Por que 120px:** é onde o §2.6 mostra nome, valor e seta — com a altura fixa de 60px, o valor
também cabe. É o mesmo raciocínio do §2.10: um piso que só torna o bloco clicável, sem dizer o quê,
resolve metade do problema.

**A proporção continua valendo acima do piso**, e o valor escrito continua o verdadeiro: o piso mexe
na largura, nunca no número.

## 3. Barras agrupadas

Usado em **Evolução Mensal**.

### 3.1 Eixo vertical

**Quatro linhas: o zero e três passos.** O passo sai do conjunto `{1; 2; 2,5; 5} × 10ⁿ` — o menor valor do conjunto que satisfaça:

```
passo * 3 >= maior_valor * 1,05
topo = passo * 3
```

A folga de 5% impede que a barra mais alta encoste no topo.

Exemplo com os dados do mockup: maior valor 6.300 → alvo 6.615 → passo 2.500 → topo 7.500, linhas em 0, 2.500, 5.000 e 7.500.

O eixo **sempre começa em zero**. Cortar a base de um gráfico de barras exagera diferença e é falseamento, não estilo.

### 3.2 Barras

- Largura fixa de 34px, **2px de folga** entre as duas barras do mesmo mês.
- Espaçamento entre grupos: a largura útil dividida pelo número de meses; cada par fica centralizado no seu quinhão.
- Cantos superiores 4px, cantos inferiores retos, ancorados na linha de base.
- Cor pela entidade, sempre: `color/chart/pf` e `color/chart/pj`.

### 3.3 Rótulos

- Valor em cima da barra **só no período mais recente**, sem centavos.
- Nome do mês embaixo, centralizado no grupo; o mês mais recente usa `color/text/primary` e os demais `color/text/secondary`.
- Rótulo de eixo à esquerda, alinhado à direita numa coluna de 60px, alinhado verticalmente ao centro da sua linha de grade.

### 3.4 Casos degenerados

| Situação | Comportamento |
|---|---|
| um mês só | desenha o grupo único centralizado |
| todos os valores zero | estado vazio com a mensagem do doc 02, sem eixo |
| um valor negativo (prejuízo no mês) | o eixo estende abaixo de zero com a mesma regra de passo, e a linha do zero passa a ser interna, em `color/border/strong` |
| menos meses do que o intervalo pedido | mostra só os meses com dado real, sem preencher vazios |

### 3.5 Interação

**Hover 🟩:** passar o mouse sobre a área de um mês (as duas barras, PF e PJ, mais o espaço entre elas) ativa esse mês inteiro: as duas barras recebem a mesma sobreposição de **8% preto** (`multiply`) usada no treemap (seção 2.9), e um **tooltip** aparece acima do grupo, ancorado no topo da barra mais alta daquele mês, com:

- Nome do mês (mesmo texto do rótulo do eixo)
- **PF:** valor exato, com centavos, etiqueta na cor `color/chart/pf`
- **PJ:** valor exato, com centavos, etiqueta na cor `color/chart/pj`

Estilo do tooltip: fundo `color/bg/card`, contorno `color/border/default`, raio `scale/radius/control`, sem sombra (regra 1 do doc07 — o sistema não usa sombra em lugar nenhum), seta de 6px apontando pra baixo, centralizada no grupo. Texto em `label.xs`/`body.sm`, números tabulares.

**Sem cursor `pointer`.** As barras mostram informação ao passar o mouse, mas não são clicáveis — diferente do bloco de treemap. Pra qualquer ação sobre um mês, a pessoa usa a linha correspondente na tabela detalhada abaixo do gráfico (regra 9 do doc07).

### 3.6 Variante de série única: Evolução da Dívida (Detalhe do Passivo) 🟩

Mesmo sistema de eixo e barra das seções 3.1-3.2, adaptado pra **série única** (uma barra por ponto, não um par PF/PJ) — a barra mostra o saldo devedor calculado por amortização, não uma comparação de entidade.

**Amostragem, pra dívidas com muitas parcelas:**
- **Até 12 parcelas:** uma barra por parcela real, sem amostragem — mesma lógica da regra 3.4 ("menos meses do que o pedido, mostra só o que existe").
- **Mais de 12 parcelas:** 12 pontos amostrados por índice igualmente espaçado entre a parcela 1 e a parcela N: `índice(i) = arredondar(1 + i × (N−1) / 11)`, pra i de 0 a 11.
- **Âncora obrigatória, "hoje":** a parcela atual (parcelas pagas + 1; ou a última, se a dívida já estiver quitada) sempre vira uma das 12 barras. A fórmula acima já ancora a primeira (`i=0` → parcela 1) e a última (`i=11` → parcela N) nas pontas — essas duas nunca são substituídas, é o começo e o fim da dívida, perder qualquer uma tira a leitura da história inteira. Se "hoje" não coincidir com nenhum índice amostrado, ela substitui o índice **interno** (nunca o primeiro nem o último) mais próximo dela — mesmo que isso deixe o espaçamento entre barras levemente desigual perto de onde a substituição aconteceu. Mostrar onde a dívida está agora importa mais que a regularidade visual do espaçamento.

**Eixo vertical:** mesma fórmula da seção 3.1 (zero + 3 passos do conjunto `{1; 2; 2,5; 5} × 10ⁿ`, 5% de folga acima do maior valor), com o maior valor da série (tipicamente a parcela mais antiga mostrada, a #1) definindo o passo. Eixo sempre começa em zero, mesma regra.

**Barras:** mesma geometria da seção 3.2 (largura fixa, cantos superiores arredondados em `scale/radius/control`, base reta ancorada na linha de zero) — sem o par e sem a folga de 2px entre duas barras do mesmo grupo (não há par aqui, é série única); espaçamento entre barras = largura útil dividida pelo número de pontos amostrados, vinculado a `scale/space/8`. **Saldo positivo mas visualmente menor que 3px na escala usa 3px como altura mínima** — mesmo critério de visibilidade mínima já usado no Sankey que a v7 descartou (doc02) e no treemap, pra uma parcela quase quitada não desaparecer.

**Cor: nunca `color/chart/negative`.** Dívida não é erro — mesmo princípio já registrado no doc07, regra 21 (bloco vazado, não vermelho, no treemap "Onde Está Meu Dinheiro": "não julga, um financiamento não é um erro"). Usa `color/chart/series-1`, o token genérico já reservado pra série única sem distinção de entidade.

**Rótulo:** valor em cima da barra, **sem centavos**, só na barra que representa "hoje" — mesma regra 3.3 ("só o período mais recente"), com "mais recente" reinterpretado como a posição atual da dívida, não necessariamente a última barra da série (que normalmente é o pagamento final, saldo zero, no futuro). Nome do mês/ano embaixo de cada barra, mesmo padrão de rótulo de eixo; a barra de "hoje" usa `color/text/primary`, as demais `color/text/secondary`. Valor com centavos só aparece no tooltip de hover, nunca no rótulo sempre visível — mesma distinção já feita na seção 3.3 vs. 3.5.

**Casos degenerados, além dos 4 já cobertos na seção 3.4:**

| Situação | Comportamento |
|---|---|
| dívida recém-cadastrada (0 parcelas pagas) | "hoje" = parcela 1, coincide com a primeira barra amostrada, sem precisar de substituição de índice |
| dívida já quitada (parcelas pagas = total) | "hoje" = última parcela, saldo zero — o rótulo de valor fica na barra final, não na primeira |
| reajuste de juros registrado no meio da série | não muda amostragem nem eixo — os valores exibidos já vêm recalculados pelo motor de amortização (doc03), o gráfico só desenha o que recebe |

**Interação:** mesma regra da seção 3.5 (hover ativa a barra com overlay de 8% preto/`multiply`, tooltip acima, mesmo estilo de card sem sombra), com o conteúdo do tooltip adaptado pra 1 valor em vez de 2: nome do mês/ano + saldo devedor exato (com centavos) + status da parcela naquele ponto (Prevista/Paga). Sem cursor `pointer` — ação sobre uma parcela específica usa a lista "Parcelas" abaixo do gráfico (regra 9 do doc07).

---

## 4. Tabela da cascata do DRE, sem barra

**Revisão 🟩:** a cascata do DRE teve uma barra proporcional de grandeza relativa numa coluna entre o nome e o valor (8px de altura, escala pelo maior valor, mínimo de 3px). Foi removida numa revisão posterior — decisão de simplificação visual, ver doc02. A cascata hoje é só a tabela: operador (`+`/`−`/`=`) em coluna de largura fixa, nome, valor tabular à direita, com as linhas de resultado (subtotal e Lucro Líquido) em peso maior que as linhas de movimento. Nenhum elemento gráfico além do texto.

A coluna de valor continua precisando de **largura fixa**. Isso não é sobre a barra que saiu, é sobre o texto: sem largura fixa, o comprimento do número muda linha a linha e a coluna inteira perde alinhamento à direita.

---

## 5. Entradas e Saídas (antigo Mapa de Fluxo)

**Revisão 🟩:** esta tela tinha um diagrama Sankey de três colunas (fontes → hub → destinos, versão simplificada pedida no doc 01). Foi removido numa revisão posterior: mesmo seguindo a regra à risca (fita como dado, nó como âncora, escala honesta, mínimo de 3px, rampa por ranking, sem cruzamento), o resultado não lia como um fluxo rastreável, porque o hub agregava tudo antes de redistribuir e escondia qual fonte foi pra qual destino. Ver doc02 pra o histórico da decisão e doc07, seção "Tabela pura, sem reforço visual extra", regras 24-26.

O que sobrou é só a tabela, que já era obrigatória antes (regra 9 do doc07, versão acessível de qualquer gráfico) e agora é o conteúdo inteiro da tela, não um complemento.

### 5.1 Tabela

Duas colunas, **Entradas** e **Saídas**, cada uma com cabeçalho, nome e valor exato à direita, número tabular. A linha "Sobrou" fecha a coluna de Saídas em peso maior, mesmo padrão de linha de resultado usado na cascata do DRE.

### 5.2 Casos degenerados

| Situação | Comportamento |
|---|---|
| nenhuma entrada e nenhuma saída | estado vazio do card |
| só entradas, sem saídas | mostra as entradas normalmente e uma linha única "Sobrou" com o total em Saídas |
| entradas ≠ saídas | **não deve acontecer**: o total é fechado por construção, tudo que entrou foi para algum destino, e o que não foi gasto é "Sobrou". Se as somas divergirem, é erro de dado e deve ser reportado |
| muitas entradas ou saídas | agrupar o excedente em "Outros", mesmo critério do treemap, pra tabela não crescer sem limite |

---

## 6. Estados que todo gráfico precisa ter

- **Vazio:** título curto, mensagem de uma ou duas linhas, e botão de ação só quando existe uma ação imediata que resolve. Ver doc 01, seção 15.

- **Carregando:** blocos do mesmo formato do conteúdo real, na mesma posição.

  **Atenção, isto mudou junto com a rampa clara.** "Bloco claro" deixou de ser suficiente para dizer carregando, porque agora o dado também é claro. O esqueleto se diferencia por **três coisas ao mesmo tempo, e nenhuma delas é claridade**:

  | | Esqueleto | Dado |
  |---|---|---|
  | cor | cinza neutro, sem o azul da rampa | rampa `color/chart/ramp-*` |
  | contorno | nenhum | 1px `color/border/control` |
  | texto | nenhum | nome + valor |

  Bloco claro com contorno e rótulo é dado; bloco claro liso, sem borda e sem texto, é carregando.

  Não existe mockup deste estado, e isso é deliberado: a regra é curta, o vocabulário de esqueleto já está definido no doc 02 e aplicado em doze telas, e desenhar aqui seria replicação, não verificação. **Se em uso alguém relatar que o carregando parece tela vazia ou quebrada, aí sim vale desenhar.**

- **Erro de dado:** não desenhar gráfico parcial. Mensagem no lugar do gráfico, e a tabela abaixo continua disponível quando os dados dela vieram.

---

## 7. O que ainda não tem regra escrita

- **Equivalente de toque pra camada de interação, caso o produto ganhe uma versão mobile no futuro.** As regras de hover das seções 2.9 e 3.5 cobrem só Desktop (mouse) — coerente com a decisão de plataforma prioritária ser desktop (doc02). *Correção 🟩:* uma versão anterior deste documento dizia que "o app tem uma página Mobile no Figma" — não tem; o arquivo Figma tem cinco páginas (Capa, Wireframe, Mockup, Style guide, Tokens), nenhuma delas Mobile. O que existe é uma referência, no doc02, a um modelo de Home/hub "usado no mobile" numa decisão anterior à etapa de wireframe atual — não é uma página deste arquivo. Se um dia existir uma versão mobile de verdade, o que substitui "passar o mouse" em touch (um toque já mostra o tooltip? precisa de um segundo toque pra abrir o detalhe?) ainda não foi decidido.

---

## 8. Saudação da Home 🟩

**Dinâmica por horário do dispositivo**, não um texto fixo: "Bom dia" / "Boa tarde" / "Boa noite".

| Faixa | Texto |
|---|---|
| 05:00–11:59 | Bom dia |
| 12:00–17:59 | Boa tarde |
| 18:00–04:59 | Boa noite |

Sem nome da pessoa (o produto ainda não guarda esse dado — ver doc02 se/quando isso for decidido) e **sem emoji ou ícone**, consistente com a regra de estilo já registrada no doc02 ("sem emoji decorativo nos mockups"). Tipografia: `heading.xl` (Geist SemiBold, 24/30) — igual ao resto dos títulos de seção da Home, corrigindo um resquício de fonte (`Inter Bold`) que tinha sobrado do wireframe original.

O mockup na página **Mockup** mostra "Boa tarde" como exemplo estático — qualquer faixa serviria, essa foi só a escolhida pra ilustrar.

---

## 9. Cards da Home 🟩

Três cards da Home renderizam a partir de dado e ainda não tinham regra formal — só decisões narrativas soltas no doc02. Esta seção formaliza os três, no mesmo espírito das seções de gráfico acima.

### 9.1 Pendências

Cada um dos 4 tipos já definidos no doc02 (valor sem destino aguardando direcionamento, recorrência sem valor definido, lucro do mês não distribuído, divergência paga a menos) gera **um card por ocorrência** — não um total agregado por tipo. Duas divergências de recorrências diferentes geram dois cards, por exemplo.

- **Ordenação:** mais antiga primeiro (data de criação da pendência), mesmo critério cronológico do Eventos Recentes (seção 9.3) — pendência parada há mais tempo aparece primeiro.
- **Quantos cabem na fileira:** os cards dividem a largura disponível em partes iguais, com largura mínima de ~245px (o valor usado no mockup de hoje, com 4 cards). **A partir do momento em que não cabem mais na largura mínima, a fileira quebra pra uma segunda linha** — não existe "ver todas" nem corte, porque pendência é, por definição, uma lista curta (itens somem da lista assim que resolvidos).
- **Conteúdo de cada card:** valor formatado (regra da seção 1) + descrição curta do motivo + botão de ação, com o rótulo do botão variando por tipo (mapeamento já em doc02: Direcionar agora / Revisar agora / Alocar agora / Pagar).
- **0 pendências:** estado vazio já desenhado (tela "Vazio — Pendências", doc02).

### 9.2 Saldo para Consumo Livre

- **Barra de progresso:** largura preenchida = `mín(gasto ÷ limite, 100%)` do track.
- **Gasto ultrapassa o limite:** a barra **preenche 100% do track e para aí** (não estoura visualmente pra fora do contêiner). O texto `R$ gasto / R$ limite` continua mostrando o valor real gasto, que pode ser maior que o limite. **Sem cor de alerta** — a barra continua no mesmo preto neutro de sempre, consistente com o princípio já registrado no doc07/doc02 de não usar vermelho/laranja pra sinalizar estouro de orçamento.
- **Texto auxiliar** ("Saindo da conta X · reabastece dia N") sempre visível, independente do estado da barra.
- **Primeira vez (sem valor mensal configurado):** não é este card — é o Estado A "Configurar", já desenhado (doc02, "Consumo Livre expandida para 3 estados").

### 9.3 Eventos Recentes

- **Mostra só os últimos 5 eventos** (reajustes, divergências, parcelas confirmadas), já era uma decisão registrada no doc02 — aqui formalizada como regra de renderização.
- **Ordenação:** mais recente primeiro (decrescente por data).
- **Menos de 5 eventos:** mostra quantos existirem, sem preencher linhas vazias nem placeholder.
- **0 eventos:** estado vazio já desenhado (tela "Vazio — Eventos Recentes", doc02).
- **Texto de cada linha:** data (`dd/mm/aaaa`) + descrição automática do evento — o formato exato da descrição varia por tipo de evento e já está exemplificado linha a linha no mockup (não há um template único, cada tipo de evento tem sua frase própria).

---

## 10. Indicadores Financeiros 🟩

O PRD define só as **5 famílias** (🟦): Rentabilidade, Endividamento, Qualidade de Vida Financeira, Crescimento Patrimonial, Liquidez. O indicador individual dentro de cada família, e o formato de cada um, não estava especificado em lugar nenhum — o mockup já tinha um catálogo completo desenhado, esta seção só formaliza o que já existia como regra, define o que faltava (formato por tipo, casos degenerados) e fecha a pendência de "faixas de referência" com uma decisão explícita.

**Catálogo (🟩, preenchendo lacuna do PRD):**

| Família | Indicador | Formato | Exemplo |
|---|---|---|---|
| Rentabilidade | Margem bruta | percentual, 1 casa | 87,5% |
| Rentabilidade | Margem EBITDA | percentual, 1 casa | 57,6% |
| Rentabilidade | Margem EBIT | percentual, 1 casa | 57,6% |
| Rentabilidade | Margem líquida | percentual, 1 casa | 46,4% |
| Rentabilidade | ROE | percentual, 1 casa | 4,1% |
| Rentabilidade | Taxa de poupança | percentual, 1 casa | 29,8% |
| Endividamento | Grau de endividamento | percentual, 1 casa | 41,6% |
| Endividamento | Endividamento sobre PL | percentual, 1 casa | 71,3% |
| Endividamento | Comprometimento da renda | percentual, 1 casa | 23,2% |
| Qualidade de Vida Financeira | Custo de vida mensal | moeda (seção 1) | R$ 5.500,00 |
| Qualidade de Vida Financeira | Reserva de emergência | número + " meses", 1 casa | 4,2 meses |
| Qualidade de Vida Financeira | Cobertura por renda passiva | percentual, 1 casa | 12,8% |
| Qualidade de Vida Financeira | Consumo livre / FCL | percentual, 1 casa | 18,4% |
| Qualidade de Vida Financeira | Eficiência de aporte | percentual, 1 casa | 62,0% |
| Crescimento Patrimonial | Crescimento do PL (mês) | percentual com sinal, 1 casa | +1,5% |
| Crescimento Patrimonial | Crescimento dos investimentos (mês) | percentual com sinal, 1 casa | +2,1% |
| Liquidez | Liquidez corrente | razão, 1 casa, sem unidade | 7,0 |
| Liquidez | Liquidez geral | razão, 1 casa, sem unidade | 2,4 |

**Layout:** cada família é um card (mixin Card do doc07 — fundo, contorno, raio), nome da família como título, uma linha por indicador (nome à esquerda em `body.md`/`text/primary`, valor à direita em `numeric.md`, mesma largura de coluna de valor pra todo indicador da tela). Duas colunas de cards lado a lado — agrupamento pensado pra equilibrar a altura total das duas colunas, não por ordem alfabética nem por importância relativa das famílias.

**Formato por tipo:**
- **Percentual:** `X,X%`, 1 casa decimal, vírgula (convenção pt-BR do doc08 seção 1). Sem a exceção de arredondar pra 0 casas que vale dentro de marca de gráfico (seção 1) — aqui o número é pra conferir, não só comparar grandeza a distância.
- **Percentual com sinal**, só na família Crescimento Patrimonial: `+X,X%` ou `−X,X%` (menos tipográfico), sinal sempre visível mesmo no positivo — única família onde a direção da variação importa mais que o valor absoluto, por isso foge da convenção geral (que só marca o negativo).
- **Razão/índice**, só na família Liquidez: número puro, 1 casa decimal, sem `%` nem sufixo — `7,0`, nunca `7,0x` nem `700%`. Convenção padrão de índice de liquidez contábil (ativo circulante ÷ passivo circulante, por exemplo).
- **Moeda:** regra da seção 1, sem exceção — com centavos, `R$` com espaço.
- **Meses**, só em Reserva de emergência: número, 1 casa decimal, sufixo `" meses"` com espaço — `4,2 meses`.

**Cor: nunca semântica, sempre `color/text/primary`.** Nem o valor de Crescimento Patrimonial (que pode ser negativo) nem nenhum outro indicador ganha verde/vermelho — mesmo princípio já aplicado em Consumo Livre (seção 9.2) e na dívida do treemap/gráfico de barras: o número já diz o que precisa, cor de julgamento não é vocabulário deste sistema.

**Faixas de referência: decidido em 2026-09-11 — não entram, e o que entra no lugar é a ajuda.** Definir o que é "bom" ou "ruim" pra cada indicador (liquidez corrente ideal acima de quanto? reserva de emergência ideal de quantos meses?) é decisão de conteúdo financeiro, não de renderização — nenhum limiar desses está no PRD nem no modelo de domínio. E há um impedimento que não é de preferência: **vários dos 18 não têm referência universal possível.** "Custo de vida mensal" é um valor em reais; "Crescimento do PL (mês)" e "Crescimento dos investimentos (mês)" dependem da fase de vida de quem lê. Faixa em uns e não em outros criaria a pergunta "por que esse não tem?", pior que a ausência uniforme.

**A regra de renderização que nasceu dessa decisão:** cada linha de indicador traz, **entre o rótulo e o valor**, o "i" de ajuda do Style guide (`icon/info`, 20×20, o mesmo `InfoTooltip` do Novo Lançamento), com uma frase que diz **o que o número é** — a fórmula em português. Nunca se ele é bom. O nome acessível do botão é `Ajuda sobre <rótulo do indicador>`, e a frase mora na definição do domínio (`INDICATOR_DEFINITIONS`, campo `help`), não no HTTP: é conteúdo estático derivado da chave, não dado do mês.

Exemplo, literal: `Liquidez corrente ⓘ 7,0x` → _"Quantas vezes o que você tem disponível cobre o que você deve no curto prazo."_

**Casos degenerados:**

| Situação | Comportamento |
|---|---|
| divisão por zero (ex.: Liquidez corrente quando Passivo Circulante = 0) | mostra `—` (travessão, `color/text/tertiary`) no lugar do valor, nunca `∞` nem `NaN` |
| indicador sem dado suficiente pro cálculo (ex.: conta nova, sem histórico pra Reserva de emergência) | se só 1-2 indicadores dependem de um histórico que ainda não existe, mostram `—` individualmente e o resto da tela funciona normal; se a tela inteira não tem dado, é o estado vazio (doc02), não indicador por indicador |
| mês futuro (projeção, mesma navegação `← →` do DRE) | indicadores recalculados com base em lançamentos "Previsto" — mesma lógica de projeção já usada no DRE e em Entradas e Saídas (doc02), sem marcação visual adicional além da legenda que o seletor de mês já mostra |
