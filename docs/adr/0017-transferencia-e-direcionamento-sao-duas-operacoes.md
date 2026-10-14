# ADR-0017 — "Redirecionamento" são duas operações, não uma: Transferência e Direcionamento

- **Status:** aceita (decisão do dono, 2026-09-11)
- **Responde ao hotspot H12** (Event Storming, "Redirecionamento como operação única, atravessando
  Onde Está Meu Dinheiro, Consumo Livre, Destinação do Lucro, Venda de Bem Material e pagamento a
  maior")
- **Estende:** ADR-0014 (unidade de trabalho entre portas segregadas) · ADR-0012 §3 (portas
  segregadas)

## Contexto

O PRD v7 §5 afirma, em uma frase:

> **Redirecionamento de valor:** existe um só conceito de mover valor de uma origem para um destino
> (conta, investimento ou passivo), acionado de vários pontos do produto. Ele altera a posição de
> dois lugares ao mesmo tempo e, portanto, precisa ser tratado como uma operação única.

O Event Storming elevou isso a hotspot e deixou explícito que a resposta não é extensão de union
type: "isto é uma afirmação sobre **atomicidade entre dois agregados** (debita de um lado, credita
do outro), que é decisão de arquitetura".

### O que existe hoje, medido origem por origem

| #   | Origem                 | Grava a intenção           | Move a posição dos dois lados                      |
| --- | ---------------------- | -------------------------- | -------------------------------------------------- |
| 1   | Onde Está Meu Dinheiro | —                          | **sim, por N+1 `PATCH` disparados pelo cliente**   |
| 2   | Destinar o Lucro       | `ProfitAllocation`         | não                                                |
| 3   | Venda de Bem Material  | `Allocation`               | não                                                |
| 4   | Sobra do Consumo Livre | `LeftoverDirection`        | não (só o destino "Consumo Livre" devolve à verba) |
| 5   | Pagamento a maior      | aceito no schema, ignorado | não — bloqueado neste hotspot, por escrito         |

### O defeito não é hipótese: está escrito no código

`block-detail-modal.tsx`, no laço que executa o redirecionamento:

> "Escritas reais, uma por lado do movimento — **não é uma transação atômica de backend, então se
> uma falhar as anteriores já aconteceram**; a pessoa vê o erro e pode conferir/corrigir pelos
> cadastros."

E o hook que ele chama sanciona a forma:

> "Não existe endpoint de 'transferência entre blocos': **duas chamadas PATCH, uma por lado, são a
> forma sancionada** de registrar o mesmo movimento sem inventar rota nova."

Redirecionar R$ 5.000 de uma conta para um investimento debita a conta e depois credita o
investimento. Falhou a segunda, **os R$ 5.000 deixam de existir** — sem aviso, sem evento, sem
rastro. Num produto cujo valor inteiro é a pessoa confiar nos números, é a pior classe de defeito
possível, e o caminho para ele é uma falha de rede comum.

### E as cinco origens não são a mesma operação

Esta é a descoberta que muda o desenho, e ela veio de medir as origens em vez de ler a frase do PRD
como especificação técnica.

**Na origem 1, os dois lados são posições que existem.** Uma conta bancária tem `balance`, um
investimento tem `accumulatedValue`; ambos são campos mantidos pela pessoa (files_design/03), não
derivados. Mover entre eles encolhe um e cresce o outro. É aqui, e só aqui, que a frase "altera a
posição de dois lugares ao mesmo tempo" descreve o que acontece.

**Nas origens 2, 3 e 4 o lado de origem não é uma posição que encolhe.** O lucro do mês é um
resultado do DRE; o dinheiro de uma venda é um evento; a sobra do Consumo Livre é derivada
(`verba − gasto`). Nenhum dos três é um saldo do qual se debita. Na venda isso é literal: os
R$ 45.000 de um bem vendido **nunca entram em conta nenhuma** — o único `Entry` que a rota de venda
cria é o do ganho/perda, e o bem sai do Balanço por `soldOn`. Exigir que essas origens "debitem"
obrigaria a inventar uma posição que o produto não tem.

Tratá-las como uma operação só é possível — bastaria uma união com casos que não debitam nada — mas
o custo é uma abstração que mente sobre metade dos seus casos, e é ela que a próxima pessoa teria de
desfazer.

## Decisão

### §1 — Duas operações, com os nomes que o produto já usa

**Transferência** move valor entre duas posições. **Direcionamento** aplica a um destino um valor
que chega de um evento.

Nenhum nome é novo. "Direcionamento" já é `Allocation` no `src/domain/GLOSSARY.md`, hoje escopado à
venda ("O destino do dinheiro de uma venda") — generalizá-lo é exatamente o que o H12 pede, e é o
que as telas já escrevem ("Direcionar valor", "+ Adicionar Direcionamento", "Direcionar agora").
"Transferência" entra no glossário para o que as telas chamam de "Redirecionar valor", em Onde Está
Meu Dinheiro e no Detalhe do Consumo Livre.

