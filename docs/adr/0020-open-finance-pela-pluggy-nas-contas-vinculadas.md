# ADR-0020 — Open Finance pela Pluggy: nas contas vinculadas, o banco é a fonte do fato

- **Status:** aceita (decisões do dono em 2026-09-29; implementada no mesmo dia — ver "Como ficou" no fim)
- **Fecha:** a linha do roadmap "integração bancária automática (Open Finance)" do PRD §1
- **Emenda:** ADR-0001 §1 (o Lançamento é a fonte da verdade) · a regra do Event Storming, Fluxo
  E, "saldo de conta mantido pela pessoa, nunca derivado" · ADR-0009 (LGPD — um operador externo
  passa a receber consulta, nunca dado nosso)
- **Estende:** ADR-0012 (portas segregadas — o provedor externo é mais uma porta, com adaptador
  próprio) · ADR-0017 (Transferência — o PIX entre contas próprias vira uma)
- **Não toca:** ADR-0008 (sem autenticação e sem exposição à internet continuam valendo: não há
  webhook)

## Contexto

O PRD v7 deixava a integração bancária fora do MVP e pedia só que "a modelagem de lançamentos não
impeça integração futura" (§5). O dono decidiu antecipá-la, com a Pluggy, e as respostas que
decidiram o desenho foram dadas em sessão em 2026-09-29:

- **A Pluggy complementa o lançamento manual, não o substitui.**
- **Nenhuma senha de banco passa pelo Bigorna.** A pessoa conecta os bancos no **Meu Pluggy**
  (`meu.pluggy.ai`), que guarda o consentimento do Open Finance; o Bigorna só lê pela API com as
  credenciais da aplicação. A PF e a PJ estão na mesma conta do Meu Pluggy (confirmado pelo dono;
  a página pública do Meu Pluggy fala em "contas do mesmo titular" no plano gratuito, até 5
  conexões).
- **Sincronização sob demanda, sem webhook.** O ambiente continua privado.
- **Não há tela de revisão.** O que vem do Open Finance é fato.
- **O modelo mental do dono já é o desenho do produto** e a importação se encaixa nele em vez de
  detalhar tudo: da conta corrente importa quanto do saldo livre está sendo consumido, não o item a
  item (esse ele vê no banco); do cartão importa o detalhe; de investimentos e dívidas importa a
  visão geral.

## Decisão

### §1 Só servidor, só leitura, só credencial da aplicação

`PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` vivem no `.env` (só o nome entra no `.env.example`).
O servidor troca as duas por uma API Key (`POST /auth`, validade de 2 horas) e lê `/accounts`,
`/transactions`, `/investments` e `/loans` por `itemId`. Nenhuma chamada sai do navegador, nenhum
script da Pluggy entra no cliente, e a CSP (`connect-src 'self'`) não muda. `POST /items` — criar
conexão enviando credencial bancária — **não é usado**, por decisão: é o caminho em que a senha do
banco passaria pelo nosso servidor.

### §2 O provedor é uma porta, a regra é do domínio

- **Porta** `OpenFinanceReader` em `src/data/contracts`, que devolve um retrato normalizado
  (contas, saldos, transações, investimentos, empréstimos) em `Cents` e `IsoDate`. O tipo da Pluggy
  não atravessa a porta.
- **Adaptador** `src/data/pluggy/`, amarrado em `src/data/index.ts`. Uma fixture sintética
  implementa a mesma porta e roda a mesma suíte de contrato (ADR-0013, L).
- **Regra pura** em `src/domain/open-finance/`: dado o retrato e o estado atual, decide o que cada
  transação vira (§4). Não sabe que a Pluggy existe.
- **Idempotência pelo id da transação no provedor**: importar duas vezes o mesmo retrato não muda
  nada. É a guarda contra dupla contagem, e tem teste citando PRD §5.

### §3 Vínculo: cada conta do provedor aponta para uma posição do Bigorna

