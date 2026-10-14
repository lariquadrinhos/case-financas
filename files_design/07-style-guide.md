# 07 — Style Guide (fundações)

> Camada visual do produto, aplicada em cima dos wireframes em escala de cinza dos docs 01 e 03. Construída no arquivo Figma, página **Style guide**.
>
> **Status:** fundações, sistema de gráfico, biblioteca de componentes e biblioteca de ícones fechados, conferidos contra o Wireframe inteiro. Onze componentes com variantes e estados (Botão, Botão de ícone, Campo, Etiqueta, Controle segmentado, Card, Linha de tabela, Toggle, Alternador de tema, Progresso, Linha expansível — todos com estado de Foco, ver seção Foco (navegação por teclado)) e 16 ícones funcionais. **Aplicação da camada visual concluída** nas 26 telas "Desktop —" principais do Wireframe (os 4 relatórios do bloco 8 do doc01, Histórico, Revisão de Recorrentes, as 4 abas de Novo Lançamento, as 5 telas de Plano de Contas e Patrimônio, o drill-down Detalhe do Passivo, os 6 Onboarding e os 9 modais "sobre Início"), claro e escuro cada — mais os 24 estados Vazio (48 frames), Home em Modo de Organização e os dois estados do Plano de Contas expandido — bloco aberto e categoria em edição, claro e escuro (ver doc02 pro histórico completo dessas levas). Checklist de conformidade de tokens (8 categorias) cobrindo todas essas telas. Estado Carregando deliberadamente não desenhado — regra escrita já basta (doc08, seção 6).

**Arquivo Figma:** https://www.figma.com/design/7IZBeQV15kgZp7Shcqh4c8 · página **Capa** (primeira aba — nome do projeto, status atual e mapa das páginas do arquivo, serve de porta de entrada pra quem abre o arquivo pela primeira vez) · página **Wireframe** (estrutura funcional em escala de cinza, sem camada visual) · página **Mockup** (telas reais recoloridas com a camada visual do Style guide, sem alterar o Wireframe original — telas completas empilhadas na ordem do fluxo do app, componentes soltos numa área à parte; cobertura das telas principais concluída, ver "Status" acima — restam só os itens listados em "O que ainda falta") · página **Style guide** (fundações, componentes, ícones) · página **Tokens** (biblioteca visual de cor e escala, gerada a partir da configuração de variáveis do Figma — cor mostra swatch, nome, hex e RGB claro/escuro lado a lado; escala mostra o valor desenhado no tamanho real: barra de espaçamento, retângulo de altura, quadrado com o raio aplicado, linha com a espessura do traço)

---

## Princípio único

**Preto e cinza constroem, azul dá estado, cor significa.**

Referência de direção: Midday (calmo, sem cor, editorial). O que o board de referências não resolvia, e este sistema resolve: o produto é PF **e** PJ, e precisa de cor com significado sem virar papagaio.

---

## Hierarquia de cor 🟩

Seis papéis, mas nunca dois no mesmo peso na mesma tela.

| Papel | Onde aparece | Nunca |
|---|---|---|
| **Preto (`color/bg/inverse`)** | Ação primária: Novo Lançamento, Destinar este Lucro | Não é usado como decoração nem como fundo de seção |
| **Azul (`color/text/state`)** | Estado: item ativo na navegação, segmento selecionado, link, ação em linha, foco | Nunca significa "bom" nem "ruim", e nunca é botão primário |
| **PF / PJ** | Etiqueta de croma baixo ao lado do nome do lançamento. Em gráfico, sobe pra `color/chart/pf` e `color/chart/pj` | Nunca preenche a linha inteira, nunca compete com o número |
| **Verde (`color/text/positive`)** | Só onde tamanho e peso não dão conta: variação na Evolução Mensal, Indicadores Financeiros, barra de gráfico | Nunca em lançamento individual de receita, e **nunca no Lucro Líquido** (ver regra 11) |
| **Vermelho (`color/text/negative`)** | Só em variação negativa e atraso. **Exceção única:** contorno de erro de validação de campo (`color/border/negative`), ver seção Biblioteca de componentes | **Prejuízo no DRE continua neutro**, conforme decidido no doc 02. E **dívida não é vermelha** (ver regra 21) |
| **Âmbar (`color/text/alert`)** | Só em pendência: status Previsto, recorrência a definir | Nunca em informação passiva |

**Consequência prática:** um lançamento de despesa no Histórico é preto com o operador à esquerda, não vermelho. Se todo negativo fosse vermelho, a tela sangraria e o vermelho perderia valor exatamente onde importa.

**Status na tabela:** "Pago" é rótulo silencioso em cinza terciário (estado resolvido, não pede nada). "Previsto" é etiqueta âmbar (pede ação). Cor marca o que precisa de atenção.

### Por que PF e PJ são ciano e índigo 🟩

A primeira versão usava teal e violeta. Foram trocados por **ciano-azulado (PF)** e **índigo (PJ)** por dois motivos:

1. **O teal ficava perto demais do verde**, que no sistema significa resultado positivo.
2. **Teal e violeta não pareciam da mesma família.** Puxando os dois pra perto do azul, eles lêem como um conjunto, sem invadir o azul de estado.

**Por que não dois tons de azul**, que seria o mais calmo: azul já significa estado e passaria a significar três coisas na mesma tela. E dois tons do mesmo matiz codificam **ordem**, não categoria: claro e escuro lêem como "menos e mais", e PF e PJ são pares, não ranqueados. Acessibilidade não era o impedimento — dois azuis separam até melhor que dois matizes. A decisão foi de significado, não técnica.

---

## Regras de densidade 🟩

O produto é denso (DRE, Balanço, Histórico) e as referências densas de mercado são feias por um motivo evitável: resolvem densidade **acrescentando** borda, cor, ícone e peso de fonte. Aqui a densidade vem de ritmo e alinhamento.

1. **Grade de 4** e altura de linha fixa em tabela (44px).
2. **Números alinhados à direita, sempre, com figuras tabulares.** Coluna de valor desalinhada é o que mais faz tabela financeira parecer amadora.
3. **Uma divisória fininha só**, e só onde separa significado. Sem zebrado, sem borda em toda célula.
4. **Cabeçalho de tabela em caixa alta pequena e cinza**, não em negrito preto.
5. **Um peso de fonte pra estrutura** (Medium) e o resto Regular. Hierarquia por tamanho e por cinza, não por negrito.
6. **Ícone só quando substitui palavra**, nunca acompanhando uma.
7. **Card nunca dentro de card.** O nível de dentro vira seção com título e divisória, sem borda própria.
8. **Operador em coluna de largura fixa** na cascata, pra todos os nomes de linha alinharem no mesmo x.
9. **Valor zero em cinza terciário.** O que não aconteceu não precisa do mesmo peso do que aconteceu.
10. **Sem sombra.** Separação é feita por borda no claro e por claridade no escuro.
11. **Um canal por mensagem.** Se tamanho, peso e régua já marcam a linha, cor não entra. É por isso que o Lucro Líquido não é verde, e por isso o treemap não repete a porcentagem ao lado do valor: a área já é a porcentagem.

---

## Tokens

Coleção **Cor**, com os modos **Claro** e **Escuro**. Nomeados por papel semântico, nunca por cor literal.

| Token | Claro | Escuro |
|---|---|---|
| `color/bg/canvas` | #F7F8F8 | #0E1216 |
| `color/bg/card` | #FFFFFF | #161B21 |
| `color/bg/subtle` | #F4F5F6 | #1D242B |
| `color/bg/inverse` | #12161A | #E8EDF2 |
| `color/border/default` | #E6E8EA | #262E36 |
| `color/border/control` | #878F94 | #5F6B77 |
| `color/border/strong` | #D3D7DA | #38424C |
| `color/border/focus` | #2758CC | #6E9BFF |
| `color/border/negative` | #A62B3F | #F08098 |
| `color/text/primary` | #12161A | #E8EDF2 |
| `color/text/secondary` | #4A5259 | #ADB7C1 |
| `color/text/tertiary` | #676E75 | #8B95A0 |
| `color/text/inverse` | #FFFFFF | #0E1216 |
| `color/text/on-block` | #12161A | #12161A |
| `color/text/state` | #2758CC | #6E9BFF |
| `color/text/positive` | #1B6E4A | #4FBF87 |
| `color/text/negative` | #A62B3F | #F08098 |
| `color/text/alert` | #8A5A00 | #E5B45C |
| `color/text/pf` | #175E75 | #6BC3DA |
| `color/text/pj` | #43409E | #A9A2F5 |
| `color/bg/state-subtle` | #EAF0FE | #1B2740 |
| `color/bg/positive-subtle` | #E3F2EA | #10321F |
| `color/bg/negative-subtle` | #FAE7EA | #3A1620 |
| `color/bg/alert-subtle` | #FDF0D9 | #33270F |
| `color/bg/pf-subtle` | #E3EFF4 | #10303B |
| `color/bg/pj-subtle` | #E9E8F9 | #23214A |
| `color/chart/pf` | #0B7FA6 | #22A3BC |
| `color/chart/pj` | #5350D8 | #8A7CF0 |
| `color/chart/series-1` | #2E6BE6 | #6E9BFF |
| `color/chart/positive` | #2C8A5E | #4FBF87 |
| `color/chart/negative` | #C0566A | #E08498 |
| `color/chart/neutral` | #C3C8CD | #3A444E |
| `color/chart/ramp-1` | #738292 | #C3D3E4 |
| `color/chart/ramp-2` | #8292A2 | #B2C2D3 |
| `color/chart/ramp-3` | #92A2B2 | #A2B2C3 |
| `color/chart/ramp-4` | #A2B2C3 | #92A2B2 |
| `color/chart/ramp-5` | #B2C2D3 | #8292A2 |
| `color/chart/ramp-6` | #C3D3E4 | #738292 |

