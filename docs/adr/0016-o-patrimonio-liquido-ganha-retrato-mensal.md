# ADR-0016 — O Patrimônio Líquido ganha retrato mensal, gravado no composition root

- **Status:** aceita (decisão do dono, 2026-09-09)
- **Fecha:** P21, aberta desde que a Evolução Mensal foi escrita
- **Estende:** ADR-0012 §1 (SQLite, portas segregadas) · ADR-0013 §O (recurso novo entra
  acrescentando)

## Contexto

A Evolução Mensal desenha uma linha de Patrimônio Líquido mês a mês. O Balanço Patrimonial, de onde
o PL vem, é explicitamente "foto do momento atual, sem seletor de mês" (PRD, `files_design/03`): não
existe lançamento de "saldo em tal mês".

Para desenhar a série, `computeMonthlyTrend` reconstruía o passado andando para trás a partir do PL
de hoje:

```
PL(mês) = PL(mês seguinte) − Lucro Líquido(mês seguinte)
```

Isso assume que **só o Lucro Líquido move o Patrimônio Líquido**. A P21 registrava a suposição há
meses, sem que ninguém a verificasse.

**Ela foi verificada em 2026-09-09, e é falsa — não por imprecisão, por construção.** Os quatro
componentes do PL:

| Componente                        | Tem histórico?                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Passivo (saldo devedor)           | **sim** — as parcelas têm data de pagamento                                           |
| Bem Material                      | **sim** — `recordedValue` é fixo (PRD §5, sem reavaliação) e `soldOn` diz quando saiu |
| Conta bancária (`balance`)        | **não**                                                                               |
| Investimento (`accumulatedValue`) | **não**                                                                               |

E os dois que não têm mudam **apenas** quando a pessoa os edita: `PUT /bank-accounts/{id}` e
`PUT /investments/{id}` são os únicos escritores. Medido: **pagar um Lançamento não move saldo
nenhum.** Ou seja, Lucro Líquido e Patrimônio Líquido são variáveis independentes neste produto — o
Lucro Líquido move o DRE, o PL move quando a pessoa digita um número novo. A reconstrução não era
uma aproximação boa: era uma conta entre grandezas que não se relacionam.

## Decisão

### §1 O PL passado é gravado, não derivado

Tabela `net_worth_snapshots`, uma linha por `(usuário, mês, visão)`, com o PL e a data em que o
retrato foi tirado. Não há como derivar o passado — a §Contexto mostra por quê —, então o único
caminho honesto é registrar o presente enquanto ele é presente.

### §2 O retrato é tirado quando o patrimônio muda, não quando o mês acaba

Não existe ritual de "fechar o mês" neste produto, e inventar um seria funcionalidade nova para
resolver um problema de relatório. Como o PL só muda nas mutações de patrimônio, gravar nelas dá o
valor **exato** de fechamento: o último retrato de um mês É o fechamento daquele mês.

Um mês sem retrato não é um mês desconhecido — é um mês em que o patrimônio não mudou, e por isso
**herda o anterior**, também exato.

### §3 A gravação mora no composition root, não nas rotas

Doze rotas mexem em patrimônio. Chamar o gravador em cada uma seria doze lugares para esquecer um, e
uma rota nova nasceria sem ele. Em vez disso, `src/data/index.ts` **decora** os seis escritores de
patrimônio: qualquer gravação, existente ou futura, tira o retrato sem que a rota saiba.

O `userId` sai do primeiro argumento, que toda porta recebe por convenção
(`contracts/common.ts`) — é o que permite decorar num registro único por processo, que não conhece
a sessão da requisição.

O harness de teste (`fixtures/test-repositories.ts`) aplica o **mesmo** decorador, com o relógio
injetável. Sem isso o teste rodaria sobre uma montagem diferente da de produção, e o recurso não
teria cobertura nenhuma.

### §4 O que veio antes continua reconstruído, e continua dizendo que é

Meses anteriores à existência da tabela não têm retrato e não podem ganhar um. Eles seguem na
reconstrução do §Contexto, com `netWorthIsReconstructed: true` no ponto — o campo que a rodada
anterior já tinha criado e que agora tem significado exato: **verdadeiro só onde não há retrato
nenhum até aquele mês.**

## Consequências

- A série da Evolução Mensal passa a ter uma fronteira: estimada antes do primeiro retrato, exata
  depois. O contrato HTTP diz de qual lado cada ponto está.
- Cada mutação de patrimônio recalcula os três Balanços, o que relê contas, investimentos, bens,
  passivos e o cronograma inteiro de cada passivo. É caro por chamada e barato no total: essas
  mutações são raras, ao contrário de pagar Lançamento, que não passa por aqui.
- Se algum dia uma porta de patrimônio ganhar um método que NÃO move o PL, ele passará a gravar um
  retrato redundante. É desperdício, não erro — o valor gravado continua correto.

## Explicitamente NÃO feito

- **Gravar na leitura do relatório.** Foi considerado: uma rota só, quase nenhum código. Mas mudaria
  o significado do número de "o PL de julho" para "o PL na última vez que você abriu o app em
  julho", e um mês sem visita não ganharia retrato.
- **Backfill dos meses passados.** Não há dado de onde tirá-lo. Preencher com a reconstrução seria
  gravar uma estimativa num campo que a tela vai passar a tratar como medição.
- **Mostrar na tela quais meses são estimados.** Nenhum frame do Figma desenha essa marcação, e
  inventar o texto seria decidir design. O campo viaja no contrato, pronto para quando o design
  decidir.
- **Histórico de saldo de conta.** Resolveria a raiz — mas é um segundo modelo de dados e um segundo
  fluxo de entrada, e o produto não pede.

## Rodada 2 — o retrato passa a carregar o total investido (2026-09-11, fecha a P22)

Mesma decisão, um número a mais na mesma linha. "Crescimento dos investimentos (mês)" deduzia o mês
anterior como `total_atual − aporte`, assumindo que só a Destinação do Lucro mexe nos investimentos
— a irmã exata da suposição que esta ADR derrubou para o Patrimônio Líquido.

A ADR-0017 §4 tornou a suposição falsa de vez: direcionar uma venda para um investimento sobe o
`accumulatedValue` sem passar por balde nenhum. Medido no cenário de 100.000 investidos + 5.000 de
lucro + 20.000 de venda: o indicador mostrava **4,2%** onde o certo eram **25%**.

`NetWorthSnapshot` ganhou `investmentsTotal`, gravado no mesmo instante e pela mesma decoração do
composition root — uma tabela paralela seria um segundo lugar para esquecer de gravar. Migração
0010, conferida aplicando as onze em ordem num banco limpo.

**Por que medir os dois meses basta, e somar fontes não é preciso:** o produto NÃO reavalia
investimento (é o que o texto de ajuda do próprio indicador diz). Se nada rende, todo aumento no
total é aporte. Somar fonte por fonte daria o mesmo número por um caminho mais longo — e esbarraria
no fato de que os direcionamentos de venda nem são persistidos.

**"Eficiência de aporte" NÃO mudou**, e a diferença é de pergunta: ela mede que parte do LUCRO virou
aporte, e dinheiro de venda não é lucro do mês. Continua somando só os dois baldes da Destinação do
Lucro.
