# Glossário de Nomenclatura — Controle Financeiro PF + PJ

> Todo nome de tela, atalho e conceito de interface fechado nesta sessão, com a razão da escolha. Objetivo: evitar que alguém renomeie algo sem saber que já foi pensado — e dar ao time uma referência única de vocabulário de produto.

**Princípio geral:** nomes devem ser **literais e explícitos**. A pessoa usuária precisa ler o rótulo e saber exatamente o que vai encontrar, sem decodificar metáfora ou termo "convidativo".

---

## Telas principais

| Nome final | O que é | Por que esse nome |
|---|---|---|
| **Bigorna** | Nome do produto: a marca na barra lateral (ao lado do logo, uma bigorna de ferreiro) e o título da aba do navegador | Decisão do dono em 2026-10-01. É o nome do repositório e do produto desde o início; "Finanças PF+PJ", que a Mockup escrevia na marca, descrevia o produto em vez de nomeá-lo. O título da aba é só "Bigorna", sem subtítulo |
| **Home** | Tela-hub de entrada, pós-onboarding | Termo neutro; não existe no PRD (que usa "Painel" para outra coisa) — criado para não colidir com o nome do relatório |
| **Onboarding** | As 5 telas de primeiro uso (Plano de Contas + 4 saldos) | Termo técnico já usado internamente; não é exposto à pessoa usuária como rótulo de tela |
| **Novo Lançamento** | Formulário único de lançar despesa/receita/pró-labore e distribuição/IR | "Lançamento" é o termo que o próprio domínio usa em todo o resto do produto (Histórico de lançamentos, agregado Lançamento); "transação", usado inicialmente, era um sinônimo fora do vocabulário do produto. *(Consumo Livre não é mais aba aqui — virou widget próprio na Home, ver "Consumo Livre" abaixo.)* |
| **Revisão de Recorrentes** | Checklist mensal de ocorrências recorrentes geradas automaticamente | Nome técnico e literal; "Checklist do mês" foi cogitado e descartado por ser "convidativo" demais, menos explícito sobre o que está sendo revisado |
| **Histórico** | Lista filtrável de todos os lançamentos | Termo direto, sem ambiguidade |
| **Relatórios** | Categoria/título que agrupa os 4 relatórios abaixo | É título, não botão de ação |
| **Plano de Contas e Patrimônio** | Acesso pós-onboarding às 5 seções de configuração, agora sempre visíveis na barra lateral (não mais "editar cadastros") | Renomeado duas vezes: primeiro de "Editar cadastros" (remetia a dados pessoais de conta de usuário) para "Editar Plano de Contas e Patrimônio"; depois o "Editar" foi removido porque a seção passou a guardar informação visível de análise (não só edição), especialmente após a expansão de Passivos |
| **Bens Materiais** (era "Ativos") | Categoria de imóvel, veículo, equipamento no onboarding e em Plano de Contas e Patrimônio | "Ativos" colidia com o termo contábil amplo já usado no Balanço Patrimonial (onde "Ativo" inclui tudo: contas, investimentos, bens materiais). "Bens Materiais" desambigua, descrevendo especificamente bens físicos |
| **Destinar o Lucro** | Tela de divisão do lucro líquido do mês em 4 categorias | Ação literal — "destinar" é o próprio verbo usado no PRD |
| **Pró-labore e Distribuição** | Aba do Novo Lançamento para as duas transações entre PJ e PF | Nome anterior "Intercompany" era jargão de finanças corporativas; renomeado a pedido do time de produto para nomear o conteúdo exato (os dois únicos sub-tipos existentes), em vez de um termo técnico ou uma notação direcional (ex.: "PJ → PF") |
| **Consumo Livre** | Widget da Home pra gasto variável do dia a dia, sem lançar item por item | Nome mantido sem sufixo extra ("mesada" foi cogitado internamente durante o design e descartado — não aparece em nenhuma tela) |
| **Onde Está Meu Dinheiro** | Treemap interativo da Home com Contas, Investimentos e Dívidas | Pergunta literal que o bloco responde; substitui o "Mapa de Posição" (versão em barra, descontinuada) |
| **Despesas por Categoria** | Treemap interativo da Home com o gasto do mês por categoria | Nome literal, descreve exatamente o conteúdo |
| **Entradas e Saídas** (era "Mapa de Fluxo") | Tabela de duas colunas na Home: de onde veio e pra onde foi o dinheiro no mês | O nome antigo descrevia um **diagrama** Sankey que a v7 removeu por inteiro (doc07, regras 24-26). Sem o diagrama, "Mapa" não descrevia mais o conteúdo, e o nome mudou junto com ele. Não confundir com "Evolução Mensal" (relatório histórico) |
| **Organizar Home** | Botão que ativa o modo de reordenar/minimizar cards da Home | Nome literal; "Personalizar" e "Editar" foram considerados e descartados por soarem mais vagos |
| **Analisar** | Botão que abre o Detalhe do Passivo, na lista de Passivos | Substituiu um link de texto solto ("clique para analisar") por um botão de verdade, consistente com o resto do produto |