Uma conta da Pluggy é **vinculada** a uma Conta Bancária, a um Investimento ou a um Passivo que já
existe. A entidade (PF/PJ) vem da posição vinculada, nunca do CPF/CNPJ do titular — o Bigorna não
lê o produto de identidade da Pluggy (minimização, ADR-0009). Conta do provedor sem vínculo é
ignorada.

Numa posição vinculada:

- **O saldo vem do provedor** a cada sincronização e deixa de ser editável à mão.
- ~~**Lançamento Pago manual é recusado** a partir da data do vínculo.~~ **Emendado em
  2026-10-09 (ver "Emenda: Pago manual numa conta vinculada", no fim):** o Pago manual é aceito, e
  a transação do banco casa com ele em vez de virar outro lançamento. Previstos e recorrências
  continuam manuais.

### §4 O que cada transação importada vira

| Origem                                                                | Vira                                                                    | Detalhe                                                                                                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saída da conta corrente que é a **conta de origem do Consumo Livre**  | Gasto de **Consumo Livre** (categoria de sistema)                       | Visão geral: a descrição do banco fica guardada, sem categoria                                                                                      |
| Transação que casa com um **Previsto** ou ocorrência aberta           | O Previsto vira **Pago**, na data da transação                          | Regra de casamento em aberto (PRD P49)                                                                                                              |
| Par saída/entrada entre **duas contas vinculadas** (ex.: PIX PJ → PF) | **Transferência** (ADR-0017)                                            | Não é receita nem despesa. **Pró-labore e distribuição de lucro continuam manuais** — a eliminação intercompany (PRD §5) não depende de adivinhação |
| **Compra no cartão** de crédito vinculado                             | Lançamento de despesa **Previsto**, com a categoria do **de-para** (§5) | Vira Pago quando a fatura é paga — é a regra do PRD §5, "compra no crédito é uma despesa com status Previsto até a fatura ser paga"                 |
| **Pagamento da fatura** saindo da conta corrente                      | Liquida os Previstos do cartão                                          | **Não** é gasto de Consumo Livre, senão a compra contaria duas vezes                                                                                |
| **Investimento** vinculado                                            | Atualiza o saldo                                                        | Visão geral; sem reavaliação mensal no DRE (PRD §5, realização só na venda)                                                                         |
| **Empréstimo** vinculado                                              | Atualiza o saldo devedor                                                | Em aberto (PRD P46): conflita com a dívida calculada da ADR-0005                                                                                    |

A data de todo lançamento importado é a data que o banco informa para a transação: é a data de
pagamento que o regime de caixa exige (ADR-0001 §2), dita pelo banco em vez de digitada.

### §5 De-para de categoria, fixo e versionado

Uma tabela em código liga cada categoria da Pluggy a uma categoria do Plano de Contas. O que não
tiver par cai numa categoria "Outros" de Despesas Pessoais/Consumo. Mudar o de-para é um commit.
Corrigir uma compra específica é editar o lançamento pelo Histórico, que já existe. O conteúdo da
tabela é decisão do dono (PRD P51), não de engenharia.

### §6 Sob demanda

A sincronização é um `POST /api/v1/open-finance/sync`, disparado pelo servidor quando a pessoa
abre o app, no máximo uma vez por intervalo. O Meu Pluggy atualiza as conexões uma vez por dia do
lado dele, então disparar mais que isso não traz dado novo. O intervalo e o ponto exato do disparo
estão em aberto (PRD P53).

### §7 LGPD

- A Pluggy é consultada pela API; o Bigorna não envia dado da pessoa para ela. O consentimento do
  Open Finance mora no Meu Pluggy.
- O log registra só evento, resultado e contagem (`open_finance.sync.ok`, `imported: 12`), nunca
  valor, descrição, nome de estabelecimento ou id de conta do provedor.
- Os testes usam só a fixture sintética. **Nenhum retrato real da API entra no repositório**, nem
  como fixture "anonimizada".

## Alternativas consideradas