Coleção **Escala**: `scale/space/4·8·12·16·24·32·40`, `scale/height/table-row` (44), `scale/height/control` (32), `scale/radius/control` (6), `scale/radius/card` (10), `scale/radius/pill` (999), `scale/stroke/hairline` (1).

### Checklist de conformidade de tokens (Dev Mode) 🟩

**Regra geral, sem exceção:** todo valor que bate com um token existente precisa estar **vinculado** a ele — nunca deixado como número, hex ou estilo aplicado manualmente por semelhança visual. Um valor parecido mas não vinculado engana tanto quanto um valor errado: o Dev Mode mostra "24", sem dizer se é `scale/space/24` ou um número arbitrário daquela tela específica — o dev não tem como saber a diferença olhando o Inspect.

Esta lista cobre só o que o **Dev Mode do Figma consegue mostrar automaticamente** pra quem for implementar (nome de variável, nome de estilo de texto, nome de componente/instância). O resto das regras deste documento e do doc08 — geometria (ícone ancorado no canto, foco por fora), regras de ausência (sem sombra, sem zebrado), regras condicionais a dado (valor zero em cinza terciário, cor de gráfico por entidade) e formatação de conteúdo (doc08 seção 1) — continua obrigatório, mas não aparece sozinho no painel de inspeção: exige ler a documentação, não só vincular um token. Não confundir "não está nesta lista" com "não precisa seguir".

| # | Categoria | O que aparece no Dev Mode quando vinculado | Onde a lista completa mora |
|---|---|---|---|
| 1 | Cor | Nome da variável (`color/bg/card`) em vez do hex | Esta seção, coleção Cor |
| 2 | Espaçamento | Nome da variável (`scale/space/24`) em padding/gap | Esta seção, coleção Escala |
| 3 | Raio | Nome da variável (`scale/radius/card`) no corner radius | Esta seção, coleção Escala |
| 4 | Altura de controle | Nome da variável (`scale/height/control`) na altura do elemento | Esta seção, coleção Escala |
| 5 | Traço | Nome da variável (`scale/stroke/hairline`) na espessura do contorno | Esta seção, coleção Escala |
| 6 | Tipografia | Nome do estilo (`heading.sm`) em vez de família/tamanho soltos | Seção Tipografia |
| 7 | Componente | Nome do componente (e Code Connect, se configurado) em vez de "Frame"/"Rectangle" genérico | Seção Biblioteca de componentes |
| 8 | Ícone | Nome do ícone (`icon/arrow-diagonal`) como instância, não vetor redesenhado | Seção Biblioteca de ícones |

**Nota sobre figuras tabulares:** vem de graça junto com a categoria 6 (Tipografia) — os estilos `numeric.*` já têm a opção "Number style: Monospace" marcada à mão no Figma (seção Tipografia, acima). A API de plugin não lê nem escreve essa configuração, então não dá pra auditar por script — só conferir uma vez, visualmente, no painel de tipo de cada estilo (não por nó individual, já que é propriedade do estilo, não da instância).

**Repare na rampa:** são **seis tons só**, na ordem no claro e na ordem inversa no escuro. E `color/text/on-block` é o único token igual nos dois modos, porque os blocos da rampa são claros nos dois.

**Nomenclatura, revisão:** os 38 tokens de cor foram renomeados de papel semântico em português (`superficie/canvas`, `texto/primario`) para `color/categoria/papel` em inglês (`color/bg/canvas`, `color/text/primary`), pra bater com convenção de design token em código. Figma não aceita ponto no nome da variável, então o nome real usa barra (que também agrupa em pasta no painel); a tabela visual da página **Tokens** mostra esse mesmo nome com ponto (`color.bg.canvas`), formato mais comum em token JSON. É troca de rótulo, não de sistema — os seis papéis de cor, a hierarquia e todas as regras deste documento continuam as mesmas.

### Cores de banco (referência, fora do sistema de tokens) 🟩

Paleta do seletor de "Cor" no formulário "Adicionar conta" (Contas Bancárias), pra personalização visual da conta. **Reorganizada em 2026-09-11 em duas metades:** a faixa mostra as **5 de banco** como sugestão e, na 6ª vaga, o **gatilho do color pick** — as outras 6 cores vivem dentro dele. **Não são tokens do sistema**: são cor de marca de terceiro (do banco, não do produto), então ficam com fill literal, sem `setBoundVariable`, mesma lógica já usada pro scrim dos modais (decisão registrada no doc02). Também documentadas na página **Tokens** do Figma, como bloco de referência separado da coleção **Cor** real.

| Banco | Hex | Fonte |
|---|---|---|
| Nubank | `#820AD1` | cor de marca citada de forma consistente entre fontes (brandcolorcode.com) |
| Itaú | `#EC7000` | confirmado no rebranding de 2024 (Pentagram) |
| Banco do Brasil | `#0038A8` | Manual de Identidade Visual oficial do BB — Pantone 286 |
| Bradesco | `#EA1D2C` | Guia de Comunicação Visual oficial do Bradesco — Pantone 185C |
| Caixa | `#1C60AB` | Manual de Identidade Visual da Caixa — Pantone 293 |

**As 6 cores extras, dentro do color pick 🟩** — cinco matizes novas, escolhidas para não colidirem
com as de banco (que ocupam roxo, laranja, dois azuis e vermelho) nem entre si, mais o cinza que já
existia:

| Cor | Hex | Observação |
|---|---|---|
| Verde | `#1E8E5A` | |
| Teal | `#0F766E` | |
| Ouro | `#C9A227` | |
| Rosa | `#BE185D` | |
| Marrom | `#6F4E37` | |
| Cinza | `#6B7280` | O antigo "Cor extra", que ocupava a 6ª vaga da faixa. Mantém o slug `outra` — é dado já gravado, e renomear pediria migração para mudar nada na tela. Substituiu o C6 Bank (doc02): não foi possível confirmar o hex oficial da cor "Carbon" em fonte acessível |

**O gatilho do color pick** é um círculo de 28×28, mesma vaga e mesma geometria das cores: sem
preenchimento, **borda tracejada** em `color/border/control` e um `+` centralizado em
`color/text/secondary`. Tracejado e vazio de propósito — ele precisa parecer clicável **sem** parecer
uma cor, que era exatamente o defeito do cinza naquela vaga: lia-se como "escolha cinza" quando
queria dizer "nenhuma das cinco".

Escolhida uma cor extra, **o gatilho vira aquela cor, continua tracejado** (agora com 2px) **e
mantém o `+` no centro**. O tracejado e o `+` dizem "este abre"; a espessura é o estado selecionado,
o mesmo que as outras bolinhas usam. Fecha uma regra de anel aprendível:

| Anel | Significa |
|---|---|
| sólido 1px `color/border/default` | uma cor, não selecionada |
| sólido 2px `color/border/strong` | uma cor, selecionada |
| tracejado 1px `color/border/control` | o color pick, sem cor extra escolhida |
| tracejado 2px `color/border/strong` | o color pick, carregando a cor escolhida |

**O `+` fica no centro nos dois casos**, e só o tom muda: `--bank-account-plus-light` por padrão,
`--bank-account-plus-dark` onde o claro fica abaixo de 3:1 — hoje, **só o ouro** (2,42 contra 7,51).
Os dois são valores FIXOS e não `color/text/inverse`: aquele inverte com o tema e estas cores não,
então um `+` que virasse escuro no modo escuro ficaria ilegível sobre um fundo que continuou igual.

Contraste do claro sobre cada extra, medido: verde 4,14 · teal 5,47 · ouro 2,42 · rosa 6,04 ·
marrom 7,44 · cinza 4,83. O verde é empate técnico com o escuro (4,39) e fica claro, para não haver
dois verdes vizinhos com tratamentos opostos por 0,25 de diferença.

