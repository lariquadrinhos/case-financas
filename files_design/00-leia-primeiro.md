# Leia Primeiro — Documentação de Design, Finanças PF + PJ

> Ponto de entrada pra quem está chegando no projeto agora. Este conjunto de documentos + o arquivo Figma cobrem o design completo do produto, do primeiro acesso às ações do dia a dia.

**Arquivo Figma:** https://www.figma.com/design/7IZBeQV15kgZp7Shcqh4c8

O arquivo tem cinco páginas: **Capa** (mapa das páginas, porta de entrada pra quem abre o arquivo pela primeira vez), **Wireframe** (as telas em escala de cinza, o "o quê" e o fluxo — fonte da verdade do conteúdo, muda com mais frequência), **Mockup** (telas reais recoloridas com a camada visual do Style guide, sem alterar o Wireframe original — cobertura das telas principais concluída, telas completas empilhadas na ordem do fluxo do app), **Style guide** (fundações, biblioteca de componentes e ícones, o "como se parece") e **Tokens** (biblioteca visual de cor e escala).

---

## Por onde começar

Se você é **dev ou PM chegando agora**, nessa ordem:

1. **[01 — Especificação de Telas](./01-especificacao-de-telas.md)** — comece aqui. Descrição funcional de cada tela do produto, sem o desenho visual. É o "o quê" de cada tela.
2. **[03 — Modelo de Dados por Tela](./03-modelo-de-dados-por-tela.md)** — depois de entender uma tela, veja os campos exatos, obrigatoriedade e validação. É o "com quê" pra implementar.
3. **O arquivo Figma** — o desenho de tudo que está descrito nos dois documentos acima.

Se você vai **implementar**, mais dois, nessa ordem:

4. **[07 — Style Guide](./07-style-guide.md)** — cor, tipografia, espaçamento, modo escuro, sistema de gráfico e a biblioteca de componentes (botão, campo, card, tabela, etiqueta, controle segmentado, com variantes e estados de foco/hover/desabilitado). Traz os tokens com os valores dos dois modos e o motivo de cada decisão. É o "como se parece".
5. **[08 — Regras de Renderização de Dados](./08-regras-de-renderizacao-de-dados.md)** — como o desenho é **calculado** quando o layout nasce do dado: algoritmo do treemap, escala do eixo dos gráficos, arredondamento, mínimos, casos degenerados. É o "como é gerado", e é o documento que evita adivinhação na hora de codar gráfico.

Se você quer entender **por que uma tela é do jeito que é** (não só o que ela faz), ou vai continuar o trabalho de design:

6. **[02 — Log de Decisões de UX](./02-log-de-decisoes-de-ux.md)** — histórico cronológico do raciocínio por trás de cada decisão. **Não é a fonte da verdade do estado atual** (isso é o doc 01) — é o "porquê" de cada coisa, na ordem em que foi decidida.
7. **[04 — Glossário de Nomenclatura](./04-glossario-de-nomenclatura.md)** — todo nome de tela/botão/conceito já fechado, com o motivo da escolha. Consulte antes de renomear qualquer coisa.

Se você é do **time de produto**, avaliando o que ainda depende de decisão:

8. **[05 — Sugestões para o Time de Produto](./05-sugestoes-para-o-time-de-produto.md)** — ideias e observações que tocam o modelo de domínio ou o escopo do PRD, não decisões que o design pode tomar sozinho. Documento vivo, cresce conforme surgem.

Se você vai **rodar o teste de usabilidade**:

9. **[06 — Roteiro de Protótipo](./06-roteiro-de-prototipo.md)** — lista das ações prototipadas e o roteiro de conexões (tela → clique → tela) pra montar o protótipo clicável no Figma.

---

## Convenções que valem pro conjunto inteiro

- **🟦 PRD** = definido no documento de produto original · **🟩 Design** = decisão tomada durante o trabalho de design, preenchendo lacuna do PRD.
- **Campos monetários** sempre usam máscara ativa (não placeholder) — ver convenção detalhada no início do doc 03.
- **Campos são obrigatórios por padrão** (asterisco * + legenda), com 3 exceções documentadas no doc 03 — Rótulo, campos de direcionamento/alocação, e toggles com valor padrão pré-selecionado.
- **Sem emoji decorativo** nos mockups — só símbolos funcionais (↗ clicável, ▾ expandir, ← → navegação).
- **Sem travessão (—)** em textos de interface — usar vírgula, dois-pontos ou ponto.
- **Cor, tipografia e espaçamento não se decidem tela a tela** — saem dos tokens do doc 07. Se algo precisar de uma cor que não existe lá, é sinal de que falta uma decisão de sistema, não de que a tela é especial.
- **Formato de moeda** (centavos, separadores, sinal de negativo) está no doc 08, seção 1, e vale pro produto inteiro.

## O que este conjunto de documentos NÃO cobre

- **Ilustração e microanimação** — o doc 07 cobre cor, tipografia, espaçamento e modo escuro, mas o produto ainda não tem linguagem de ilustração nem especificação de movimento.
- **Equivalente de toque pra mobile** — as regras de hover/tooltip (treemap, gráficos de barra, linha de tabela) cobrem só Desktop/mouse, condizente com desktop ser a plataforma prioritária. Sem página Mobile no Figma hoje; se o produto ganhar uma versão mobile no futuro, o que substitui "passar o mouse" em toque ainda não foi decidido (doc08, seção 7).
- **Fórmulas de cálculo financeiro** (amortização de passivo, juros compostos) — o design definiu a interface e o fluxo, mas a exatidão da fórmula é responsabilidade de engenharia/backend.

## Uma nota sobre as páginas do Figma

As telas da página **Wireframe** continuam em escala de cinza de propósito: elas são a fonte da verdade do conteúdo e do fluxo, e mudam com mais frequência. **Nunca são alteradas pelo trabalho de colorir mockups** — cada tela colorida é uma cópia nova, feita na página **Mockup**, nunca uma edição do wireframe original.

A camada visual foi provada primeiro na página **Style guide**, com a biblioteca de componentes (variantes e estados) e o sistema de gráfico. A aplicação real nas telas do produto, na página **Mockup**, está concluída pras 26 telas principais do Wireframe (claro e escuro) mais os 24 estados Vazio e Home em Modo de Organização — ver o doc02 pro histórico de como cada leva foi construída, e o doc07 ("Status", no topo) pro resumo do que resta.

Aplicar a camada visual às demais telas é trabalho de replicação, não de decisão: as regras já estão fechadas nos docs 07 e 08. Onde uma tela expõe uma lacuna nova (uma regra que ainda não existia, ou uma regra que a geometria antiga do wireframe não seguia de verdade), a regra é escrita ou corrigida no doc08 antes de aplicar — nenhum mockup deve só herdar a aparência do wireframe sem checar se ela está de acordo com o sistema.