- **Widget Pluggy Connect no cliente.** Ganha: conectar banco de dentro do app. Perde: um script
  de terceiro numa página de finanças, contra ADR-0009, e uma exceção permanente na CSP. O Meu
  Pluggy já faz a conexão fora do app.
- **`POST /items` com credencial bancária.** Descartada pelo dono: a senha do banco passaria pelo
  Bigorna.
- **Webhooks.** Ganha: tempo real. Perde: uma rota pública num app sem autenticação (ADR-0008). O
  Meu Pluggy sincroniza uma vez por dia, então o ganho real é pequeno.
- **Tela de revisão das importações.** Descartada pelo dono: o Open Finance é o fato. O custo
  aceito é que um erro do de-para aparece no DRE até alguém editar pelo Histórico.
- **Toda PJ → PF é pró-labore.** Descartada: uma distribuição de lucro viraria despesa
  operacional da PJ e quebraria a eliminação intercompany, regra imutável.
- **Casar lançamento manual com importado por valor e data.** Descartada em favor de "conta
  vinculada é só Pluggy": casamento aproximado erra com valores repetidos, e o erro é silencioso.
- **Entidade pelo CPF/CNPJ do titular.** Descartada: exigiria ler o produto de identidade, que
  traz documento pessoal, para responder algo que o vínculo já responde.

## Consequências

- **ADR-0001 §1 muda de sentido nas contas vinculadas:** o Lançamento continua sendo a única coisa
  que os relatórios leem, mas deixa de ser a origem do fato. Quem diz o que aconteceu é o banco;
  o Lançamento é a cópia dele.
- **O widget de Consumo Livre muda** quando a conta de origem está vinculada: registrar gasto à
  mão duplicaria o que o banco já informa. A tela está desenhada no Figma, então essa mudança
  precisa passar pelo design (PRD P48).
- **A tela de Contas Bancárias precisa de um jeito de vincular** (e Investimentos e Passivos
  também). É a menor superfície de tela que o desenho exige, e não existe no Figma (PRD P50).
- **Uma entrada na conta corrente que não casa com nada** (estorno, PIX de terceiro, rendimento)
  não tem destino definido (PRD P52).
- **Dependência externa nova.** Se a Pluggy estiver fora, a sincronização falha, o app continua
  funcionando com o último retrato e o log registra `open_finance.sync.failed`.

## Como ficou (2026-09-29)

O dono aceitou as recomendações das perguntas abertas ("faça e conforme eu uso a gente ajusta"),
e o PRD v7.42 registra cada uma. O que o código faz, e onde:

- **Regra pura:** `planImport` e `refusesManualPaid` em `src/domain/open-finance/rules.ts`; o
  de-para em `category-mapping.ts`. As fases rodam sobre o lote inteiro, nesta ordem: Previsto →
  pagamento de fatura → Transferência → o resto. A ordem é a regra: invertida, o PIX de um
  pró-labore Previsto vira Transferência, e o pagamento da fatura vira Consumo Livre. As duas
  inversões foram provocadas de propósito e cada uma derrubou os testes que a cobrem.
- **Casamento com Previsto (P49):** mesma conta, mesmo valor ao centavo, até 5 dias. Uma série
  "a definir" não tem valor previsto, então não casa. O gasto entra pelo de-para, e o mês é
  descartado na Revisão de Recorrentes.
- **Fatura (derivada do PRD §5):** uma saída da conta corrente com o mesmo valor de um crédito no
  cartão, com até 5 dias de diferença, é o pagamento da fatura. Ele liquida as compras Previstas
  do cartão **da mais antiga para a mais nova, até somar o valor pago**, e cada compra vira Paga
  na data do pagamento. "Toda compra até a data do pagamento" liquidaria compras da fatura
  seguinte.
- **Data do vínculo:** é o **1º dia do mês** em que a pessoa vincula. O mês inteiro é importado e
  o DRE dele fica completo. Revincular mantém a data original. Confirmado pelo dono em 2026-09-29, com alternativas na mesa (desde 1º de janeiro, últimos 12 meses, data escolhida por conta): o histórico anterior ao mês do vínculo fica de fora do DRE.
