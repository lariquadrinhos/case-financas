# ADR-0015 — O style guide substitui a medição empírica de tokens

- **Status:** aceita (decisão do dono, 2026-09-04)
- **Substitui:** ADR-0011 §1 e §2 (a lista de tokens `[figma]`/`[derived]` medida à mão e a
  ponte para o Tailwind construída sobre ela)
- **Mantém de ADR-0011:** §3 (valor literal falha o build), §4 (os 130 frames vivem no
  repositório) e §5 (três estados de tema)
- **Estende:** ADR-0010 §1 (os tokens também são nomeados em inglês) · ADR-0009 §2 (a CSP
  proíbe origem externa de fonte)

## Contexto

A ADR-0011 foi escrita numa fase em que **o style guide não existia**. O time de design tinha
entregue o Wireframe — cinza, sem camada visual — com um punhado de variáveis no Figma
(`--texto-primario`, `--superficie-card`, `--borda-controle`, `--espaco-8`, `--raio-controle`) e
mais nada. Tudo o que a tela precisava além disso foi **amostrado dos frames**: o preto do botão
primário, o fundo da página, a rampa de blocos do treemap, a escala tipográfica inteira. Foram
registrados em `tokens.css` como `[derived]`, com o motivo escrito ao lado, para que nenhum
componente precisasse de valor literal — que é o ponto inteiro da ADR-0011 e continua valendo.

Era a decisão certa para o que existia. Mas era medição, não sistema: um valor `[derived]` é uma
resposta plausível para "que cinza é este?", não a resposta do design.

Depois disso o time de design fechou o **`files_design/07-style-guide.md`**, e com ele o
`files_design/08-regras-de-renderizacao-de-dados.md`. O doc07 traz o que a amostragem nunca
poderia produzir sozinha:

- **38 tokens de cor nomeados por papel semântico** (`color/bg/canvas`, `color/text/negative`,
  `color/chart/pf`), com valor claro **e** escuro lado a lado, gerados da coleção de variáveis
  **Cor** do Figma — não amostrados de pixel.
- A **hierarquia de cor**: seis papéis com "onde aparece" e "nunca" para cada um. Verde nunca no
  Lucro Líquido, vermelho nunca no lançamento de despesa, âmbar só em pendência. Isso não é uma
  paleta, é uma regra de significado, e nenhuma amostragem de frame cinza a produziria.
- A coleção **Escala** fechada: `scale/space/4·8·12·16·24·32·40`, `scale/height/table-row` (44),
  `scale/height/control` (32), `scale/radius/control` (6), `scale/radius/card` (10),
  `scale/radius/pill` (999), `scale/stroke/hairline` (1).
- **Uma família tipográfica: Geist**, com 10 estilos nomeados e figuras tabulares nos estilos
  `numeric.*`. A ADR-0011 dizia, em `docs/DESIGN.md` §7, que fonte web estava explicitamente
  fora — porque a fonte do wireframe era a pilha de sistema e não havia razão para pagar por
  outra. O doc07 dá a razão.
- **Onze componentes com variantes e estados**, incluindo o estado de Foco de cada um, e uma
  biblioteca de 16 ícones.
- Contraste **verificado nos dois modos**, com o registro de que o par PF/PJ que passa no claro
  **reprova** no escuro e precisou de matizes diferentes. A ADR-0011 gerava o escuro por
  inversão aproximada; o doc07 prova que inverter não basta.

A pergunta desta ADR é simples: quando a medição empírica e o style guide discordam, quem ganha?

## Decisão

### §1 O `files_design/07` é a fonte da verdade visual, acima do que foi medido

Todo token de cor de `src/styles/tokens.css` vem **literalmente** da tabela "Tokens" do doc07. O
nome no Figma usa barra (`color/bg/canvas`, porque o Figma não aceita ponto no nome da variável);
a custom property CSS troca a barra por traço (`--color-bg-canvas`), para o mapeamento ficar
mecânico e conferível em qualquer direção.

**Não existe mais a distinção `[figma]` / `[derived]` para cor.** Os 38 tokens são canônicos, os
38, e é a lista fechada: um 39º token de cor exige mudar o doc07 (e o Figma) primeiro. A marca
`[derived]` sobrevive **só para medida de layout** — largura da sidebar, largura do diálogo,
altura da faixa de gráfico — que são fatos de tela específicos, fora da coleção **Escala**, que
nenhuma variável do Figma governa. Cada um continua com a origem escrita no comentário.

**Emenda (medida).** A frase acima é verdadeira sobre **variáveis** e foi conferida: a coleção
**Escala** (`487:88`, página Tokens `486:2`) tem exatamente quatro grupos — `scale.space`
(`487:80`: 4/8/12/16/24/32/40), `scale.height` (`487:82`), `scale.radius` (`487:84`) e
`scale.stroke` (`487:86`). Não existe nenhum `scale/width/*`.

