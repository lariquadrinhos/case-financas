# ADR-0011 — Os tokens do Figma são a única fonte visual, e valor literal é erro de build

- **Status:** aceita (decisão do dono, 2026-09-01)
- **Estende:** ADR-0010 §1 (os tokens também são nomeados em inglês)

## Contexto

O time de design entregou o wireframe com **variáveis de verdade** no Figma — `--texto-primario`,
`--superficie-card`, `--borda-controle`, `--espaco-8`, `--raio-controle` — e não só retângulos
com cor solta. Isso é raro e vale preservar.

O modo como essa fidelidade normalmente se perde é conhecido: alguém precisa de um cinza que
"quase" existe, escreve `#e8eaec` direto no componente, e seis meses depois há onze cinzas no
produto e nenhum deles é o do Figma.

A API do Figma tem limite de chamadas por assento, e o limite foi atingido durante esta fase.
Depender dela a cada tela não é viável.

## Decisão

### §1 `src/styles/tokens.css` é a fonte única, e cada token diz de onde veio

Todo token é marcado `[figma]` ou `[derived]`.

`[figma]` significa que existe uma variável correspondente no arquivo
`7IZBeQV15kgZp7Shcqh4c8`, lida via `get_variable_defs`. O nome da variável original está no
comentário da linha, porque o nome no código é inglês (ADR-0010) e sem o comentário o rastro
para o design se perderia. **Não mude um valor `[figma]` sem mudar no Figma primeiro.**

`[derived]` significa que o wireframe usa aquilo visualmente mas não há variável: o botão
primário preto, o fundo da página, a rampa de blocos do treemap, a escala tipográfica. Foram
amostrados dos frames e registrados aqui **para que nenhum componente precise de valor
literal** — que é o ponto inteiro desta ADR.

### §2 A ponte para o Tailwind é explícita, e a escala de espaço é em pixels

`src/styles/globals.css` mapeia cada token em `@theme inline`. A consequência é que
`bg-surface-card` funciona e `bg-[#fff]` é proibido.

A escala numérica de espaçamento foi **substituída por pixels**: `p-20` é 20px, não os 5rem do
padrão do Tailwind. É deliberado — o wireframe é especificado em pixels, e uma segunda
conversão mental é onde a fidelidade se perde. Está documentado em `docs/DESIGN.md` §3 com um
aviso, porque contraria a expectativa de quem conhece o Tailwind.

Verificado no CSS gerado, não assumido: `.p-20{padding:var(--space-20)}`.

### §3 Valor literal em componente falha o build

`make audit-tokens` procura hex e px fora de `src/styles/` e sai com erro. Roda no CI.

Se você precisa de um valor que não existe como token, **o token é que está faltando** — e
acrescentá-lo em `tokens.css` obriga a decidir se ele é `[figma]` ou `[derived]`, que é
exatamente a pergunta certa.

### §4 A árvore de todos os frames vive no repositório

`docs/figma/frames/*.xml` tem os 130 frames com id, nome de camada, posição, tamanho e **todo o
texto de cada tela**. `docs/figma/INDEX.md` é o índice.

É o que substitui a API para o trabalho do dia a dia, e tem duas vantagens sobre ela: funciona
sem cota e sem rede, e um diff mostra quando o design muda.

Consequência prática: a cópia de estado vazio foi **extraída literal** dos frames para
`src/components/patterns/empty-states.ts`, com o node de origem em cada entrada. A afirmação
"está fiel ao Figma" é conferível com `cat docs/figma/frames/<node>*.xml`.

### §5 Dois estados de tema, não três — **emendado 2026-09-05**

**Esta seção descrevia um comportamento que nunca foi decidido pelo produto e contradizia
`files_design/02`.** O texto original dizia "`system` é o padrão e segue o sistema operacional" e
tratava isso como terceiro estado do Alternador de tema. Mas `files_design/02`
§"Controle de tema (claro/escuro): lacuna encontrada e Alternador de tema criado" registra que a
opção "híbrido de 3 estados (Automático/Claro/Escuro)" foi avaliada e **descartada por nome** —
"adiciona complexidade de interação (3 estados em vez de 2) sem um motivo concreto do produto" —
em favor da opção 2, toggle manual de 2 estados. `files_design/07` confirma: "Alternador de tema
— Estado (Claro, Escuro), **2 variantes**". Por precedência (`CLAUDE.md` §2, especificação de
telas > ADR), o doc de design é quem vale; esta ADR estava desalinhada com uma decisão de produto
já tomada, não o inverso — `src/components/patterns/theme-toggle.tsx` foi corrigido para 2
estados (`Theme = 'light' | 'dark'`), sem uma seleção "Automático" e sem reverter pra um terceiro
estado ao clicar no ícone já ativo.

O que continua valendo, e o motivo de `tokens.css` ainda ter o bloco `@media`: antes da primeira
escolha explícita da pessoa, a página ainda precisa pintar alguma coisa, e pintar sempre claro
independente do sistema operacional seria pior do que resolver pela preferência do SO uma única
vez. Esse `@media (prefers-color-scheme: dark)`, guardado por `:root:not([data-theme='light'])`
para que uma escolha explícita de claro sempre vença, resolve **só a aparência inicial antes da
escolha** — não é um modo selecionável, não tem representação própria no Alternador de tema, e o
primeiro clique em qualquer um dos 2 ícones grava `data-theme` em `<html>` e vira a escolha
explícita e permanente da pessoa. `readStoredTheme()` só reconhece `'light'`/`'dark'`; qualquer
outra coisa (nada gravado, ou um valor de uma versão anterior desta ADR) cai no mesmo cálculo de
preferência do sistema, só para decidir qual dos 2 ícones já nasce marcado como ativo.

A paleta escura aparece duplicada em `tokens.css` — uma vez no `@media`, uma vez no
`[data-theme='dark']`. CSS não tem mixin; a duplicação é deliberada e está comentada, em vez de
escondida atrás de um passo de build.

## Consequências

- **`src/styles/tokens.css`** e **`globals.css`**: criados, com o mapeamento comentado.
- **`Makefile`**: alvo `audit-tokens`, no `check` e no CI.
- **`docs/figma/`**: 130 frames + índice, versionados.
- **`src/components/patterns/empty-states.ts`**: cópia literal, com node de origem.
- **`docs/DESIGN.md`**: documenta a escala em pixels e a lista do que não entra.
- **Custo aceito**: 900 KB de XML no repositório. Vale o que compra — fidelidade conferível sem
  rede e sem cota.

## Explicitamente NÃO feito

- **Gerar os tokens do Figma em tempo de build.** Amarraria o build à API e à cota. O valor
  muda raramente; o build roda sempre.
- **Traduzir os nomes das variáveis no Figma.** O arquivo é do time de design, que trabalha em
  português. A tradução vive no comentário do nosso lado.
- **Adotar o tema padrão do shadcn/ui.** Os primitivos foram escritos sobre Radix e tematizados
  nos nossos tokens. Herdar a paleta zinc do shadcn traria um segundo sistema de cor para
  brigar com o do Figma.
- **Paleta de marca.** O wireframe é em escala de cinza por decisão do design
  (`files_design/00`). Inventar cor de marca aqui seria design, não implementação.