**Duas tentativas caíram antes desta, e ficam registradas para ninguém refazer.** (1) Um `+` num selo
no canto: desenhado, o selo mede 10 de largura num círculo de 28 — uma mordida visível, disputando
atenção com a própria cor. (2) Tirar o `+` e deixar só o tracejado: ficou publicado um dia, e **quem
usa o app reparou na falta** — o tracejado sozinho não diz que aquilo abre alguma coisa.

A faixa nunca perde um banco: a alternativa considerada, empurrar a cor escolhida para a 1ª vaga,
tirava o Nubank das sugestões e obrigava a abrir o color pick para recuperar a cor mais comum.

**Os quatro estados estão desenhados**, como telas completas na Mockup:
`Desktop — Contas Bancárias (color pick aberto) (claro)` e `(escuro)`, e
`Desktop — Contas Bancárias (cor extra selecionada) (claro)` e `(escuro)`. O painel aberto é
ancorado pela direita do gatilho, 8 abaixo — a tradução do `align="end"` + `sideOffset={8}` que o
código usa.

**Aberto** (`Color pick — aberto (claro)` / `(escuro)`, 252×52): as **seis extras** em **uma linha**,
mesma aritmética da faixa (6 × 28 + 5 × 12 = 228) mais 12 de respiro de cada lado. Escolher fecha a
janela.

**As de banco NÃO se repetem dentro dela** — reversão de 2026-09-11, decidida olhando o desenho. A
primeira versão mostrava as onze, com o argumento de que quem abriu a janela procurando não deveria
ter que fechá-la para escolher um banco. Desenhado, ficou poluído: onze bolinhas em duas linhas
logo abaixo de uma faixa que já traz cinco delas. E o argumento não se sustenta na geometria — o
painel abre **abaixo** do gatilho, então a faixa continua visível acima dele: a bolinha do Nubank
está à vista, um clique adiante, sem fechar nada.

### Contraste e separação verificados

Todo texto passa 4,5:1 e todo elemento interativo passa 3:1, **nos dois modos**. `color/border/control` existe separado de `color/border/default` exatamente por isso: divisória pode ser invisível, borda de botão não pode.

O par `color/chart/pf` + `color/chart/pj` foi validado como paleta categórica nos dois modos. Duas observações que valem registro:

- No **claro**, a separação para tritanopia fica na faixa de piso (ΔE 7,4). Só é aceitável porque o sistema obriga três canais secundários de identidade: legenda, rótulo direto e tabela com o mesmo dado.
- No **escuro**, o par que funciona no claro **reprovou** no piso de visão normal (ΔE 13,5, abaixo de 15). Foi necessário abrir o ângulo entre os matizes. É a prova concreta de que o escuro não é o claro invertido.

Sobre a rampa: `color/text/on-block` sobre o passo mais escuro dá 4,62 e sobre o mais claro dá 11,91, então passa em todos os seis, nos dois modos.

### Foco (navegação por teclado) 🟩

**Mecanismo único, reaproveitado em todo o sistema:** anel de 2px em `color/border/focus`, por fora do elemento (`strokeAlign: outside`), sem mudar o tamanho da caixa — o mesmo que Botão, Campo e Toggle já usavam desde o início. Quando o elemento tem uma borda própria (contorno padrão), o anel de foco a substitui enquanto o foco estiver ali, em vez de somar duas bordas.

**Auditoria de cobertura:** ao revisar o sistema pra fechamento, 6 elementos clicáveis não tinham estado de foco definido — todos ganharam variante nesta revisão:

| Elemento | Alvo do foco | Variante nova |
|---|---|---|
| Card | O card inteiro (só quando é clicável) | `Estado=Foco` |
| Linha de tabela | A linha inteira (ex.: item do Histórico, que abre edição ao clicar) | `Tipo=Dado, Estado=Foco` |
| Controle segmentado | O segmento individual, não o trilho inteiro | `Opções=2, Selecionado=1, Estado=Foco` (exemplo representativo) |
| Alternador de tema | O botão de ícone individual (sol ou lua), não o trilho inteiro | `Tema=Claro, Estado=Foco` (exemplo representativo) |
| Linha expansível | O cabeçalho inteiro (é ele que expande/recolhe) | `Estado=Foco` |
| Bloco de treemap | O bloco inteiro, mesmo alvo do clique | Sem variante Figma — é elemento calculado, não componente. Regra em doc08, seção 2.9 |
| Ícone isolado (seta de navegação, calendário, info, drag-handle) | O ícone sozinho, 20×20px — pequeno demais como alvo de clique próprio | Resolvido criando o componente **Botão de ícone** (ver Biblioteca de componentes), que já nasce com Foco como um dos 3 estados nativos, não como adição posterior |

**Por que só um exemplo representativo em Controle segmentado e Alternador de tema:** o foco recai sobre um segmento/ícone específico, não sobre o componente inteiro — documentar as combinações inteiras (cada segmento de cada contagem de opções, cada ícone de cada tema) multiplicaria variantes sem agregar entendimento novo. Um exemplo claro basta pra quem for implementar generalizar o padrão.

---

## Modo escuro 🟩

