# Sugestões para o Time de Produto — Controle Financeiro PF + PJ

> Ideias e observações que surgem durante o trabalho de design, mas que **tocam o modelo de domínio ou o escopo do PRD** — não são decisões que o design pode tomar sozinho. Ficam registradas aqui para o time de produto avaliar, priorizar ou descartar. Este documento é vivo: novas entradas são adicionadas conforme aparecem.

> **Revisado em 2026-09-11, contra o que foi construído.** O produto saiu do papel desde que estas
> sugestões foram escritas, e uma sugestão que continua no presente depois de o mundo mudar vira
> ruído. Cada entrada ganhou uma linha de **Status** conferida no código e nas decisões registradas.
> Uma delas (a 5) teve a **premissa derrubada por medição** — está marcada como tal, e o texto
> original ficou, porque o que foi pedido continua legítimo mesmo quando o caminho proposto não é.

---

## 1. Período financeiro customizável (não calendário)

**Status (2026-09-11): em aberto, intacta.** O regime de caixa por mês calendário continua como o PRD escreveu e como o `CLAUDE.md` §3 repete. Nada foi construído que aproxime ou afaste esta ideia.

**Data:** sessão de wireframes, desktop
**Contexto:** ao revisar a tela de Revisão de Recorrentes ("Julho de 2026")

**Observação:** a organização financeira pessoal (PF e PJ) frequentemente não segue o mês calendário. Um exemplo comum: a pessoa organiza as finanças em torno da data de fechamento da fatura do cartão de crédito (ex.: um período de 26 de um mês a 25 do mês seguinte), não do dia 1 ao último dia do mês.

**Situação atual no PRD:** o regime de caixa é definido explicitamente por **mês calendário**, a partir da data de pagamento informada:

> "o mês contábil de cada lançamento é o mês da data de pagamento informada pela pessoa (padrão: mês corrente)... Não há regime de competência paralelo."

**Por que isso não é uma decisão de design:** essa regra sustenta outras peças já definidas no domínio — a "virada de mês" que aciona o motor de recorrência, a cascata do DRE, o conceito de "mês fechado" (automático, por calendário). Introduzir um período customizável (não alinhado ao calendário) é uma **mudança de modelo de domínio**, não um ajuste de interface.

**Sugestão para avaliação futura:** permitir que a pessoa defina um "dia de início do período financeiro" (ex.: dia 26), e o sistema passaria a agrupar lançamentos, gerar recorrências e fechar relatórios com base nesse período customizado, em vez do mês calendário fixo. Possível evolução pós-MVP — impacta as regras H3 (regime de caixa) e H4 (motor de recorrência) do Event Storming.

---

## 2. Capturar receitas/despesas recorrentes já no onboarding

**Status (2026-09-11): em aberto, intacta.** Conferido nas rotas: o onboarding tem a tela 0 mais cinco passos — Plano de Contas, Contas Bancárias, Bens Materiais, Investimentos e Passivos. Nenhum deles toca Recorrência, exatamente como a arquitetura definiu.

**Data:** revisão de wireframes, tela "Onboarding 1 — Plano de Contas"
**Contexto:** ao revisar onde entram valores como salário (receita recorrente mensal)

**Observação:** hoje, receitas e despesas recorrentes (salário, aluguel, mensalidades fixas) só são configuradas na primeira vez que a pessoa as lança pelo fluxo normal de "Novo Lançamento", marcando a opção de recorrência — não fazem parte do onboarding. Isso pode fazer o onboarding parecer incompleto: a pessoa configura toda a estrutura (plano de contas, saldos, patrimônio) mas sai da configuração inicial sem ter registrado nem sua fonte de renda principal.

**Situação atual no PRD/arquitetura:** o Onboarding é definido explicitamente como uma orquestração de apenas dois contextos — **Configuração** (Plano de Contas) e **Patrimônio** (saldos iniciais). Os contextos **Lançamentos** e **Recorrência** são tratados como propositalmente separados, e não fazem parte do que o onboarding orquestra.

