# Perguntas em aberto

> O que as fontes da verdade não respondem, e que **não foi inventado**.
>
> Cada pergunta abaixo apareceu durante a implementação do domínio. Em vez de decidir por conta
> própria, o código adotou uma resposta provisória, marcou o ponto com um comentário
> `OPEN QUESTION` e registrou aqui. Isso é regra do `CLAUDE.md`: não assumir premissas.
>
> **Este documento existe para ser respondido, não arquivado.** Cada item traz o que foi
> assumido hoje e o que muda quando a resposta vier. Responder uma pergunta é editar a fonte da
> verdade correspondente (PRD, especificação de telas ou modelo de dados) — não este arquivo.
>
> Para achar o ponto exato no código: `grep -rn "OPEN QUESTION" src/`.

---

## Para o time de Produto e Contabilidade

### P1. Em qual bloco o pró-labore entra na visão da PJ? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/domain/reports/income-statement.ts` · `blockForRole`

**Resposta: Despesas Administrativas (bloco 4).** Confirma o que o código já fazia, agora com o
raciocínio registrado e travado por teste.

**A lacuna era real, e a planilha não a fechava** — foi o que a apuração mostrou. O PRD repete
"despesa/custo operacional" seis vezes (§1, §5, §7, UC3, §9.2, nota intercompany) sem nunca
nomear o bloco. E a planilha de referência (`docs/reference/meu-dre.xlsx`), que o PRD v2
incorporou como plano de contas, **não tem pró-labore nos blocos 3 nem 4**: ele aparece uma vez
só, como RECEITA no bloco 1 ("Salário / Pró-labore"). A planilha é uma visão única, com os
custos da PJ misturados aos gastos da PF; **a visão isolada da PJ é invenção do produto**, e é
por isso que nenhuma fonte respondia.

**Por que Despesas Administrativas:**

- pró-labore é remuneração do dono, não custo direto de entregar o serviço;
- o que o CSV guarda de fato na planilha é ferramenta e serviço — assinaturas de software, streaming,
  ração do pet, academia, Contador/assessoria, infraestrutura/internet, outros custos diretos.
  **Nenhuma linha de mão de obra**;
- e o efeito na margem bruta: no CSV, a margem bruta da PJ passaria a depender de quanto o dono
  decidiu se pagar naquele mês, que é transferência discricionária e não custo do serviço.
  **Ressalva medida, e a decisão foi tomada sabendo dela:** esse efeito hoje não existe, porque
  `grossProfit` é calculado sem o CSV — ver P44. O argumento vale para depois que a cascata for
  corrigida.

**O Lucro Líquido não muda com a escolha** (o EBITDA soma os três blocos de despesa de qualquer
jeito); muda em qual linha do DRE o valor aparece. Travado em
`src/domain/reports/income-statement.test.ts`, com o teste visto vermelho ao inverter o bloco
para CSV.

### P44. O "Lucro Bruto" do DRE era a Receita Líquida da planilha — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/domain/reports/types.ts` · `income-statement.ts` · `indicators.ts` · `docs/figma`

**Resposta: renomear a linha para "Receita Líquida" e manter as 13 linhas.** O subtotal passa a se
chamar o que ele é, nenhum valor do DRE muda, e a "Margem bruta" passa a descontar o CSV.

**O diagnóstico, lido das fórmulas do próprio `meu-dre.xlsx`:**

| Planilha                        | Produto, antes                           | Produto, agora                                          |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `(=) RECEITA LÍQUIDA = C10−C16` | `Lucro Bruto` (mesmo valor, nome errado) | `Receita Líquida`                                       |
| `(=) LUCRO BRUTO = C17−C26`     | não existia                              | `IncomeStatement.grossProfit`, calculado e não impresso |

**Por que renomear e não inserir a linha que falta:** a compressão foi deliberada. A planilha tem
**dois** subtotais que o produto nunca teve — `RECEITA LÍQUIDA` e `EBT — Lucro Antes do IR` — e o
design fechou em 13 linhas. O erro não era a compressão; era o nome que sobrou na linha. Inserir
"Lucro Bruto" depois do CSV exigiria frame novo e reabriria a pergunta do EBT.

**O indicador é onde o defeito saía da tela do DRE.** `grossMargin` lia o subtotal impresso, então
media "1 − taxa de dedução" e o CSV não o afetava. Agora lê `statement.grossProfit`. Travado por
teste visto vermelho com a fórmula antiga: com 1.000.000 de receita e 300.000 de CSV, a antiga dá
100% e a certa dá 70%. `savingsRate` não mudou de valor — ele já dividia por essa linha, e o
comentário dele já descrevia o valor certo com o nome errado, que foi o fio que levou ao achado.

**Alterado também o Figma**, nas 5 ocorrências (DRE claro e escuro, Destinar o Lucro claro e
escuro, e o Wireframe `11:50`), mais o XML extraído `frames/11-2__desktop-dre.xml`. **A regra 1 do
doc07 ("nunca alterar o Wireframe original") foi quebrada de propósito** aqui: o
`.claude/skills/checklist-de-tela` manda o implementador ler esses XML como fonte de fidelidade, e
deixar "Lucro Bruto" ali faria a próxima pessoa "consertar" o nome de volta. Zero ocorrências de
"Lucro Bruto" restam no arquivo do Figma.

**O que ficou de fora, e vale registrar:** o `EBT — Lucro Antes do IR` da planilha continua sem
linha no produto, pela mesma decisão de 13 linhas. Não é lacuna nova; é a outra metade da mesma
compressão, agora escrita.

### ~~P2. Com lucro líquido exatamente zero, a tela mostra o card ou a mensagem?~~ — RESPONDIDA pelo Figma (nota de estado `242:14`)

**Onde:** `src/domain/profit-allocation/rules.ts` · `canAllocate` ·
`src/domain/reports/income-statement.ts` · `hasProfitToAllocate` · `src/app/(app)/dre/page.tsx`

Não era lacuna: o Wireframe não desenha apenas o caso negativo, ele escreve a regra **com o
critério**. O frame `242:2` "Estado — DRE com Prejuízo (Lucro Líquido negativo)"
([`frames/242-2__…xml`](figma/frames/242-2__estado-dre-com-prejuizo-lucro-liquido-negativo.xml))
termina na nota `242:14`: «"Destinar este Lucro" some quando o resultado é negativo — **não faz
sentido oferecer alocação de algo que não existe**». Com Lucro Líquido zero não existe valor a
alocar, então vale a mensagem, não o card. O limiar é `netProfit > 0`.

**Resposta:** a mensagem. O comportamento do código já era esse — o que estava errado era
declarar a decisão como inexistente. Ficou registrado em `files_design/01` §8.1/§9 e no PRD
§9.2 (changelog v7.7).

