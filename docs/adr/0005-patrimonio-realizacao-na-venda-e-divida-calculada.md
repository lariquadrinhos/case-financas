# ADR-0005 — Patrimônio: resultado só na venda, e a dívida é calculada por amortização

- **Status:** aceita (escrita em 2026-09-08)
- **Fecha:** hotspots **H5** (realização só na venda) e **H9** (passivos separados do DRE) do
  Event Storming — **H9 com o conteúdo revisto duas vezes desde que foi levantado**
- **Estende:** ADR-0001 §1 e §5 · ADR-0002 §4 (número calculado não precisa de linha)

## Contexto

H5 e H9 foram levantados juntos e o Event Storming reservou um número para os dois. Desde então,
duas coisas mudaram o conteúdo de H9, e é por isso que esta ADR não podia ser escrita antes:

1. **A v7 do PRD reverteu "passivo 100% manual"**: a dívida ganhou cadastro completo, cronograma
   calculado por amortização e reajuste de juros com recálculo prospectivo.
2. **A P6, decidida em 2026-09-08, reverteu "separado do DRE"** na direção que faltava: a parcela
   paga **conta** no DRE.

O que sobrou de H9 é uma metade, e ela continua valendo: **nenhuma baixa automática a partir de
Lançamento**. Registrar uma despesa não abate dívida.

## Decisão

### §1 Bem material e investimento não são reavaliados; o resultado nasce na venda

Não há mark-to-market, não há reavaliação mensal, não há depreciação. Um bem entra pelo valor
informado e fica nele até ser vendido.

`evaluateSale` calcula ganho ou perda como `valor de venda − valor registrado`, e o resultado vai
para **Resultado Não Operacional** (bloco 7). O ganho **nunca é armazenado**: é derivado da venda,
como todo número deste produto é derivado dos fatos (ADR-0001 §1).

Um bem vendido sai da lista de Bens Materiais — já deixou o patrimônio.

### §2 D&A é sempre zero, e a linha existe mesmo assim

Sem depreciação mensal, o bloco 6 vale zero todo mês, e portanto **EBITDA = EBIT sempre**. A linha
permanece na cascata por fidelidade à estrutura do DRE de referência, e a igualdade é **afirmada
por teste**, não assumida.

É a única consequência de H5 que estava testada antes desta ADR — o resto era modelo sem prova, e
o Event Storming marcava isso com ⚠️.

### §3 Dívida e DRE são planos distintos numa direção só

**Registrar despesa não constrói passivo**, e nenhum lançamento abate saldo devedor. É a metade de
H9 que sobreviveu, e existe para impedir dupla contagem: se um lançamento de "Financiamento"
abatesse a dívida, o mesmo pagamento apareceria como despesa e como amortização.

A direção oposta foi decidida na P6 e **não** é proibida: a parcela paga conta no DRE, em Despesas
Administrativas e pelo valor cheio, exatamente como a planilha de referência faz. Ela entra como
**parcela**, não como Lançamento sintético — o "Editar" da linha vai para o Detalhe do Passivo, e
é o `source.kind` que garante isso.

O saldo devedor continua vindo do cronograma, nunca de soma de lançamentos.

### §4 O cronograma é calculado por Price, e o valor da parcela declarado não entra no cálculo

O cronograma sai de **valor original, taxa e número de parcelas**, pela fórmula de Price
(`priceInstallmentFactor`), com `multiply` de `core/money` arredondando ao centavo e `splitEvenly`
distribuindo a sobra — de outro modo a soma das parcelas erra o total em até n/2 centavos contra o
número que a pessoa vê.

O campo "Valor da parcela" do formulário é **dado cadastral declarado**, não entrada de cálculo, e
nenhuma tela o exibe de volta. A escolha pelo cálculo automático está desenhada e é explícita: a
nota `164:2` do Wireframe registra que foi "escolha deliberada", por pedido de produto, contra a
alternativa de só registrar valores confirmados.

Um reajuste de juros recalcula **prospectivamente**: parcela já paga nunca é reescrita.

### §5 A única divergência que o produto reconhece é previsto × pago

Nunca formulário × cálculo. Pagar a menos gera Pendência com a ação "Pagar", que desde a P25
resolve a pendência **e** registra a diferença como Lançamento na data de hoje. Pagar a mais vira
Evento de rastreabilidade com os dois valores.

Parcela já quitada na abertura do cadastro nasce com valor presumido igual ao previsto e sem data
de pagamento, e **conta no DRE pelo mês previsto** (P27) — decisão tomada com a consequência
medida: cadastrar dívida em andamento escreve despesa em meses passados.

## Consequências

- `TangibleAsset.soldOn`, `AssetSale` e `Allocation` existem; `gainOrLoss` é calculado e não
  persistido, o que remove a classe de bug "ganho gravado diverge do ganho recalculado".
- `Installment.paidDate` passou a ser persistido ao fechar a P6: sem ele o regime de caixa de
  ADR-0001 §2 não fecha para parcela.
- O Balanço lê saldo devedor do cronograma (`outstandingBalance`), descontando tudo que ainda está
  Prevista — e por isso "Descartar" uma parcela não muda o saldo.
- H5 continua **modelado com pouco teste direto** em `src/domain/assets/sale.ts`. Esta ADR não
  conserta isso; nomeia.

## Explicitamente NÃO feito

- **Depreciação e amortização mensais.** §2 é a decisão, e ligá-las muda o DRE inteiro.
- **Mark-to-market de investimento.** O valor de um investimento é o que a pessoa informou.
- **Baixa automática de dívida a partir de Lançamento.** §3, e é a metade de H9 que continua de pé.
- **Sistema de amortização SAC ou outro.** Só Price. O sistema não é campo do cadastro.
- **Rastreabilidade de base/custo por lote** (custo médio, FIFO) na venda de investimento. O
  trade-off que H5 pesava foi resolvido pelo lado da simplicidade.