Mas ela vinha sendo lida como licença para amostrar de qualquer página, e não é: **"nenhuma
variável governa" não é "não há fonte no Figma".** Para medida de layout, a página de amostragem
obrigatória é a **Mockup** (`552:2`) — `[derived]` significa "medido no Mockup", nunca "medido no
Wireframe". O Wireframe segue valendo para conteúdo, fluxo e existência de estado; para geometria
ele é a camada anterior, e esta seção já decidiu que a camada visual do doc07/Mockup vence a
medição antiga.

O que a leitura frouxa custou, em três tokens que citavam node id de Wireframe:

| Token                  | Era (Wireframe)      | É (Mockup)                                      |
| ---------------------- | -------------------- | ----------------------------------------------- |
| `--width-sidebar`      | 278 (`5:3`, `26:26`) | **272** — `749:2`, `397:3`, 86/86 nós da Mockup |
| `--width-content-max`  | 1066 (`317:2`)       | **1088** — filhos de `549:70` e `397:26`        |
| recuo lateral do shell | `px-48`              | **`px-40`** — x de todo filho de `549:70`       |

Os três são o mesmo fato visto de três lados, e por isso mudam juntos: 272 + 40 + 1088 + 40 =
1440, o frame. Os pares do Wireframe (278 + 48 + 1066 + 48) também fecham 1440 — é isso que fazia
cada erro passar sozinho na revisão. Reforço independente: 48 **não existe** em `scale.space`; 40
existe (`scale.space.40`, `487:39`).

Consequência direta: os nomes da fase anterior (`--surface-card`, `--ink-primary`,
`--line-default`, `--block-1..4`, `--block-debt`, `--surface-inverse`) **deixaram de existir**
como tokens. O que se parecia com eles virou:

| Antes (ADR-0011, medido)       | Agora (doc07)                                          | O que mudou além do nome                                                       |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `--surface-card`               | `--color-bg-card`                                      | nada no claro; o escuro deixou de ser inversão e virou valor próprio (#161B21) |
| `--ink-primary`                | `--color-text-primary`                                 | idem                                                                           |
| `--line-strong` (#D1D1D6)      | `--color-border-strong` (#D3D7DA)                      | valor do sistema, não mais uma amostra do `Grays/Gray 4` do Figma              |
| `--line-selected`              | — (removido)                                           | seleção passou a ser `bg-state-subtle` + `text-state`, não uma borda própria   |
| `--surface-inverse`            | `--color-bg-inverse`                                   | vira token de **papel** ("a ação primária é o inverso do fundo"), não "preto"  |
| `--block-1..4`, `--block-debt` | `--color-chart-ramp-1..6`                              | 4 passos viraram 6, atribuídos por **posto**, e a ordem inverte no escuro      |
| (não existia)                  | `--color-text-pf/pj`, `--color-chart-pf/pj`            | PF e PJ ganharam cor. A cor segue a **entidade**, nunca a posição              |
| (não existia)                  | `--color-text-positive/negative/alert` e os `*-subtle` | o sistema deixou de ser escala de cinza                                        |
| (não existia)                  | `--color-border-negative`                              | a exceção única de vermelho fora de variação financeira: erro de validação     |

### §2 A ponte para o Tailwind ganhou uma camada de papel, e a escala em pixels continua

`src/styles/globals.css` mapeia cada token em `@theme inline`. Três famílias de utilitário
(`surface-*`, `ink-*`, `line-*`) existem para que a classe se leia como o papel que ela cumpre —
`bg-surface-card`, `text-ink-primary`, `border-line-focus` — enquanto a variável por baixo
mantém o nome exato do token do doc07. `chart-*` não precisa dessa indireção: cor de gráfico só é
cor de gráfico.

A escala numérica de espaçamento continua **substituída por pixels** (`p-20` é 20px, não 5rem),
pelo mesmo motivo da ADR-0011 §2: o desenho é especificado em pixels e uma segunda conversão
mental é onde a fidelidade se perde. Isso não mudou.

Os 10 estilos de texto do doc07 viram uma classe cada (`.text-style-heading-sm`,
`.text-style-numeric-md`, …) em `@layer components`. Peso **não** entra em `body-md` e
`numeric-md` de propósito: a variante `-medium` é a mesma caixa, mais pesada, então é o
`font-medium` do próprio Tailwind por cima — o que só funciona porque `utilities` sempre ganha de
`components`, independente da ordem no arquivo.

### §3 Geist é self-hosted, e isso é consequência da CSP, não preferência

O doc07 fecha em uma família só. A CSP deste projeto tem `font-src 'self'` (ADR-0009 §2), o que
proíbe `fonts.googleapis.com` e qualquer CDN. A implementação usa o pacote npm **`geist`** (da
própria Vercel, arquivos locais) através de `next/font`, montado uma vez no `RootLayout`; as
variáveis `--font-geist-sans` / `--font-geist-mono` alimentam `--font-sans` / `--font-mono` em
`tokens.css`.

Isso **revoga** a linha "Fonte web — a pilha de sistema é rápida, legível e não pede origem
externa" que estava em `docs/DESIGN.md` §7. A pilha de sistema continua no fallback, e só aparece
enquanto a variável do `next/font` ainda não resolveu.

### §4 O que o doc07 não cobre continua fora do sistema, e isso é explícito

Três coisas visuais do produto **não** são token, por decisão registrada no próprio doc07:

1. **O scrim dos modais** (`rgb(0 0 0 / 0.45)`) — "um escurecedor de fundo não muda de cor com o
   tema" (processo #10). Fica como constante compartilhada, nunca redefinida por tema.
2. **As 6 cores de banco** do seletor "Cor" de Contas Bancárias — são cor de marca de terceiro,
   não do produto. `bankAccountColourSchema` guarda o slug, nunca o hex.
3. **Movimento** (`--duration-fast`, `--duration-normal`, `--easing-default`) — o doc07 não trata
   de movimento. Ficam neutros e zerados sob `prefers-reduced-motion`.

Registrar cada uma aqui é o que impede que alguém "conserte" a ausência delas na coleção **Cor**.

### §5 O que a ADR-0011 decidiu e continua valendo, sem alteração

- **§3 — valor literal em componente falha o build.** `./tools/audit.sh tokens` procura hex e px
  fora de `src/styles/` e sai com erro. Roda no `make check` e no CI. Se um valor não existe como
  token, o token é que está faltando.
- **§4 — os 130 frames vivem no repositório.** `docs/figma/frames/*.xml` continua sendo a fonte de
  fidelidade do dia a dia: funciona sem cota e sem rede, e um diff mostra quando o design muda.
- **§5 — três estados de tema.** `system` é o padrão; a escolha explícita grava `data-theme` em
  `<html>` e sempre ganha da preferência do sistema. A paleta escura continua duplicada de
  propósito (`@media` + `[data-theme='dark']`), porque CSS não tem mixin e um passo de build
  esconderia a duplicação em vez de removê-la.

## Consequências

- **`src/styles/tokens.css`** reescrito: 38 tokens de cor canônicos, coleção **Escala**, os 10
  estilos de texto, e `[derived]` reservado a medida de layout.
- **`src/styles/globals.css`**: as três famílias de papel, a escala em pixels e as 10 classes
  `.text-style-*`.
- **`package.json`**: dependência `geist`, montada em `src/app/layout.tsx` via `next/font`.
- **`docs/DESIGN.md`** reescrito do zero para descrever este sistema. A versão anterior —
  anatomia medida dos frames, tokens `[figma]`/`[derived]`, "sem fonte web", "sem cor semântica de
  alerta" — está **superada** e não deve ser consultada como referência.
- **Todos os componentes** de `src/components/ui/` e `src/components/patterns/` foram
  retematizados. A estrutura e a acessibilidade sobre Radix não mudaram — foi ajuste de estilo.
- **Custo aceito:** as duas famílias de nome (`--color-bg-*` no token, `surface-*` no utilitário)
  precisam ser lidas juntas para o rastro fechar. É o preço de manter o nome do doc07 intacto sem
  escrever `bg-color-bg-card` em toda tela.

## Explicitamente NÃO feito

- **Gerar os tokens do Figma em tempo de build.** Mesma razão da ADR-0011: amarraria o build à API
  e à cota. O valor muda raramente; o build roda sempre. A tabela do doc07 é o intermediário
  versionado.
- **Apagar a ADR-0011.** Numeração de ADR é imutável. Ela continua no repositório com o raciocínio
  da fase em que foi tomada — é o registro de por que os valores medidos existiram, e é o que
  torna esta ADR legível.
- **Renomear as variáveis no Figma.** O arquivo é do time de design. O doc07 já as renomeou para
  inglês (`color/bg/canvas`); a única tradução do nosso lado é barra → traço.
- **Tokenizar o scrim, as cores de banco e o movimento.** Ver §4.
- **Adotar um tema de biblioteca pronta (shadcn/ui).** Os primitivos são Radix tematizados nos
  nossos tokens. Herdar a paleta zinc traria um segundo sistema de cor para brigar com o do
  doc07.