1. **A ação primária é o inverso do fundo**, por definição. Por isso `color/bg/inverse` é um token só com dois valores, e não "preto".
2. **O fundo escuro não é preto puro**, é um azul-tinta (#0E1216). Preto puro dá halação com texto claro.
3. **A separação entre superfícies é feita por claridade, não por sombra.** Por isso o sistema inteiro é sem sombra, também no claro.

---

## Tipografia

**Uma família só: Geist.** Geist Mono aparece apenas nos códigos do Plano de Contas.

| Estilo | Fonte | Tamanho / entrelinha | Uso |
|---|---|---|---|
| heading.xl | Geist SemiBold | 24 / 30 | Nome da tela |
| heading.sm | Geist SemiBold | 15 / 20 | Título de card, linha de resultado |
| body.md | Geist Regular | 14 / 20 | Texto, nome de linha, item de navegação |
| body.md-medium | Geist Medium | 14 / 20 | Ênfase estrutural, botão, subtotal |
| body.sm | Geist Regular | 13 / 18 | Explicação, dado secundário |
| label.xs | Geist Medium | 11 / 14, caixa alta | Cabeçalho de coluna, etiqueta, eixo, nome de bloco |
| numeric.md | Geist Regular + figuras tabulares | 14 / 20 | Valor em coluna |
| numeric.md-medium | Geist Medium + figuras tabulares | 14 / 20 | Valor de subtotal, valor em bloco |
| numeric.lg | Geist SemiBold | 20 / 26 | Valor único em destaque |
| code.sm | Geist Mono Regular | 12 / 16 | Código do Plano de Contas |

### Figuras tabulares

Por padrão, os algarismos da Geist têm larguras diferentes, como as letras: o "1" ocupa quase metade da largura do "0". Numa coluna de valores empilhados, isso desalinha as casas decimais.

A própria Geist traz um segundo jogo de algarismos, todos da mesma largura. É isso que os estilos `numeric.md` e `numeric.md-medium` usam. **Não é outra fonte** — é a Geist com uma opção ligada.

- **No Figma:** estilo de texto → configurações de tipo → *Details* → **Number style: Monospace uppercase/lining**. ("Monospace" aqui é o nome que o Figma dá pra figura tabular, não tem relação com a Geist Mono.) A API de plugin não liga essa opção; foi marcada à mão nos dois estilos.
- **Na implementação:** `font-variant-numeric: tabular-nums`.

---

## Sistema de gráfico 🟩

1. **Cor de gráfico segue a entidade, nunca a posição.** PF é sempre `color/chart/pf` e PJ é sempre `color/chart/pj`. Trocar o filtro nunca repinta quem sobrou.
2. **Nunca dois eixos y.**
3. **Sequencial é um matiz só.** Divergente é dois matizes com cinza neutro no meio. Nunca arco-íris.
4. **Marca fina, topo arredondado em 4px ancorado na base**, e 2px de folga entre marcas adjacentes.
5. **Grade recessiva.** Linha de grade em `color/border/default`, linha de base em `color/border/strong`, rótulo de eixo em label.xs/terciário.
6. **Rótulo direto é seletivo, nunca em todo ponto.**
7. **Legenda sempre presente com 2 séries ou mais**, nenhuma com uma só.
8. **Texto usa token de texto, nunca a cor da série.** A exceção é texto **dentro** de uma marca preenchida — ver regra 14.
9. **Toda tela de gráfico tem a tabela do mesmo dado embaixo.** A tabela é a versão acessível do gráfico.

### Treemap (Despesas por Categoria, Onde Está Meu Dinheiro) 🟩

10. **A rampa é atribuída por posição no ranking**, e os passos se espalham pelos seis, não pelos primeiros N. A fórmula está no doc 08, seção 2.5, e vale pra todo elemento que recebe a rampa por ranking.
11. **A rampa é clara nos dois modos**, e a mesma: seis tons, na ordem no claro e invertida no escuro. Foi decisão de leitura — a versão escura anterior pesava demais num card de Home.
12. **Maior é sempre o de maior contraste contra a superfície.** No claro isso significa o mais escuro dos seis; no escuro, o mais claro.
13. **Todo bloco tem contorno de 1px em `color/border/control`.** É o preço da rampa clara: o passo mais claro tem só 1,5 de contraste contra o card branco, e sem o contorno ele sumiria e a folga de 2px pararia de aparecer. O contorno é estrutural, não decorativo.
14. **O texto dentro de bloco preenchido usa `color/text/on-block`, sempre.** Não existe mais inversão de cor de texto no meio da rampa.
15. **Texto em bloco vazado não usa `color/text/on-block`.** Bloco vazado tem o fundo do card, que muda entre os modos, então usa `color/text/primary` e `color/text/secondary`.
16. **Sem porcentagem no bloco.** A área é a porcentagem.
17. **Um treemap por faixa, no máximo seis blocos visíveis.** A partir do sétimo, o excedente agrupa em "Outras".
18. **Bloco estreito perde o `↗`, bloco baixo perde o valor.** Escada completa no doc 08, seção 2.6.

#### Quando ativo e dívida convivem (Onde Está Meu Dinheiro) 🟩

19. **Ativo e dívida não dividem o mesmo treemap.** São sinais opostos. O card se divide em duas faixas rotuladas, cada uma com seu total.
20. **A escala de largura é comum às duas faixas.** A faixa de dívidas ocupa a fração da largura que as dívidas representam do total de ativos.
21. **Dívida é bloco vazado, não bloco vermelho.** Fundo `color/bg/card`, contorno `color/border/control`. Cheio contra vazado é a distinção mais forte sem usar cor, e **não julga** — um financiamento não é um erro.
22. **A conta fecha no rodapé**, com Patrimônio Líquido.

### O estado de carregando, com a rampa clara 🟩

23. Com a rampa clara, "bloco claro" deixou de dizer carregando. O esqueleto se diferencia por três coisas ao mesmo tempo, e nenhuma é claridade: **cinza neutro** (sem o azul da rampa), **sem contorno**, **sem texto**.

**Não existe mockup deste estado, e é deliberado.** Mockup serve pra testar regra incerta, não pra instruir. Se em uso alguém relatar que o carregando parece tela vazia, aí passa a existir dúvida e vale desenhar.

### Tabela pura, sem reforço visual extra 🟩

24. **Nem a cascata do DRE nem Entradas e Saídas usam elemento gráfico junto da tabela.** As duas tentativas iniciais adicionavam algo além do nome e do valor: uma barra proporcional de grandeza (DRE) e um diagrama Sankey de fontes → hub → destinos (Mapa de Fluxo, hoje **Entradas e Saídas**). As duas foram removidas na mesma revisão, pelo mesmo motivo: o objetivo é o visual menos poluído possível, e a tabela sozinha, bem tipografada (número tabular à direita, hierarquia por peso nas linhas de resultado), já cumpre isso sem precisar de metáfora visual adicional.
25. **O Sankey especificamente não sobreviveu ao teste do mockup.** Ele seguiu a regra escrita à risca (fita como dado, nó como âncora, mínimo de 3px, rampa por ranking) e ainda assim não leu como "fluxo": o hub agregando tudo antes de redistribuir tirava a rastreabilidade de qual fonte foi pra qual destino, que é a razão de ser de um Sankey. Ver doc02 pra o histórico da decisão.
26. **Se um gráfico voltar a fazer sentido aqui no futuro**, ele entra como elemento novo, não como remendo da tabela — a tabela continua sendo a fonte de verdade acessível (regra 9), com ou sem gráfico ao lado.

---

## Barra lateral

> 🟩 **Redesenho de 2026-10-01, pendente de design** (ver doc01 §0): os grupos recolhíveis viraram títulos de seção fixos, "Início" virou item, a barra ficou fixa na tela, a linha passou a 32 e o Alternador de tema foi para o rodapé. O que segue descreve a Mockup anterior.

Segue exatamente a estrutura do wireframe (docs 01 e 02), que **não** é uma lista plana:

- Marca **"Finanças PF+PJ"** (sem espaços em volta do `+`), com o **Alternador de tema** (componente novo, ver Biblioteca de componentes) na mesma linha, empurrado pro extremo direito (`primaryAxisAlignItems: SPACE_BETWEEN`).
- Botão primário "+ Novo Lançamento".
- **"Relatórios"** é um grupo recolhível, expandido por padrão, com quatro filhos recuados.
- Itens de nível raiz: Revisão de Recorrentes, Histórico.
- **"Plano de Contas e Patrimônio"** é o segundo grupo recolhível, recolhido por padrão.

Item ativo usa `color/bg/state-subtle` + `color/text/state`, o mesmo mecanismo de seleção dos controles segmentados.

**O que o Alternador de tema resolve 🟩:** até esta revisão, o produto tinha os dois modos (claro/escuro) totalmente desenhados, mas nenhum controle na interface pra pessoa trocar entre eles — lacuna percebida ao revisar o sistema como um todo, não um pedido de PRD. Decisão: alternância manual (não segue o sistema operacional automaticamente), controle fixo na barra lateral por ser o único elemento hoje compartilhado por todas as telas — colocar num cabeçalho por tela exigiria repetir o componente em 15 lugares, com risco de inconsistência. Ver doc02 pro raciocínio completo.

**Cobertura no Wireframe 🟩:** o componente foi replicado nas 25 telas "Desktop —" principais do Wireframe (incluindo as 4 abas do Novo Lançamento e os 5 modais "sobre Início"), além da própria Início — 26 cópias de sidebar no total. **Ficaram de fora, deliberadamente**: os estados "Vazio" (conta nova, sem dado) e o estado "Home em Modo de Organização", que são variações de estado das mesmas telas, não telas novas — replicar neles é trabalho pendente, não uma decisão em aberto.

**Divergência a validar 🟩:** no wireframe os dois grupos usam `▾`. Aqui o recolhido usa `▸` e o expandido `▾`.

---

## Biblioteca de componentes 🟩

Página **Style guide**, onze component sets, posicionados à direita das telas de prova de conceito. Cada um usa só os tokens já existentes nas coleções **Cor** e **Escala** — nenhum componente inventou uma cor nova, com uma única exceção documentada abaixo (`color/border/negative`).

**Nomenclatura: `Propriedade=Valor`, o formato nativo do Figma.** Uma revisão anterior renomeou as 52 variantes para nome único com barra (`btn/primary/default`, `tag/pf`, `accordion-row/expanded`…), apostando que o nome colaria direto no código; a aposta foi revertida em 2026-09-08 porque o formato não é cosmético — é a sintaxe que o Figma **parseia**. Sem o `=`, os 11 component sets ficaram sem propriedade nenhuma: nada de seletor no painel, nada no Dev Mode, e `componentPropertyDefinitions` lançava erro nos 11, o que também impedia dar qualquer propriedade a um set (foi assim que a falta apareceu — ao tentar adicionar o slot de conteúdo à Linha expansível). Os eixos de cada set, hoje:

| Componente | Eixos de variante |
|---|---|
| Botão | `Estilo` (Primário, Secundário, Texto) × `Estado` (Padrão, Hover, Foco, Desabilitado) |
| Botão de ícone | `Estado` (Padrão, Hover, Foco) + propriedade `Ícone` (troca de instância) |
| Campo | `Estado` (Padrão, Foco, Erro, Desabilitado) |
| Etiqueta | `Tipo` (PF, PJ, Previsto, Pago) |
| Controle segmentado | `Opções` (2, 3) × `Selecionado` (1, 2) × `Estado` (Padrão, Foco) |
| Card | `Estado` (Padrão, Hover, Foco) |
| Linha de tabela | `Tipo` (Cabeçalho, Dado) × `Estado` (Padrão, Hover, Foco) |
| Toggle | `Valor` (Ligado, Desligado) × `Estado` (Padrão, Foco, Desabilitado) |
| Alternador de tema | `Tema` (Claro, Escuro) × `Estado` (Padrão, Foco) |
| Progresso | `Passo` (1 a 5) |
| Linha expansível | `Estado` (Recolhido, Expandido, Foco) + propriedade `Conteúdo` (troca de instância) |

Uma divergência consciente em relação ao texto original deste documento: **Alternador de tema** usa dois eixos (`Tema` × `Estado`) e não um só de `Estado` (Claro, Escuro), porque o eixo precisa carregar também a variante de Foco adicionada depois — os dois não cabem na mesma propriedade.

**Conferência contra o Wireframe 🟩:** depois da biblioteca fechada, passei o Wireframe inteiro (3.807 nós de texto, todas as telas) procurando ícone, tipografia, cor e componente que a Style guide não cobrisse ainda. Tipografia e cor não têm o que auditar ali — o Wireframe é cinza e usa Inter de propósito, é o "o quê", não o "como se parece" (ver nota no fim deste doc). Ícone: só apareceram `▾`, `↗`, `←`, `→` e `▸`, todos já na biblioteca; os círculos de 16px que pareciam suspeitos eram o dedo do Toggle e o `icon/info`, não coisa nova. Componente: essa conferência foi o que revelou a falta de **Progresso** e **Linha expansível**, os dois só usados no fluxo de Onboarding, que passam a fazer parte da biblioteca a partir desta revisão.

**Hover e selecionado legíveis no claro** 🟩 *(2026-10-01, pedido do dono: "está ruim de identificar a transição no modo claro")*. Medido em tokens.css: no claro, card `#ffffff` × subtle `#f4f5f6` = 1,09:1, e todo par de fundos fica entre 1,03 e 1,14:1 — o hover em `bg/subtle` não aparecia. Entra o token **`color/bg/hover`** (`#dfe3e6` claro, 1,29:1 contra o card; `#2a333c` escuro), ainda fora da coleção do Figma, e **todo hover de controle passa a usá-lo** (Botão Secundário e Texto, Controle segmentado, Seletor, linhas expansíveis, itens da barra lateral). No **Controle segmentado**, o item selecionado ganha **contorno `color/border/control`** (3:1 contra o trilho) e mantém o texto primário em peso médio — o texto azul de "segmento selecionado" da Hierarquia de cor foi testado e revertido pelo dono no mesmo dia ("fora do padrão visual"); o hover ganha o fundo novo mais o texto primário — duas propriedades por estado (densidade nº 11).

**Todo controle clicável mostra o cursor de mãozinha e tem hover** 🟩 *(2026-10-01, pedido do dono)*. Isso vale para botão, aba, opção, rádio, interruptor, seletor, link e linha expansível. O cursor vem de uma regra única em `globals.css`, por papel, porque o Tailwind 4 tirou o `cursor: pointer` do `<button>`. O hover é o fundo `color/bg/subtle` ou o dimming de 92%, os mesmos do Botão.

**Botão** — `Estilo` (Primário, Secundário, Texto) × `Estado` (Padrão, Hover, Foco, Desabilitado), 12 variantes. Primário é `color/bg/inverse` cheio; Secundário é contorno `color/border/control`; Texto não tem fundo nem contorno. Foco é o mesmo em todos os três: anel de 2px em `color/border/focus`, por fora do componente, sem mudar o tamanho da caixa. Desabilitado é opacidade 40% no componente inteiro, não uma cor nova. Hover no Primário é opacidade 92% (dimming sutil, coerente com "sem sombra"); no Secundário e no Texto é fundo `color/bg/subtle`.

*Quando usar 🟩:* Primário é a ação principal do contexto (uma só por tela ou por formulário — "Salvar Lançamento", "Confirmar Venda"). Secundário é uma ação alternativa de mesmo peso funcional, mas não a principal ("Cancelar" ao lado de "Confirmar", ou as duas ações de mesmo peso no cabeçalho do Detalhe do Passivo, doc01 seção 12). Texto é ação leve dentro de contexto já denso — nunca a única ação de uma tela. 🟩 *2026-10-01, pendente de design:* a ação em linha de tabela ("Editar", "Marcar Pago", "Descartar", "Remover", "Analisar") deixou de ser Texto, porque não parecia botão (pedido do dono). Agora é **Secundário compacto**: o contorno `color/border/control` na altura do Botão de ícone (32), com `color/text/negative` no texto das destrutivas. Texto ficou para botão de ícone e para abrir/fechar uma lista. *Quando não usar:* nunca dois Primários lado a lado (a hierarquia de decisão some); não usar Texto pra uma ação destrutiva ou irreversível — o produto ainda não tem uma variante de botão "negativa/destrutiva" definida, então uma ação desse tipo precisa passar por essa lacuna antes de virar botão (ver seção de contraste/acessibilidade, pendente).

**Botão de ícone** — `Estado` (Padrão, Hover, Foco), 3 variantes, componente novo desta revisão. Contêiner de 32×32 (raio `scale/radius/control`) com o ícone de 20×20 centralizado dentro, exposto como propriedade `Ícone` (instance-swap) — troca o ícone sem trocar o componente. Padrão é transparente; Hover ganha fundo `color/bg/subtle`; Foco usa o mesmo anel de 2px em `color/border/focus` do resto do sistema.

*Quando usar 🟩:* qualquer ícone que seja, sozinho, o alvo inteiro de um clique ou toque — resolve a lacuna de área de toque mínima que os ícones de 20×20px tinham sozinhos. Exemplos concretos no produto: as setas do seletor de mês (`← Julho 2026 →`, DRE e outros relatórios), o ícone de calendário do Campo de data, o `info` de tooltip, o `drag-handle` de reordenar card (Organizar Home). *Quando não usar:* ícone que já mora dentro de outro componente com sua própria área de clique definida — o sol/lua do Alternador de tema já tem 32×32 de área própria dentro do trilho, não precisa de um Botão de ícone por dentro; e ícone puramente decorativo, sem ação própria (o `arrow-diagonal` dentro de um bloco de treemap, ou o `chevron` de um item de navegação cujo clique é a linha inteira, não o ícone isolado).

**Campo** — `Estado` (Padrão, Foco, Erro, Desabilitado), 4 variantes. Rótulo acima (body.sm, `color/text/secondary`), caixa com contorno `color/border/control`, raio `scale/radius/control`. Foco usa o mesmo anel do botão. Erro troca o contorno para `color/border/negative` e adiciona uma linha de mensagem abaixo em `color/text/negative`.

*Quando usar 🟩:* qualquer entrada de texto, número ou data em formulário — é o padrão-base de todos os campos do Novo Lançamento e dos cadastros. *Quando não usar:* pra escolha entre um conjunto fixo e pequeno de opções (isso é Controle segmentado ou Toggle, não um Campo com dropdown disfarçado); e não usar o estado Erro pra avisos que não bloqueiam o salvamento — mensagens informativas (como a legenda de Consumo Livre) usam texto comum, não o padrão de erro do Campo.

**Etiqueta** — quatro tipos (PF, PJ, Previsto, Pago), não dois eixos de variante, porque nunca coexistem na mesma etiqueta. PF e PJ usam `color/text/pf`/`color/bg/pf-subtle` e `color/text/pj`/`color/bg/pj-subtle`; Previsto usa `color/text/alert`/`color/bg/alert-subtle`; Pago usa `color/text/positive`/`color/bg/positive-subtle`. Pílula (`scale/radius/pill`), texto em label.xs.

*Quando usar 🟩:* marcar um atributo do item numa lista ou tabela, sempre um dos 4 tipos já definidos. *Quando não usar:* a Etiqueta não é clicável e não deve virar botão disfarçado (pra ação, use Botão Texto ao lado, não a etiqueta em si); e não inventar um 5º tipo sem antes definir o token de cor correspondente — hoje só existem os 4 pares de token que os 4 tipos usam.

**Controle segmentado** — `Opções` (2, 3) × `Selecionado` (posição), com exemplos PF/PJ e Mês/Trimestre/Ano. Trilho em `color/bg/subtle`, item selecionado ganha fundo `color/bg/card` — a mesma lógica de profundidade por claridade usada no resto do sistema, sem sombra. **Foco 🟩** (adicionado nesta revisão): anel de 2px em `color/border/focus` no segmento individual que está com foco de teclado, não no trilho inteiro — variante de exemplo `Opções=2, Selecionado=1, Estado=Foco`.

*Quando usar 🟩:* escolha entre 2 ou 3 visões/categorias mutuamente exclusivas, todas visíveis ao mesmo tempo, sem estado "nenhuma selecionada" (sempre tem um item ativo). *Quando não usar:* mais de 3 opções vira lista ou dropdown, não Controle segmentado; e não usar pra ligar/desligar uma função isolada — isso é Toggle. A diferença prática: Controle segmentado troca **qual visão** a pessoa está olhando (PF/PJ/Consolidado); Toggle liga ou desliga **uma característica** de um item (recorrência ativa ou não).

**Card** — `Estado` (Padrão, Hover, Foco), raio `scale/radius/card`, contorno `color/border/default`. Hover clareia o fundo pra `color/bg/subtle` e escurece o contorno pra `color/border/strong`. Só se aplica quando o card inteiro é clicável; a maioria dos cards do produto é só exibição e fica sempre em Padrão. **Foco 🟩** (adicionado nesta revisão, variante `Estado=Foco`): anel de 2px em `color/border/focus` por fora, substituindo o contorno padrão enquanto o card está focado — mesma regra de "só quando clicável" do Hover. **Ícone de card clicável 🟩** (adicionado nesta revisão): quando o card inteiro é clicável, ganha um `arrow-diagonal` (↗) de 18×18 no canto superior direito do cabeçalho, na mesma linha do título — mesma altura, encostado na borda direita do card, sem folga. É só pista visual: o alvo de clique continua sendo o card inteiro, nunca o ícone isolado (mesmo princípio do bloco de treemap, doc08 seção 2.9, e mesma regra de "quando não usar" do Botão de ícone, acima — este ícone nunca vira um Botão de ícone próprio). Card sem essa condição (a maioria) não leva o ícone.

*Quando usar 🟩:* contêiner visual de agrupamento — a maioria dos blocos da Home e dos relatórios. Use o estado Hover **só** quando o card inteiro navega pra algum lugar ao ser clicado; um card puramente informativo (a maioria) nunca deveria ganhar o estado Hover, mesmo que "pareça mais bonito" — hover num elemento que não faz nada ao clicar é sinal falso pra quem usa o produto. *Quando não usar:* pra listar itens comparáveis lado a lado com várias colunas de dado — isso é Linha de tabela, não uma pilha de Cards.

**Linha de tabela** — `Tipo` (Cabeçalho, Dado) × `Estado` (Padrão, Hover no Dado, Foco no Dado), 4 variantes. Altura fixa em `scale/height/table-row`, uma divisória só (borda inferior 1px, `color/border/default`), número sempre à direita e tabular. Cabeçalho é caixa alta, `color/text/secondary`, sem fundo — regras de densidade 2 e 4 aplicadas ao componente. **Foco 🟩** (adicionado nesta revisão, variante `table-row/focus`): anel de 2px em `color/border/focus` ao redor da linha inteira, só faz sentido onde a linha inteira é clicável (ex.: Histórico, onde clicar no item abre a edição) — mesma condição do Hover.

*Quando usar 🟩:* listas de itens comparáveis, com o mesmo conjunto de colunas linha a linha (Histórico, Lançamentos do DRE, Entradas e Saídas). *Quando não usar:* pra 1 ou 2 itens sem estrutura tabular real (aí um Card comunica melhor); e o estado Hover da linha só faz sentido quando a linha tem ação própria (Editar, Marcar Pago) — uma tabela só de leitura, sem ação por linha, não precisa do estado Hover.

**Toggle** — `Valor` (Ligado, Desligado) × `Estado` (Padrão, Foco, Desabilitado), 6 variantes. Trilho 36×20, pílula (`scale/radius/pill`), círculo branco (`color/bg/card`). Ligado usa `color/text/state`, o mesmo azul de estado do resto do sistema — não é "sim = bom", é estado ativado, igual ao item de navegação selecionado. Desligado usa `color/border/control`. Usado nos campos opcionais com valor padrão pré-selecionado, como "Definir data de término" da recorrência (docs 02 e 03).

*Quando usar 🟩:* ligar/desligar uma única característica ou opção binária de um item, com efeito imediato (não precisa de botão "Salvar" separado). *Quando não usar:* pra trocar entre visões ou categorias — isso é Controle segmentado (ver a diferença explicada lá); e não usar Toggle quando as duas opções têm um resultado visual concreto e não abstrato (like tema claro/escuro) — esse caso é o Alternador de tema, com ícones no lugar do trilho genérico, ver raciocínio completo no doc02.

**Alternador de tema** — `Estado` (Claro, Escuro), 2 variantes, componente novo desta revisão. Mesma mecânica visual do Controle segmentado (trilho `color/bg/subtle` com contorno `color/border/default`, raio `scale/radius/control`, item ativo ganha fundo `color/bg/card`), só que os dois "segmentos" são os ícones `icon/sun` e `icon/moon` em vez de texto. O ícone ativo sobrescreve a cor pra `color/text/primary`; o inativo fica em `color/text/secondary` — mesmo padrão de ênfase por cor que o Controle segmentado já usa no texto. Único lugar do produto, por enquanto: a barra lateral, ao lado da marca. **Foco 🟩** (adicionado nesta revisão): anel de 2px em `color/border/focus` no botão de ícone individual (sol ou lua), igual ao Controle segmentado — variante de exemplo `Tema=Claro, Estado=Foco`.

*Quando usar 🟩:* só pra alternar o tema claro/escuro do produto — é um componente de propósito único, não um "Controle segmentado com ícone" genérico reaproveitável pra outras escolhas binárias. *Quando não usar:* não replicar essa mecânica (ícone dentro de trilho) pra outras alternâncias de 2 opções — se a escolha for abstrata (ligado/desligado), o componente certo é o Toggle; se for entre categorias, é o Controle segmentado com texto.

**Progresso** — indicador de passo dos 5 onboardings (`Passo=1` a `Passo=5`), 5 variantes. Cinco pílulas em fileira; a do passo atual é mais larga e em `color/bg/inverse`, as outras em `color/border/default`. Não marca "concluído" separadamente do "atual" — o onboarding é um wizard linear com Voltar/Avançar, então a posição já basta.

*Quando usar 🟩:* só em fluxos lineares de etapas fixas e conhecidas de antemão, como o wizard do onboarding. *Quando não usar:* não é um indicador de percentual de valor — o progresso do Consumo Livre ("R$ 350 / R$ 500") é dado calculado em tempo real, não passo de wizard, e usa sua própria barra, não este componente; não usar Progresso pra algo que a pessoa possa pular etapas ou repetir fora de ordem.

**Linha expansível** — `Estado` (Recolhido, Expandido, Foco), 3 variantes. Cabeçalho com título numerado (body.md-medium) + descrição auxiliar (body.md, `color/text/secondary`) + `icon/chevron-right` (recolhido) ou `icon/chevron-down` (expandido). Recolhido é só o cabeçalho em `color/bg/subtle`; expandido ganha contorno `color/border/default`, uma divisória e a área de conteúdo do bloco. Usada na revisão do Plano de Contas no onboarding e nas 5 abas em acordeão de Plano de Contas e Patrimônio pós-onboarding (doc 02). **Propriedade `Conteúdo` 🟩** (adicionada em 2026-09-08, troca de instância): o que aparece na área de conteúdo quando expandido. Existe porque instância de componente não aceita filho novo — sem o slot, montar um bloco com conteúdo real obrigava a desenhar um card irmão ao lado da Linha expansível, e a tela ganhava um card que o produto não tem. O padrão da propriedade é o placeholder de sempre, então o componente parece o mesmo de antes até alguém trocar. **Foco 🟩** (adicionado nesta revisão, variante `Estado=Foco`): anel de 2px em `color/border/focus` ao redor do cabeçalho inteiro — é ele que expande/recolhe ao ser ativado.

*Quando usar 🟩:* agrupar conteúdo secundário que a maioria das pessoas não precisa ver de cara, mas que precisa continuar acessível sem trocar de tela (blocos do Plano de Contas). *Quando não usar:* não é substituto de navegação entre telas — os grupos recolhíveis da barra lateral (Relatórios, Plano de Contas e Patrimônio) são outro padrão, específico de navegação, não este componente; e nunca esconder um campo obrigatório de formulário dentro de uma Linha expansível recolhida — a pessoa pode nem abrir e deixar de preencher algo que precisava.

### O novo token: `color/border/negative` 🟩

O Campo precisava de um estado de erro de validação ("CPF inválido", campo obrigatório vazio), e a regra do doc 07 até aqui reservava vermelho só pra variação financeira negativa. Essa é a única exceção do sistema: **vermelho também marca erro de formulário**, não só valor negativo. A decisão foi consciente — erro de campo é convenção forte demais pra brigar com ela usando âmbar ou ausência de cor — e por isso ganhou um token próprio (`color/border/negative`, mesmo valor de `color/text/negative` nos dois modos, com escopo de contorno) em vez de reaproveitar `color/text/negative` fora de escopo. Se um dia aparecer um terceiro uso de vermelho, é sinal de que a exceção virou regra e merece revisão.

---

## Biblioteca de ícones 🟩

16 componentes, grade de 20×20px, traço de 1,5px com ponta e junção arredondadas (eco da Geist e dos raios do sistema, nunca aresta dura), cor padrão `color/text/secondary`. Sem preenchimento, exceto nos pontinhos (alça de arrastar, mais opções) onde o preenchimento é o próprio ícone. Nomeados `icon/{nome}`, mesma convenção da biblioteca de componentes.

**Os 10 confirmados em uso real**, cada um rastreável a um lugar específico do produto: `chevron-down` e `chevron-right` (expandir/colapsar, barra lateral), `arrow-diagonal` (badge `↗` de bloco clicável), `arrow-left` e `arrow-right` (navegação/paginação), `calendar` (abrir seletor de data, doc 02), `info` (tooltip de ajuda contextual, doc 02, sem preenchimento preto), `drag-handle` (reordenar card na Home, doc 06), **`sun` e `moon`** (Alternador de tema, novo nesta revisão — `moon` é o único ícone da biblioteca construído por operação booleana, `figma.subtract`, em vez de vetor desenhado à mão, porque uma lua-crescente exige um recorte curvo que uma única linha de traço não desenha).

**`icon/repeat`** 🟩 *2026-10-01, pendente de design — ainda não existe no Figma:* duas setas em laço, na mesma regra (20×20, traço 1,5, pontas arredondadas). Marca o que é recorrente ao lado do nome do lançamento na tabela do DRE e no Histórico, com o nome acessível "Recorrente" (pedido do dono).

**`icon/eye` e `icon/eye-off`** 🟩 *2026-10-01, pendentes de design — ainda não existem no Figma:* o "olhinho" da simulação do DRE. O `eye-off` é um **olho fechado**: a pálpebra em curva para baixo e três cílios, sem íris (o dono pediu "abrir e fechar", mais legível que o olho riscado). Desenhados na mesma regra dos demais.

**6 de uso geral**, adicionados sem uso comprovado ainda, pra não precisar interromper uma tela nova por falta de ícone: `search`, `close`, `check`, `trash`, `more-horizontal`, `download`.

**Cor não é fixa no componente.** `color/text/secondary` é o padrão porque é o que a maioria dos usos documentados já pedia (chevron de navegação, ícone de calendário ao lado de campo), mas cada instância pode sobrescrever a cor conforme o contexto — por exemplo, um chevron dentro do item ativo da barra lateral usa `color/text/state`, não o padrão do componente.

---

## Processo pra criar um mockup novo 🟩

Premissas fixas — valem pra todo mockup novo, sem precisar ser repetidas a cada pedido:

1. **Nunca alterar o Wireframe original.** Mockup é sempre uma peça nova, construída do zero ou clonada de outro mockup já pronto — nunca uma edição do frame cinza correspondente. Se a correção certa parecer "editar o Wireframe", é sinal de que a peça deveria nascer como mockup separado.
2. **Não é colorir um wireframe — é construir com os elementos reais do design system.** Cor, espaçamento, raio, altura de controle e traço sempre vinculados a variável (nunca número ou hex solto); texto sempre com o estilo nomeado certo (nunca fonte/tamanho aplicado à mão); todo elemento atômico (botão, ícone, etiqueta, controle segmentado, toggle, alternador de tema) sempre uma **instância real** do componente da Biblioteca — nunca redesenhado à mão pra só parecer com o componente. Card é a exceção conhecida: é mixin de estilo (borda + raio + cor), não átomo de conteúdo fixo, então não vira instância.
3. **Claro e escuro juntos, por padrão.** Construir o claro, depois clonar e trocar o modo da coleção de variáveis **Cor** pra Escuro (`setExplicitVariableModeForCollection`) — nunca recolorir à mão. Variantes de componente que carregam estado visual próprio, não só cor (o `=light`/`=dark` do Alternador de tema, por exemplo), precisam de troca manual de variante depois do clone, porque variante não é token de cor e não muda sozinha com o modo. Só pular o escuro com decisão explícita registrada no doc02 (caso de "Início dashboard", revertido depois).
4. **Sidebar, cabeçalho e qualquer peça compartilhada entre telas: clonar de um mockup já pronto, nunca reconstruir do zero.** Reconstruir à mão é exatamente como a divergência de estrutura entre o dashboard e o DRE/Evolução Mensal aconteceu (ver doc02) — clonar garante padding, largura e estrutura interna idênticos sem precisar acertar cada número à mão.
5. **Passa pelo checklist de conformidade de tokens (seção Tokens, acima) antes de considerar pronto** — as 8 categorias, não só cor. Um mockup não está "pronto" só porque parece certo em screenshot; precisa ter cada valor de token de fato vinculado, e cada átomo de fato instanciado.
6. **Frame sempre 1440px de largura, altura nunca menor que 900px.** Levantado direto das 26 telas do Wireframe: largura é fixa nas 26; altura varia por tela, mas nunca fica abaixo de 900 — é o piso da viewport padrão "acima da dobra", mesmo em tela com pouco conteúdo (Histórico, Revisão de Recorrentes, Balanço Patrimonial, Evolução Mensal e os 5 modais "sobre Início" ficam exatamente em 900). Telas com mais conteúdo crescem além disso, nunca encolhem pra menos. **Nunca redimensionar o frame pra "hug" exato do conteúdo** — isso pode deixar a tela abaixo do piso, cortada/pequena demais numa janela de navegador de verdade. **Ao clonar uma tela existente como base e depois adicionar bem mais conteúdo (ex.: uma tela de lista virando uma tela de 4 cards empilhados), medir a altura de novo antes de decidir o tamanho final** — alternar `counterAxisSizingMode` pra `AUTO` só pra medir a altura real do conteúdo, depois fixar em `max(900, altura medida)`. Nunca confiar no número já setado no frame herdado do clone: um frame `FIXED` mantém a altura antiga mesmo depois do conteúdo interno crescer além dela, e o excesso vaza silenciosamente pra fora do frame sem erro nem aviso. **Esta regra NÃO vale para tela de modal:** lá o fundo é recortado de propósito e crescer a moldura destrói o que o recorte comunica — ver a regra 10, que traz a invariante que distingue os dois casos.
7. **Todo texto criado do zero precisa de `fills` explícito e vinculado, na mesma hora em que o estilo de texto é aplicado.** `setTextStyleIdAsync` só cobre fonte/tamanho/entrelinha — nunca cor. Texto novo sem `fills` nasce preto sólido, sem vínculo, e **isso passa despercebido no modo claro** (preto puro e `color/text/primary` claro são quase idênticos visualmente) — só aparece quebrado no escuro, onde o preto não vira claro junto com o resto. Regra geral por trás desta e da anterior: **toda propriedade de um nó novo precisa ser setada explicitamente**, nunca assumir que uma API cobre mais do que o nome sugere, e nunca confiar só no screenshot do modo claro pra validar cor — testar sempre os dois modos.
8. **Todo frame novo que serve só de wrapper de layout precisa de `fills = []` explícito — vale tanto pra `figma.createFrame()` quanto pra `figma.createAutoLayout()`.** Frame novo nasce com fundo branco sólido, sem vínculo, nos dois casos — mesma família de bug da regra 7 (propriedade "óbvia demais" que ninguém seta por parecer desnecessária). No claro passa despercebido (branco sobre branco); no escuro vira uma faixa clara visível atrás do conteúdo. Checar todo frame-wrapper criado do zero, não só os que têm cor pretendida — e não assumir que só `createFrame()` tem esse comportamento só porque foi onde o bug apareceu primeiro.
9. **Nunca redimensionar uma instância de `icon/*` — usar sempre o tamanho nativo 20×20 do componente.** Os ícones deste sistema têm o desenho interno (vetor/elipse) com `constraints: MIN/MIN`, não `SCALE` — redimensionar a instância corta/desloca o desenho em vez de escalar junto. Esse bug já apareceu duas vezes na mesma sessão (a setinha diagonal dos cards, depois os ícones `icon/info` de Novo Lançamento) porque a regra estava só no log de decisões, não aqui como regra ativa do processo — se precisar de um ícone visualmente menor num contexto apertado, o ajuste é no espaçamento ao redor, nunca no tamanho do ícone.
10. **Telas que são modal (Novo Lançamento e os demais "modais sobre Início"): compor como fundo + scrim + diálogo, nunca como tela cheia própria.** Fundo = clone do mockup real do Início já pronto (claro/escuro), nunca o Wireframe cinza. Scrim = retângulo preto a ~45% de opacidade, **sem vínculo de token** (decisão deliberada — um escurecedor de fundo não muda de cor com o tema). Diálogo = Card mixin (bg/card, border/default, radius/card), sem sombra (a biblioteca não tem estilo de efeito nenhum — `getLocalEffectStylesAsync()` vazio — flat é a linguagem visual do sistema inteiro). Altura do composite = a maior necessária entre as variações da mesma tela (ex.: as 4 abas de Novo Lançamento dividem a mesma altura de canvas, dimensionada pela aba mais alta), com o diálogo **centralizado verticalmente** dentro dela — nunca fixado num `y` só, pra não sobrar vão vazio embaixo de diálogos mais curtos. Ao clonar pro escuro, trocar também o fundo pelo clone do Início **escuro** já pronto (não só mudar o modo de cor do fundo claro) — o Início escuro é seu próprio mockup finalizado, com o alternador de tema já na posição certa.

    **Regra 🟩 (posição do diálogo, com fórmula):** "centralizado" não é um julgamento visual, é uma posição calculada, nos dois eixos, sempre em relação à **área de conteúdo** (a área à direita da sidebar, nunca o frame inteiro):
    - `diálogo.x = larguraDaSidebar + (larguraDoFrame − larguraDaSidebar − larguraDoDiálogo) / 2`
    - `diálogo.y = (alturaDoFrame − alturaDoDiálogo) / 2`

    **Regra 🟩 (o recorte do fundo é PROPOSITAL, e tela nova nesse formato replica):** a moldura de uma tela de modal é uma **janela**, não a página inteira. O fundo é maior que a moldura e fica cortado de propósito — é o recorte que evidencia a decisão de desenho: o modal aparece *sobre* a tela em que a pessoa já estava, em vez de ser uma tela própria. Medido: os 5 "modais sobre Início" do Wireframe têm moldura de 900 sobre um fundo de 2501; no Mockup, `Destinar o Lucro` tem 1300 sobre um conteúdo de 1474, e `Registrar Reajuste de Juros`, 1000 sobre 1270. Nenhum desses é defeito, e nenhum deve ser "consertado" crescendo a moldura — crescer a moldura destrói justamente o que o recorte comunica.

    **A invariante que separa esse recorte de uma moldura velha (o defeito da regra 6), e ela é checável nó a nó:**

    - **O diálogo cabe inteiro na moldura, sempre.** Diálogo cortado é defeito, nunca convenção. (Conferido: `Destinar o Lucro` ocupa 147→1153 dentro de 1300; `Registrar Reajuste de Juros`, 243→757 dentro de 1000.)
    - **Só o filho que representa o fundo pode estourar.** Na página Mockup esse filho é a coluna `Conteúdo` (ou `Backdrop (Início)`), e a `Barra lateral` acompanha a moldura. Na página Wireframe, onde o desenho é esquemático, o fundo inteiro — `Sidebar` **e** `Frame` — fica na altura real da página e é recortado junto: os 5 "modais sobre Início" têm `Sidebar` de 2501 numa moldura de 900, e isso é correto ali.
    - **Qualquer outra coisa estourando é defeito.** Foi assim que a auditoria de 2026-09-08 achou a `Sidebar` de "Registrar Reajuste de Juros (modal)" com 1050 numa moldura de 1000 — não batia nem com a moldura, nem com a página de fundo (o Detalhe do Passivo do Wireframe tem 1500), enquanto os outros três filhos terminavam exatos em 1000. Era a barra sozinha fora do esquadro; foi corrigida pra 1000.

    Consequência pra quem audita: **uma varredura que compara conteúdo com moldura vai acusar TODA tela de modal**, e quase toda acusação é ruído. O que se checa é a invariante acima, não o estouro.

    **De onde vem a altura da moldura de uma tela de modal, já que ela quase nunca é 900:** do diálogo, não do fundo. A moldura precisa comportar o diálogo inteiro **e** deixá-lo centralizado pela fórmula acima, respeitando o piso de 900 da regra 6. Confere na aritmética das duas telas do Mockup que fogem do piso: `Destinar o Lucro` tem diálogo de 1006 numa moldura de 1300 — `(1300 − 1006) / 2 = 147`, exatamente o `y` do diálogo; `Registrar Reajuste de Juros`, diálogo de 514 em 1000 — `(1000 − 514) / 2 = 243`, idem. **`Destinar o Lucro` não pode ser 900**: o diálogo sozinho é maior que isso. Quem "normalizar" essas molduras pro piso corta o diálogo e quebra a invariante — a altura já está subordinada a ele.

    Nunca posicionar por olho, nem herdar o `x`/`y` de um clone anterior sem recalcular pra largura/altura do diálogo daquela tela específica — um diálogo mais alto ou mais largo que o de origem desalinha os dois eixos imediatamente. Auditoria de fechamento (ver doc02) encontrou 34 telas de modal desviando dessa fórmula: os 16 mockups de Novo Lançamento centralizados no frame inteiro em vez da área de conteúdo (136px de desvio horizontal, herdado de antes da convenção "área de conteúdo, não frame inteiro" existir), e desvio vertical de até 95px em outras 9 (Detalhe da Categoria e Detalhe do Bloco, os piores casos, com o diálogo quase encostando no rodapé). Todas recalculadas pela fórmula acima.
11. **Item ativo de navegação (sidebar) muda em pelo menos 2 propriedades independentes: cor (fundo `bg/state-subtle` + texto `text/state`) E peso da fonte (`body.md-medium`, não `body.md`).** Ao ativar/desativar um item da sidebar, trocar só a cor e esquecer o peso da fonte deixa o item "ativo" com peso normal — sutil o bastante pra passar numa checagem rápida, óbvio ao lado de qualquer outra tela com o padrão certo. Regra geral por trás: **antes de escrever o script que ativa/desativa qualquer estado visual, levantar todas as propriedades que mudam entre os dois estados, não só a mais óbvia.**
12. **Em auto-layout, o "eixo primário" segue a direção do `layoutMode`, não é sempre largura ou sempre altura.** Numa frame `HORIZONTAL`, `primaryAxisSizingMode` controla a **largura** e `counterAxisSizingMode` controla a **altura** — o oposto do que a intuição "primário = principal = altura" sugere. Setar `primaryAxisSizingMode = 'AUTO'` numa linha horizontal esperando que ela hugue a altura do conteúdo não faz nada pra altura (que fica presa no valor do último `resize()`) e pode deixar texto de duas linhas vazando por cima do elemento vizinho, sem erro nem aviso — só visível no screenshot. Antes de escrever `primaryAxisSizingMode`/`counterAxisSizingMode` num frame novo, confirmar qual dos dois eixos é qual olhando o `layoutMode` daquele frame especificamente, nunca por hábito do último frame que se escreveu.

**Quando isso não se aplica:** provas de conceito isoladas (ver seção abaixo) têm critério próprio — só ganham mockup onde existe uma dúvida de desenho real a responder, não pra cobrir toda tela do produto.

---

## Provas de conceito

Cinco telas foram desenhadas antes da Mockup existir, em claro e escuro: `Desktop — DRE`, `Desktop — Evolução Mensal`, `Card — Despesas por Categoria`, `Card — Onde Está Meu Dinheiro` e `Card — Entradas e Saídas`.

**Elas não existem mais como frames próprios** (conferido no arquivo em 2026-09-11: a página Style guide tem `Benchmark`, `vision board` e `style guide`, e nada além disso). A Mockup as substituiu pelas telas reais — que é o desfecho certo para uma prova de conceito: ela some dentro do que provou. O que segue valendo delas são as regras 24-26, escritas abaixo.

Cada uma foi escolhida por ter uma dúvida que só o desenho responderia: a densidade do DRE, gráfico e tabela juntos na Evolução, a rampa de matiz único nas Despesas, rampa e semântica convivendo no Patrimônio, e se um diagrama fazia falta no antigo Mapa de Fluxo — a resposta acabou sendo não, ver regras 24-26.

**Critério pra decidir o que mais desenhar:** só ganha mockup a tela onde existe uma dúvida que o desenho responde. Onde a regra escrita já basta, replicar é desperdício.

### Mudanças em relação aos wireframes (docs 01 a 03) — **validadas em 2026-09-09** 🟩

Item a item, em docs/PERGUNTAS-EM-ABERTO.md (P32). Duas delas não estavam de fato implementadas
quando esta seção dizia "a validar", e a validação é que descobriu: o bloco "Outras" das Despesas
por Categoria não abria nada, e nenhum teste travava a não-somabilidade da Evolução Mensal.

**No DRE:** os três parágrafos de ajuda viraram um, com os controles agrupados numa barra · o sinal de menos deixou de aparecer duas vezes · "Pago" perdeu o verde e "Previsto" ficou âmbar · entrou etiqueta PF/PJ na tabela de lançamentos · "Editar" virou ação em texto azul · Lucro Líquido não é verde · a tabela é só nome e valor, sem barra de grandeza relativa (regra 24, revisão que removeu a barra proporcional testada antes).

**Na Evolução Mensal:** o gráfico mostra PF e PJ como duas séries agrupadas, que **não somam** o consolidado porque ele elimina pró-labore e distribuição · número herói com a variação do mês em verde · linha de Lucro Líquido sombreada na tabela.

**Em Despesas por Categoria:** o `↗` ficou dentro do bloco · sem porcentagem · limite de seis blocos com "Outras" a partir do sétimo.

**Em Onde Está Meu Dinheiro:** duas faixas em vez de um treemap único · "tom diferenciado" virou vazado, não vermelho · rodapé com Patrimônio Líquido · nomes de bloco encurtados.

**Em Entradas e Saídas (antigo Mapa de Fluxo):** o diagrama Sankey foi removido por inteiro (regras 24-26) · ficou só a tabela de duas colunas, Entradas e Saídas, nome e valor · o nome da tela mudou junto, porque sem diagrama "Mapa de Fluxo" não descrevia mais o conteúdo (princípio de nomenclatura literal do doc01).

---

## O que ainda falta

- Camada de interação nos gráficos: equivalente de toque pra Mobile — ver doc08, seção 7.
