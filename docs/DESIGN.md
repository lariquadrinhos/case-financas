# Design System

> **Este documento foi reescrito do zero.** A versão anterior descrevia um sistema **medido à
> mão**: quando ela foi escrita, o time de design tinha entregue só o Wireframe cinza e um punhado
> de variáveis no Figma, e todo o resto — o preto do botão primário, o fundo da página, a rampa do
> treemap, a escala tipográfica — foi amostrado dos frames e registrado como `[derived]`.
>
> Aquele sistema está **superado**. O `files_design/07-style-guide.md` chegou depois, fechado, com
> 38 tokens de cor nomeados, a coleção **Escala**, a tipografia Geist, onze componentes com
> estados e a hierarquia de significado de cor. Ele é a fonte da verdade agora. A troca está
> registrada em **[ADR-0015](adr/0015-o-style-guide-substitui-a-medicao-empirica-de-tokens.md)**,
> que substitui ADR-0011 §1 e §2 e mantém §3, §4 e §5.
>
> Ordem de precedência, quando duas fontes discordam:
>
> 1. `files_design/07-style-guide.md` — fundações, tokens, componentes, ícones
> 2. `files_design/08-regras-de-renderizacao-de-dados.md` — como cada dado aparece na tela
> 3. `docs/figma/frames/*.xml` — a árvore literal dos 130 frames, com todo o texto
> 4. `src/styles/tokens.css` — a implementação
> 5. este documento
>
> Se o código discordar do doc07, **o código está errado**. É o inverso da regra anterior.

---

## 1. Princípio único

**Preto e cinza constroem, azul dá estado, cor significa.** (doc07, "Princípio único")

Referência de direção: calmo, sem cor, editorial. O que essa referência não resolvia — e este
sistema resolve — é que o produto é PF **e** PJ, e precisa de cor com significado sem virar
papagaio.

### A hierarquia de cor, seis papéis

Nunca dois no mesmo peso na mesma tela.

| Papel                              | Onde aparece                                                              | Nunca                                                          |
| ---------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Preto** `color/bg/inverse`       | Ação primária: `+ Novo Lançamento`, `Destinar este Lucro`                 | Decoração, fundo de seção                                      |
| **Azul** `color/text/state`        | Estado: item ativo, segmento selecionado, link, ação em linha, foco       | Nunca significa "bom" nem "ruim", nunca é botão primário       |
| **PF / PJ**                        | Etiqueta ao lado do lançamento; em gráfico sobe pra `color/chart/pf`/`pj` | Nunca preenche a linha inteira, nunca compete com o número     |
| **Verde** `color/text/positive`    | Só onde tamanho e peso não dão conta: variação, indicador, barra          | Nunca em receita individual, e **nunca no Lucro Líquido**      |
| **Vermelho** `color/text/negative` | Só variação negativa e atraso. Exceção única: `color/border/negative`     | **Prejuízo no DRE continua neutro.** **Dívida não é vermelha** |
| **Âmbar** `color/text/alert`       | Só pendência: status Previsto, recorrência a definir                      | Nunca em informação passiva                                    |

**Consequência prática, que é o teste mais rápido de aderência:** um lançamento de despesa no
Histórico é **preto**, com o operador `−` à esquerda — não vermelho. Se todo negativo fosse
vermelho, a tela sangraria e o vermelho perderia valor exatamente onde importa.

Por que PF é ciano e PJ é índigo (e não teal/violeta, nem dois tons de azul): teal encostava no
verde, que já significa resultado positivo; dois tons do mesmo matiz codificam **ordem**, e PF e
PJ são pares, não ranqueados. O raciocínio completo está no doc07.

## 2. As 11 regras de densidade

O produto é denso (DRE, Balanço, Histórico). Densidade aqui vem de **ritmo e alinhamento**, nunca
de acrescentar borda, cor, ícone e negrito.

1. **Grade de 4**, e altura de linha de tabela fixa em 44px (`--height-table-row`).
2. **Número à direita, sempre, com figuras tabulares.** Coluna de valor desalinhada é o que mais
   faz tabela financeira parecer amadora.
