# ADR-0010 — Todo o código em inglês, toda a tela em português

- **Status:** aceita (decisão do dono, 2026-09-01)
- **Emenda:** substitui a convenção anterior desta mesma fase, que era "domínio em pt-BR sem
  acento, infraestrutura em inglês". A decisão do dono foi explícita: _"o código, pode deixar
  tudo em inglês, domínios, tudo"_.

## Contexto

Toda a especificação deste produto está em português: o PRD, o Event Storming, a especificação
de telas, o modelo de dados e um glossário de nomenclatura que fixou cada nome com o motivo
escrito ao lado — "Lançamento" e não "transação", "Bens Materiais" e não "Ativos",
"Evolução Mensal" e não "Painel".

Isso cria uma escolha real, não estética. Código em português casa 1:1 com a spec e elimina a
tradução; mas destoa das bibliotecas, mistura idiomas dentro do mesmo arquivo (`getSession`
devolvendo `usuarioId`) e dificulta contribuição de fora.

A versão intermediária — domínio em português, infraestrutura em inglês — foi tentada e
descartada: a fronteira entre "domínio" e "infraestrutura" não é nítida na prática, e cada
arquivo novo virava uma decisão de qual lado ele estava.

## Decisão

### §1 Todo o código é em inglês

Tipo, função, variável, arquivo, pasta, comentário, nome de teste. Inclusive o domínio:
`Entry`, `Recurrence`, `computeIncomeStatement`, `Cents`, `IsoDate`, `Planned`, `Paid`.

Um idioma só dentro do código elimina a pergunta "de que lado este nome está".

### §2 Todo o texto que a pessoa lê continua em português

Rótulo de botão, título de tela, mensagem de erro, texto de estado vazio: palavra por palavra
igual ao Figma. Isso é interface, não código, e o glossário de nomenclatura manda.

**As rotas também ficam em português** — `/inicio`, `/dre`, `/historico`,
`/balanco-patrimonial`. A URL é interface: a pessoa a lê, copia e compartilha.

Os rótulos vivem em `Record` constantes no domínio (`LABEL_STATUS`, `LABEL_VIEW`,
`LABEL_CLASSIFICATION`, ...), para que uma palavra seja escrita igual em toda tela que a mostra.
O domínio nunca formata frase; ele expõe o rótulo e a tela decide onde pôr.

### §3 A ponte entre os dois idiomas é normativa e fica em `src/domain/GLOSSARY.md`

Uma tabela: termo do produto em português → identificador em inglês. "Lançamento" é `Entry`.
"Bens Materiais" é `TangibleAsset`, nunca `Asset` sozinho, porque "Ativo" no Balanço inclui
contas e investimentos e o design renomeou justamente para desambiguar. "Pró-labore" fica
`ProLabore`, sem tradução, porque é termo jurídico brasileiro sem equivalente — o mesmo vale
para `'PF'` e `'PJ'`.

**Conceito novo entra no glossário antes de entrar no código, nunca depois.** É o que impede
que a mesma coisa ganhe dois nomes em dois arquivos escritos por duas pessoas na mesma semana.

### §4 A documentação continua em português

Este arquivo, o README, o CLAUDE.md, as demais ADRs. Quem os lê são as mesmas pessoas que
escreveram o PRD.

## Consequências

- **`src/domain/GLOSSARY.md`**: criado, e é leitura obrigatória antes de escrever no domínio.
- **`src/domain/core/vocabulary.ts`**: os enums em inglês e os `LABEL_*` em português no mesmo
  arquivo, com o mapeamento visível lado a lado.
- **`tokens.css`**: os tokens também são inglês, com o nome da variável do Figma no comentário
  de cada linha — o rastro para o design não se perde (ADR-0011).
- **`CLAUDE.md` §6, `CONTRIBUTING.md`, template de PR**: a regra e o checklist apontam para o
  glossário.
- **Custo aceito**: quem lê a spec em português e o código em inglês faz uma tradução mental.
  O glossário é o que torna essa tradução mecânica em vez de criativa.

## Explicitamente NÃO feito

- **Traduzir "Pró-labore", "PF" e "PJ".** Não existe equivalente em inglês, e um nome inventado
  seria pior que o termo original.
- **i18n / arquivo de mensagens.** O produto é monolíngue. Uma camada de i18n para um idioma só
  é abstração criada para um caso hipotético.
- **Traduzir as rotas.** A URL é interface.