**Por que isso não é uma decisão de design:** ampliar o onboarding para incluir configuração de recorrências mudaria o escopo que a arquitetura já definiu para esse fluxo — misturaria contextos que foram deliberadamente mantidos à parte (Configuração/Patrimônio vs. Lançamentos/Recorrência).

**Sugestão para avaliação futura:** considerar um passo opcional (ex.: "Passo 6 — Receitas e despesas fixas", ou um convite dentro da Home logo após o onboarding) para a pessoa já cadastrar suas recorrências mais previsíveis (salário, aluguel, mensalidades) antes de cair no uso normal do produto, sem misturar isso com os passos de Configuração/Patrimônio já existentes.

---

## 3. Detecção de sinônimos na busca de categoria (evitar duplicatas)

**Status (2026-09-11): a mitigação está construída, mas é mais fraca do que este texto sugere; a
sugestão segue em aberto.** A linha "Categorias parecidas neste bloco" existe em
`src/components/patterns/category-field.tsx` e tem teste. **Medido:** o que ela lista são as **duas
primeiras categorias vivas do bloco em ordem alfabética** (`SIMILAR_LIMIT = 2`), não as parecidas —
o critério de "parecida" nunca foi decidido, e o próprio código nomeia isso como suposição. Na
prática, criando "Carro" em Despesas Administrativas ela mostra "Água, Aluguel moradia", e a
duplicata que existe ("Automóvel") não aparece. Ou seja: ela reduz a chance de duplicata por lembrar
a pessoa de olhar, não por encontrar o sinônimo. Dicionário de sinônimos ou busca semântica
continuam não decididos.

**Data:** revisão de wireframes, tela "Estado — Buscar/Criar Categoria (expandido)"
**Contexto:** ao testar a busca de categoria com termos como "carro" (quando já existe "Automóvel" cadastrado)

**Observação:** a busca de categoria hoje é por correspondência de texto simples. Termos sinônimos (carro/automóvel, pet/nome do bicho) não são reconhecidos como a mesma coisa, então a pessoa pode não encontrar uma categoria que já existe e acabar criando uma duplicata sem perceber.

**Por que isso não é uma decisão de design:** resolver isso de verdade exigiria um dicionário de sinônimos curado manualmente, ou busca semântica, ambos com custo de engenharia/manutenção que vai além do escopo de uma busca de categoria simples.

**Mitigação aplicada nesta sessão, sem esperar a solução completa:** ao não encontrar correspondência e a pessoa optar por criar uma categoria nova, a interface mostra um lembrete discreto com categorias parecidas já existentes no bloco (ex.: "Categorias parecidas neste bloco: Alimentação, Automóvel"), reduzindo a chance de duplicata sem resolver o problema de fato.

**Sugestão para avaliação futura:** avaliar um dicionário de sinônimos básico para categorias comuns, ou busca semântica, como evolução pós-MVP.

---

## 4. Redesign do Onde Está Meu Dinheiro: interação direta, visual, minimizando formulários

_(O título dizia "Mapa de Posição", o nome do card antes da v7 do PRD.)_

**Status (2026-09-11): construída, e o último item em aberto fechou.** O que está descrito abaixo como "decidido pra desenhar a seguir" foi desenhado, integrado na Home e **implementado no produto** — os dois treemaps, o widget de Consumo Livre e o editor de direcionamento reaproveitado (`allocation-editor.tsx`, usado também pelo modal de direcionar pendência). Ver a Especificação de Telas, seção Home, para o estado atual. Dos dois itens que ficaram "em aberto" no fim desta seção, o acabamento visual **foi feito**; sobra a regra automática de distribuição.

