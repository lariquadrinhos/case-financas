# ADR-0002 — Os dez blocos do DRE são fixos, e a cascata é código; o que é configurável é a categoria

- **Status:** aceita (decisão de produto na v7 do PRD; escrita em 2026-09-08)
- **Fecha:** hotspot **H10** do Event Storming ("motor de DRE dirigido por configuração"), **pelo
  oposto do que o hotspot previa**
- **Estende:** ADR-0001 §1 (o relatório é projeção pura)

## Contexto

O Event Storming levantou H10 como "blocos e fórmulas configuráveis", com o trade-off
"flexibilidade total vs. complexidade do motor". A v1 deste documento chegou a tratar isso como o
maior risco técnico do projeto, a validar cedo.

O PRD v7 fechou a questão por decisão de produto, não por ADR, e nas duas direções: **§1 e §9.5
dizem que os 10 blocos são fixos**, e que só as categorias dentro deles são editáveis. Esta ADR
existe para que essa decisão pare de viver apenas como uma frase no PRD e passe a explicar o que
o código faz — porque o código faz uma coisa **intermediária**, que nem "fixo" nem "configurável"
descrevem sozinhos, e é isso que precisa estar escrito.

## Decisão

### §1 A estrutura de um bloco é dado; a ordem da cascata é código

`StatementBlock` é um registro persistido, com `name`, `order`, `effect`
(`Add`/`Subtract`/`Signed`/`None`), `belowTheLine`, `acceptsUserCategories` e `statementLabel`. Os
dez são semeados por pessoa a partir de `DEFAULT_BLOCKS`, e vivem numa tabela.

A **ordem da cascata e a posição dos subtotais**, porém, são um array em código
(`CASCADE`, em `src/domain/reports/income-statement.ts`). O motor lê o `effect` de cada bloco para
saber se soma ou subtrai, mas não lê de lugar nenhum que "Receita Líquida vem depois de Deduções".

Isso é deliberado: um motor que lesse a ordem de uma tabela precisaria validar que a tabela
descreve uma cascata coerente — nenhum subtotal antes do que ele soma, nenhum ciclo, nenhum bloco
órfão — e essa validação é o "complexidade do motor" que H10 pesava. Com dez blocos fixos, o array
**é** a especificação, e um erro nele é um erro de compilação ou um teste vermelho, não um dado
inválido em produção.

### §2 O bloco não é editável pela pessoa, e a rota HTTP é somente leitura

`GET /api/v1/statement-blocks` existe; `POST`, `PATCH` e `DELETE` não. A única escrita é
`StatementBlockWriter.seed`, chamada de `src/features/onboarding/seed-chart.ts` e apenas quando a
tabela está vazia.

Os blocos são, portanto, **dado de referência por pessoa**, não configuração. Estão numa tabela
por dois motivos práticos, nenhum deles "para o usuário editar": manter a chave estrangeira de
Categoria → Bloco íntegra no banco, e deixar a fase 2 (mais de uma PJ, planos distintos) mudar de
ideia sem migrar constante de código.

### §3 O que a pessoa configura é a Categoria, dentro de um bloco

Criar, renomear, arquivar e marcar renda passiva — tudo isso é da Categoria. O bloco a que ela
pertence é escolhido na criação e o bloco em si nunca muda de forma.

Um bloco recusa categoria quando `acceptsUserCategories` é falso, e há exatamente um assim: D&A,
que é sempre zero no MVP e existe por fidelidade à estrutura do DRE de referência.

### §4 Um número que não é bloco entra como campo do relatório, não como linha nova

Quando o produto precisa de um valor que a cascata não imprime, ele vira campo do
`IncomeStatement` e não um décimo primeiro bloco. É o caso de `netProfit` (que o card "Destinar
este Lucro" lê) e de `grossProfit` (o Lucro Bruto de verdade, que alimenta a Margem Bruta desde a
P44 sem virar linha na tela).

A regra prática: **linha da cascata é decisão de desenho; número calculado é decisão de domínio**,
e as duas não precisam coincidir.

## Consequências

- Acrescentar um bloco é mudar `DEFAULT_BLOCKS`, o array `CASCADE` e uma migração — três lugares,
  de propósito. Não é operação de usuário.
- A ordem da cascata tem teste próprio (`prints the lines in the reference order`), que é o que
  transforma o array numa especificação verificada.
- `files_design/01` §8.1 descreve a mesma cascata e passou a estar marcado 🟩 (decisão de design),
  não 🟦 — o PRD nunca definiu a ordem, e a marcação errada foi corrigida junto com a P44.
- A fase 2 com mais de uma PJ não precisa de motor configurável: precisa de um conjunto de blocos
  por entidade, o que a tabela já comporta.

## Explicitamente NÃO feito

- **Fórmula configurável.** Nenhum campo guarda "EBITDA = Lucro Bruto − Administrativas −
  Pessoais". A fórmula é código, e os subtotais somam contribuições, nunca valores impressos.
- **Bloco criado, renomeado ou reordenado pela pessoa.** Não há tela, não há rota, e o glossário
  (`files_design/04`) trata os dez nomes como vocabulário fechado.
- **Segundo plano de contas.** Uma pessoa, um conjunto de dez blocos. Vários planos é fase 2, e
  reabre §2, não §1.
- **Validação de coerência da cascata em tempo de execução.** Ela não existe porque a cascata não
  é dado de entrada. Se um dia for, essa validação passa a ser obrigatória — e é o custo que H10
  pesava.