A alternativa considerada era batizar o segundo conceito de "Aplicação". Recusada: o produto já tem
uma palavra para ele, e o glossário proíbe que a mesma coisa ganhe dois nomes.

### §2 — Uma Transferência é atômica, no servidor

`POST /api/v1/transfers` debita a origem e credita o destino dentro de um único
`withTransaction` (ADR-0014). O cliente deixa de encadear `PATCH`.

O motivo é o mesmo da ADR-0014, e a frase de lá vale literal aqui: a promessa da tela não se
qualifica com "a menos que a segunda escrita falhe". A diferença é que na ADR-0014 o que se perdia
era um Evento; aqui é dinheiro.

### §3 — Uma Transferência é um fato, e deixa rastro

Toda Transferência grava um `TraceEvent`. Antes disto um redirecionamento não deixava nenhum: a
pessoa via os dois saldos diferentes do que eram e não tinha como saber por quê, nem distinguir isso
de uma correção de cadastro. O Evento já é o mecanismo do produto para "aconteceu algo que mexeu num
número" (files_design/03).

O Evento é gravado dentro de `applyTransfer` e não nas rotas, para que a frase acima seja literal:
as duas rotas que movem valor entre posições passam por lá, e uma delas esquecer seria a diferença
entre um movimento rastreável e dois saldos que mudaram sozinhos.

**O que isto custou em documento de design, e foi decidido junto (2026-09-11):**

- A linha "Tipo" do `files_design/03` ganhou o quinto valor, **Transferência**. A linha "Origem"
  ganhou a conta/investimento de destino. A linha "Descrição" ganhou o exemplo.
- A **origem gravada é o destino** — a única posição onde a operação faz existir valor novo. A
  escolha não tem consequência observável hoje, porque nenhuma tela lista o histórico de uma conta;
  fica registrada para quando listar.
- As **40 legendas** que enumeram os tipos na Mockup passaram a incluir redirecionamentos: 36 do card
  "Eventos Recentes" (ele aparece atrás de cada modal) e 4 do estado vazio, claro e escuro. O estado
  vazio foi de três para quatro linhas, dentro do contêiner.
- A redação — "R$ 5.000,00 redirecionados de Nubank para Tesouro Direto" — segue a forma das três que
  o `files_design/03` já escrevia: começa pela coisa, depois o que aconteceu. Usa o verbo do botão
  ("Redirecionar valor"), não o nome do conceito no domínio.

**E a migração 0009 nasceu quebrada.** O `drizzle-kit` gerou o `INSERT … SELECT` da tabela recriada
lendo as duas colunas NOVAS da tabela ANTIGA, que não as tem. Medido aplicando as dez migrações em
ordem num banco limpo: `no such column: "origin_bank_account_id"`. Corrigido para `NULL` nas duas —
que é o valor certo e não conveniência, porque evento antigo nenhum tem origem `BankAccount` ou
`Investment`: os dois tipos nascem com a Transferência.

### §4 — O que um Direcionamento faz, e o que continua não fazendo

Um Direcionamento credita o destino e não debita ninguém. O registro da intenção — que as origens 2,
3 e 4 já gravam hoje, cada uma no seu agregado — permanece onde está: `ProfitAllocation`,
`Allocation` e `LeftoverDirection` não são substituídos por uma tabela nova.

O que muda é que o crédito no destino passa a acontecer, na mesma transação do registro, em vez de
não acontecer. Antes disto, direcionar R$ 20.000 de uma venda para "Tesouro Direto" gravava a
escolha e deixava o investimento com o valor de antes.

### §4.1 — Emenda (2026-09-11, ao implementar): nem toda origem credita sem debitar

Escrever o §4 e medir as três origens deu respostas diferentes, e aplicá-lo ao pé da letra teria
criado a mesma classe de defeito que o §2 fecha, só na direção oposta — dinheiro aparecendo em vez
de sumir. `netWorth = totalAssets − totalLiabilities`, e `balance` e `accumulatedValue` somam os
dois no Ativo: creditar um destino sem contrapartida faz o Patrimônio Líquido crescer sozinho.

| Origem                 | Contrapartida                               | O que ela é          |
| ---------------------- | ------------------------------------------- | -------------------- |
| Venda de Bem Material  | o bem sai do Ativo (`soldOn`), no mesmo ato | **Direcionamento**   |
| Sobra do Consumo Livre | `config.sourceAccountId`, conhecida         | **Transferência**    |
| Destinar o Lucro       | nenhuma no agregado                         | continua só registro |