**Data:** conversa pós-reunião com produto, sobre tornar a aplicação "mais visual" e diferenciada de planilha
**Contexto:** produto pediu mais visual e interatividade; conversa também conectou um problema real identificado durante o design: hoje "escolher destino do dinheiro" está implementado 3 vezes, em lugares diferentes (Destinar o Lucro dentro do DRE, Direcionar valor dentro de Vender Bem Material), sem reaproveitamento.

### Implementado

**Dois treemaps interativos na Home**, cada um com blocos proporcionais ao valor (tamanho = importância), ícone de seta sinalizando "isso é clicável": **Despesas por Categoria** (gasto do mês por categoria, clicar abre detalhe + lançamento pré-preenchido) e **Onde Está Meu Dinheiro** (Contas, Investimentos, Dívidas — clicar permite redirecionar). Bens Materiais não entram no segundo, por não serem líquidos.

**Consumo Livre virou widget próprio** (não mais aba do Novo Lançamento), com 3 estados completos: configurar valor mensal, card com progresso + toque rápido "Gastei um valor", e detalhe com histórico/editar/redirecionar. Documentado em detalhe na Especificação de Telas e no Modelo de Dados.

**Componente único de redirecionamento**, reaproveitado a partir de vários gatilhos (clicar num bloco do treemap, Destinar o Lucro, Direcionar valor de venda) — resolve o problema original de "3 implementações separadas" que motivou essa conversa.

**Não implementado, e descartado deliberadamente:** a ideia de "Chegou Dinheiro, Distribuir Agora" (distribuir a receita no momento em que ela é lançada) foi cogitada e depois **descartada** — o dinheiro já cai na Conta escolhida no formulário normal, e o mapa interativo já permanente resolve a necessidade sem precisar de um momento especial. Ver Log de Decisões de UX para o raciocínio completo dessa reversão.

### Em aberto, para pensar depois

**Regra automática de distribuição** ("toda receita que entra, 20% pra reserva, 10% pra consumo livre..."). Ideia com potencial, mas a pessoa ficou insegura sobre como definir as categorias/percentuais — não avançar sem mais clareza.

**~~Acabamento visual de verdade~~ — FEITO.** Este item pedia "cores, ilustração, microanimação,
pra quando um designer visual de alta fidelidade pegar isso". Foi exatamente o que aconteceu: o
`files_design/07` fechou a camada visual (hierarquia de cor, tipografia, sistema de gráfico,
biblioteca de componentes e de ícones) e a página **Mockup** aplicou tudo isso nas telas de verdade,
em claro e escuro. A Mockup é hoje a fonte visual vigente (ADR-0015), e o produto foi construído a
partir dela.