- **Trava (§3):** despesa, receita e IR Pagos à mão numa conta vinculada respondem 409
  `open_finance.account_is_linked`, com uma frase que a tela mostra. A trava vale também para o
  gasto de Consumo Livre com a conta de origem vinculada (P48) e para o saldo da conta ou do
  investimento vinculado. **Pró-labore e distribuição ficam fora da trava:** o PIX entre as
  contas é importado como Transferência, que não cria lançamento, então o lançamento manual é o
  único registro dele.
- **Estorno (P52):** ainda sem destino. É **ignorado**, não vira receita, e fica registrado em
  `imported_transactions`, com `outcome = Ignored`.
- **Empréstimos (P46) e fatura como dívida (P47):** **não implementados** nesta entrega. A API
  de empréstimos da Pluggy não mostrou um campo de saldo devedor que eu tenha conferido, e a
  fatura como bloco de dívida muda Onde Está Meu Dinheiro, que está no Figma.
- **Onde se vincula (P50):** um card "Open Finance" nas telas de Contas Bancárias (conta corrente e
  cartão) e de Investimentos. O card **não está no Figma** e segue o padrão Card + Table da própria
  tela. Ele está marcado 🟩 pendente em `files_design/01` §10.
- **Quando sincroniza (P53):** ao abrir o app (`OpenFinanceAutoSync`, no layout), no máximo uma
  vez a cada 6 horas, e em "Sincronizar agora" no card, que força. O banco é lido **fora** da
  transação SQLite, e as escritas acontecem numa transação só.