3. **Uma divisória fininha só**, e só onde separa significado. Sem zebrado, sem borda por célula.
4. **Cabeçalho de tabela em caixa alta pequena e cinza** (`label.xs`), não em negrito preto.
5. **Um peso de fonte pra estrutura** (Medium) e o resto Regular. Hierarquia por tamanho e cinza.
6. **Ícone só quando substitui palavra**, nunca acompanhando uma.
7. **Card nunca dentro de card.** O nível de dentro vira seção com título e divisória.
8. **Operador em coluna de largura fixa** na cascata, pra todos os nomes alinharem no mesmo x.
9. **Valor zero em cinza terciário.** O que não aconteceu não precisa do peso do que aconteceu.
10. **Sem sombra.** Separação por borda no claro, por claridade no escuro.
11. **Um canal por mensagem.** Se tamanho, peso e régua já marcam a linha, cor não entra. É por
    isso que o Lucro Líquido não é verde, e por isso o treemap não repete a porcentagem ao lado
    do valor — a área **é** a porcentagem.

## 3. Tokens

Fonte única: [`src/styles/tokens.css`](../src/styles/tokens.css).

**Nenhum componente pode conter hex ou px literal.** Auditado por `./tools/audit.sh tokens`
(alvo `make audit-tokens`, dentro de `make check` e do CI). Se você precisa de um valor que não
existe como token, **o token é que está faltando**.

### 3.1 Cor — 38 tokens canônicos, claro e escuro

Vêm **literalmente** da tabela "Tokens" do doc07, gerada da coleção de variáveis **Cor** do
Figma. O nome no Figma usa barra (`color/bg/canvas`, porque o Figma não aceita ponto); a custom
property troca a barra por traço (`--color-bg-canvas`). O mapeamento é mecânico nos dois sentidos,
de propósito.

| Grupo                  | Tokens                                                                                                                       | Papel                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `--color-bg-*` (10)    | `canvas` `card` `subtle` `inverse` `state-subtle` `positive-subtle` `negative-subtle` `alert-subtle` `pf-subtle` `pj-subtle` | superfícies e os fundos de croma baixo das etiquetas          |
| `--color-border-*` (5) | `default` `control` `strong` `focus` `negative`                                                                              | `default` é divisória, `control` é borda de elemento clicável |
| `--color-text-*` (11)  | `primary` `secondary` `tertiary` `inverse` `on-block` `state` `positive` `negative` `alert` `pf` `pj`                        | os seis papéis da §1, aplicados a texto                       |
| `--color-chart-*` (12) | `pf` `pj` `series-1` `positive` `negative` `neutral` `ramp-1..6`                                                             | sistema de gráfico                                            |

Três fatos do doc07 que é fácil implementar errado:

- **A rampa tem seis passos, e a ordem inverte no escuro.** No claro `ramp-1` é o mais escuro; no
  escuro `ramp-1` é o mais claro. Os dois blocos de tema em `tokens.css` já trazem a ordem certa.
- **`--color-text-on-block` é o único token idêntico nos dois modos** (`#12161A`), porque os
  blocos da rampa são claros nos dois.
- **Cor de gráfico segue a entidade, nunca a posição.** PF é sempre `chart/pf`, PJ é sempre
  `chart/pj`. Trocar o filtro nunca repinta quem sobrou.

O par PF/PJ que passa no contraste do claro **reprovou** no escuro e precisou de matizes
diferentes — está registrado no doc07 e é a prova concreta de que o escuro não é o claro
invertido.

### 3.2 Escala — a coleção fechada

`--space-4·8·12·16·24·32·40`, `--height-table-row` (44), `--height-control` (32),
`--radius-control` (6), `--radius-card` (10), `--radius-pill` (999), `--stroke-hairline` (1).

`--height-control` (32) é a altura do **Botão de ícone**, e não a de "todo controle": no Style
guide os símbolos `532:467/532:470/532:473` medem 32×32 (doc07 §292, "Contêiner de 32×32"),
enquanto os 12 símbolos de **Botão** (`458:2` … `458:24`, frame 458:26) medem 72×44 sem exceção e
o **Controle segmentado** (`460:30`, `460:35`, `460:40`, `460:47`) mede 38. Ler o nome
`scale/height/control` como "a altura de qualquer controle" foi exatamente o erro que deixou todo
botão do produto 12 abaixo do desenho — ver `--height-button` em 3.3.