**Regra automática de distribuição** ("toda receita que entra, 20% pra reserva, 10% pra consumo
livre...") **continua em aberto**, pelo mesmo motivo de então: a insegurança não era de desenho, era
sobre quais categorias e percentuais fariam sentido. Nada foi construído que responda isso.

---

## 5. Projeção de saldo acumulado futuro (Patrimônio Líquido ao longo dos meses)

**Status (2026-09-11): a pergunta continua legítima, mas o CAMINHO proposto caiu por medição.**

A sugestão propunha estender a Evolução Mensal para desenhar meses futuros na mesma linha, "usando
os mesmos dados que alimentam a projeção do DRE" — recorrências conhecidas e parcelas de passivo.
Ao fechar a P21 (ADR-0016) isso foi medido, e o resultado desmonta a premissa: **Lucro Líquido e
Patrimônio Líquido são grandezas independentes neste produto.**

Dos quatro componentes do PL, dois têm histórico (o saldo devedor de um passivo, porque as parcelas
têm data de pagamento; o bem material, porque `soldOn` diz quando ele saiu) e dois não têm — saldo
de conta e valor de investimento. E esses dois mudam **apenas** quando a pessoa os edita: pagar um
Lançamento não move saldo nenhum. Projetar o PL a partir do resultado projetado do DRE desenharia
uma linha que não descreve o patrimônio — descreveria o resultado, com nome de patrimônio.

**O que mudou a favor:** o PL dos meses PASSADOS deixou de ser reconstruído por dedução e passou a
ser gravado (tabela `net_worth_snapshots`, ADR-0016). A Evolução Mensal tem hoje uma série de PL
exata para trás, que é a metade do caminho que não dependia desta decisão.

**O que a pergunta exige, e não é um gráfico:** responder "quanto vou ter acumulado em 6 meses"
obriga a decidir **o que move o patrimônio ao longo do tempo** — algo que o produto hoje não modela,
porque saldo é um número que a pessoa mantém à mão, não uma consequência dos lançamentos. É mudança
de modelo de domínio, da mesma natureza da sugestão 1, e não extensão de tela.

_O texto original da sugestão fica abaixo, porque o que a usuária pediu continua de pé mesmo com o
caminho proposto invalidado._

**Data:** feedback direto de usuária testando o produto, junto com o pedido de projeção no DRE
**Contexto:** ela pediu duas coisas parecidas mas diferentes — "simular um valor futuro" (resolvido: ver Log de Decisões, DRE agora projeta mês futuro navegando o seletor) e "validar como vai ser meu saldo futuro" (**não resolvido**)

**Observação:** o DRE projetado responde "qual vai ser meu resultado **naquele mês**", mas não responde "quanto vou **ter acumulado** depois de 3, 6, 12 meses". São perguntas diferentes — resultado mensal vs. patrimônio acumulado.

**Situação atual:** não existe hoje nenhuma tela que projete Patrimônio Líquido pra frente. Balanço Patrimonial e Onde Está Meu Dinheiro mostram só o presente (decisão deliberada). Evolução Mensal mostra só histórico (passado). O único precedente de projeção pra frente que já existe é a Evolução da Dívida, dentro de Detalhe do Passivo — mas essa é escopada a uma dívida só, não ao patrimônio inteiro.

**Sugestão para avaliação futura:** estender a Evolução Mensal para também desenhar meses futuros na mesma linha do gráfico (passado real → futuro projetado), usando os mesmos dados agora disponíveis (recorrências conhecidas + parcelas de passivo) que alimentam a projeção do DRE. Não decidido ainda se entra no MVP ou fica pra depois.

---

## 6. Área própria de "Cartão de Crédito" (unificar lançamentos + fatura)

**Status (2026-09-11): em aberto, intacta.** Continua sendo reversão da H9, não lacuna, e nada construído desde então mudou isso — despesa no crédito segue sendo Despesa com Status Previsto até a fatura ser paga, e o Passivo "Cartão de Crédito" segue sendo cadastro separado.

**Data:** conversa sobre como funciona pagar uma despesa no cartão de crédito
**Contexto:** dúvida sobre se lançar uma despesa no crédito e separadamente manter um Passivo "Cartão de Crédito" gera duplicação

**Observação:** hoje, compra no crédito (à vista ou parcelada) é só uma Despesa comum com Status Previsto até a fatura ser paga — mecanismo que já existe e resolve o caso comum (quem paga a fatura inteira todo mês). O Passivo "Cartão de Crédito" é um cadastro manual separado, pensado pra quem carrega saldo devedor com juros — as duas coisas não se conectam automaticamente.

**Ideia levantada:** criar uma área própria de "Cartão de Crédito" que mostre a fatura como uma unidade, onde a pessoa lança direto na fatura (não como Despesa solta), separando lançamentos de crédito dos de débito/pix, com cards visuais no dashboard.

**Por que isso não é uma lacuna, é reversão de decisão:** o Event Storming já resolveu esse ponto explicitamente (H9, marcado ✅): "DRE e passivos são planos distintos... registrar uma despesa não constrói nem baixa automaticamente um passivo... por isso não há dupla contagem." A ideia da área de Cartão de Crédito uniria esses dois planos — o oposto do que foi decidido, não um preenchimento de lacuna.

**Sugestão para avaliação futura:** vale validar com o time de produto se o mecanismo atual (Despesa + Status Previsto/Pago) já resolve bem o caso de uso real, ou se há um cenário concreto de duplicação que ele não cobre, antes de reverter uma decisão já fechada em Event Storming.

---

## 7. Faixas de referência (bom/ruim) nos Indicadores Financeiros

**Status (2026-09-11): RESPONDIDA — a faixa foi recusada, e a necessidade por trás dela foi
atendida de outro jeito.**

**A faixa não entra.** O limiar é conteúdo financeiro: varia por literatura, por perfil de risco e
por entidade, e nada disso está no PRD nem no domínio — escolher um número aqui seria o design
inventando conteúdo financeiro. E há um impedimento mais duro que a preferência: **vários dos 18 não
têm referência universal possível.** "Custo de vida mensal" é um valor em reais; "Crescimento do PL
(mês)" e "Crescimento dos investimentos (mês)" dependem inteiramente da fase de vida de quem lê.
Uma faixa aplicada a uns e não a outros criaria a pergunta "por que esse não tem?", que é pior que
a ausência uniforme. O PRD segue proibindo faixa e cor de julgamento.

**O que a pessoa precisava continuava real:** ver o número sem saber o que ele é. Isso se resolve
**explicando**, não sentenciando. Cada um dos 18 ganhou um "i" de ajuda com uma frase que diz o que
o número é — a fórmula em português —, no mesmo `InfoTooltip` que o Novo Lançamento já usa nos campos
cuja opção não é auto-explicativa.

> Liquidez corrente ⓘ 7,0x — _"Quantas vezes o que você tem disponível cobre o que você deve no
> curto prazo."_

Diz o que 7,0x **é**. Não diz se 7,0x é bom. A diferença é a decisão inteira.

Travado por dois testes de domínio: nenhuma definição pode ficar sem ajuda (um indicador novo com
"i" mudo quebra o portão) e nenhuma frase pode conter "saudável", "recomendado", "ideal", "ruim" ou
"preocupa"

**Data:** ao fechar a pendência de handoff do catálogo e formato dos Indicadores Financeiros (doc08, seção 10)
**Contexto:** a tela mostra 18 indicadores (Margem líquida, Liquidez corrente, Reserva de emergência etc.), cada um só com o valor calculado, sem nenhuma indicação de se aquele número é bom, ruim ou neutro.

**Observação:** indicadores financeiros costumam vir acompanhados de uma referência (ex.: "liquidez corrente saudável é acima de 1,5", "reserva de emergência recomendada é de 6 meses de custo de vida"). Sem isso, a pessoa vê o número mas não sabe se deveria se preocupar ou não — precisa de conhecimento financeiro prévio pra interpretar.

**Por que isso não é uma decisão de design:** os limiares de referência variam por literatura financeira, por perfil de risco e às vezes por contexto (PF vs. PJ, entidade com dívida de longo prazo vs. sem dívida). Não existe um valor "certo" único, e nenhum desses limiares está no PRD nem no modelo de domínio — decidir um número aqui seria o design inventando conteúdo financeiro, não preenchendo uma lacuna de interface. Também esbarra no princípio já estabelecido do produto de não usar cor de julgamento (vermelho/verde) em nenhum lugar — se uma faixa de referência for adicionada, precisaria de um jeito de comunicar "dentro/fora da faixa" sem cor, o que é uma decisão de sistema, não pontual.

**Sugestão para avaliação futura:** se o time de produto validar que faz sentido, definir (com uma fonte confiável, ex. um educador financeiro ou referência de mercado) os limiares de cada indicador, e decidir junto com design como comunicar isso sem cor de alerta — ex. um texto de apoio abaixo do valor ("referência: acima de 1,5"), não preenchimento visual da linha.

---

*(Próximas entradas serão adicionadas aqui conforme surgirem.)*
