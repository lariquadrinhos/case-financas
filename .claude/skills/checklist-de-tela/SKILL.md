---
name: checklist-de-tela
description: Checklist de verificação de uma tela antes de dá-la por pronta. Use depois de implementar ou alterar qualquer rota, componente de tela ou estado de tela, e antes de dizer que está pronta. Confere fidelidade ao Figma, estados vazio/carregando/erro, tokens, acessibilidade, nomenclatura, formato de dinheiro e data, obrigatoriedade de campo, LGPD e o portão local.
---

# Checklist de tela

Esta skill **verifica**, não gera. Ela é aplicada a uma tela que já existe no código.

Rode cada verificação e produza um relatório com ✅/⚠️/❌ por item, citando o arquivo e o
comando. **Não dê a tela por pronta com nenhum ❌.**

⚠️ é para o que você não conseguiu verificar (o frame não existe, o componente ainda não foi
escrito). ⚠️ não vira ✅ por otimismo: ou você rodou o comando e leu a saída, ou o item é ⚠️.

## 1. Fidelidade ao Figma

- O frame correspondente foi localizado em `docs/figma/INDEX.md` e o `.xml` foi lido inteiro
  **antes** de a tela ser escrita. O `.xml` é a fonte de fidelidade, não a API do Figma: a API
  tem limite de chamadas e por isso os 130 frames foram extraídos para `docs/figma/frames/`.
- Todo texto visível da tela aparece no XML, palavra por palavra. Título, rótulo de campo,
  texto de botão, cabeçalho de coluna, legenda, texto de estado vazio.