`--space-20` e `--space-48` estão marcados `[derived]`: não são variáveis nomeadas do Figma, mas
são múltiplos da grade de 4 (densidade #1) e são o padding interno de card e a margem lateral da
página.

### 3.3 `[derived]` — o que sobrou da marca, e o que ela significa agora

A distinção `[figma]` / `[derived]` da ADR-0011 **acabou para cor**: os 38 são canônicos, e um
39º exige mudar o doc07 primeiro.

`[derived]` sobrevive só para **medida de layout** — largura da sidebar (272px), largura máxima do
conteúdo (1066px), largura do diálogo, altura da faixa do gráfico, largura mínima do card de
Pendências. São fatos de tela específicos, fora da coleção **Escala**, que nenhuma variável do
Figma governa. Cada um tem a origem escrita no comentário, com o node do frame quando veio de lá.

### 3.4 O que deliberadamente **não** é token

Três coisas visuais ficam fora do sistema, por decisão do próprio doc07 — registradas em
`tokens.css` como bloco de referência, para que ninguém "conserte" a ausência delas:

1. **O scrim dos modais** (`--scrim-overlay`, `rgb(0 0 0 / 0.45)`) — "um escurecedor de fundo não
   muda de cor com o tema".
2. **As 6 cores de banco** do seletor "Cor" de Contas Bancárias — cor de marca de **terceiro**,
   não do produto. `bankAccountColourSchema` guarda o slug, nunca o hex.
3. **Movimento** — o doc07 não trata de movimento. `--duration-fast` (120ms) para hover e mudança
   de estado, `--duration-normal` (200ms) para entrada de overlay, `--easing-default` para tudo.
   Ambos viram `0ms` sob `prefers-reduced-motion`. Não há animação de conteúdo: um número que muda
   sozinho na tela de alguém conferindo o próprio dinheiro é ruído, não deleite.

### 3.5 A ponte para o Tailwind

[`src/styles/globals.css`](../src/styles/globals.css) mapeia cada token em `@theme inline`.

Três famílias de utilitário existem para que a classe se leia como o **papel** que cumpre,
enquanto a variável por baixo mantém o nome exato do doc07:

| Utilitário          | Variável do doc07      |
| ------------------- | ---------------------- |
| `bg-surface-card`   | `--color-bg-card`      |
| `text-ink-primary`  | `--color-text-primary` |
| `border-line-focus` | `--color-border-focus` |

`chart-*` não precisa dessa indireção: cor de gráfico só é cor de gráfico.

> [!IMPORTANT]
> A escala de espaçamento do Tailwind foi **substituída por pixels**: `p-20` é 20px, não os 5rem
> do padrão. É deliberado — o desenho é especificado em pixels, e uma segunda conversão mental é
> onde a fidelidade se perde. `gap-8` é 8px.

Um efeito colateral conhecido dessa ponte: um utilitário que aponta para um token **inexistente**
não gera CSS nem erro — a classe simplesmente some. O `audit tokens` não pega isso, porque ele
procura valor literal, não nome inválido. Foi assim que `bg-surface-page` e `bg-surface-sidebar`,
restos da nomenclatura da ADR-0011, sobreviveram invisíveis até esta rodada de fechamento (ver
§9).

### 3.6 Tema — três estados, não dois

`system` é o padrão e segue o sistema operacional, que é o que espera quem nunca toca no
controle. Escolher claro ou escuro grava `data-theme` em `<html>`, e o CSS é escrito de forma que
a escolha explícita sempre ganhe da preferência do sistema
(`:root:not([data-theme='light'])` dentro do `@media`).

A paleta escura aparece duplicada em `tokens.css` — uma vez no `@media`, uma vez no
`[data-theme='dark']`. CSS não tem mixin; a duplicação é deliberada e está comentada, em vez de
escondida atrás de um passo de build.

O script que aplica o tema antes da primeira pintura roda inline **com nonce da CSP**
(`src/middleware.ts`). Sem ele a página pinta clara e depois vira, o que é pior que não ter
alternador. O controle é o **Alternador de tema**, fixo na barra lateral — o único elemento hoje
compartilhado por todas as telas.

## 4. Tipografia

**Uma família só: Geist.** Geist Mono aparece apenas nos códigos do Plano de Contas.

**Geist é self-hosted, e isso não é preferência.** A CSP deste projeto tem `font-src 'self'`
(ADR-0009 §2): `fonts.googleapis.com` e qualquer CDN são bloqueados. A implementação usa o pacote
npm **`geist`** (da própria Vercel, arquivos locais) via `next/font`, montado uma vez no
`RootLayout`. As variáveis `--font-geist-sans` / `--font-geist-mono` alimentam `--font-sans` /
`--font-mono` em `tokens.css`; a pilha de sistema fica só no fallback, e só aparece enquanto a
variável não resolveu.

Os 10 estilos nomeados do doc07 viram uma classe cada, em `@layer components`:

| Estilo              | Classe                   | Tamanho / entrelinha  | Uso                                     |
| ------------------- | ------------------------ | --------------------- | --------------------------------------- |
| `heading.xl`        | `.text-style-heading-xl` | 24 / 30, SemiBold     | Nome da tela                            |
| `heading.sm`        | `.text-style-heading-sm` | 15 / 20, SemiBold     | Título de card, linha de resultado      |
| `body.md`           | `.text-style-body-md`    | 14 / 20, Regular      | Texto, nome de linha, item de navegação |
| `body.md-medium`    | `+ font-medium`          | 14 / 20, Medium       | Ênfase estrutural, botão, subtotal      |
| `body.sm`           | `.text-style-body-sm`    | 13 / 18, Regular      | Explicação, dado secundário             |
| `label.xs`          | `.text-style-label-xs`   | 11 / 14, Medium, alta | Cabeçalho de coluna, etiqueta, eixo     |
| `numeric.md`        | `.text-style-numeric-md` | 14 / 20, tabular      | Valor em coluna                         |
| `numeric.md-medium` | `+ font-medium`          | 14 / 20, tabular      | Valor de subtotal, valor em bloco       |
| `numeric.lg`        | `.text-style-numeric-lg` | 20 / 26, SemiBold     | Valor único em destaque                 |
| `code.sm`           | `.text-style-code-sm`    | 12 / 16, Geist Mono   | Código do Plano de Contas               |

**Peso não entra em `body-md` e `numeric-md` de propósito.** A variante `-medium` é a mesma caixa,
mais pesada, então é o `font-medium` do próprio Tailwind por cima. Isso só funciona porque o bloco
está em `@layer components`, que a camada `utilities` sempre vence — independente da ordem no
arquivo.

**Figuras tabulares** não são outra fonte: é a Geist com `font-variant-numeric: tabular-nums`
ligado. Sem isso, o "1" ocupa quase metade da largura do "0" e a coluna de valores desalinha.

## 5. Anatomia e foco

O shell é `sidebar fixa + área de conteúdo`, em
[`src/app/(app)/layout.tsx`](<../src/app/(app)/layout.tsx>).

| Medida                     | Token                 | Valor  |
| -------------------------- | --------------------- | ------ |
| Largura da sidebar         | `--width-sidebar`     | 272px  |
| Largura máxima do conteúdo | `--width-content-max` | 1066px |
| Recuo lateral do conteúdo  | `--space-48`          | 48px   |
| Recuo superior do conteúdo | `--space-40`          | 40px   |
| Altura de controle         | `--height-control`    | 32px   |
| Altura de campo            | `--height-field`      | 40px   |
| Altura de botão            | `--height-button`     | 44px   |
| Altura de linha de tabela  | `--height-table-row`  | 44px   |

`--height-button` não é a coleção Escala reaproveitada: é a altura desenhada do componente
**Botão**, medida nos 12 símbolos `458:2` … `458:24` do Style guide (todos 72×44) e confirmada no
Mockup (CTA da barra lateral `936:1550`, 240×44; rodapé do Onboarding 1, `988:2080`, `988:2083` e
`988:2085`). Ela substitui `--height-action` (43px), que vinha do Wireframe `26:28` — onde todo
controle é o mesmo traço cinza de altura uniforme e portanto nada decide sobre altura de
componente (ADR-0015 §1). `--height-field` (40px) continua sendo a **Caixa** do Campo (símbolo
`460:3` → frame `460:5`, 240×40) e nunca a altura de um botão: quando os dois ficam na mesma
linha, o par alinha pela base (`items-end`), com as duas alturas que o desenho dá.

A sidebar não colapsa: o desenho é desktop-first (frame de 1440px, altura nunca menor que 900) e o
PRD diz "web responsivo" sem especificar mobile — decidir o comportamento mobile sem desenho seria
inventar.

### Foco

**Mecanismo único em todo o sistema:** anel de 2px em `--color-border-focus`, **por fora** do
elemento, sem mudar o tamanho da caixa. É exatamente o que o `outline` do CSS faz — nunca
participa do layout, mesmo com `outline-offset`. Está em `:focus-visible` na camada base, e
`--focus-ring` / `--focus-offset` / `--focus-color` são os tokens.

O doc07 auditou a cobertura e nomeou o **alvo** de cada componente, que é o que costuma sair
errado:

| Elemento            | O que recebe o anel                                        |
| ------------------- | ---------------------------------------------------------- |
| Card                | o card inteiro — **só quando é clicável**                  |
| Linha de tabela     | a linha inteira, onde a linha tem ação própria             |
| Controle segmentado | o **segmento** individual, não o trilho                    |
| Alternador de tema  | o **botão de ícone** individual (sol ou lua), não o trilho |
| Linha expansível    | o cabeçalho inteiro, que é o que expande                   |
| Bloco de treemap    | o bloco inteiro, mesmo alvo do clique (doc08 §2.9)         |
| Ícone isolado       | resolvido pelo componente **Botão de ícone**, 32×32        |

Regra que vem junto: **nunca `<div onClick>` no lugar de um elemento focável de verdade**, e todo
campo tem rótulo. Foco visível nunca é removido (WCAG 2.4.7).

## 6. Componentes

`src/components/ui/` — primitivos, quase todos sobre Radix. Estrutura e acessibilidade vieram da
fase anterior e continuam corretas; o que mudou nesta rodada foi o **estilo**, retematizado nos
tokens do doc07.

| Componente                | Papel                                         | Nota                                                                                                                                   |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                  | Primário, Secundário, Texto                   | Primário é `bg/inverse` cheio; Secundário é contorno `border/control`; Texto não tem fundo. Desabilitado é opacidade 40%, não cor nova |
| `Card` + partes           | a unidade de layout de toda tela              | Hover e Foco **só** quando o card inteiro é clicável. Card clicável ganha `↗` de 18×18 no canto do cabeçalho                           |
| `Input`, `Label`, `Field` | formulário                                    | `Field` amarra `htmlFor`, `aria-describedby`, `aria-invalid`, `aria-required`. Erro troca o contorno para `border/negative`            |
| `Dialog`                  | todo frame "modal sobre X"                    | Radix: foco preso, Esc fecha, resto da página escondido do leitor. Suporta overlay empilhado                                           |
| `Tabs`                    | as 4 abas de Novo Lançamento                  | navegação por seta, como o padrão WAI-ARIA exige                                                                                       |
| `Table`                   | Histórico, planilha do DRE, Parcelas, Eventos | `<table>` de verdade; coluna de valor tabular e à direita                                                                              |
| `Badge`                   | Etiqueta: PF, PJ, Previsto, Pago              | quatro tipos, não dois eixos — nunca coexistem. Não é clicável, nunca vira botão disfarçado                                            |
| `Switch`                  | Toggle                                        | Ligado usa `text/state` — é "ativado", não "sim = bom"                                                                                 |
| `Select`, `Tooltip`       | escolha em lista, ajuda contextual            |                                                                                                                                        |
| `Skeleton`                | barra do estado carregando                    | `aria-hidden`; o anúncio é do `Loading`                                                                                                |

`src/components/patterns/` — composições próprias do produto (30 arquivos). As que carregam regra,
e não só forma:

| Componente               | Papel                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `MoneyInput`             | máscara ativa de moeda. Sempre inicia em `R$ 0,00`; dígito entra pela direita; caret preso no fim. Entrega `Cents`, nunca float |
| `Treemap`                | SVG/CSS próprio, algoritmo squarify do doc08 §2, rampa por **posto**, teto de 6 blocos com "Outras" a partir do 7º              |
| `MonthlyTrendChart`      | barras agrupadas do doc08 §3, com a tabela do mesmo dado embaixo                                                                |
| `SegmentedControl`       | 2 ou 3 opções mutuamente exclusivas, sempre uma ativa. Mais de 3 vira lista, não segmento                                       |
| `AccordionRow`           | Linha expansível. Nunca esconder campo obrigatório dentro de uma recolhida                                                      |
| `OnboardingProgress`     | as 5 pílulas do wizard. **Não** é barra de percentual — o Consumo Livre usa a própria                                           |
| `ThemeToggle`            | Alternador de tema, componente de propósito único                                                                               |
| `Sidebar`                | dois grupos recolhíveis (Relatórios expandido, Plano de Contas e Patrimônio recolhido) + itens raiz                             |
| `Empty` + `EMPTY_STATES` | 17 estados vazios, com a cópia extraída **literal** dos frames e o node de origem em cada entrada                               |
| `Loading`, `ErrorState`  | carregando e erro de dado                                                                                                       |
| `SearchCreateField`      | o padrão "buscar e criar" que se repete em várias telas por decisão de design                                                   |

**Ícones:** 16 componentes de 20×20, traço de 1,5px arredondado, `currentColor`, SVG inline. Nunca
redimensionar uma instância de ícone — se precisa parecer menor, o ajuste é no espaçamento.

## 7. Gráfico e formato de dado

Não há biblioteca de gráfico. O treemap e as barras agrupadas são SVG/CSS próprio, seguindo o
algoritmo do doc08. As regras que governam os dois:

1. Cor segue a **entidade**, nunca a posição.
2. Nunca dois eixos y.
3. Sequencial é um matiz só; divergente é dois matizes com cinza no meio. Nunca arco-íris.
4. Grade recessiva: linha em `border/default`, base em `border/strong`, rótulo em `label.xs`
   terciário.
5. Legenda sempre presente com 2 séries ou mais, nenhuma com uma só.
6. **Toda tela de gráfico tem a tabela do mesmo dado embaixo.** A tabela é a versão acessível do
   gráfico.

### Formato de número — doc08 §1, e é regra, não capricho

- Localidade **pt-BR**: ponto no milhar, vírgula no decimal.
- `R$` com **um espaço**: `R$ 22.400,00`.
- **Centavos sempre**, inclusive zero.
- **Exceção única: dentro de marca de gráfico.** Rótulo em cima de barra, valor dentro de bloco de
  treemap e rótulo de eixo omitem centavos — ali o número é pra comparar grandeza, não pra
  conferir. Um valor em tabela **ao lado** do gráfico mantém os centavos.
  Implementação: `formatMoneyNoCents` em `src/lib/format.ts`.
- Negativo usa `−` (menos tipográfico) antes do `R$`, e **nunca parênteses nem cor**.
- Todo número em coluna é tabular e alinhado à direita.

`formatMoney`, `formatDate`, `formatMonth` e `formatPercent` moram em `@/domain/core`, porque
formato de exibição de dinheiro é regra de domínio, não detalhe de tela.

### Casos degenerados

Também são regra. Divisão por zero nos Indicadores Financeiros mostra **travessão**, nunca `NaN`
nem `0%` — checado antes de qualquer ramo de unidade em
[`src/lib/indicator-format.ts`](../src/lib/indicator-format.ts). Percentual com sinal existe só na
família Crescimento Patrimonial, e **a cor nunca é semântica** ali: mesmo o sinal não implica
verde ou vermelho.

### Os três estados que todo gráfico precisa ter

- **Vazio:** título curto, mensagem de uma ou duas linhas, botão só quando existe ação imediata
  que resolve.
- **Carregando:** blocos da mesma forma e posição do conteúdo real. **Atenção:** "bloco claro" já
  não basta para dizer carregando, porque a rampa também é clara. O esqueleto se diferencia por
  **três coisas ao mesmo tempo**, nenhuma delas claridade — cinza neutro sem o azul da rampa, sem
  contorno, sem texto. Bloco claro com contorno e rótulo é **dado**.
- **Erro de dado:** não desenhar gráfico parcial. Mensagem no lugar do gráfico, e a tabela abaixo
  continua disponível se os dados dela vieram.

## 8. Vocabulário

O glossário de produto é `files_design/04-glossario-de-nomenclatura.md` e é **fechado**. A ponte
entre ele e os identificadores em inglês é
[`src/domain/GLOSSARY.md`](../src/domain/GLOSSARY.md), e é normativa (ADR-0010).

Quase sempre o nome "melhor" que ocorreu a você já foi considerado e descartado, com o motivo
escrito ao lado. **Nunca renomeie.**

Regras de escrita de interface:

- **Sem travessão (—)** em texto de tela. Use vírgula, dois-pontos ou ponto.
- **Sem emoji.** Só símbolo funcional: `↗` clicável, `▾`/`▸` expandir, `←` `→` navegação. A
  saudação da Home é "Bom dia / Boa tarde / Boa noite" por horário do dispositivo, **sem emoji e
  sem o nome da pessoa** (doc08 §8) — a versão com "Olá! 👋" era do wireframe antigo e saiu.
- Todo campo obrigatório tem asterisco **e** a legenda "Campo obrigatório" no rodapé.

## 9. O que explicitamente NÃO entra

- **Biblioteca de gráfico** (Recharts, Chart.js, D3). Um treemap e uma barra agrupada não
  justificam megabytes, um tema próprio brigando com os tokens, e um vendor no caminho de um dado
  financeiro.
- **Biblioteca de ícone.** Os 16 ícones do doc07 são SVG inline com `currentColor`.
- **Fonte de CDN.** Geist é self-hosted via `next/font`. A CSP bloqueia origem externa
  (ADR-0009 §2). _Isto reverte a linha "sem fonte web" da versão anterior deste documento._
- **Qualquer recurso de terceiro no cliente.** Sem analytics, sem telemetria, sem CDN.
- **Sombra.** Em nenhum lugar, nem no claro nem no escuro. A biblioteca do Figma não tem um único
  estilo de efeito.
- **Vermelho em despesa, em dívida e em prejuízo.** Vermelho é variação negativa, atraso e erro de
  validação. Só.
- **Verde no Lucro Líquido.** Densidade #11: tamanho e peso já marcam a linha.
- **Cor de alerta no estouro do Consumo Livre.** A barra preenche 100% e para; o texto mostra o
  valor real. Sem vermelho, sem laranja (doc08 §9.2).
- **Colapso da sidebar em mobile.** Não foi desenhado. Implementar sem desenho é inventar.
- **Um 39º token de cor.** A lista é fechada. Um token novo exige mudar o doc07 (e o Figma) antes.

## 10. Checklist antes de desenhar UI nova

Nesta ordem:

1. **O frame existe?** Procure em [`docs/figma/INDEX.md`](figma/INDEX.md) por nome. São 130
   frames, incluindo vazio e carregando de quase tudo.
2. **Se existe, leia o XML** e copie o texto palavra por palavra. A afirmação "está fiel" é
   conferível com `cat docs/figma/frames/<node>*.xml`, sem rede e sem cota.
3. **O doc08 tem regra para este dado?** Formato, caso degenerado, teto de blocos, ordenação.
   Regra de renderização é regra de domínio disfarçada de regra visual.
4. **O padrão já existe em outra tela?** "Buscar e criar", "Para onde + Valor", "lista + adicionar
   item" e "seletor de mês" se repetem por decisão explícita de design.
5. **Se é mesmo novo:** só token, nenhum valor literal — e confira que o nome do utilitário existe
   em `globals.css`, porque um nome inválido some sem erro (§3.5).
6. **Rode a skill `checklist-de-tela`** antes de dar por pronto, e `make check` depois.