---

## Relatórios (4 telas)

| Nome final | Nome anterior / origem | Por que esse nome |
|---|---|---|
| **DRE** | — (já era este nome no PRD) | Termo contábil padrão, reconhecível por quem entende de economia — mantido como está |
| **Balanço Patrimonial** | "Balanço" | Nome por extenso remove a ambiguidade de "balanço" no uso coloquial (ex.: "fazer um balanço de algo") |
| **Evolução Mensal** | "Painel" (nome da aba na planilha de origem, `Meu DRE.xlsx`) | "Painel" não é termo técnico — só o nome legado da aba de origem, não descreve o conteúdo (série histórica mês a mês). "Evolução Mensal" é literal |
| **Indicadores Financeiros** | "Indicadores" | Mais completo e preciso, mesmo sentido |

*Nota: o formato visual da Evolução Mensal (gráfico + tabela) ainda depende de definição de design mais detalhada; a decisão de conteúdo está fechada.*

---

## Ações e sub-elementos

| Nome final | Contexto | Observação |
|---|---|---|
| **Cartão de crédito** | Campo das abas Despesa e Receita do Novo Lançamento (na Receita desde 2026-10-09: um estorno pode entrar pelo cartão); ícone ao lado do nome no Histórico e no DRE; filtro "Cartão" do DRE | Sim/não: a despesa passou pelo cartão (ADR-0021). Só uma marca — não escolhe qual cartão. No filtro do DRE, encurtado para "Cartão" porque o contexto já é despesa. Ícone `icon/credit-card` pendente de design |
| **Contabilizar em** | Campo da aba Despesa do Novo Lançamento, depois da Data de pagamento | O mês em que a despesa entra nos relatórios, quando diferente do mês do pagamento (ADR-0021). Texto do dono; "Competência" foi evitado porque o PRD diz que não há regime de competência paralelo, e o campo é escolha por lançamento, não um segundo regime. Pendente de design |
| **Recorrentes** / **Cartão** | Filtros da barra de controles do DRE | Recalculam a cascata só com o que bate (2026-10-06). "Recorrentes" é o mesmo texto do filtro do Histórico. Pendente de design |
| **Exibir tudo** / **Recolher tudo** | Canto superior direito do card da cascata do DRE | Abre ou fecha todos os blocos e categorias de uma vez (2026-10-06). Pendente de design |
| **(+) Entradas** / **(−) Saídas** (com o total) e **Saldo** | Cabeçalhos recolhíveis e fim da tabela "Lançamentos deste mês" do DRE | Somas do que a tabela mostra, com filtro ou sem (2026-10-06). Os grupos começam fechados e o total fica no cabeçalho; "Total das entradas/saídas" como linha própria existiu por algumas horas no mesmo dia e saiu quando os grupos passaram a recolher. Pendente de design |
| **Descrição** | Campo do Novo Lançamento, abaixo das abas; linha secundária no DRE e no Histórico | O que o lançamento foi, em texto livre (PRD v7.47). Não confundir com o **Rótulo**, que só existe em IR e Consumo Livre porque ali não há Categoria. Pendente de design |
| **Classificar agora** / **O que foi esta transferência?** | Pendência de transferência entre PJ e PF | Opções: **Pró-labore**, **Distribuição de lucro**, **Aporte na PJ**, **Só transferência**. "Aporte na PJ" nomeia o dinheiro do sócio colocado na empresa; "Empréstimo" foi evitado, porque o produto não controla juros nem devolução. Pendente de design |
| **Verba: Valor fixo / Saldo da conta** | Configurar Consumo Livre | O limite do mês: um valor digitado, ou o saldo da conta de origem (2026-09-29). Pendente de design |
| **A categorizar** | Categoria de sistema do Plano de Contas; Pendência "N lançamentos a categorizar" | Onde chega o que vem do banco até a pessoa escolher a categoria (PRD v7.46). "Sem categoria" foi evitado: o lançamento TEM uma categoria, provisória, e o nome diz o que falta fazer. Pendente de design |
| **Categorizar agora** | Ação da Pendência "a categorizar" | Mesmo molde de verbo das outras ações de Pendência ("Direcionar agora", "Revisar agora", "Alocar agora"). Pendente de design |
| **Criar e vincular** | Card Open Finance (Contas Bancárias, Investimentos) | Cria o cadastro a partir da conta do banco e já o vincula. "Importar" foi evitado porque sugere trazer lançamentos, não criar a posição. Pendente de design (ADR-0020) |
| **Sincronizar agora** | Card Open Finance | Força a leitura do banco fora do intervalo de 6h (PRD P53). Pendente de design (ADR-0020) |
| **Lançar outro** / **Voltar** | Botões pós-salvamento do Novo Lançamento | Evitado "Sair", por soar como abandonar a tarefa |
| **Confirmar** / **Editar** / **Descartar** | Ações por item na Revisão de Recorrentes e na tabela "Lançamentos deste mês" do DRE | "Confirmar" substitui "Marcar Pago" (dono, 2026-10-06): "receitas não são pagas" — o verbo vale para despesa e receita. "Marcar como pago/recebido" e "Efetivar" foram considerados e descartados. "Descartar" ≠ "Encerrar recorrência" — o primeiro pula só 1 mês, o segundo para a série pra sempre. O "Marcar Paga" da parcela no Detalhe do Passivo não mudou: parcela é sempre dívida paga |
| **Desfazer** | Linha Paga/Recebida da tabela "Lançamentos deste mês" do DRE | Volta o lançamento a Previsto, com a data e o valor do pagamento (2026-10-06). Não aparece no que veio do banco. Par de "Confirmar". Pendente de design |
| **Vincular ao banco** | Lançamento feito à mão: "Lançamentos deste mês" do DRE, linha do Histórico e Editar Lançamento | Liga o lançamento à transação do Open Finance que o pagou, para não duplicar e ter a origem (2026-10-09). Depois de ligado, o Editar diz "Vinculado a uma transação do banco." Pendente de design |
| **Caixa do mês** / **Saldo hoje** / **Ainda previsto** / **Saldo previsto no fim do mês** | Card abaixo da cascata do DRE, no mês atual | Saldo em conta e previsão de caixa, fora do DRE (2026-10-09): o DRE é resultado, o saldo é patrimônio. Pendente de design |
| **Do início ao fim do mês** / **Saldo no início do mês** / **Fora do DRE** | Ponte no card "Caixa do mês" | Início + Lucro Líquido ± Fora do DRE = saldo previsto no fim (2026-10-09). "Fora do DRE" é o que mexeu no caixa sem ser resultado. Pendente de design |
| **Encerrar recorrência** | Ação dentro da edição completa de um lançamento recorrente | Termo distinto de "Descartar" para evitar confusão entre as duas ações |
| **Só este mês** / **Deste mês em diante (mantém os anteriores)** | Escolha do "Descartar" de uma ocorrência de recorrência (Revisão e DRE) | A segunda era "A série completa (encerra a recorrência)" até 2026-10-06; o efeito sempre foi encerrar a série na data deste mês sem tocar nos anteriores, e o nome sugeria apagar a série inteira (dono: "deste em diante e manter anteriores") |
| **Descartar** (lançamento) | Linha do Histórico e rodapé do Editar Lançamento (ADR-0019) | Mesmo verbo dos itens de cadastro, nunca "Excluir"/"Remover". Tira o lançamento; se ele é o pagamento de uma ocorrência, aquele mês fica descartado. "Encerrar a recorrência também" é escolha à parte na confirmação |
| **Ver previsão do mês** | Botão do DRE (PRD v7.40) | Cascata com pago + previsto somados. "Previsão" e não "Projeção" para não confundir com o "Previsto" do toggle, que continua exclusivo |
| **Editar Lançamento** | Título do Novo Lançamento em modo de edição | "Novo Lançamento" na edição era lido como criar um segundo lançamento |
| **Redirecionar valor** | Bloco de Onde Está Meu Dinheiro e Detalhe do Consumo Livre | Move valor entre duas coisas que a pessoa TEM (conta, investimento): uma encolhe, a outra cresce. É a **Transferência** do domínio (ADR-0017 §1) |
| **Direcionar valor** / **+ Adicionar Direcionamento** / **Direcionar agora** | Venda de Bem Material, Destinar o Lucro, sobra do Consumo Livre e a Pendência | Manda para um destino um valor que ACABOU de chegar — nada encolhe do outro lado. É o **Direcionamento** do domínio (ADR-0017 §1). Os dois verbos parecem sinônimos e não são: quem lê "redirecionar" deve esperar que algo saia de algum lugar |

---

## Conceitos que NÃO viraram nome de tela (para evitar confusão futura)

| Termo | Por que não é usado como rótulo de tela |
|---|---|
| "Painel" | Reservado no PRD para o relatório, agora renomeado para "Evolução Mensal" — não deve ser reutilizado como sinônimo de Home ou de qualquer outra tela |
| "Cadastro" | Evitado em qualquer rótulo — remete a dados pessoais de conta de usuário, o que não existe neste produto (sem login) |
| "Transação" | Substituído por "Lançamento" em toda a interface, para manter consistência com o domínio |
| "Mapa de Fluxo" | Nome do card até a v7 do PRD, quando ele era um diagrama Sankey. O diagrama foi removido e o card virou **Entradas e Saídas** — o nome antigo descreve um desenho que não existe mais |
| "Mapa de Posição" | Versão em barra, descontinuada, do que virou **Onde Está Meu Dinheiro** |