- **Conexões:** a Pluggy não lista as conexões de uma aplicação ("For security reasons, Pluggy does
  not provide a method to list all existing connections", docs.pluggy.ai, "Item"). Os `itemId`
  entram por `PLUGGY_ITEM_IDS` no `.env`.
- **Categoria da Pluggy:** a documentação diz que ela só vem em planos que a incluem ("requires
  Pro subscription"). Sem categoria, toda compra do cartão cai em "Outros". Os nomes do de-para
  **não foram conferidos contra uma conta real**. É a primeira coisa a ajustar com o uso (P51).
- **Vários investimentos do banco num só** (decisão do dono, 2026-09-29): o banco trouxe 36
  investimentos, um por caixinha e um por CDB. Vários podem apontar para o **mesmo**
  Investimento, e o saldo dele passa a ser a **soma**. Isso muda o "um para um" do §3 só para
  investimentos. A Conta Bancária continua recebendo o saldo de uma conta só (409
  `open_finance.target_already_linked`), porque duas contas escrevendo o mesmo saldo se
  sobrescreveriam.
- **"Criar e vincular"** (decisão do dono, 2026-09-29): numa conta corrente ou num investimento
  sem vínculo, o card cria a posição com o nome e o saldo do banco, na entidade que a pessoa
  escolhe, e já a vincula (`POST /open-finance/links/{id}/position`). O cartão não tem o botão:
  ele não é posição.
- **Várias contas correntes numa Conta Bancária** (decisão do dono, 2026-09-29, no mesmo dia da
  anterior): um banco informou dois produtos com o mesmo número de conta, e o dono quis uma conta só.
  A recusa `target_already_linked` saiu, e a Conta Bancária também recebe a soma dos saldos.
  Isso exigiu uma fase nova no `planImport` (3a): uma saída e uma entrada de mesmo valor entre
  duas contas do banco ligadas à **mesma** Conta Bancária viram `Ignored/InternalMovement`. Sem
  essa fase, a saída viraria Consumo Livre e a entrada viraria receita — medido: com a fase
  desligada, o teste que a cobre falha. A trava do Pago manual passa a valer desde o vínculo
  **mais antigo** da conta. Uma Conta Bancária continua tendo **uma** entidade: juntar uma conta
  PJ com contas PF faz os gastos da PJ entrarem como PF, e a escolha fica com a pessoa.
- **Vincular e desvincular refazem o saldo na hora** (pedido do dono, 2026-09-29):
  `refreshLinkedBalance` soma as contas do banco que continuam ligadas ao cadastro, sem esperar a
  próxima sincronização. Antes, desvincular uma de duas contas somadas deixava a parte dela no saldo
  até a sincronização seguinte. Quando a conta desvinculada é a **última**, o cadastro fica com o
  último saldo que o banco informou e volta a ser editado à mão. Zerar faria o dinheiro sumir do
  Balanço enquanto ele continua no banco.
- **A compra do cartão pertence à fatura dela** (2026-09-29): a Pluggy informa o `billId` de cada
  compra (38 de 40 transações medidas) e as faturas do cartão em `GET /bills`, com vencimento e
  fechamento. O pagamento quita a fatura com vencimento mais próximo da data dele e liquida só as
  compras dessa fatura. Enquanto não é paga, a compra fica Prevista na data de **vencimento** da
  fatura, que é o mês em que o regime de caixa a coloca. O FIFO "até somar o valor pago" continua só
  como alternativa para quem não informa faturas. Nas 7 compras de setembro medidas, as duas regras
  dão o mesmo resultado: as 7 são da fatura que fechou em 08/09 e foi paga em 11/09.
- **Rendimento de conta vai para Resultado Financeiro:** "Proceeds interests and dividends" passou
  de "Dividendos" (Receita Bruta) para "Rendimento de caixa/conta". Foram 14 créditos num só mês,
  rendimento diário de conta remunerada e de caixinha, e não o dividendo de investimento externo do
  PRD §5.
- **"Reimportar"** (`POST /open-finance/reimport`): desfaz o que a importação criou (avulsos,
  compras do cartão, gastos de Consumo Livre, registros de transferência e de ignoradas) e importa
  de novo com as regras e a configuração de agora, na mesma transação. Mantém o Previsto que o banco
  já pagou, porque desfazê-lo exigiria a data prevista que o pagamento sobrescreveu. Edição feita à
  mão num lançamento importado se perde, e o diálogo de confirmação avisa. O que veio de uma conta
  desvinculada depois não volta.
- **Sem de-para: a pessoa categoriza** (decisão do dono, 2026-09-29, PRD v7.46). Esta decisão
  **revoga o §5**. A tabela fixa "categoria da Pluggy → categoria do Plano de Contas" era a mesma
  para qualquer pessoa e não batia com o jeito de gastar do dono: um PIX para uma pessoa é aluguel,
  uma loja é custo da PJ. Agora o que vem do banco chega como despesa ou receita numa categoria de
  sistema **"A categorizar"**. São duas, `a-categorizar` em Despesas Pessoais/Consumo e
  `a-categorizar-receita` em Receita Bruta, porque um Lançamento precisa de um bloco para o DRE
  fechar com o banco. Ele vira uma **Pendência por mês** ("N lançamentos a categorizar"), com
  "Categorizar agora". A categoria da Pluggy e a descrição do banco ficam guardadas como detalhe
  (`imported_transactions.provider_category`) e aparecem ao abrir a categoria no DRE, onde a pessoa
  troca a categoria. Trocar a categoria de um lançamento importado marca `categorized_by_person`, e o
  "Reimportar" preserva esses lançamentos. A categoria da Pluggy ainda decide **se** a transação
  entra no DRE (dinheiro próprio, estorno, pagamento de fatura), mas não **onde** ela entra.
- **A importação começa no DIA do vínculo** (decisão do dono, 2026-09-29, revoga o "1º dia do mês"
  confirmado mais cedo no mesmo dia): "ao invés de pegar lançamentos passados, vamos começar a pegar
  somente de hoje em diante". Vincular e "Criar conta nova" gravam `linkedOn = hoje`. Os vínculos
  que já existiam foram trazidos para 2026-09-29 e reimportados. Os pendentes de antes disso saíram,
  e os dois categorizados à mão ficaram (`categorized_by_person`). A trava do Pago manual acompanha:
  antes do vínculo, o lançamento manual é livre.
- **A compra PENDING do cartão é importada** (pedido do dono, 2026-10-01, PRD v7.50). Medido: as
  compras feitas depois do fechamento de 08/09 estavam todas PENDING e sem `billId`, e as 7 POSTED
  eram as da fatura já fechada. O normalizador descartava toda PENDING, então desde o vínculo
  nenhuma compra do cartão tinha sido importada. Agora a PENDING do **cartão** entra marcada
  (`imported_transactions.pending`) como Previsto em "A categorizar", na data da compra; a PENDING
  da conta corrente continua de fora, porque lá ela viraria um Pago. A cada sincronização, a fase
  0b do `planImport` segue a compra: com o mesmo id, ela vai para o vencimento da fatura quando
  fecha e acompanha o valor; com um id novo (a Pluggy apaga e recria a transação quando a data, o
  valor ou a descrição mudam muito — docs.pluggy.ai, "Transaction"), ela é reconhecida pelo mesmo
  cartão, mesmo valor ao centavo e até 5 dias, a mesma janela da P49, porque o `providerId`, a
  âncora sugerida, veio vazio nas 14 transações medidas; sem substituta, o Previsto sai. A
  categoria da pessoa e o lançamento são mantidos em todos os casos. Uma PENDING nunca é liquidada
  por pagamento: ela é da fatura aberta. Só se segue o cartão que o banco respondeu nesta leitura,
  para uma falha parcial não apagar compras.
- **O cartão começa no último fechamento** (pedido do dono, 2026-10-01, PRD v7.50). Vinculado em
  29/09, o cartão deixava de fora 3 compras de 25 e 26/09 da fatura que fechou em 08/09 e ainda
  estava aberta. O pagamento dela liquidaria só parte das compras, e o DRE do mês do pagamento
  ficaria abaixo do que saiu da conta. Agora o vínculo de um cartão grava `linkedOn` = o último
  `billClosingDate` até hoje (`cardImportStart`); sem fechamento informado, vale o dia do vínculo.
  É o dia do fechamento, e não o seguinte, porque o dono disse "melhor data de compra é 8/10 e o
  vencimento é 15": a compra do dia do fechamento já é da fatura seguinte. Os dois cartões já
  vinculados foram trazidos para 08/09 e 05/09. Conta corrente e investimento continuam no dia do
  vínculo.
- **A compra PENDING fica no vencimento projetado** (2026-10-01). Como a fatura aberta não existe
  no banco, `projectedDueDate` a deduz da última fatura fechada: fechamento + N meses até passar a
  data da compra, vencimento + os mesmos N meses. Medido: as 5 compras de 25 a 30/09 saíram de
  setembro e foram para 15/10. Quando a fatura fecha, a fase 0b troca pela data real do banco.
- **A fatura aberta só chega inteira quando fecha** (medido em 2026-10-01). Enquanto a fatura está
  aberta, o Open Finance entrega só as compras dos **últimos 7 dias** ("Fetches the last 7 days of
  transactions", docs.pluggy.ai, "Credit Card Installments"; "open bills are not returned until the
  bills are closed or overdue", "Considerations & FAQ"). Conectado em 29/09, o cartão trouxe
  pendentes só de 25/09 em diante: as compras de 09/09 a 24/09 somam ~69% da fatura aberta e
  nunca passaram pela Pluggy. Elas chegam POSTED, com `billId`, quando a fatura fecha, e entram
  como compras novas (são de depois do `linkedOn`). Daí em diante, a atualização diária do Meu
  Pluggy captura cada compra dentro da janela de 7 dias, e a fatura aberta fica completa no
  Bigorna antes de fechar. O "saldo" do cartão na Pluggy é o limite usado (limite − disponível),
  não o total da fatura. Medido também: a conexão foi criada em 29/09 às 20:51, então as compras de
  09/09 a 24/09 nunca passaram pela Pluggy. Consequência para a fase 0b: uma compra pendente com
  mais de 7 dias (`RECENT_CARD_WINDOW_DAYS`) que some do retrato **não** é apagada, porque saiu da
  janela, não foi cancelada; ela volta POSTED no fechamento e herda o lançamento e a categoria.
  Ainda não foi medido se a Pluggy mantém a pendente depois dos 7 dias: a guarda vale nos dois
  casos.
- **A sincronização automática pode ser desligada** (pedido do dono, 2026-10-01, PRD v7.51). A
  preferência mora em `open_finance_settings.auto_sync`; sem linha, vale ligada, como era antes. Com
  ela desligada, `POST /sync` sem `force` responde `Paused` sem ler o banco, e `PUT
/open-finance/auto-sync` liga ou desliga. O §6 continua valendo para o "Sincronizar agora" (`force`),
  que é a pessoa pedindo.

## Emenda: Pago manual numa conta vinculada (2026-10-09)

A trava do §3 deixa de valer para despesa, receita e IR — lançados como Pagos, editados para
Pago ou confirmados no "Confirmar" do DRE e da Revisão de Recorrentes. Continua valendo para o
gasto de Consumo Livre lançado à mão com a conta de origem vinculada (P48) e para o saldo da
posição vinculada.

**Por quê, com a medição.** Em 2026-10-09 os 32 Previstos de outubro do dono estavam todos em
contas vinculadas, e todo "Confirmar" era recusado com 409; o diálogo ainda escondia o motivo
("Tente novamente"). Por algumas horas a tela trocou o botão por "Aguardando o banco" (PRD v7.67);
o dono reverteu: "deixa eu marcar como pago". Um Previsto cujo valor real difere do planejado
(P49 exige o mesmo valor) nunca seria pago pelo banco.

**O que impede a contagem dupla.** A sincronização inclui entre os candidatos que a transação
pode pagar (`importState`, `src/api/open-finance.ts`) os lançamentos **Pagos à mão ainda não
ligados a nenhuma transação**, pela mesma regra do Previsto (P49: mesma conta, mesmo valor, até 5
dias). Ao casar, o lançamento passa a ter a data e o valor do banco, e o registro da transação
aponta para ele. Medido no teste da rota: sem o casamento, a sincronização deixava dois
lançamentos do mesmo gasto; com ele, um.

**O risco que fica.** Um Pago manual com valor diferente do que o banco lançar não casa, e a
transação entra como outro lançamento em "A categorizar". A pessoa vê os dois lado a lado e
descarta um.

## Emenda: "Vincular ao banco" (2026-10-09)

Quando o casamento automático não liga um lançamento feito à mão à transação que o pagou (valor ou
data fora da regra do P49), a pessoa liga à mão. As candidatas vêm de uma regra pura do domínio
(`bankLinkCandidates`, `src/domain/open-finance/rules.ts`): transações que viraram lançamento
próprio, numa conta do provedor vinculada à mesma Conta Bancária, no mesmo sentido e até
`BANK_LINK_WINDOW_DAYS` (15) de distância. Ao ligar (`POST /entries/{id}/bank-link`), o lançamento
recebe o valor e a data do banco e fica Pago, o duplicado é apagado e o registro passa a apontar
para ele (`ImportedTransactionWriter.relink`, gravado como `PayPlanned` e `categorizedByPerson`,
para o "Reimportar" preservar). O §3 continua: o banco é a testemunha — aqui a pessoa só diz qual
transação testemunha qual lançamento.

## Emenda: o extrato do mês para o "Caixa do mês" (2026-10-09)

`GET /open-finance/month-movement` lê do provedor, sob demanda (§6), as transações do mês de cada
conta vinculada a uma Conta Bancária e devolve entradas − saídas por conta. O Bigorna guarda só o
saldo atual de cada conta (`BankAccount.balance`); o saldo do dia 1º sai do extrato, sem gravar
histórico novo. O cartão não entra: compra no cartão não move a conta corrente.