A venda é a única onde creditar sem debitar está certo — e lá isso conserta um número que estava
errado na direção contrária: vender um bem de R$ 300.000 por R$ 350.000 e direcionar tudo tirava o
bem do Ativo e não punha nada no lugar, derrubando o PL em R$ 300.000 numa operação que devia subir
R$ 50.000, o ganho.

A sobra do Consumo Livre tem conta de origem, então ela é uma Transferência e reusa `applyTransfer`.

A Destinação do Lucro fica de fora **com motivo escrito**, não por escopo: o agregado não tem campo
de conta de origem, e o lucro do mês já está em alguma conta. Creditar o destino inventaria dinheiro.
Se o produto quiser que ela mova valor, o que falta é decidir de ONDE sai — e isso é campo novo no
agregado, não código novo aqui.

### §4.2 — Destino Passivo é recusado, não ignorado

Nas três origens, um direcionamento para Passivo devolve `422
allocations.liability_not_supported`. Abater dívida é amortização extraordinária: o saldo devedor é
derivado do cronograma de parcelas, e mexer nele é decisão de produto que ninguém tomou.

Gravar a escolha e não fazer nada — o que as três faziam — é um no-op silencioso, a mesma classe de
defeito que a recusa muda do "Descartar" acabou de fechar. O Detalhe do Bloco já recusava esse
destino com uma frase que explica; agora a API recusa junto.

### §5 — O pagamento a maior sai do limbo

`overpaymentChoice` era aceito pelo schema e ignorado desde que existe, com o comentário apontando
para este hotspot.

**"Descontar da próxima ocorrência" passa a acontecer.** Reduz o previsto do mês seguinte pelo
excesso, materializando a ocorrência se ela ainda não existir (o id é derivado, `${recurrenceId}:${month}`,
e `create` é get-or-create — ADR-0004).

A fonte especifica o caminho feliz e só ele; três bordas que o MODELO admite ficaram sem resposta e
**recusam**, por decisão de produto de 2026-09-11: série que acaba neste mês (`endsOn`), mês seguinte
ainda "a definir" (`plannedAmount: null`), e excesso maior que o previsto do mês seguinte. Descontar
"o que couber" foi a alternativa medida e recusada: zeraria o mês seguinte e faria sumir o resto sem
virar nada, num fluxo cuja regra escrita é que pagar a mais NUNCA vira pendência.

A recusa é validada ANTES da transação. Recusar depois de gravar o pagamento deixaria a pessoa com o
pagamento no banco e um erro na tela, e reenviar gravaria o pagamento duas vezes.

**"Redirecionar o valor extra" é RECUSADO, e a razão é contábil.** O dinheiro extra de um pagamento
a maior saiu da conta e foi para quem recebeu: pagar R$ 1.700 de um aluguel de R$ 1.500 entrega
R$ 1.700 ao locador. Creditar um investimento com esses R$ 200 subiria o Patrimônio Líquido em
dinheiro que a pessoa não tem mais — a mesma classe de defeito que o §4.1 existe para impedir.

O caso em que a opção faria sentido é o que `files_design/02` descreve — "se for parcela de Passivo,
Redirecionar → Passivo cobre amortização extraordinária" —, e ele **não é alcançável de onde a opção
está**: a escolha de pagamento a maior existe só no diálogo de recorrência, e a rota de parcela
(`/installments/{id}/payment`) nem aceita o campo. Para a opção funcionar, ela precisaria primeiro
existir no pagamento de parcela, e aí esbarra na amortização extraordinária, que continua sem
decisão de produto.

Enquanto isso, a API devolve `422 overpayment.redirect_not_supported` e o texto de ajuda na tela diz
o que acontece de verdade, em vez de prometer o que o `152:15` desenha.

## Consequências

- O defeito de dinheiro sumindo deixa de ser possível na origem 1, que é a única onde ele existe.
- Direcionar para um investimento passa a mexer no investimento, o que a P22 depende para contar
  aporte que não veio de "Destinar o Lucro".
- As telas não mudam: as cinco já desenham "Para onde + Valor". O que muda é o que acontece depois
  do clique.
- `AllocationOrigin`, hoje só `TangibleAssetSale`, cresce — e agora cresce com um significado
  escrito, em vez de por acréscimo de `case`.

## Explicitamente NÃO feito

- **Uma tabela única de movimentos.** Os três agregados que hoje registram intenção continuam donos
  dela. Unificar o REGISTRO é outra decisão, e não é a que o H12 pede — ele pede atomicidade.
- **Transferência com destino Passivo.** Redirecionar valor livre para uma dívida é amortização
  extraordinária, que o Detalhe do Bloco hoje recusa dizendo por quê. Continua recusando: é decisão
  de produto sobre o cronograma de parcelas, não sobre atomicidade.
- **Desfazer uma Transferência.** O Evento registra que aconteceu; reverter é transferir de volta.