**Corrigido junto (variante que esta pergunta mascarava):** com zero exatamente, o card saía com
uma linha só — título sem legenda —, altura que nenhum frame das duas páginas desenha. O bloco
`242:11` (401×34) é sempre `242:12` título (206×17) sobre `242:13` legenda (401×15), igual ao
card positivo `239:22` (`239:23` 183×17 + `239:24` 466×15). A legenda `242:13` são duas
sentenças independentes: com prejuízo saem as duas ("Prejuízo de R$ 1.850,00. Não há valor pra
investir, guardar ou distribuir."), com zero sai só a segunda, que é verdadeira nos dois casos.
Nenhum texto novo foi criado.

### ~~P3a. Quando o valor da parcela declarado não bate com a amortização calculada, o que acontece?~~ — RESPONDIDA pelo Figma (nota de design `164:2` + os frames da tela)

**Onde:** `src/domain/assets/installments.ts` · `buildInstallmentSchedule`

Não era lacuna de produto: produto já tinha decidido, e a decisão está desenhada. A nota
`164:2` do Wireframe, "Nota — Passivo: cálculo automático de juros foi escolha deliberada"
([`frames/164-2__…xml`](figma/frames/164-2__nota-passivo-calculo-automatico-de-juros-foi-escolha-deliberada.xml)),
diz no texto `164:4`: "Consideramos duas abordagens: (A) sistema calcula a amortização e
recalcula a cada reajuste de juros, ou (B) só registra valores reais confirmados, sem prever.
**Escolhemos a (A) por pedido explícito de produto**".

As três opções que este item listava não levam a três telas: **duas delas não têm tela nenhuma**,
e a medição é direta nos frames.

| Opção listada                     | Tem tela? | O que o frame mostra                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| avisar da divergência             | **não**   | o "Valor da parcela" declarado não é exibido de volta em lugar nenhum: a linha da lista tem só Saldo devedor e Parcelas (`40:2` nós `90:66`/`90:67` e `90:69`/`90:70`; Mockup `933:1416` nós `934:71`/`934:72` e `934:74`/`934:75`) e o card "Informações da Dívida" tem quatro itens (`91:2`: `91:47`, `91:50`, `91:53`, `91:56`), nenhum deles a parcela declarada |
| resolver a taxa pelos outros três | **não**   | a taxa é sempre digitada: "Taxa de juros (a.m.) \*" é campo obrigatório no cadastro (`40:2` nó `90:43`) e "Nova taxa de juros (a.m.) \*" no modal de reajuste (`94:2`)                                                                                                                                                                                               |
| ignorar                           | **sim**   | é o que os frames desenham, e o que o código já faz                                                                                                                                                                                                                                                                                                                  |

**Resposta:** `installmentAmount` é **dado cadastral declarado**, não entrada de cálculo. Fica no
modelo porque é campo obrigatório do formulário (`40:2` nó `90:30` "Valor da parcela \*"), e o
cronograma sai de Valor original + Taxa + Número de parcelas. A única divergência que o produto
reconhece é **previsto × pago**, registrada no histórico de eventos (`91:2`: "Parcela #12 paga:
previsto R$ 1.520,00, pago R$ 1.540,00 (divergência de R$ 20,00)") — nunca formulário × cálculo.

**Corrigido junto (regressão que este item mascarava):** a lista de Passivos imprimia o valor
declarado numa coluna "Parcela" que nenhum frame desenha
(`src/features/plano-de-contas-e-patrimonio/screens/passivos.tsx`). Coluna removida; teste em
`screens/passivos.test.tsx`.

**Continua divergente, e é de contrato, não de tela:** o frame não desenha uma tabela, e sim uma
linha por passivo com **Saldo devedor** onde a implementação mostra "Valor original" (além de
Entidade, Classificação e Taxa, que a linha não tem). Trocar exige `outstandingBalance` na
resposta de `GET /liabilities` (`src/api/contracts/liabilities.ts`), que hoje não o devolve.

### P3. A fórmula de amortização escolhida (Price) confere com o que financeiro espera? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/domain/assets/installments.ts` · `priceInstallmentFactor` · `presentValueOfStream`

Esta é a pergunta que o design realmente delega, no mesmo texto `164:4`: "isso é cálculo
financeiro real (amortização, juros compostos). O design definiu a interface e o fluxo, mas **a
fórmula exata precisa ser validada por alguém de backend/financeiro antes de implementar: um erro
aqui mostra saldo devedor errado pra pessoa**."

- **Assumido hoje:** Tabela Price — parcela constante, `PMT = PV · i / (1 − (1+i)^−n)` — e o saldo
  devedor como valor presente das parcelas ainda Previstas, descontadas à mesma taxa. O motivo
  está no comentário de `priceInstallmentFactor`: o formulário coleta **um** "Valor da parcela" e
  a Revisão de Recorrentes lista **uma** parcela por mês (`files_design/01` §6), e um número só
  para o cronograma inteiro é, por definição, parcela constante; SAC daria um valor diferente todo
  mês, que nenhum campo de nenhuma tela comporta.
- **O Figma não decide isso, e a medição prova:** os números do `91:2` são ilustrativos e
  mutuamente incoerentes — 348 × R$ 1.520,00 = R$ 528.960,00 contra "Saldo devedor atual
  R$ 178.400,00" impresso ao lado, e Price sobre R$ 320.000,00 em 360 meses dá R$ 2.855,64 a
  0,85% a.m. (R$ 2.714,11 a 0,80%), não R$ 1.520,00. É exatamente o que `164:4` avisa: o frame
  define interface e fluxo, não a conta.
- **Resposta (2026-09-08): Price, confirmado.** É o que já está implementado, e o motivo estrutural
  pesou na decisão: o formulário coleta UM "Valor da parcela" e a Revisão de Recorrentes lista uma
  parcela por mês, e um número só pro cronograma inteiro é, por definição, parcela constante. SAC
  exigiria redesenhar formulário e lista. Nada mudou no código.
- **Se um dia entrar SAC** (segundo financiamento, outro credor): vira campo novo no cadastro do
  Passivo, e aí sim as telas precisam comportar parcela variável.
- **A implementação foi VALIDADA em 2026-09-11** (H11, metade de engenharia). A P3 tinha fechado a
  ESCOLHA do método; ninguém tinha conferido se o código calcula Price direito. Confrontada a forma
  fechada com a simulação mês a mês `saldo × (1+i) − parcela`, que não compartilha código com ela:
  com a PMT exata o resíduo é 1e-6 centavos nos quatro cenários, e com as parcelas arredondadas fica
  dentro do teto teórico do arredondamento (535 de 1038 a 0,80%). O reajuste preserva o principal.
  Em `src/domain/assets/amortisation.validation.test.ts`. **Continua faltando** a conferência de quem
  responde pelo financeiro, que é a outra metade que o PRD §5 exige e que não se faz em código.
- **Se financeiro responder SAC** (ou Price com carência, ou juros pró-rata die): muda
  `priceInstallmentFactor` e `presentValueOfStream`, e com eles o "Saldo devedor" do card, da
  lista, do Balanço e do gráfico `91:59`. Nenhuma tela muda de forma.

### ~~P5. "Saldo devedor" é a soma nominal das parcelas restantes ou só o principal?~~ — RESPONDIDA pelo Figma (medida no frame)

**Onde:** `src/domain/assets/installments.ts` · `outstandingBalance`

Não era lacuna: o frame existe, tem números conferíveis, e a conta fecha. O card "Informações da
Dívida" é o nó `338:2` do Wireframe `91:2` "Desktop — Detalhe do Passivo (análise de dívida)"
([`frames/91-2__desktop-detalhe-do-passivo-analise-de-divida.xml`](figma/frames/91-2__desktop-detalhe-do-passivo-analise-de-divida.xml)),
e desenha as quatro colunas da linha `91:44` lado a lado: "Valor original R$ 320.000,00"
(`91:47`), "Saldo devedor atual R$ 178.400,00" (`91:50`), "0,85% a.m." (`91:53`) e
"12 / 360 pagas" (`91:56`). A parcela é R$ 1.520,00 (`91:104`) e a taxa de cadastro, 0,80% a.m.
(`91:145`).

**As duas contas, rodadas com os números literais do frame:**

| Leitura                          | Conta                         | Resultado     | Cabe no card?                                         |
| -------------------------------- | ----------------------------- | ------------- | ----------------------------------------------------- |
| soma **nominal** das restantes   | 348 × R$ 1.520,00             | R$ 528.960,00 | **não** — é 1,65× o "Valor original" impresso ao lado |
| **valor presente** das restantes | Σ 1.520 / (1,008)^k, k=1..348 | R$ 178.128,97 | **sim** — 0,15% do número desenhado                   |

O gráfico `91:59` confirma a mesma âncora: a barra Ago/25 (`91:63`, o mês do cadastro) tem 120px
e a de Jul/26 (12 meses depois, "12 / 360 pagas") tem 67,2px — razão 0,560, contra
178.400/320.000 = 0,5575. A série sai do **valor original** e cai. Na leitura nominal ela sairia
de R$ 547.200,00 e cairia 3,3%, que não é o desenho. A lista de Passivos repete o mesmo número
para o mesmo passivo (Wireframe `40:2`, nó `90:67` "R$ 178.400,00" com `90:70` "12/360"): a
coluna da lista, o card e o Balanço são **uma** grandeza, não três.

**Resposta:** saldo devedor é o **principal em aberto** — o valor presente das parcelas ainda
Previstas, descontadas à taxa vigente do passivo. Card, lista, Balanço e gráfico mostram o mesmo
número, e nenhuma tela precisa explicar divergência nenhuma.

**O que continua em aberto, e é outra pergunta:** a fórmula exata do desconto. A nota `164:2`
("Passivo: cálculo automático de juros foi escolha deliberada") diz, em `164:4`, que o design
definiu interface e fluxo mas "a fórmula exata precisa ser validada por alguém de
backend/financeiro… um erro aqui mostra saldo devedor errado pra pessoa". O código desconta pela
mesma Price que gerou o cronograma (`presentValueOfStream`), o que fecha as duas invariantes que
o frame exige — saldo ≤ valor original, e série ancorada no valor original caindo até zero.

**Ponto próprio levantado pela mesma medição, já respondido:** o frame usa o "Valor da parcela"
DECLARADO (R$ 1.520,00) como o pagamento real, não a parcela re-derivada por Price a partir do
valor original (que daria R$ 2.855,64 a 0,85% em 360 meses). Os dois números não podem ser a
mesma conta — e não precisam ser: `164:4` diz que o design define interface e fluxo, não a
fórmula, então os valores do frame são ilustrativos. Ver **P3a** (o valor declarado é dado
cadastral, não entrada de cálculo) e **P3** (a fórmula em si, que continua aberta).

### P6. Marcar uma parcela como paga cria um Lançamento? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/domain/reports/income-statement.ts` · `src/domain/assets/types.ts`

**Resposta: a parcela CONTA no DRE, em Despesas Administrativas, pelo valor cheio — mas não vira
Lançamento.** Ela entra como parcela, por `IncomeStatementInput.installments`, e a linha carrega
`source.kind === 'Installment'`.

**A evidência foi a planilha, lida célula a célula.** Em JUN, JUL e AGO de 2026:

| Linha                               | Bloco                       | Estado                  |
| ----------------------------------- | --------------------------- | ----------------------- |
| `(-) Financiamento imóvel/veículo`  | 4. Despesas Administrativas | **preenchida todo mês** |
| `(-) Juros do financiamento`        | 8. Resultado Financeiro     | **zerada todo mês**     |
| `(-) Saldo devedor — financiamento` | Balanço                     | preenchida              |

A referência lança a parcela **inteira** como despesa administrativa e **não separa juros**. E o
plano de contas do produto já traz a categoria de destino com rótulo idêntico
(`financiamento-imovel-veiculo`, "Financiamento imóvel/veículo").

**O que estava errado ia além da contabilidade.** `sourceOf` sempre devolvia `{ kind: 'Entry' }`,
e a variante `Installment` do contrato não era produzida por nada: a linha que o Figma `11:2`
desenha (nó `235:64`, "Financiamento apartamento, parcela 13") **nunca aparecia na tela**, e o
`InstallmentRowActions` da tela do DRE era código morto. Sem a parcela, o DRE subestimava a
despesa do mês por ela inteira e superestimava o Lucro Líquido — o número que alimenta o
"Destinar este Lucro", ou seja, o produto oferecia destinar dinheiro que já tinha ido para o
financiamento.

**Por que não vira Lançamento:** o desenho já dizia que não. O "Editar" da linha aponta para o
Detalhe do Passivo, não para o formulário de Novo Lançamento, "which only knows Lançamentos" — e
é o `source.kind` que decide isso. Criar um Lançamento por baixo daria à pessoa um registro
editável em separado, que sairia do cronograma na primeira edição.

**Consequência que a decisão obrigou a resolver: `Installment.paidDate`.** O mês contábil é o da
data de pagamento (PRD §5, regime de caixa). O formulário já pedia a data e o endpoint já a
recebia, mas ela ia só para o Evento de rastreabilidade e era descartada da parcela — uma parcela
prevista para 10/08 e paga em 02/09 cairia em agosto. O campo passou a ser persistido (migração
`0006`).

**Detalhe que só apareceu ao olhar a tela:** o filtro Pago/Previsto vale para a **cascata**, não
para a lista. A legenda do card no Figma `11:2` diz "Mostra pagos e previstos juntos, independente
do filtro da cascata", e a linha de Lançamento já se comportava assim. A primeira versão da
implementação aplicou o filtro nos dois e a parcela Prevista sumia da lista — os testes passavam.

**O que continua em aberto:** P27, o valor "pago" das parcelas já quitadas na abertura do cadastro
— elas não têm data de pagamento informada por ninguém, então `paidDate` nasce nula e o DRE as
trata pela data prevista.

### P7. Quais palavras-chave sugerem circulante e não circulante? — **RESPONDIDA (produto, 2026-09-09)**

**Resposta: o vocabulário do PRD, mais um bloco declaradamente coloquial.**

As sete palavras que já existiam foram conferidas: são a derivação **completa** das quatro linhas do
Balanço no PRD — curto prazo, longo prazo, cartão, financiamento, empréstimo, imóvel, veículo. Nada
faltava daquela fonte; a lista deixa de ser "assumida" e passa a ser decidida.

Mas uma sugestão que não reconhece "consórcio" nem "cheque especial" não sugere quase nada na
prática. Entraram oito palavras que a pessoa digita e nenhuma fonte escreve — consórcio, Tesouro,
FGTS, cheque especial, crediário, parcelamento, poupança, CDB —, **depois** das do PRD na ordem de
avaliação, para que onde a fonte fala seja ela a decidir ("Consórcio de curto prazo" é circulante).
Cada linha diz no campo `source` de qual dos dois blocos ela é.

**O que torna o custo de errar baixo, e foi medido:** a Classificação de um Lançamento **não
alimenta relatório nenhum**. O Balanço é montado sobre contas, investimentos, bens e passivos, não
sobre lançamentos — ela serve de filtro no Histórico. Somada à edição livre do campo nas duas telas,
uma sugestão errada custa um clique.

### P8. Qual classificação cada categoria de referência sugere? — **RESPONDIDA (produto, 2026-09-09)**

**Resposta: só onde o conceito se aplica.** Categoria de despesa sugere `Circulante`; a de
financiamento sugere `Não circulante`; as de receita e de dedução seguem `null`.

O PRD promete "classificação sugerida a partir da categoria", e a máquina inteira já existia —
`Category.suggestedClassification` e o formulário que a lê. Só o dado nunca tinha sido preenchido:
as 28 categorias de referência saíam com `null`, e a promessa nunca disparava para nenhuma delas.

**Por que não todas.** Circulante / não circulante é vocabulário de INSTRUMENTO — um ativo ou
passivo com horizonte. "Alimentação" não é nem um nem outro, e receita não é ativo nem passivo.
Preencher as 28 significaria, na prática, escrever `Circulante` em quase tudo — indistinguível de
pré-selecionar Circulante sempre, sem tabela nenhuma, e uma sugestão arbitrária ensina a pessoa a
ignorar o campo.

A regra sai do **bloco**, não de uma tabela categoria a categoria: os três blocos de despesa são o
que acontece e se paga no mês. A única exceção é nomeada por fonte — "Financiamento imóvel/veículo",
do PRD §Balanço, "Passivo não circulante — saldo devedor de financiamento".

### P20. Qual é o valor pré-selecionado de "Entidade"? — **RESPONDIDA (produto, 2026-09-09)**

**Resposta: PF**, e o `files_design/03` foi corrigido nas cinco linhas que diziam "Default: vazio".

A contradição não era entre dois documentos, era **dentro do mesmo**: a convenção no topo do
`files_design/03` já lista Entidade entre os "toggles/seletores com valor padrão pré-selecionado",
e as tabelas abaixo dela escreviam `vazio` em cinco lugares. PF é o único default de Entidade que
alguma fonte escreve — a aba Despesa, na linha 112 da mesma tabela.

O código já fazia isso; o que mudou foi o documento deixar de dizer o contrário. A consequência
aceita: quem só clica "Adicionar" cadastra como PF sem escolher. É o mesmo risco que qualquer
default carrega, e a alternativa custava estado de erro em três telas de onboarding que hoje não
têm nenhum.

### P21. Só o Lucro Líquido move o Patrimônio Líquido? — **RESPONDIDA (medida + produto, 2026-09-09)**

**Resposta: não, e a suposição não era imprecisa — era falsa por construção.** Registrada em
**ADR-0016**.

A reconstrução da Evolução Mensal fazia `PL(mês) = PL(mês seguinte) − Lucro Líquido(mês seguinte)`.
Medido, componente a componente:

| Componente do PL                  | Tem histórico?                                                       |
| --------------------------------- | -------------------------------------------------------------------- |
| Passivo (saldo devedor)           | **sim** — as parcelas têm data de pagamento                          |
| Bem Material                      | **sim** — `recordedValue` é fixo (PRD §5) e `soldOn` diz quando saiu |
| Conta bancária (`balance`)        | **não**                                                              |
| Investimento (`accumulatedValue`) | **não**                                                              |

E os dois sem histórico mudam **apenas** quando a pessoa os edita — `PUT /bank-accounts/{id}` e
`PUT /investments/{id}` são os únicos escritores. **Pagar um Lançamento não move saldo nenhum.**
Logo Lucro Líquido e Patrimônio Líquido são grandezas independentes neste produto: um move o DRE, o
outro move quando alguém digita um número. A conta não aproximava — relacionava coisas que não se
relacionam.

**O que foi construído** (ADR-0016, decisão de produto de 2026-09-09):

- Tabela `net_worth_snapshots`, uma linha por `(mês, visão)`.
- O retrato é tirado **quando o patrimônio muda**, não quando o mês acaba — não existe ritual de
  fechar mês, e como o PL só muda nessas horas, o último retrato do mês É o fechamento dele. Mês
  sem retrato herda o anterior, e isso também é exato: é mês em que nada mudou.
- A gravação mora no **composition root**, decorando os seis escritores de patrimônio. Doze rotas
  mexem em patrimônio; chamar o gravador em cada uma seria doze chances de esquecer uma, e uma rota
  nova nasceria sem ele.
- O harness de teste aplica o mesmo decorador, com relógio injetável — senão o teste rodaria sobre
  uma montagem diferente da de produção.

**O que continua em aberto, e não é dívida escondida:** meses anteriores à tabela não têm retrato e
não podem ganhar um — não existe dado. Eles seguem reconstruídos, com `netWorthIsReconstructed:
true`, que agora significa exatamente "estimado". E **nenhuma tela mostra essa distinção ainda**:
nenhum frame do Figma desenha a marcação, e inventar o texto seria decidir design.

### P22. De onde vêm os Aportes de Investimento do mês e a Renda Passiva que os Indicadores Financeiros precisam? — **RESPONDIDA (produto, 2026-09-08; fechada em 2026-09-11)**

**Onde:** `src/domain/reports/indicators.ts` · `investmentContributionsThisMonth`, `PASSIVE_INCOME_CATEGORY_NAMES`

Dois indicadores do catálogo (files_design/08 §10) precisam de um dado que nenhuma fonte diz como
obter dentro do próprio `reports`:

1. **Crescimento dos investimentos** e **Eficiência de aporte** precisam de "quanto foi aportado em
   investimentos este mês, via Destinação do Lucro" (buckets "Aporte em Investimentos" +
   "Reinvestimento de Dividendos"). Esse número só existe dentro de `profit-allocation` — e a regra
   de dependência do domínio (`src/domain/README.md`: "reports ← entries + chart-of-accounts +
   assets") proíbe `reports` de importar `profit-allocation` para somá-lo sozinho.
2. **Cobertura por renda passiva** precisa saber quais categorias de Receita contam como "renda
   passiva" (aluguel, dividendos) — `Category` não tem esse marcador.

- **Assumido hoje:** (1) quem monta o input de `computeFinancialIndicators` (fora deste módulo) soma
  os buckets do mês e passa o total já pronto em `investmentContributionsThisMonth`, `null` quando
  não há `ProfitAllocation` registrada para o mês — os dois indicadores mostram travessão nesse
  caso; (2) a soma casa pelo NOME das categorias padrão ("Aluguel recebido",
  "Dividendos/Rendimentos de investimentos externos") — quem renomear qualquer uma das duas para de
  ser contado aqui.
- **O que mudou (2026-09-08):** a parte que quebrava calada foi fechada. O casamento passou a ser
  por **id de categoria**, nunca por nome — `sumRowsOfCategories` filtra por
  `aluguel-recebido`/`dividendos-rendimentos`, e `IncomeStatementRow` ganhou `categoryId` (que
  viaja no contrato HTTP) pra isso ser possível. Motivo, medido antes da mudança: renomear
  "Aluguel recebido" derrubava `passiveIncomeCoverage` de 50% pra 0%, sem erro e sem aviso — o
  nome é texto livre que a pessoa edita ("Editar" existe em toda categoria, Figma 44:2), enquanto
  `renameCategory` nunca toca no id. Teste em `indicators.test.ts` ("P22 — conta a renda passiva
  mesmo depois de a categoria ser renomeada"), provado vermelho→verde.
- **Decisão de produto (2026-09-08): `Category` ganhou o marcador.** `isPassiveIncome` é um campo
  da categoria, `true` de fábrica nas duas de referência, e a pessoa marca as dela pelo "Editar" da
  linha no Plano de Contas. `passiveIncomeCoverage` passou a somar o que estiver marcado, em vez de
  uma lista fixa de ids. Coberto por `indicators.test.ts` ("P22 — …criada pela pessoa, marcada por
  ela").
- **~~Pendência de design~~ — FECHADA, e o registro é que estava velho.** O controle ("Conta como
  renda passiva", um Toggle no formulário de edição inline) foi desenhado: componente
  `Categoria em edição` (`1301:5237`) da Mockup, com o rótulo `1301:5232` e o Toggle `1301:5233`,
  rótulo à esquerda e controle à direita. Só aparece em Receita Bruta, porque
  `passiveIncomeCoverage` só soma esse bloco.
- **Item (1) resolvido em 2026-09-11, e por um caminho diferente do que a pergunta supunha.**
  `investmentContributionsThisMonth` continua nascendo onde nascia (a rota soma os dois baldes do
  mês, o que está certo para "Eficiência de aporte": ela pergunta que parte do LUCRO virou aporte, e
  dinheiro de venda não é lucro do mês).

  O que estava errado era o OUTRO indicador. "Crescimento dos investimentos (mês)" deduzia o mês
  anterior como `total_atual − aporte`, o que assume que só a Destinação do Lucro mexe nos
  investimentos. A ADR-0017 §4 tornou a suposição falsa de vez: direcionar uma venda para um
  investimento sobe o `accumulatedValue` sem passar por balde. **Medido: 4,2% onde o certo eram 25%**
  (100.000 investidos, mais 5.000 de lucro e 20.000 de venda no mês).

  A correção é a mesma da ADR-0016 e reusa a máquina dela: o retrato mensal passou a carregar o
  total investido, e o indicador lê o retrato do mês anterior em vez de deduzir. Basta medir os dois
  meses porque **o produto não reavalia investimento** — é o que o próprio texto de ajuda do
  indicador diz —, então todo aumento no total é aporte. Somar fonte por fonte seria o caminho longo
  para o mesmo número, com o agravante de que os direcionamentos de venda nem são persistidos.

  Sem retrato do mês anterior (instalação nova, primeiro mês) o indicador mostra travessão, que é a
  resposta certa para "não sei quanto havia antes".

- **Se a resposta for diferente:** se o produto decidir que esse agregado deve nascer em outro
  lugar (ex.: um campo em `Investment` mantido pela pessoa, como `balance` em `BankAccount`), o
  parâmetro `investmentContributionsThisMonth` sai do input; se `Category` ganhar um marcador de
  "renda passiva", `sumRowsOfCategories` troca a lista fixa de ids pelo marcador.

### P24. Ao editar um Passivo, o cronograma já gerado deve ser recalculado? — **RESPONDIDA (2026-09-07)**

**Onde:** `src/app/api/v1/liabilities/[id]/route.ts` · `PATCH` · `src/api/contracts/liabilities.ts`
· `liabilityPatchSchema`

**A pergunta estava mal posta.** Ela dizia "nenhuma fonte diz", e o Figma diz — por texto literal,
em quatro lugares, e sempre a mesma coisa: existe **um** gatilho de recálculo, nomeado.

- Wireframe `91:2`, legenda do gráfico "Evolução da dívida (saldo devedor)" (`91:98`), repetida
  palavra por palavra no Mockup `948:1687` (`949:72`): _"Calculado automaticamente com base na taxa
  de juros e no cronograma de amortização. **Recalculado a cada reajuste de juros registrado**."_
- O cabeçalho separa fisicamente as duas ações (grupo `203:2`: `91:43` "Editar dados cadastrais" e
  `91:58` "Registrar reajuste de juros"; no Mockup, `948:1838` com `948:1839`/`948:1841`). Só a
  segunda tem tela própria — `94:2` —, e é lá que mora todo o vocabulário de recálculo (`339:2`,
  `94:56`). `grep -rn "recalcul" docs/figma/frames/` só acha `94:2` e `164:2`.
- Nota de design `164:2` (`164:4`): entre "(A) sistema calcula a amortização **e recalcula a cada
  reajuste de juros**" e "(B) só registra valores reais confirmados", _"escolhemos a (A) por pedido
  explícito de produto"_.
- `files_design/03`, "objeto Parcela": Número é "1 até Número de parcelas" e Valor previsto é
  "calculado por amortização, **recalculado a cada reajuste de juros registrado**".

**Decidido, portanto:** o `PATCH` **não recalcula** — e deixou de aceitar os campos que dariam
forma a um cronograma novo. `originalAmount`, `installmentCount`, `installmentsAlreadyPaid`,
`startDate` e `monthlyInterestRate` (as cinco entradas de `buildInstallmentSchedule`) saíram de
`liabilityPatchSchema` e voltam **422**. "Editar dados cadastrais" edita Nome, Credor / Instituição,
Entidade, Classificação e Valor da parcela — nenhum deles muda número que a tela deriva.

**A medição que fechou o caso:** aceitá-los deixava a tela se contradizendo, o que o frame proíbe.
`installmentCount` de 360 pra 400 fazia o card "Parcelas" (`91:56`/`948:2290`) imprimir
"12 / 400 pagas" sobre uma lista (`337:3`) de 360 linhas e um rodapé (`91:132`/`950:71`) que
continuava contando sobre 360; e o evento de Cadastro que o histórico guarda pra sempre —
"Dívida cadastrada: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m." (`950:85`) — viraria
mentira sem nenhum Evento que explicasse, já que o enum de `files_design/03` só tem Cadastro,
Reajuste de juros, Parcela paga e Recorrência paga.

**O que sobrou em aberto (P24b):** o Onboarding 5 — Passivos (`29:180`) desenha "Editar" na linha
de um passivo já cadastrado, e `src/app/onboarding/passivos/page.tsx` (`LiabilityRow`) manda o
formulário inteiro nesse `PATCH`. Ele já respondia 422 antes desta mudança (o corpo carregava
`monthlyInterestRate`, fora do schema desde antes) e continua respondendo: **nenhuma fonte diz o
que "Editar" pode mudar num passivo cujo cronograma já foi gerado no passo anterior**. Consertar
isso é decisão de produto, não de código.

### P25. "Pagar" uma divergência de pagamento a menor gera um Lançamento novo? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/app/api/v1/payment-discrepancies/[id]/payment/route.ts`

**Resposta: sim.** A ação resolve a Pendência **e** registra a diferença como Lançamento. Decidida
junto com a P6 e pelo mesmo princípio: se a parcela de Passivo paga conta no DRE, o complemento de
um pagamento a menor também conta. Sem ele o DRE fica curto pela diferença para sempre.

**O Lançamento herda** categoria, entidade, classificação e conta do Lançamento de origem — é o
mesmo gasto sendo completado — e nasce **Pago**.

**A data é HOJE, não a original**, e isso responde a ressalva que a própria pergunta levantava: usar
`originDate` reescreveria um mês que a pessoa já fechou, fazendo o DRE daquele mês divergir do que
ela viu. Regime de caixa (PRD §5): o dinheiro sai agora. O Figma desenha "Pagar" como ação direta
no card de Pendência (frame `5:2`), sem diálogo que pudesse perguntar a data — então não há data a
perguntar, e assumir a original seria pior que assumir hoje.

**Uma exceção, estreita e declarada:** a divergência nasce de um Lançamento
(`PaymentDiscrepancyOrigin` é só `{ kind: 'Entry' }`), e Pró-labore e Distribuição não têm
Categoria. Sem categoria o complemento não teria onde cair, então a rota resolve a Pendência e para
aí. Nenhuma fonte descreve divergência nesses dois tipos.

### P26. Qual é a "data" de uma Pendência de Lucro Não Destinado? — **RESPONDIDA (produto, 2026-09-09)**

**Onde:** `src/domain/pending-items/rules.ts`

**Resposta, escrita como regra única para os cinco tipos: a data de uma Pendência é a data do FATO
que a originou — e, quando esse fato é um mês inteiro, o primeiro dia dele.**

Três dos cinco tipos já tinham data real e nunca foram dúvida: a venda (`originDate`), a ocorrência
(`plannedDate`) e a divergência (`originDate`). Os dois sintéticos — lucro não destinado e sobra do
Consumo Livre — tratam de um **mês**, não de um instante. `YYYY-MM-01` deixa de ser substituto
provisório e passa a ser a data do fato **na precisão que o fato tem**.

**Guardar carimbo de tempo real foi recusado, e não por economia:** a pendência é derivada — não
existe instante de criação para carimbar. O que daria para gravar é "quando a destinação foi salva
pela última vez", que ordenaria por _mexido mais recentemente_ em vez de _mês mais antigo em
aberto_ — pior para o propósito da lista.

**Escopo, medido:** a data **nunca chega à tela**. Nenhum dos cartões desenha data — Wireframe
`115:2`, Mockup `549:75`, Vazio `309:2`, Carregando `309:26` — enquanto o card vizinho Eventos
Recentes, na mesma Home, imprime `dd/mm/aaaa` (`150:7`). A ausência é escolha de desenho. A data é
só a chave da ordem.

**A pergunta deixou de ser teórica no dia anterior, e foi isso que a fechou.** A Pendência de sobra
(P14) nasceu usando `${mês seguinte}-01` — o mês em que a sobra vira decisão — enquanto a de lucro
usava `${mês}-01`. Lidas isoladamente, as duas convenções pareciam igualmente defensáveis; só a
lista misturada mostra a diferença: **uma sobra de junho é assunto mais antigo que o lucro de
julho**, e com a convenção do mês seguinte as duas empatavam. A sobra foi alinhada à regra, com o
teste da ordem visto vermelho na convenção antiga.

### P27. O valor "pago" das parcelas já quitadas de um Passivo em andamento é o previsto? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/domain/assets/installments.ts` · `buildInstallmentSchedule` ·
`src/domain/reports/income-statement.ts`

**Resposta: sim, e elas contam no DRE.** O valor presumido é o previsto, e o mês é o da data
prevista. A pessoa pagou de fato; o relatório mostra.

**A pergunta mudou de peso ao ser decidida.** Ela existia desde antes, mas era inofensiva enquanto
a parcela não entrava no DRE. Ao fechar a P6, essas parcelas passaram a alimentar um relatório — e
a consequência foi **medida na fixture sintética antes de decidir**, não deduzida:

```
Parcela #1, marcada paga na abertura do cadastro:
  paid_date   = NULL      ← nenhum campo do formulário a pede
  paid_amount = 271412    ← presumido igual ao previsto

DRE de 2025-08, mês em que a pessoa nem usava o produto:
  Despesas Administrativas = R$ 2.714,12
  Lucro Líquido            = −R$ 2.714,12
```

Cadastrar uma dívida em andamento escreve despesa nos meses passados correspondentes. **É o
comportamento pretendido**, decidido sabendo disso, e está travado por teste — porque
`paidDate === null` é um discriminador exato de "paga na abertura" e seria tentador usá-lo para
excluí-las.

**Por que não pedir o valor real de cada parcela antiga:** cobraria da pessoa, para desbloquear o
cadastro de uma dívida, um dado que ela provavelmente não tem à mão — o extrato de cada parcela
paga antes de o produto existir. A planilha de referência não desempata: ela começa em JUN-2026 e
não tem mês anterior ao início.

**O que sobra, e é do time de Design:** nada na tela distingue parcela **presumida** de parcela
**confirmada**. Nenhum frame do Detalhe do Passivo faz essa distinção, então marcar seria inventar
UI. Registrado abaixo, na seção do design.

---

## Para o time de Design

### P45. A tela deve distinguir parcela com valor presumido de confirmada? — **RESPONDIDA (design, 2026-09-09)**

**Resposta: não distingue.** As parcelas que o campo "Parcelas já pagas" cria continuam
indistinguíveis das que a pessoa marcou paga informando valor e data.

Marcar exigiria decidir o marcador e, junto, uma ação de **corrigir parcela antiga** que hoje não
existe — sem ela, o marcador informaria um problema sem oferecer saída. A decisão é consciente,
não esquecimento: está registrada aqui e no comentário de `buildInstallmentSchedule`, que diz que
o valor é presumido e por quê.

### P9. "Consumo Livre" ou "Consumo livre"? — RESPONDIDA (medida no Figma)

**Onde:** `src/domain/chart-of-accounts/types.ts`

A pergunta descrevia o Figma como fonte dividida ("a lista do Plano de Contas no frame `44:2`
escreve **Consumo livre**") e desempatava por autoridade externa a ele ("assumido hoje: a forma
do glossário"). **As duas coisas estão erradas.** O Figma não empata, e `44:2` não é a lista do
Plano de Contas.

**Resposta:** **"Consumo Livre"**, com L maiúsculo, é o que o Figma escreve — não uma escolha
do glossário.

**Medição.** Nome da categoria, nas duas páginas:

| Página              | "Consumo Livre"   | "Consumo livre" |
| ------------------- | ----------------- | --------------- |
| Wireframe (130 XML) | 55 nós, 21 frames | 1 nó: `44:78`   |
| Mockup `552:2`      | 96 nós            | nenhum          |

Onde o maiúsculo aparece: card da Home `193:5` "Saldo para Consumo Livre" (frame `5:2`), bloco
do treemap `198:3`, Histórico `9:67` e `9:112` (a coluna Categoria de um lançamento real),
modais `192:3` "Configurar Consumo Livre", `192:16` e `192:19`, Revisão de Recorrentes `10:44`.

**Os três textos que pareciam contradizer, e não contradizem:**

1. `44:78` — está no frame `44:2` **"Onboarding 1 — bloco de categoria expandido (exemplo)"**,
   não na lista do Plano de Contas. É o único nó em caixa baixa do arquivo inteiro e não tem
   contraparte no Mockup: "Desktop — Plano de Contas (claro)" `936:1543` e "Desktop —
   Onboarding 1 (claro)" `988:1995` desenham o bloco **colapsado** (60 instâncias "Linha
   expansível"), então nada no Mockup confirma `44:78`. Tratar como typo do frame — cabe
   reportar ao time de Design, não decidir aqui.
2. As telas de Plano de Contas (`331:2`, `29:2`) **não imprimem a categoria**. O que elas trazem
   é a legenda em prosa `331:103` / `51:16` "Alimentação, transporte, lazer, vestuário, consumo
   livre..." — todos os itens em caixa baixa depois da primeira palavra, ou seja capitalização
   de frase, não o rótulo.
3. "Consumo livre / FCL" (`25:113`; no Mockup `858:1284` e `858:1403`) é **outra string**: o
   rótulo da linha do indicador Qualidade de Vida Financeira, registrado assim, minúsculo, em
   `files_design/08` e em `src/domain/GLOSSARY.md`. Vive em `src/domain/reports/types.ts` e
   continua minúsculo.

**Placar do nome da categoria: 151 nós × 1.** Trocar para "Consumo livre" contrariaria, entre
outros, o rótulo que o Histórico imprime para um lançamento real e o título do modal que a
própria categoria abre.

**Estado do código:** já correto e coberto —
`src/domain/chart-of-accounts/types.ts` cadastra `'Consumo Livre'`,
`src/domain/reports/types.ts` usa `'Consumo livre / FCL'`, e
`src/domain/chart-of-accounts/rules.test.ts:51,82` e
`src/app/(app)/inicio/_lib/category-routing.test.ts:6` cravam a grafia.

### P10. A categoria de sistema "Consumo Livre" pode ser editada ou descartada? — RESPONDIDA (produto, 2026-09-07)

**Onde:** `src/app/onboarding/plano-de-contas/_components/plano-de-contas-step.tsx` ·
`src/features/plano-de-contas-e-patrimonio/screens/plano-de-contas.tsx`

A pergunta partia de um falso dilema: o frame `44:78` desenha "Consumo livre" com o par
Editar/Descartar dos vizinhos, e a nota `44:88` escreve a regra ("cada categoria tem
Editar/Descartar"), mas o contrato da API proíbe renomear ou arquivar a categoria de sistema
porque o widget de Consumo Livre **sempre** lança nela — arquivá-la quebraria o widget.

**Decisão de produto:** "Consumo Livre" **sai da lista do Plano de Contas**. Deixa de ser uma
linha do bloco Despesas Pessoais/Consumo e passa a ser tratada como área de consumo isolada,
que é a sua própria categoria, com widget próprio na Home (`files_design/01 §4a`).

Isso resolve a contradição na raiz em vez de escolher um lado: fora da lista, a regra do frame
`44:88` passa a valer **sem exceção** para tudo que está listado, e a trava do domínio
(`refuseIfSystem`) continua protegendo o widget. Ela permanece no treemap de Despesas por
Categoria da Home, onde `files_design/02` a coloca de propósito ("sem isso, o total de despesas
do mês ficaria incompleto").

- **O que muda se for revertido:** volta o dilema — ou a trava sai e o widget precisa saber lidar
  com a categoria arquivada, ou a linha volta à lista com um par de ações desabilitado, que
  nenhum frame desenha.

### P11. Recriar uma categoria arquivada restaura a antiga ou cria uma nova? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/domain/chart-of-accounts/rules.ts` · `createCategory` · `activeNamesake`

**Resposta: cria um registro novo.** Confirma o comportamento atual. A antiga continua arquivada,
com o histórico dela, e não reaparece sem a pessoa pedir.

**Como o código já permitia isso, e é bom saber:** `createCategory` recusa nome duplicado via
`activeNamesake`, que só olha categorias **ativas do mesmo bloco**. Uma arquivada não bloqueia a
recriação — não por descuido, e agora por decisão.

**Restaurar foi recusado pelo efeito colateral:** desarquivar traria de volta, sem aviso, os
lançamentos antigos para as listas. Pode ser o que a pessoa quer ao recriar, ou uma surpresa se ela
achava que tinha recomeçado do zero — e não há tela que pergunte qual dos dois é.

**Um defeito que esta decisão obrigou a consertar, e que existia antes dela.** Ao medir o custo de
"criar um registro novo", apareceu que ele era maior do que a pergunta descrevia:

|                                                  | Antes   | Depois |
| ------------------------------------------------ | ------- | ------ |
| Lançamentos da categoria arquivada contam no DRE | sim     | sim    |
| Aparecem no filtro de Categoria do Histórico     | **não** | sim    |

Medido na base sintética com uma categoria arquivada: `/categories` devolvia 38 e
`/categories?includeArchived=true` devolvia 39, e a tela do Histórico usava a primeira. Os
lançamentos apareciam no total e eram **impossíveis de encontrar** — falha silenciosa, porque o
filtro parece funcionar.

Arquivar esconde a categoria das listas de **escolha**; um filtro de histórico olha para trás e
não é essa tela. O Histórico passou a usar `useCategoriesIncludingArchived`, e dois testes travam
isso — vistos vermelhos com a consulta antiga. Sem a correção, a decisão da P11 tornaria o caso
comum: passariam a existir duas "Academia" e a metade antiga sumiria do filtro.

### ~~P12. O que mais o "Editar" da Revisão de Recorrentes permite mudar?~~ — RESPONDIDA pelo Figma

**Onde:** `src/domain/recurrence/engine.ts` · `editOccurrence`

Não era lacuna: o frame existe e responde. O painel de "Editar" é o card `34:24` da coluna ②
(`34:21`) do Wireframe `34:2`
([`frames/34-2__estado-3-acoes-da-revisao-de-recorrentes.xml`](figma/frames/34-2__estado-3-acoes-da-revisao-de-recorrentes.xml)),
e desenha **um campo só**: `144:3` "Valor *" com a caixa `144:4`/`144:5` "R$ 189,90". Depois
dele vêm `34:25` "Aplicar esta mudança a:" e as duas linhas `34:27` "Só esta ocorrência
(Julho/2026)" e `34:29` "Toda a série (valores em aberto)". Não há data prevista, categoria,
conta nem "Tipo de valor" desenhados; o conteúdo do card termina em y=188 de 202, exatamente os
14 de padding inferior. A página Mockup (canvas `552:2`) não desenha este diálogo — tem só
"Desktop — Revisão de Recorrentes" e a versão vazia —, então o Wireframe é a fonte única.

**Resposta:** só o valor. A frase "muda valor/dados" de `files_design/01` §6 é o texto solto; o
frame é a especificação.

### ~~P13. Preencher o valor de uma série "a definir" converte a série para "fixo"?~~ — RESPONDIDA pelo Figma

**Onde:** `src/domain/recurrence/engine.ts` · `editOccurrence`

Não era lacuna: o frame existe e responde, e não é nenhum dos dois frames de recorrência — é o
tooltip. O card `74:14` "④ Hover: Tipo de valor (recorrência)" do Wireframe `71:11`
([`frames/71-11__estado-tooltips-de-ajuda-status-classificacao-tipo-de-valor-sub-tipo.xml`](figma/frames/71-11__estado-tooltips-de-ajuda-status-classificacao-tipo-de-valor-sub-tipo.xml))
define os dois tipos pelos textos `75:2` a `75:6`: "Fixo: o valor se repete igualmente todo
mês." / "A definir: o valor sofre alterações e deve ser informado a cada mês." / "Para editar ou
informar o valor de recorrências, use a tela Revisão de Recorrentes." (transcrito palavra por
palavra em `files_design/02`, na linha do "Ícone 'i' de ajuda contextual".)

**Resposta:** **não converte.** Variar todo mês é a definição do tipo "a definir", não um estado
provisório a ser resolvido: preencher um mês não faz o mês seguinte parar de variar. A série
continua nascendo em branco (PRD §5 "Motor de recorrência": "fixa = valor copiado; a definir =
em branco"). Trocar o tipo é uma mudança de "Tipo de valor", e esse controle mora no bloco
RECORRÊNCIA do Novo Lançamento (frame `262:873`, nó `67:8`, com os segmentos `67:11` "Fixo
(copia o valor)" e `67:13` "A definir (em branco)"), nunca na ação rápida — o card "② Editar"
(`34:21` do frame `34:2`) desenha um campo só, `144:3` "Valor *", e as duas linhas de escopo.

**E não existe a pendência que voltava todo mês:** a opção `34:29` "Toda a série (valores em
aberto)" alcança toda ocorrência ainda Prevista, inclusive a atrasada (`files_design/02`).
Continuar vendo a pendência mês a mês só acontece se a pessoa escolher `34:27` "Só esta
ocorrência", que é exatamente o que ela pediu.

**Consequência no código:** numa série "a definir", o `editOccurrence` de escopo "Toda a série"
preenche as ocorrências em aberto e **não** grava valor no template — o template de uma série
que varia não tem valor de série a guardar. Fixado por
`src/domain/recurrence/engine.test.ts`.

### P14. A sobra do mês anterior no Consumo Livre é registro guardado ou derivado? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/domain/discretionary-spending/` · `src/app/api/v1/leftover-directions/` ·
`src/app/api/v1/pending-items/route.ts`

**Resposta, e ela reformula a pergunta: a sobra vira PENDÊNCIA.** Não entra sozinha em lugar
nenhum — aparece na Home como "valor sem destino", a pessoa decide para onde vai, e **um dos
destinos é o Consumo Livre deste mês**. O teto do mês continua sendo a verba configurada até ela
mandar.

**A pergunta ficou aberta porque o frame se contradiz, e isso foi medido.** No `345:752`:

```
verba R$ 500 · sobra R$ 150 · gastos 50 + 30 + 70 = 150 · cabeçalho "R$ 350 de R$ 500"
500 − 150 = 350  ✓ fecha         (a sobra NÃO entrou)
650 − 150 = 500  ✗ não fecha     (se tivesse entrado)
```

Os **números** dizem que a sobra não entrou; o **texto** da linha diz "adicionada ao saldo". A
decisão resolve os dois: a sobra só entra por decisão, e a frase é que precisa parar de prometer
o que não cumpre.

**O que se guarda é o DIRECIONAMENTO, não a pendência** — que era literalmente a pergunta. A
pendência continua derivada (`sobra(mês) − soma dos direcionamentos`), o que preserva ADR-0001 §1,
dispensa materializar nada no virar do mês e dá o parcelamento de graça: direcionar R$ 100 de
R$ 150 deixa R$ 50 pendentes, igual à pendência de venda de bem material.

**As duas sub-perguntas somem junto:**

- _(a) a sobra sobe o teto?_ Só o que a pessoa mandar de volta. `allowanceForMonth` deixa de somar
  a sobra automática e passa a somar `leftoverBroughtForward`.
- _(b) sobra zero mostra "+ R$ 0,00"?_ Sem sobra, não há pendência.

**Um defeito da minha própria implementação, achado ao rodar:** a primeira versão só considerava
meses **com gasto**, e um mês em que a pessoa não gastou nada — que sobrou a verba INTEIRA, a maior
sobra possível — não gerava pendência. Corrigido para o intervalo do primeiro uso até o mês
anterior. O piso é o primeiro mês com gasto: sem ele, configurar o Consumo Livre hoje geraria
pendência para todo mês desde sempre.

**Verificado ponta a ponta na base sintética:** julho sobrou R$ 150 → direcionei R$ 100 para o
Consumo Livre → a pendência de julho caiu para R$ 50, e agosto passou a aparecer com **R$ 600** (a
verba de R$ 500 mais os R$ 100 trazidos, sem gasto no mês). Direcionar mais do que resta é recusado
com 422 `leftover_direction.exceeds_pending`.

**Fica em aberto, e é do Design:** o quinto card empurra a lista para uma segunda linha, onde o
`flex-wrap` estica o card sozinho para a largura inteira — o Mockup agora mostra isso, e não ficou
bonito. Corrigir com grade de 4 colunas mudaria também o caso de 3 itens, que já existe hoje.

### P15. O Rótulo de um gasto de Consumo Livre fica no Lançamento ou ao lado dele? — RESPONDIDA (lida no Figma)

**Onde:** `src/domain/discretionary-spending/types.ts` · `src/api/contracts/discretionary-spending.ts` ·
`src/data/sqlite/schema.ts`

A pergunta afirmava que "não está definido em nenhuma fonte". **Está.** O Wireframe tem uma nota
inteira sobre isso: nó `164:5`, "Nota — Por que Rótulo só em Consumo Livre e IR"
(`docs/figma/frames/164-5__nota-por-que-rotulo-so-em-consumo-livre-e-ir.xml`), cujo texto `164:7`
diz, literal:

> Regra simples: Rótulo existe só nas abas que não têm campo de Categoria (Consumo Livre e IR),
> porque sem Categoria, não tem outro jeito de diferenciar lançamentos parecidos no Histórico.
> Despesa, Receita e Pró-labore/Distribuição já têm Categoria, então Rótulo seria redundante ali.

**Resposta:** o Rótulo é **campo do próprio Lançamento** — ele ocupa o lugar que a Categoria
ocuparia, e Categoria é campo do lançamento. É assim que a aba IR o desenha: frame `262:226`,
grupo `68:3` entre a Data e o bloco RECORRÊNCIA, rótulo `68:4` "Rótulo (opcional)", input `68:5`,
placeholder `68:6` "Ex: IR referente a 2025" (no estado vazio, `305:744`, texto `305:1035`).

**Quando é preenchido:** não na criação — o popover "Gastei um valor" (frame `345:1002`, nó
`345:1252`) tem só valor e "Confirmar", e a legenda `345:1258` é explícita: "Sem categoria, sem
conta, sem data pra escolher, só o valor. A barra atualiza na hora." O Rótulo entra depois, pelo
"Editar" de cada linha do histórico do widget (frame `345:752`, botões `199:2`/`199:4`/`199:6`),
que é onde `files_design/03` §"Consumo Livre — widget" já mandava: "Campos editáveis: Valor, e
opcionalmente Rótulo".

**Estado do código:** o formulário de edição inline oferecia **só o Valor**, e
`useEditDiscretionaryExpense` mandava só `{ amount }` — ou seja, o Rótulo era inalcançável pela
interface inteira e a coluna nunca recebia nada. Corrigido em
`src/app/(app)/inicio/_components/modals/discretionary-detail-modal.tsx` e
`src/app/(app)/inicio/_lib/mutations.ts`, com os testes
`src/app/(app)/inicio/_components/modals/home-modals.test.tsx` ("164:7 + files_design/03 §146 …").

**Persistência:** a linha continua em `discretionary_expenses`, com chave primária 1:1
`(user_id, entry_id)` — e isso não contraria a resposta, ao contrário: `entries` tem coluna
`label`, mas o CHECK `entries_expense_revenue_shape` exige `label IS NULL` para toda Despesa e
Receita, que é a segunda frase de `164:7` escrita como restrição de banco. Um gasto de Consumo
Livre É uma Despesa; alargar aquele CHECK deixaria qualquer Despesa carregar Rótulo. A tabela
lateral também é o marcador de quais Lançamentos o widget criou (`listByMonth`).

**O que sobrou em aberto, com escopo menor (P15b):** nenhum dos 130 frames do Wireframe desenha o
**conteúdo** do popover/estado de "Editar" da linha do histórico do widget — só o botão
(`199:2`/`199:4`/`199:6`). O formulário inline segue o único estado de edição inline desenhado,
`46:8` "Estado — Editar categoria (inline)". E as três linhas de gasto do frame
(`192:26`/`192:29`/`192:32`) trazem só "Dia 05/07", "Dia 12/07", "Dia 18/07": o frame não desenha
gasto nenhum com Rótulo, então **onde** o Rótulo entra na linha é suposição nomeada — hoje depois
da data, com o separador " · " do próprio card (`192:20`).

### P16. Quais são os nomes fechados das cores de conta bancária? — RESPONDIDA (lida no Figma)

**Onde:** `src/domain/assets/types.ts` · `src/api/contracts/bank-accounts.ts` ·
`src/lib/bank-account-colours.ts`

A pergunta citava `files_design/02` dizendo que os hexadecimais eram "aproximações de memória,
conferir antes de produção" e concluía que "a lista fechada de nomes de token não existe" —
**as duas afirmações estão vencidas**. O próprio `files_design/02` registra depois a revisão
que trocou as aproximações pelos hexes de manual de marca oficial e tirou o C6 Bank da paleta
("C6 Bank saiu da paleta de cores de conta, virou \"Cor extra\" genérica"), e a lista fechada
foi desenhada.

**Resposta:** são seis, nesta ordem — Nubank, Itaú, Banco do Brasil, Bradesco, Caixa e
**"Cor extra"** (cinza neutro genérico, para conta de banco fora dos cinco mapeados).

**Fonte:** Figma, página **Tokens**, nó `1091:2` "Cores de banco (referência)" (x=100 y=2616,
1040x582) — uma linha por cor, com bolinha, nome, hex, rgb e fonte:

| Nó          | Banco           | Hex       | RGB                |
| ----------- | --------------- | --------- | ------------------ |
| `1091:5055` | Nubank          | `#820AD1` | rgb(130, 10, 209)  |
| `1091:5061` | Itaú            | `#EC7000` | rgb(236, 112, 0)   |
| `1091:5067` | Banco do Brasil | `#0038A8` | rgb(0, 56, 168)    |
| `1091:5073` | Bradesco        | `#EA1D2C` | rgb(234, 29, 44)   |
| `1091:5079` | Caixa           | `#1C60AB` | rgb(28, 96, 171)   |
| `1091:5085` | Cor extra       | `#6B7280` | rgb(107, 114, 128) |

A mesma tabela está transcrita em `files_design/07` §"Cores de banco (referência, fora do
sistema de tokens)". O seletor que consome a paleta é o campo "Cor" de Adicionar conta —
Mockup `921:40`/`921:42` e Wireframe `332:115`/`332:117`, seis elipses de 28x28 em
x = 0/40/80/120/160/200.

**Aplicado:** `BANK_ACCOUNT_COLOURS` (união fechada em `src/domain/assets/types.ts`) e
`bankAccountColourSchema = z.enum(BANK_ACCOUNT_COLOURS)`. Antes disso o contrato era
`z.string().regex(/^[a-z0-9-]{1,40}$/)`, e a medição do custo: `POST /api/v1/bank-accounts`
com `colour: "conta-roxa"` respondia **201**, gravava o slug inventado e a tela pintava a
bolinha de cinza pelo fallback de `bankAccountSwatch` — erro de entrada virava dado válido.
Hoje responde 422 (`src/app/api/v1/bank-accounts/route.test.ts`). Os slugs inventados
`conta-roxa`/`conta-azul`/`conta-verde`/`conta-laranja`, que estavam nas fixtures e em 20
arquivos de teste, foram migrados para a paleta real.

O slug da sexta cor continua `outra` (o rótulo visível é "Cor extra", `1091:5087`): o Figma
nomeia o rótulo, não o slug, e renomear a chave gravada exigiria migração sem mudar nada na
tela.

### P17. Qual o texto do evento "Recorrência paga"? — RESPONDIDA (medida no Figma; fechada em 2026-09-11)

**Onde:** `src/domain/trace-events/rules.ts` · `describeRecurrencePaid` · `describeDiscrepancy`

A pergunta dizia que "`files_design/03` dá o texto exato de três eventos, não deste". **Metade
falso, e a metade falsa era a que estava implementada errado.**

**O que foi medido:** o Figma imprime, palavra por palavra, a frase da recorrência paga **com
divergência** — em **onze** frames do Wireframe e também no Mockup:

> "Aluguel pago com divergência: previsto R$ 1.500,00, pago R$ 1.300,00 **(R$ 200,00 pendente)**"

Nós: Wireframe `150:8` (`5-2__desktop-inicio-dashboard.xml`, card "Eventos Recentes" `150:2`) e os
dez repetidos `262:1107`, `262:780`, `262:459`, `262:212`, `347:214`, `347:439`, `347:664`,
`347:889`, `347:1114`, `349:238`; Mockup `549:282`, dentro do card `549:276`. O código cortava a
frase em "pago R$ 1.300,00" porque seguiu o exemplo de `files_design/03` — que é uma lista de
"ex.:", não a redação completa. **Corrigido:** o sufixo entra quando pago < previsto, com a
diferença (150000c − 130000c = 20000c = "R$ 200,00"), que é o mesmo valor que vira item no card de
Pendências (nota `163:4`). Quando pago > previsto não há sufixo: `files_design/03` §"Marcar Pago"
diz que esse caso "nunca vira Pendência", e nenhum frame desenha sufixo aí.

**FECHADA em 2026-09-11, e não pela redação que a pergunta esperava.** Ao medir para escolher o
texto da recorrência paga sem divergência, apareceu um defeito nas DUAS frases: elas colavam "pago"
no assunto, e o assunto vem de `entrySubject`, que devolve o **nome da categoria**. Das 39
categorias padrão, **12 quebram a concordância** — "Academia pago", "Alimentação pago",
"Assinaturas e ferramentas pago". O frame funcionava por acaso: "Aluguel" é masculino singular, e
uma categoria criada pela pessoa pode ser qualquer coisa.

A forma escolhida põe o nome antes de um travessão, e o particípio deixa de tocar nele:

- sem divergência: **"Academia — pagamento conforme o previsto"**
- com divergência: **"Academia — pagamento com divergência: previsto R$ …, pago R$ … (R$ … pendente)"**

Os 36 textos da Mockup foram atualizados junto, e a linha "Descrição" do `files_design/03` também.
A frase de PARCELA não mudou: "Parcela #11 paga" concorda porque "Parcela" é palavra fixa, não nome
de categoria.

**Coberta por:** `src/domain/trace-events/rules.test.ts`, `describeDiscrepancy — Figma 150:8`.

### P35. A descrição congelada do Evento leva o nome do Passivo? — **RESPONDIDA (produto, 2026-09-09)**

**Resposta: grava-se a forma curta — a do Detalhe do Passivo — e a Home monta a dela na hora.**

O Figma desenha o MESMO evento com duas redações, e a diferença não é estilo: o Detalhe do Passivo
já tem o nome da dívida no título da tela e não o repete na linha; a Home não tem contexto nenhum e
precisa dele dentro da frase. Uma string só não atende as duas.

O que se grava passou a ser a do Detalhe, nas três de origem Passivo:

| Gravado (Detalhe)                                                       | Exibido na Home                                                            |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Dívida cadastrada: R$ 320.000,00, 360 parcelas…` (91:145)              | `Financiamento apartamento cadastrado: R$ 320.000,00…` (150:20)            |
| `Taxa de juros reajustada de 0,80% para 0,85% a.m.` (91:139)            | `Taxa de juros do Financiamento apartamento reajustada de…` (150:14)       |
| `Parcela #12 paga: previsto…, pago… (divergência de R$ 20,00)` (91:136) | `Parcela #12 do Financiamento apartamento paga: previsto…, pago…` (150:11) |

**A consequência aceita:** o nome não é congelado junto com a frase, é resolvido na leitura — logo
renomear o Passivo muda o que a Home mostra para eventos antigos. A alternativa era gravar duas
redações de tudo. Travado por teste (`route.test.ts`, "renomear o Passivo muda o que a Home mostra").

**O sufixo de divergência fica só no Detalhe**, como os dois frames desenham: `91:136` o traz,
`150:11` não. Quem quiser a diferença calculada abre o Passivo.

**Duas coisas que a pergunta desenterrou:**

- `liabilityRegisteredEvent` montava a frase **inline**, duplicando `describeRegistration` — mudar a
  regra não mudava nada em produção. Agora há uma só.
- `describeInstallmentPaid` nunca escreveu o sufixo de `91:136`. O texto gravado agora o traz, e é
  a Home que o tira, junto com o nome que acrescenta.

As trocas da Home são ancoradas em texto que o próprio domínio gerou, nunca em texto livre, e
quando a âncora não casa a frase gravada passa inteira: um evento escrito por uma versão anterior
nunca vira frase quebrada.

### P28. Qual é o rótulo do evento de rastreabilidade "Divergência"? — RESPONDIDA (medida no Figma)

**Onde:** `src/domain/trace-events/types.ts` · `LABEL_TRACE_EVENT_KIND`

`files_design/03` dá o texto exato dos quatro primeiros tipos de evento. O quinto, `Discrepancy`,
vem da generalização da nota do Figma `163:4` ("Qualquer divergência (previsto ≠ pago), em qualquer
lançamento ou parcela de Passivo, gera um Evento") somada a `files_design/03` §"Marcar Pago" ("gera
um Evento de divergência").

A pergunta ficou aberta sob a alegação de que o rótulo era "um substituto à espera da redação de
Produto/Design" — **falso**: a redação de Produto existe e está desenhada.

**Resposta:** "Divergência de pagamento".

**Fonte:** Figma, página Wireframe, nó de texto `309:25` dentro do estado vazio `309:23` "Vazio —
Eventos Recentes" (`docs/figma/frames/309-23__vazio-eventos-recentes.xml`), a única vez em que a
taxonomia dos tipos é escrita por extenso: "Reajustes de juros, **divergências de pagamento** e
parcelas confirmadas aparecem aqui conforme forem acontecendo." A forma curta ("divergências") é a
legenda da Home, `150:5` (Wireframe) / `549:279` (Mockup).

**O que continua verdadeiro:** nenhum frame imprime o TIPO numa linha de evento. Medido nos 130 XML
do Wireframe e conferido na página Mockup pelo MCP: a linha da Home (`150:6`..`150:20`, Mockup
`549:280`..`549:294`) e a do histórico do Passivo (`91:134`..`91:145`) têm exatamente duas colunas,
data e descrição. `LABEL_TRACE_EVENT_KIND` nomeia o campo "Tipo" do objeto Evento
(`files_design/03`), não uma coluna de tela — e hoje não tem consumidor de tela nenhum.

**Coberta por:** `src/domain/trace-events/types.test.ts`, que deriva o rótulo esperado do próprio
XML do frame `309:23` em vez de repetir a string.

### P30. Qual token pinta o fundo da barra lateral e o da área de conteúdo? — RESPONDIDA (medida no Figma)

**Onde:** `src/app/(app)/layout.tsx` · `src/components/patterns/sidebar.tsx`

O `files_design/07` fecha os 38 tokens de cor e descreve a barra lateral inteira (marca,
alternador de tema, os dois grupos recolhíveis, o item ativo em `color/bg/state-subtle` +
`color/text/state`), mas **não diz qual token é o fundo dela**, nem o da área de conteúdo à
direita. A pergunta ficou aberta sob a alegação de que "o XML dos frames não carrega `fills`,
então não dá pra conferir" — **falso**: a página Mockup desenha os dois temas e responde.

**Resposta:** barra lateral = `color/bg/card`; área de conteúdo = `color/bg/canvas`; divisória
entre as duas = `color/border/default`. Vale nos **dois** temas.

**Fonte:** Figma, página Mockup, nós `549:44` "Desktop - Início dashboard (claro)" e `738:258`
"(escuro)", ambos 1440x2790. Cada um tem dois filhos diretos: a "Barra lateral" (`749:2` no
claro, `749:85` no escuro) em x=0 w=272, e o frame de conteúdo (`549:70`) em x=272 w=1168.

**Medição** (render 1:1 de cada nó, amostragem de pixel):

| Amostra                            | Claro (549:44) | Escuro (738:258) | Token                    |
| ---------------------------------- | -------------- | ---------------- | ------------------------ |
| barra lateral (5,1500)             | `#ffffff`      | `#161b21`        | `--color-bg-card`        |
| divisória (271,1500)               | `#e6e8ea`      | `#262e36`        | `--color-border-default` |
| conteúdo, na calha (300,1500)      | `#f7f8f8`      | `#0e1216`        | `--color-bg-canvas`      |
| card dentro do conteúdo (700,1500) | `#ffffff`      | `#161b21`        | `--color-bg-card`        |

A inspeção por variáveis engana e não substitui o pixel: `get_variable_defs` em `749:2` devolve
`--superficie-card` porque o polegar do alternador de tema (`749:6`) já usa esse token, não
porque o frame tenha esse fundo; e `549:70` não lista `--superficie-canvas` porque é
transparente — quem carrega o canvas é a tela inteira (`549:44`).

O código já está assim (`bg-surface-card` na barra, `bg-surface-canvas` no wrapper do conteúdo)
e agora está trancado por `src/components/patterns/sidebar.test.tsx`, "Sidebar — superfície".

### P31. Qual é a largura do diálogo modal? — RESPONDIDA (medida no Figma)

**Onde:** `src/styles/tokens.css` · `--width-dialog-*`

A pergunta partia de uma premissa falsa — "não há frame da página **Mockup** com um nó 'Diálogo'
vinculado pra medir". Há: a página Mockup tem frames literalmente chamados "Diálogo", e os dez
contêineres de modal do Wireframe já estavam neste repositório, com largura explícita, em
`docs/figma/frames/`. A varredura dos 130 XML mais a medição por MCP responderam a pergunta:

**Não existe UMA largura de diálogo. O produto desenha sete**, e Wireframe e Mockup concordam em
todas as que dá para conferir nas duas páginas:

| largura | diálogo                                            | Wireframe                               | Mockup                  |
| ------- | -------------------------------------------------- | --------------------------------------- | ----------------------- |
| 320     | Gastei um Valor                                    | `345:1252`                              | `1000:2643`             |
| 380     | Configurar Consumo Livre                           | `192:2`                                 | `1000:2886`             |
| 420     | Detalhe do Consumo Livre                           | `192:15`                                | `1005:3303`             |
| 440     | Adicionar Direcionamento                           | `103:22`                                | —                       |
| 460     | Vender Bem Material · Registrar Reajuste de Juros  | `99:39` · `94:39`                       | `991:2204` · `994:2372` |
| 480     | Novo Lançamento · Detalhe da Categoria/Bloco/Fluxo | `6:29` · `183:2` · `189:23` · `349:252` | `872:1305`              |
| 575     | Destinar o Lucro                                   | `27:29`                                 | `997:2505`              |

Padding interno é sempre 24 — daí os 272/332/412/527 de conteúdo medidos dentro dos frames.

- **O que estava assumido, e era invenção:** `--width-dialog: 560px` e `--width-dialog-wide: 720px`.
  Nenhum frame desenha esses dois números; o único 560 do Wireframe é o card de Onboarding 0
  (`116:3`), que não é diálogo. Dez diálogos ficavam de +80 (Detalhe da Categoria) a +280
  (Adicionar Direcionamento) largos.
- **O que ficou por medir:** os diálogos de confirmação da Revisão de Recorrentes, "Marcar como
  Pago", "Marcar Parcela Paga" e "Editar Passivo" não têm frame em tamanho real em nenhuma das duas
  páginas — `34:2` é esquema em escala reduzida (colunas de 400 com 360 internos), não geometria.
  Usam `--width-dialog-form` (460), a medida que o Figma dá a todo diálogo-formulário, e o
  comentário em cada arquivo diz que é derivação, não medição. **Pergunta para o design:** confirmar
  460 ou desenhar os frames.
- **Achado junto, e corrigido junto — a POSIÇÃO:** medindo as larguras apareceu que o diálogo
  também estava no `x` errado. `dialog.tsx` centralizava com `left-1/2` (o centro da viewport),
  enquanto o Figma centraliza na **área de conteúdo**, à direita da barra lateral —
  files_design/07 §10, regra 🟩 com fórmula `x = sidebar + (frame − sidebar − diálogo) / 2`. Os
  três nós "Diálogo" medidos por MCP fecham na fórmula com a barra lateral de 272:
  `1005:3051` x=616 (w=480), `991:2204` x=626 (w=460), `997:2505` x=568,5 (w=575); centralizar na
  viewport daria 480, 490 e 432,5 — **136px (= 272/2) à esquerda** em toda tela. O Wireframe já
  desenhava assim antes da Mockup existir: `99:39` x=629 (w=460) dentro de `99:2`, com a área de
  conteúdo `99:36` em x=278 w=1162. O scrim não acompanha o deslocamento: `99:38` é um retângulo
  de 1440×900 em (0,0), cobrindo a barra lateral também. Travado em
  `src/components/ui/dialog-metrics.test.tsx`.

### P32. As mudanças do doc07 sobre os docs 01 a 03 estão validadas? — **RESPONDIDA (produto + design, 2026-09-09)**

**Resposta: sim, as vinte estão validadas — e duas delas não estavam de fato implementadas.**

A validação foi item a item, não em bloco. O critério foi separar o que é **camada visual** (onde a
ADR-0015 §1 já dá a palavra ao doc07, e "a validar" era só o design pedindo confirmação) do que é
**regra de produto disfarçada de mudança visual** — porque essa a precedência não resolve: PRD >
design. Só quatro itens caíram na segunda categoria, e todos passaram:

- **"sem porcentagem" nas Despesas por Categoria** não tira informação que o PRD peça. O PRD §142
  pede "o peso relativo de cada categoria no mês" e o doc01 §88 pede "blocos proporcionais" — a
  área É a proporção. Validado.
- **O teto de seis blocos com "Outras"** esconde categorias individuais, o que seria perda de
  informação se "Outras" fosse um beco sem saída. Não é: files_design/08 §2.7 exige que ela abra a
  soma do que agregou, "nunca um bloco vazio". Validado — mas ver o defeito abaixo.
- **O rodapé com Patrimônio Líquido** em Onde Está Meu Dinheiro repete um número já definido e
  calculado no Balanço (`balance-sheet.ts`, PL = Ativos − Passivos), não inventa um segundo. Validado.
- **PF e PJ que não somam o consolidado** na Evolução Mensal não é escolha de gráfico: é a
  eliminação intercompany do PRD §5 aparecendo na tela. Validado — mas ver o defeito abaixo.

**Defeito 1 — "Outras" era um bloco morto em Despesas por Categoria.** O `handleSelect` do card
procurava o id do bloco na lista de categorias, e "Outras" não é categoria nenhuma: a busca devolvia
`null`, o modal não abria e o clique não fazia nada. O card irmão de Entradas e Saídas já cumpria a
§2.7; este não. Medido com um teste que abre 8 categorias, clica em "Outras" e não encontrava
diálogo nenhum. Corrigido: "Outras" abre o detalhe do que ela soma, com as categorias agregadas.

**Defeito 2 — nada travava a não-somabilidade da Evolução Mensal.** O único teste de três visões
usava uma receita PJ sem contraparte PF, então nunca exercia a eliminação: um "Consolidado"
calculado como PF + PJ passaria em todos os testes do arquivo. Travado agora com pró-labore, e
verificado vermelho desligando a eliminação em `projection.ts`.

**A pendência que era do design — fechada em 2026-09-11.** Os nós `1022:3036` e `1022:3040` dos dois
diálogos de detalhe do fluxo (`1005:3051` claro / `1006:3151` escuro) ainda diziam "Mapa de Fluxo"
na Mockup, enquanto o diálogo irmão `1022:3025` já usava o nome novo — a Mockup tinha ficado pela
metade no renome do PRD v7. Corrigidos no arquivo, com a designer presente: texto e nome de camada
passaram a "Entradas e Saídas". As molduras "Link" são auto-layout com HUG, então a largura refluiu
sozinha (112 → 131), e o resultado foi conferido nos dois temas. Código e desenho voltaram a
concordar; não sobra nada desta pergunta.

### P33. Venda de Bem Material: o Lançamento de Ganho/Perda nunca é criado — RESPONDIDA (produto, 2026-09-07)

**Onde:** `src/app/api/v1/tangible-assets/[id]/sale/route.ts` ·
`src/features/plano-de-contas-e-patrimonio/screens/vender-bem-material-dialog.tsx`

O modal prometia, com o texto literal do frame `99:56` e de `files_design/01 §11`, "Lançado
automaticamente em Resultado Não Operacional" — e o Lançamento **nunca era escrito**. O ganho não
aparecia em DRE, Balanço, Evolução Mensal nem Indicadores; existia só no JSON da resposta da
própria venda, que nada guardava. Era o achado mais grave da auditoria de 2026-09-05.

O que travava: todo `Entry` de Receita/Despesa exige `bankAccountId`
(`src/domain/entries/types.ts`), e nenhum frame desenhava esse campo no modal de venda.

**Decisão de produto:** pedir a conta no próprio modal. O `assetSaleSchema` ganhou
`gainAccountId` obrigatório, o modal ganhou o campo "Conta do ganho/perda", e a rota passou a
criar o Lançamento na categoria `ganho-perda-venda-de-ativo` (bloco Resultado Não Operacional).
Ganho vira Receita, perda vira Despesa, sempre com o valor em MAGNITUDE — quem carrega o sinal é
o `kind`, porque é assim que a cascata do DRE soma o bloco. Venda sem ganho nem perda não cria
Lançamento nenhum.

- **Pendência de design que isso cria:** o campo "Conta do ganho/perda" não existe em frame
  nenhum. Precisa ser desenhado no `99:2` (e no Mockup `991:2204`) para o arquivo voltar a bater
  com a tela.

### P34. De onde sai o bloco quando a categoria é criada pelo Novo Lançamento? — **RESPONDIDA (produto, 2026-09-08)**

**Onde:** `src/components/patterns/category-field.tsx` ·
`src/app/(app)/novo-lancamento/tabs/expense-revenue-fields.tsx`

**Resposta: é perguntado.** Criar uma categoria pela aba Despesa abre um segundo passo dentro do
mesmo dropdown, com os blocos possíveis. Desenhado antes de implementado, no Mockup
`Desktop — Novo Lançamento (criar categoria: escolher bloco)`, claro e escuro.

**Por que a derivação automática caiu.** O código deduzia o bloco da entidade — Despesa PJ →
Despesas Administrativas, Despesa PF → Despesas Pessoais/Consumo. A planilha de referência desmente
a premissa: os blocos **não se dividem por entidade**.

| Bloco                          | O que a referência põe nele                                   |
| ------------------------------ | ------------------------------------------------------------- |
| 3. Custo dos Serviços/Produtos | Contador, internet, assinaturas — **o custo da PJ mora aqui** |
| 4. Despesas Administrativas    | Aluguel moradia, plano de saúde, água, luz — **tudo PF**      |
| 5. Despesas Pessoais/Consumo   | Alimentação, transporte, lazer — **tudo PF**                  |

A divisão real é custo fixo × consumo variável, e o palpite errava nos dois sentidos.

**O que tornou o palpite inaceitável, e não só impreciso:** categoria **nunca muda de bloco** —
`categoryPatchSchema` aceita nome, classificação sugerida e renda passiva, não `blockId`. Era uma
escolha irreversível que o sistema tomava no lugar da pessoa, sem dizer.

**Duas ausências na lista, as duas por correção:**

- **D&A** não aceita categoria; oferecê-lo seria oferecer o que `createCategory` recusa.
- **Receita Bruta** soma, e uma Despesa contribui negativo — categoria de despesa ali reduziria a
  receita bruta. Sem sentido, e permanente. Isso só apareceu ao rodar o fluxo no navegador: o
  primeiro desenho oferecia os nove blocos, e a lista renderizada mostrou o erro. O filtro ficou
  pelo **efeito** do bloco, não pelo nome, e o frame foi corrigido junto.

**Dois textos mudaram, e os dois porque a frase antiga pressupunha bloco conhecido:**

- `+ Criar categoria "X" **neste bloco**` (Wireframe `83:63`) perde o "neste bloco" aqui — não
  existe "este bloco" neste contexto. No Plano de Contas a frase continua inteira.
- A dica "Categorias parecidas **neste bloco**" (PRD UC40, Figma `84:2`) não aparece no Novo
  Lançamento pelo mesmo motivo. **É uma perda declarada:** UC40 existe para evitar categoria
  duplicada, e sem bloco em contexto o risco de duplicar é maior, não menor. Mostrar "parecidas"
  de todos os blocos seria texto novo que frame nenhum desenha — fica como pergunta para o Design.

**Um achado no caminho:** `closeOnCreate` teve de nascer no `SearchCreateField`. "Criar sempre
fecha o dropdown" era verdade enquanto criar era um passo só; com dois, fechar cancelaria o fluxo
na cara da pessoa. Medido: os três primeiros testes do passo falhavam por isso.

### P39. Zerar o `npm audit` — RESPONDIDA (resolvida em 2026-09-08)

**Onde:** `package.json` · `vitest.config.ts` · `make audit-deps`

Eram **11 vulnerabilidades, 2 críticas e 2 altas**, e a pergunta era se valia subir Next 15→16 e
Vitest 2→3. A resposta acabou sendo: **as duas críticas e as duas altas foram resolvidas sem
tocar no Next**, e `make audit-deps` está **verde**. Hoje sobram 4 moderadas, todas sem correção
existente.

**O que foi feito, e por que assim:**

| Antes                                       | Depois     | Como                                              |
| ------------------------------------------- | ---------- | ------------------------------------------------- |
| `vitest` 2.1.8 (2 críticas)                 | **4.1.11** | a faixa vulnerável era `<3.2.6`; subir resolve    |
| `vite` 5.4.21 (1 alta, 1 moderada)          | **7.3.6**  | faixa vulnerável `<=6.4.2`; vem junto do Vitest 4 |
| `@vitejs/plugin-react` 4.7.0                | **5.0.4**  | é o que casa com vite 7 (o 6.x exige vite ^8)     |
| `postcss` 8.4.31 dentro do `next` (2 altas) | **8.5.28** | `overrides` no `package.json`                     |

**O `overrides` do postcss é o ponto que precisa de justificativa.** O `next@15.5.25` fixa
`postcss@8.4.31` e **não existe nenhum 15.x que suba isso** — o `npm audit fix --force` propunha
Next 16. Como a faixa segura (`>8.5.22`) é o **mesmo major**, forçar 8.5.28 é troca de patch, não
de API. Provado, não deduzido: `npm run build` completa e gera as 20 rotas, e a suíte inteira
passa. O Next 16 deixa de ser necessário por causa de auditoria — se ele entrar um dia, será por
outro motivo.

**O `npm audit fix --force` continua sendo a resposta errada:** ele propunha **downgrade** do
`drizzle-kit` de 0.31.10 para 0.18.1, além do Next 16.

**As 4 moderadas que sobram não têm correção, e isso é fato verificado, não desistência:**
todas são `esbuild <=0.24.2` chegando por `drizzle-kit → @esbuild-kit/esm-loader →
@esbuild-kit/core-utils → esbuild@0.18.20`. O `drizzle-kit@0.31.10` **é a versão mais recente
publicada** e ainda depende dessa cadeia, que o próprio autor marcou como descontinuada. Não há
versão para onde subir. O aviso é sobre o **servidor de desenvolvimento do esbuild** aceitar
requisição de qualquer origem; o drizzle-kit usa o esbuild-kit só para carregar
`drizzle.config.ts`, sem subir servidor nenhum.

- **Assumido hoje:** `make audit-deps` falha em `high`, então fica **verde** com as 4 moderadas.
  Elas estão listadas aqui para não sumirem do radar.
- **O que muda quando o drizzle-kit largar o `@esbuild-kit`:** as 4 caem sozinhas num
  `npm update`. Vale reconferir a cada atualização de drizzle-kit.

**Efeito colateral do Vitest 4, que vale registrar porque parece regressão e não é:** o limite de
5s por teste do Vitest **nunca valeu neste repositório**. Ele só interrompe um teste quando o laço
de eventos cede, e os testes de diálogo gastam o tempo em renderização síncrona — sob o Vitest 2 a
suíte passava com testes de 20s. Ao subir, o único que usa `findByRole` (que cede, porque faz
polling) passou a ser cobrado e quebrou, sem nada ter ficado mais lento. O `vitest.config.ts`
agora declara `testTimeout: 30_000`, que é o número real do que a suíte faz — os piores medidos
são 21.398ms e 18.568ms em `vender-bem-material-dialog.direcionamento-receita`. **A lentidão
desses diálogos é dívida aberta** (ver P40).

### P40. Por que os testes de diálogo levavam 20 segundos? — **RESPONDIDA (medida, 2026-09-09)**

**Resposta: uma recursão mútua entre `@floating-ui` e `nwsapi` em torno do pseudo `:modal`.** Não
era renderização em cascata, não era contenção de CPU e não era o `user-event` — as três hipóteses
que estavam escritas nos comentários dos testes, todas erradas.

**Como foi medido, em quatro passos, cada um descartando uma explicação:**

1. **Instrumentei cada interação do teste mais lento.** Das dez, oito custam 5–17ms e duas custam
   ~9s cada. As duas são `findByText`/`findByRole` logo depois de abrir um overlay do Radix.
2. **O custo não é a consulta.** O documento tem 103 nós; repetir a mesma busca depois que o
   elemento existe leva 0–3ms. O elemento **demora 8s para aparecer**.
3. **O laço de eventos fica bloqueado.** Um `setInterval` de 50ms disparado antes do clique
   disparou **uma única vez**, em 8198ms. Trabalho síncrono de CPU, não espera.
4. **Perfil de CPU do V8, tirado de dentro do próprio teste** (`node:inspector`, amostragem de
   1µs): 95% do tempo em `nwsapi`, numa pilha de ~600 quadros repetindo o mesmo ciclo. E o rastro
   do chamador nomeia a origem:

   ```
   @floating-ui/utils  isTopLayer(el)  →  el.matches(':modal')
     → jsdom delega ao nwsapi, que não tem estado de top layer
     → nwsapi: isModal = matchesNative(node, ':modal') || isFullscreen(node)
     → matchesNative reusa Element.prototype.matches, que É o nwsapi
     → volta ao começo, até o try/catch de matchesNative cortar
   ```

   São 46 chamadas por teste — `:modal` e `:popover-open`, 23 cada — porque o Popover e o Select
   do Radix posicionam via `@floating-ui`.

**A correção** está em `vitest.setup.ts`: `:modal`, `:popover-open` e `:fullscreen` respondem
`false` direto. Não é um truque para o teste passar — o jsdom não implementa top layer nenhum, então
essas três SÃO sempre falsas ali; o que o corte evita é as duas bibliotecas chegarem a essa resposta
se chamando em círculo. nwsapi 2.2.27 é a última versão publicada e a recursão está nela; não havia
upgrade que resolvesse.

|                                          | antes               | depois           |
| ---------------------------------------- | ------------------- | ---------------- |
| suíte inteira                            | 125,97s             | **14,08s**       |
| pior teste isolado                       | 21.398ms            | **429ms**        |
| `direcionamento-receita`, os dois testes | 18.722ms e 18.336ms | **203ms e 98ms** |

`testTimeout` voltou de 30s para os 5s padrão, e os `60_000` por teste saíram junto com os
comentários que os justificavam.

### P43. A faixa de Dívidas do "Onde Está Meu Dinheiro" — **RESPONDIDA (design, 2026-09-09)**

**Resposta: um bloco agregado**, como o Figma desenha e como a faixa de Investimentos já fazia.

Medido na `Faixa - Dívidas` do Mockup: UM bloco, legenda "Financiamento, **cartão**" — dois
instrumentos — sob um valor único de R$ 24.000, com o rótulo "Dívidas (Passivos)" cobrindo a faixa
inteira (420 de largura). É a mesma construção de "Investimentos / Tesouro, ações", que já era
agregada: **a faixa de baixo divergia da de cima dentro do mesmo card**.

A composição continua acessível — vive no modal do bloco, exatamente como a de Investimentos.
Travado por teste visto vermelho com um bloco por dívida. Conferido na tela: a faixa passou a
mostrar "Dívidas (Passivos)" com o total somado.

### P41. As legendas de tela não batem com o Figma — **RESPONDIDA (design, 2026-09-09)**

**Resposta: manda o Mockup**, que é a fonte visual (ADR-0015). O código passou a usar o texto
desenhado no DRE (legenda da tela e legenda do card de Lançamentos) e na Evolução Mensal.

**O que a medição mostrou, e que muda o enquadramento da pergunta:** o Mockup não _omitiu_ a
legenda longa — ele a **reescreveu**. O Wireframe `11:2` traz três parágrafos de ajuda no DRE
(y=83, y=113, y=187) e o Mockup os condensou em dois, o que é a mesma decisão que
`files_design/07` já registrava: "os três parágrafos de ajuda viraram um, com os controles
agrupados numa barra". O código seguia o Wireframe, a camada anterior — não era invenção dele.

**A legenda do card de Lançamentos era a que mais importava**, e não por estilo: o texto desenhado
carrega um FATO que o anterior não dizia — a lista mostra pagos e previstos juntos,
**independente do filtro da cascata**. É o que `buildRows` faz (recebe o mês inteiro, sem filtrar
por status), e a legenda antiga fazia essa informação sumir.

### P42. A auditoria cruzada cobriu texto, não layout — **RESPONDIDA (2026-09-09)**

**Resposta: só a ORDEM entra para o automático. O resto do layout é olho humano, e agora está
escrito que é.**

A varredura de 2026-09-08 comparou 177 termos das 32 telas: pega vocabulário trocado, rótulo
ausente e erro de digitação. Não pega ordem, agrupamento, espaçamento, largura de coluna,
alinhamento, altura de linha nem divisória.

**Por que só a ordem.** Ela é mecânica e não depende de pixel — não quebra porque o app é fluido e o
Mockup é fixo em 1440. Uma varredura de geometria (comparar `x`/`y`/tamanho de cada nó com o
`getComputedStyle` do elemento) pegaria tudo e produziria, junto, uma lista de exceções legítimas
mantida à mão para sempre. O que a ordem pega: campo fora de lugar, seção trocada, bloco ausente,
cabeçalho depois do corpo.

**Onde está:** `assertReadingOrder` (`src/lib/testing/reading-order.ts`), comparando por
`compareDocumentPosition` e não por índice de texto — duas seções podem repetir a mesma palavra, e
comparar posição no `textContent` acharia a primeira ocorrência das duas e passaria por acaso.

**Cobertura, sem corte silencioso:**

| Tela                                                  | Onde                                  | Verificada    |
| ----------------------------------------------------- | ------------------------------------- | ------------- |
| DRE, Balanço, Evolução Mensal, Indicadores, Histórico | jsdom, no `page.test.tsx` de cada uma | **sim**, aqui |
| Home, Novo Lançamento, Revisão de Recorrentes         | `e2e/visual-fidelity.spec.ts`         | **pelo CI**   |

As três de baixo só existem contra o servidor de verdade, e o e2e **não pode rodar nesta máquina**:
`playwright.config.ts` usa `reuseExistingServer` fora do CI e o `empty-state.spec.ts` apaga o banco
compartilhado — rodar aqui apagaria o banco de desenvolvimento da pessoa. Quem as vê verdes é o CI.

**E o que continua humano ficou escrito** no `.claude/skills/checklist-de-tela/SKILL.md`, com o
motivo: espaçamento, alinhamento, largura de coluna, altura de linha e divisória. As duas
divergências de layout achadas até hoje foram vistas a olho, e continuariam sendo.

### P29. O que é "hoje"? — **RESPONDIDA (produto, 2026-09-09)**

**Resposta: a hora local do processo do servidor — e a decisão carrega a condição de validade.**

Ela vale **enquanto a implantação for local** (ADR-0007 §1: monolito local, uma pessoa, mesma
máquina). Nesse arranjo o relógio do processo É o relógio da pessoa. Um fuso configurável seria um
campo que nenhuma tela do Figma desenha, para resolver um problema que a implantação alvo não tem.

Se a implantação deixar de ser local, a resposta muda para um fuso explícito guardado como
preferência, com `todayIsoDate()` recebendo-o — e isso é mudança arquitetural, vale ADR nova.

O relógio mudou de casa junto com esta resposta: era `src/api/clock.ts` e virou `src/lib/clock.ts`,
porque a P21 deu à camada de dados uma razão para precisar de "hoje" (o retrato do PL é carimbado
com a data). `src/data` não pode importar `@/api`, e um segundo `new Date()` lá dentro criaria uma
segunda definição de hoje — exatamente o que esta pergunta trata. Continua havendo **uma**.

### P18. Ocorrências materializadas ou virtuais? — **RESPONDIDA (ADR-0004, 2026-09-08)**

**Onde:** `src/domain/recurrence/engine.ts` · `src/app/api/v1/occurrences/route.ts`

**Resposta: as duas coisas, e é isso que a ADR precisou escrever.** O motor gera **virtualmente**
(ADR-0004 §1) e a **primeira visita ao mês materializa** (§3), com get-or-create pelo id derivado
do par (série, mês) (§2).

A pergunta ficou aberta tanto tempo porque o código parecia se contradizer: o comentário do motor
dizia "generates them virtually" e o da rota dizia "this route IS where that generation happens…
materialises one row per open série". As duas afirmações estavam certas — eram as duas metades de
uma decisão que ninguém tinha escrito como uma coisa só.

A derivação do id deixa de ser provisória: é ela que permite reconhecer, numa ocorrência guardada,
a mesma que o motor projeta. Os dois comentários que diziam "OPEN QUESTION" foram substituídos
pelas referências às seções.

### P19. Um `TraceEvent` pode ter origem numa Recorrência? — RESPONDIDA (medida no Figma)

**Onde:** `src/domain/trace-events/types.ts` · `src/app/api/v1/trace-events/route.ts`

A pergunta dizia que "o tipo admite, mas nenhuma fonte descreve a tela que mostraria isso".
**Falso nas duas metades:** a fonte escrita já decidia, e a tela está desenhada.

**Resposta: sim.** `files_design/03` §"Evento (histórico/rastreabilidade) — objeto geral, não
exclusivo de Passivo" fixa a coluna Origem como "Passivo específico, **ou Lançamento recorrente
específico**", e o enum de Tipo já traz "Recorrência paga". Não era lacuna: era fonte explícita
que ninguém tinha lido.

**A tela é o card "Eventos Recentes" da Home**, e o evento de origem Recorrência é a **primeira**
das suas cinco linhas. Figma, página Wireframe, nó `150:8` dentro do card `150:2`, no frame `5:2`
"Desktop — Início (Dashboard)" (`docs/figma/frames/5-2__desktop-inicio-dashboard.xml`):

> "Aluguel pago com divergência: previsto R$ 1.500,00, pago R$ 1.300,00 (R$ 200,00 pendente)"

"Aluguel" é a recorrência do produto — `10:30`/`10:31` ("Aluguel" / "PJ · Despesas Administrativas
· valor fixo") na Revisão de Recorrentes `10:2`, e de novo em `147:6`/`147:7` e `152:6`/`152:7` no
frame `34:2` — e a frase é o resultado literal da ação ④ "Marcar Pago: valor divergente"
(`147:19`, `147:20`, `147:23`). A página Mockup aplica o mesmo card em `549:276`, com a mesma
linha em `549:282`. A nota de design `163:2` confirma o conceito: "Qualquer divergência (previsto
≠ pago), em qualquer lançamento ou parcela de Passivo, gera um Evento […] Não é uma tela nova, é
um conceito (Evento) reaproveitado em vários lugares que já existiam."

**O que continua verdadeiro, e é outra pergunta:** não existe tela de **log completo por
recorrência**. O card "Histórico de eventos (rastreabilidade)" só é desenhado dentro de "Desktop —
Detalhe do Passivo" (`91:133`..`91:145`); não há frame "Detalhe da Recorrência" no
`docs/figma/INDEX.md` nem no Mockup. Isso é escopo deliberado (PRD §1, "fora de escopo"), não
lacuna — e é só o que limita o filtro `recurrenceId` de `GET /api/v1/trace-events`, nunca a
existência da origem.

**Continuam abertas, e são sobre TEXTO, não sobre tela:** a redação de um evento de **Cadastro**
para uma Recorrência (`src/domain/trace-events/types.ts`, `RegistrationEventData` — nenhum frame a
escreve; só existe a de Passivo, `150:20`) e o P17, a redação de "Recorrência paga" no caso de
valor exato.

**Regressão pinada:** `src/data/sqlite/trace-events.repository.test.ts`, "listRecent traz o evento
de origem Recorrência — é a 1ª linha da Home (Figma 150:8)". A leitura errada convidava a filtrar
essas origens fora de `listRecent` como órfãs.

### ~~P23. Qual Classificação um gasto de Consumo Livre carrega?~~ — RESPONDIDA pelo Figma

**Onde:** `src/domain/discretionary-spending/rules.ts` · `buildExpenseEntry`

Não era lacuna, e a metade que a pergunta acertava estava escrita como se fosse suposição. Duas
fontes desenhadas respondem, e se combinam.

**O critério.** O Wireframe `71:11` "Estado — Tooltips de ajuda", card `73:11` "③ Hover:
Classificação"
([`frames/71-11__…xml`](figma/frames/71-11__estado-tooltips-de-ajuda-status-classificacao-tipo-de-valor-sub-tipo.xml)),
não desenha só o par de opções `73:19` "Circulante" / `73:21` "Não circulante": ele **enuncia a
regra**, em `73:23` «Circulante: previsto para até 12 meses.» e `73:24` «Não circulante: prazo
maior que 12 meses.». O critério é temporal, e decide este caso sozinho — um gasto de Consumo
Livre é dinheiro **já gasto** (`status: 'Paid'`, data do próprio dia, porque o popover não pede
data), horizonte zero, dentro dos 12 meses. Este mesmo tooltip já é tratado como fonte normativa
noutros pontos do código (`novo-lancamento/tabs/expense-revenue-fields.tsx`,
`chart-of-accounts/rules.ts`); faltava aplicá-lo aqui.

**Não há o que perguntar à pessoa.** "Não há tela onde ela escolheria" era verdade, mas por
excesso e não por falta: o popover está inteiramente desenhado. O frame `345:1002` → diálogo
`345:1252` (320×183)
([`frames/345-1002__…xml`](figma/frames/345-1002__desktop-gastei-um-valor-modal-sobre-inicio.xml))
tem exatamente quatro filhos — `345:1253` "Quanto você gastou?", o campo `345:1254`, o botão
`345:1256` "Confirmar" e a legenda `345:1258` «Sem categoria, sem conta, sem data pra escolher,
só o valor. A barra atualiza na hora.» — e a legenda é normativa: ela **enumera** o que não se
escolhe ali. O Mockup repete a mesma composição (`1000:2643`, 320×270).

**Resposta:** `'Current'`. O valor que o código já emitia estava certo; o que estava errado era
declará-lo "assumido" (CLAUDE.md §7.1: nunca apresentar um achado na voz de uma suposição). A
categoria fixa continua nascendo com `suggestedClassification: null` como toda categoria padrão
(P8), e a pessoa pode trocar depois — `73:25` «Sugestão automática pode ser trocada manualmente
a qualquer momento.» Fixado por `src/domain/discretionary-spending/rules.test.ts`.

**Corrigido junto (divergência achada no mesmo frame):** a legenda `345:1258` saía como
`<DialogDescription>` dentro do `<DialogHeader>`, ou seja logo abaixo do título, **acima** do
campo e do botão. As duas páginas desenham a ordem inversa — Wireframe `345:1252`: título y=20,
campo y=50, "Confirmar" y=102, legenda y=150; Mockup `1000:2643`: y=24 / 70 / 150 / 210. A
legenda passou para o fim do form, mantendo o `id="gastei-um-valor-legenda"` que é o
`aria-describedby` do diálogo. Regressão pinada em
`src/app/(app)/inicio/_components/modals/home-modals.test.tsx`.

### P36. "Paga" no card Parcelas: texto cinza ou Etiqueta? — **RESPONDIDA (design, 2026-09-09)**

**Resposta: Etiqueta**, como o Mockup desenha — e o código **já fazia isso**. Esta entrada estava
errada sobre o presente: dizia "assumido hoje: texto cinza terciário", e o `InstallmentRow`
renderiza `<Badge tone={isPaid ? 'pago' : 'previsto'}>` desde antes da pergunta ser feita.

O conflito entre as duas fontes de design foi resolvido no próprio código, e melhor do que
"o Mockup vence": a regra do `files_design/07` que pede "Pago em cinza terciário" está **escopada
em tabela densa**, e o Mockup `948:1687` desenha aqui uma LISTA de linhas (`950:35` "Linha"), com a
pílula verde. A regra não se aplica — não precisou ser emendada.

### P37. O rótulo da ação na parcela Paga — **RESPONDIDA (design, 2026-09-09)**

**Resposta: "Editar"**, o literal desenhado nas duas páginas, e o código já usa. O Wireframe `91:2`
escreve "Editar" (`91:107`, `91:115`) e o Mockup confirma pela medida: o texto do botão da linha
Paga mede 39 de largura contra 83 do "Marcar Paga" — "Editar juros" é mais largo que "Marcar Paga"
e não caberia.

O nome que `files_design/01` §12 dá ao fluxo continua sendo "Registrar Reajuste de Juros"; o rótulo
curto é o da linha, e o destino é o mesmo `RateAdjustmentDialog` nos dois casos.

### P38. A linha de consequência do "Descartar" nas 4 telas de Patrimônio — **RESPONDIDA (design, 2026-09-09)**

**Resposta: sim, e ela diz as duas coisas que a pessoa não pode adivinhar** — que apaga, e que
pode ser recusado.

O Figma só desenha a linha `34:36` para o "Descartar" da Revisão de Recorrentes, onde ela é
tranquilizadora ("a série continua normalmente"). Aqui a consequência é o oposto, e foi **medida**:
este "Descartar" apaga o cadastro, e o `RESTRICT` do banco recusa com 409 quando algo ainda aponta
para ele.

**A pergunta desenterrou um defeito maior que ela.** Ao medir a consequência para escrever a frase,
`DELETE /api/v1/liabilities/{id}` devolveu **409 em 100% dos casos**: `POST /liabilities` gera o
cronograma no cadastro e `installments` tem RESTRICT contra `liabilities`, então **todo passivo
nasce com filhos que o bloqueiam** — o "Descartar" da tela de Passivos nunca funcionou.

Pior: havia um **teste travando isso como se fosse regra** ("DELETE answers 409 while the schedule
still exists"). Ele passava, e o que garantia era o defeito.

Corrigido: o `remove` do repositório passou a apagar o que é DO passivo — cronograma, reajustes e
eventos — na mesma transação, o mesmo padrão que `discretionary-spending.repository.ts` já usava.
O RESTRICT continua valendo para quem aponta de fora, que é o que o `in_use` protege. Verificado:
204, com o passivo e as 360 parcelas apagados.

**Emenda (2026-09-11): "pode ser recusado" vale para DUAS das quatro telas, não para as quatro.**
A frase acima estava certa sobre o mecanismo (RESTRICT → 409) e errada sobre o alcance. Medido nas
FKs de `schema.ts` e nos `remove()` de cada repositório:

| Tela           | Pode ser recusado? | Por quê                                                                           |
| -------------- | ------------------ | --------------------------------------------------------------------------------- |
| Conta Bancária | **sim**            | `entries`, `recurrences`, `discretionary_spending_config`, `allocation_items`     |
| Investimento   | **sim**            | `allocation_items` (um Direcionamento)                                            |
| Bem Material   | não                | única FK é `pending_allocations`, que implica `soldOn`, e a lista lê `listUnsold` |
| Passivo        | não                | o `remove()` apaga parcelas, reajustes e eventos na mesma transação               |

Por isso as frases de Bem Material e Passivo falam do que o descarte **leva junto**, e só as outras
duas nomeiam o bloqueio. As redações finais estão em `files_design/02`.

E um defeito que a revisão do texto desenterrou, do mesmo tamanho do que a P38 original achou: a
recusa era **muda**. `remove.error` não era renderizado em nenhuma das quatro telas nem no
`ConfirmActionButton` — o 409 fechava o diálogo e deixava a linha na tabela, sem uma palavra.
Corrigido: o diálogo espera a resposta, fica aberto em caso de recusa e escreve o motivo.