- Nenhum texto foi inventado, encurtado ou "melhorado" na implementação. O vocabulário foi
  fechado em `files_design/04-glossario-de-nomenclatura.md`; um botão "Descartar" que vira
  "Remover" apaga uma distinção que o produto usa ("Descartar" pula um mês, "Encerrar
  recorrência" para a série).
- A ordem e o agrupamento dos elementos seguem a árvore do XML (`x`/`y` de cada nó).
  **A ordem tem teste** desde a P42 (2026-09-09): a tela ganha uma asserção de ordem de leitura —
  `assertReadingOrder` em jsdom, ou o bloco "Ordem de leitura (P42)" em
  `e2e/visual-fidelity.spec.ts` para as telas que só existem no servidor. Se você mexeu na ordem
  de uma tela e nenhum teste ficou vermelho, a tela ainda não tem essa asserção — acrescente.
- **O que NENHUM teste pega, e por isso é olho seu:** espaçamento, alinhamento, largura de coluna,
  altura de linha e presença de divisória. A auditoria automática cobre texto (177 termos) e
  ordem; o resto é decisão consciente de 2026-09-09 — comparar geometria contra um Mockup fixo em
  1440 num app fluido produziria uma lista de exceções mantida à mão. As duas divergências de
  layout achadas até hoje (alinhamento dos botões de editar categoria, divisória da lista) foram
  vistas a olho, e continuariam sendo.
- **Se a tela é um modal, a página de fundo no frame está cortada DE PROPÓSITO** e não descreve
  aquela página. A moldura de uma tela de modal é uma janela, não a página inteira — o recorte é
  o que evidencia que o modal aparece sobre a tela em que a pessoa já estava (`files_design/07`,
  regra 10 do processo de mockup). Implementar a página de fundo a partir do frame do modal
  produz uma tela curta demais: o "Destinar o Lucro", por exemplo, mostra o DRE cortado em 1300
  de um conteúdo de 1474. Para o fundo, ler o frame **daquela** tela; do frame do modal, ler só
  o diálogo — que sempre cabe inteiro na moldura, e é assim que se sabe que o corte foi escolha
  e não moldura velha.

Achar o frame e listar todo texto dele:

```
grep -i '<nome da tela>' docs/figma/INDEX.md
grep -o 'name="[^"]*"' docs/figma/frames/<arquivo>.xml
```

Exemplo real: `grep -o 'name="[^"]*"' docs/figma/frames/10-2__desktop-revisao-de-recorrentes.xml`
devolve 116 nomes de camada, incluindo todo o texto da tela.

- **Corrigir:** copiar o texto do XML letra por letra. Se o texto do Figma é que está errado,
  mude no Figma primeiro e reextraia o frame; nunca conserte só no código, senão o XML deixa
  de ser fonte de verdade para a próxima pessoa.

## 2. Estados: vazio, carregando e erro

- **Vazio** existe. O Figma desenhou vazio para praticamente toda tela: `docs/figma/INDEX.md`
  lista frames "Vazio — ...". Procure o da sua tela e implemente o texto dele.
- **Carregando** existe. Idem, frames "Carregando — ...".
- O vazio segue o padrão de `files_design/01-especificacao-de-telas.md` §15: título curto +
  mensagem de 1 a 2 linhas explicando o que vai aparecer ali + botão de ação **quando** faz
  sentido resolver na hora (sem botão quando não há ação imediata, como em Evolução Mensal).
- O carregando é esqueleto cinza no mesmo formato do conteúdo real, **sem texto** (§15).
  Motivo: texto no esqueleto é lido por leitor de tela como conteúdo real.
- **Erro** existe, mesmo sem frame. Não há nenhum frame de erro no Figma (o único resultado de
  "erro" no índice é a nota `163:2`). Isso é lacuna de design, não permissão para omitir: a
  tela lê dado e a leitura falha. O erro precisa dizer o que falhou e oferecer nova tentativa.

```
grep -in 'Vazio\|Carregando' docs/figma/INDEX.md
grep -i 'erro' docs/figma/INDEX.md
```

- **Corrigir:** implementar os três estados. Se o texto de erro não existe em lugar nenhum,
  escreva-o e registre a pendência para o Design, em vez de deixar a tela quebrar em branco.

## 3. Tokens

- Nenhum hex e nenhum px literal fora de `src/styles/`. Todo valor vem de
  `src/styles/tokens.css`. Motivo: os tokens marcados `[figma]` são as variáveis literais do
  arquivo `7IZBeQV15kgZp7Shcqh4c8`; um hex solto num componente sai de sincronia com o Figma
  e ninguém descobre.
- Token novo entra em `tokens.css` marcado `[figma]` (existe como variável no Figma) ou
  `[derivado]` (amostrado do wireframe), nunca direto no componente.
- A tela funciona no tema escuro: `tokens.css` redefine a paleta inteira em
  `[data-theme='dark']`. Cor que só existe no claro some no escuro.

```
make audit-tokens
```

- **Corrigir:** mover o valor para `src/styles/tokens.css` e referenciar por `var(--token)`.

## 4. Acessibilidade

- Foco visível preservado. `src/styles/globals.css` define `:focus-visible` com `--anel-foco`
  e `--cor-foco`; nenhum componente pode zerar isso. Motivo: sem anel de foco a tela fica
  inoperável no teclado (WCAG 2.4.7), e este produto é todo formulário e tabela.
- Toda ação é um elemento focável de verdade, `<button>` ou `<a>`, nunca `<div onClick>`.
  Um `div` não recebe foco, não responde a Enter/Espaço e não é anunciado como ação.
- Todo campo tem `<label>` associado por `htmlFor`/`id`. Placeholder não é rótulo: ele some
  quando a pessoa digita, e campo monetário aqui já nasce com máscara ativa, sem placeholder.
- Estado não é comunicado só por cor (WCAG 1.4.1). É a razão pela qual `tokens.css` mantém os
  tokens de estado neutros e o prejuízo aparece com sinal de menos, não em vermelho
  (`files_design/01-especificacao-de-telas.md` §8.1).
- Ordem de tabulação segue a ordem de leitura. Nenhum `tabIndex` positivo.
- Modal prende o foco enquanto aberto, fecha no `Esc` e devolve o foco ao elemento que o
  abriu. Boa parte do produto é modal (Destinar o Lucro, Detalhe da Categoria, Detalhe do
  Bloco, Gastei um Valor, Vender Bem Material, Registrar Reajuste de Juros).

```
grep -rn 'outline: *none\|outline-none' src/
grep -rn 'onClick' src/app src/components src/features
grep -rn '<input\|<select\|<textarea' src/app src/components src/features
grep -rn 'tabIndex' src/
```

Os dois greps do meio listam candidatos; leia cada resultado e confirme o elemento e o `id`.

- **Corrigir:** trocar o elemento por `<button>`, ligar `label`/`id`, remover `tabIndex`
  positivo, adicionar armadilha de foco e handler de `Esc` no modal.

## 5. Nomenclatura

- Todo rótulo confere com `files_design/04-glossario-de-nomenclatura.md`, que registra o nome
  final **e o motivo** de cada escolha. Consulte antes de renomear qualquer coisa.
- Termos que não podem aparecer como rótulo de interface, cada um com substituto fechado:
  "Transação" (é **Lançamento**), "Cadastro" (remete a conta de usuário, que não existe),
  "Painel" (é **Evolução Mensal**), "Ativos" como categoria de bem (é **Bens Materiais**),
  "Intercompany" (é **Pró-labore e Distribuição**), "Mapa de Posição" (é **Onde Está Meu
  Dinheiro**).
- "Descartar" e "Encerrar recorrência" são ações diferentes e nunca se substituem.
- Sem travessão (—) em texto de interface: use vírgula, dois-pontos ou ponto
  (`files_design/00-leia-primeiro.md`).
- Sem emoji decorativo. Só símbolos funcionais: ↗ clicável, ▾ expandir, ← → navegação.

```
grep -rn 'Transação\|Cadastro\|Intercompany\|Mapa de Posição' src/
grep -rn '—' src/app src/components src/features
```

O grep de travessão também acha comentário em pt-BR, que é permitido. Ele também acha o `—`
que `formatarPercentual` devolve quando o percentual é `null`
(`src/domain/core/money.ts`) — esse caso é interface e precisa de decisão do Design.
O alvo da verificação é sempre string renderizada.

- **Corrigir:** usar o nome do glossário. Se o nome do glossário está errado, mude o glossário
  primeiro, com o motivo, e só depois o código.

## 6. Dinheiro e data

- Todo valor exibido passa por `formatMoney` (`src/domain/core/money.ts`). Nunca
  concatenação manual, `toFixed` ou `toLocaleString` solto. Motivo: valor é inteiro de
  centavos justamente porque `0.1 + 0.2 !== 0.3`, e a cascata do DRE soma dezenas de
  lançamentos antes de ser comparada com o Balanço.
- Todo campo monetário usa `MoneyInput` com máscara ativa, iniciando em "R$ 0,00", dígitos
  entrando da direita para a esquerda, vírgula fixa. É máscara, não placeholder, e vale para
  todo campo de moeda de qualquer tela (`files_design/03-modelo-de-dados-por-tela.md`).
  `MoneyInput` ainda não existe no repositório (`src/components/ui/` está vazio): a primeira
  tela com campo monetário cria o componente, e daí em diante toda tela usa o mesmo.
- Toda data exibida passa por `formatDate` (`src/domain/core/time.ts`), que trabalha
  sobre `IsoDate` "YYYY-MM-DD" sem hora. Nunca `new Date(...)` na camada de tela: com hora e
  UTC-3, um pagamento do dia 1º cai no mês anterior e o lançamento muda de mês no DRE.
- Números alinham em coluna. `src/styles/globals.css` define a classe `.numero` com
  `font-variant-numeric: tabular-nums`; toda célula de valor e de data usa.

```
grep -rn 'R\$\|toFixed\|toLocaleString' src/app src/components src/features
grep -rn 'new Date(' src/app src/components src/features
grep -rn 'MoneyInput\|"numero"\|tabular-nums' src/
```

- **Corrigir:** trocar por `formatMoney`/`formatDate`, usar `MoneyInput` no formulário e
  aplicar `.numero` na coluna.

## 7. Obrigatoriedade

- Confira campo a campo contra a tabela desta tela em
  `files_design/03-modelo-de-dados-por-tela.md`. A coluna **Obrigatório** é a regra atual do
  produto, não uma sugestão.
- Campo obrigatório tem asterisco (`*`) no rótulo, e a tela tem a legenda "Campo obrigatório".
  São 52 campos marcados em 16 telas (`files_design/02-log-de-decisoes-de-ux.md`), então a
  legenda precisa estar presente em toda tela de formulário, não só na primeira.
- Campos são obrigatórios **por padrão**, com exatamente 3 exceções:
  1. **Rótulo**, onde existe.
  2. **Campos de direcionamento/alocação** (Para onde, Valor a alocar, os 4 baldes de Destinar
     o Lucro, Investimento/Conta como destino). Ficam vazios de propósito: o valor não
     direcionado vira Pendência na Home.
  3. **Toggles e seletores com valor padrão pré-selecionado** (Entidade, Classificação,
     Sub-tipo, Tipo, Cor, Recorrência). Nunca ficam vazios de qualquer forma.
- Filtro não é formulário sendo enviado: filtro (Histórico, por exemplo) não recebe asterisco.
- A obrigatoriedade trava o registro individual sendo preenchido, não a etapa inteira: o
  onboarding permite "Salvar e continuar depois" numa etapa que a pessoa não tocou.

```
grep -n '^## ' files_design/03-modelo-de-dados-por-tela.md
grep -rn 'Campo obrigatório' src/app src/components src/features
```

- **Corrigir:** alinhar a marcação e a validação à tabela do doc 03. Divergência real entre
  tela e doc vira pergunta ao Produto, não decisão de implementação.

## 8. LGPD

- Fixture 100% sintética, sem CPF, CNPJ, nome real ou dado de pessoa real.
- Nenhum `console.log` em `src/`. Use `src/lib/log.ts`, que registra **que** algo aconteceu e
  nunca **o quê**: as chaves `valor`, `saldo`, `nome`, `rotulo`, `categoria`, `conta`,
  `credor`, `cpf`, `cnpj` e outras viram `[omitido]`.
- Nenhum recurso externo no cliente: sem fonte de CDN, sem script de terceiro, sem analytics,
  sem imagem remota. A CSP de `next.config.ts` já bloqueia (`default-src 'self'`,
  `connect-src 'self'`). Se a tela precisou afrouxar a CSP, a tela está errada, não a CSP.

```
make audit-lgpd
grep -rn 'https\?://' src/app src/components src/features
git diff -- next.config.ts
```

O `make audit-lgpd` é grep textual: ele acusa a palavra `console.log` mesmo dentro de
comentário. Hoje ele falha por causa da linha 9 de `src/lib/log.ts`, que documenta a própria
proibição. Conserte a ocorrência (real ou textual) para o alvo voltar a ser verde; nunca
afrouxe o grep, porque é ele que segura a regra.

- **Corrigir:** trocar `console.log` por `log.info`/`log.aviso`/`log.erro`, substituir a
  fixture por dado sintético, remover o recurso externo.

## 9. Portão

- `make check` verde. São três etapas em ordem: `typecheck` (`tsc --noEmit`, strict com
  `noUncheckedIndexedAccess`), `lint` (`eslint .`) e `test-unit` (`vitest run`).
- `make fmt-check` limpo.
- Se a tela tem fluxo de ponta a ponta, `make test-e2e`. Ele se pula sozinho quando o browser
  não está instalado; `make test-e2e-install` baixa o Chromium.
- O ESLint é parte do portão de arquitetura, não só de estilo: ele impede `src/domain` de
  importar React/Next e de importar `@/data`, `@/features`, `@/app` ou `@/components`. A
  dependência aponta para dentro. Erro de `no-restricted-imports` significa que a regra foi
  escrita na camada errada.

```
make check
make fmt-check
make test-e2e
```

Se o `make check` falhar em `next-env.d.ts` (`@typescript-eslint/triple-slash-reference`) ou
em `No test files found`, o problema é de configuração do repositório, não da sua tela.
Conserte assim mesmo antes de seguir: um portão vermelho por motivo alheio deixa de ser
portão, porque ninguém mais olha a saída.

- **Corrigir:** resolver a falha apontada. Toda regra de domínio que a tela usa precisa de
  teste em `src/**/*.test.ts`; sem teste, o portão não protege nada.

## Saída esperada

Um relatório curto, nesta ordem:

1. **Tela e frame** — nome da tela, rota implementada, node e arquivo do frame em
   `docs/figma/frames/` que serviu de referência.
2. **Uma linha por seção**, de 1 a 9, no formato:
   `✅ 3. Tokens — make audit-tokens, sem valor literal`
   `❌ 6. Dinheiro e data — src/features/dre/TabelaDre.tsx:42 concatena "R$ " na mão`
   Todo ❌ e todo ⚠️ cita **arquivo e linha** e diz o conserto em uma frase.
3. **Comandos rodados** — a lista literal dos comandos que você de fato executou, com o
   resultado de cada um. Comando que você não rodou não entra na lista, e o item que dependia
   dele é ⚠️, nunca ✅.
4. **Veredito** — "pronta" ou "não pronta". Qualquer ❌ obriga "não pronta".
