# Roteiro de Teste de Usabilidade — Finanças PF + PJ

As 33 ações a observar numa sessão de teste, e por onde cada uma se faz.

> **Mudou de propósito em 2026-09-11.** Este documento era o roteiro para montar um protótipo
> clicável no Figma (aba Prototype). O app foi construído e está sendo testado por uma pessoa de
> verdade — e o app é mais fiel do que qualquer protótipo, porque é ele que a pessoa vai usar. A
> **Parte 1** (as 33 ações) ficou como estava, que é o que o teste observa. A **Parte 2** deixou de
> descrever ligações de overlay entre frames e passa a dar a rota real de cada ação: URL, o que
> clicar, o que abre.
>
> Quem conduz o teste **não deve ditar o caminho** — ele está aqui para o condutor saber se a pessoa
> chegou ou não, não para ser lido em voz alta. Achar o caminho é metade do que o teste mede.

---

## Parte 1 — Ações a prototipar

### A. Primeiro acesso
1. Abrir o app pela primeira vez → Onboarding completo → chegar na Home

### B. Lançar dinheiro
2. Criar uma Despesa
3. Criar uma Receita
4. Criar um Pró-labore/Distribuição
5. Lançar um IR

### C. Consumo Livre
6. Configurar o Consumo Livre pela primeira vez
7. Registrar um gasto rápido ("Gastei um valor")
8. Ver o detalhe/histórico do Consumo Livre

### D. Revisar o mês
9. Marcar uma recorrência como paga
10. Editar o valor de uma recorrência
11. Descartar uma ocorrência do mês

### E. Consultar relatórios
12. Ver o DRE do mês (e navegar pra um mês passado/futuro)
13. Trocar a visão Consolidado/PF/PJ
14. Ver o Balanço Patrimonial
15. Ver a Evolução Mensal
16. Ver os Indicadores Financeiros

### F. Destinar dinheiro
17. Destinar o Lucro do mês (distribuir entre os 4 baldes)
18. Redirecionar saldo de um bloco em "Onde Está Meu Dinheiro"

### G. Ver o que compõe um número
19. Clicar numa categoria de despesa e ver o detalhe
20. Clicar numa linha de Entradas e Saídas e ver o detalhe

### H. Cadastrar patrimônio
21. Cadastrar uma conta bancária
22. Cadastrar um bem material
23. Vender um bem material e direcionar o valor da venda
24. Cadastrar um investimento
25. Cadastrar um passivo (dívida)

### I. Acompanhar uma dívida
26. Abrir o detalhe de um passivo (ver parcelas, evolução, histórico)
27. Marcar uma parcela como paga
28. Registrar um reajuste de juros

### J. Organizar a Home
29. Entrar no modo de organização
30. Reordenar um card (arrastar)
31. Minimizar um card
32. Maximizar um card já minimizado

### K. Consultar histórico
33. Buscar/filtrar um lançamento no Histórico

---

## Parte 2 — Onde cada ação se faz no app

Rotas e rótulos conferidos no código em 2026-09-11. **Modal é modal de verdade**: abre sobre a tela
em que a pessoa estava, e o "←" do topo fecha voltando para ela — não é rota nova, e a tela de trás
continua visível. É o mesmo comportamento que o Figma desenha com o recorte da página de fundo
(`files_design/07`, regra 10).

### A. Primeiro acesso

1. **Abrir o app pela primeira vez** — `/onboarding`
   → "Começar agora" leva a `/onboarding/plano-de-contas`, e daí `/onboarding/contas-bancarias`,
   `/onboarding/bens-materiais`, `/onboarding/investimentos`, `/onboarding/passivos`
   → "Concluir" leva a `/inicio`
   _Rota alternativa:_ "Fazer depois" no `/onboarding` vai direto para `/inicio`.
   Com base vazia, `/` redireciona para `/onboarding`; com dados, para `/inicio`.

### B. Lançar dinheiro

2–5. **Despesa · Receita · Pró-labore/Distribuição · IR** — `/novo-lancamento`
   Uma tela só, com as quatro abas nessa ordem. A pessoa chega por "+ Novo Lançamento" na barra
   lateral, de qualquer tela. "Salvar Lançamento" fecha e volta.

### C. Consumo Livre

6. **Configurar pela primeira vez** — `/inicio`, botão "Configurar Consumo Livre" no card → modal.
7. **Gasto rápido** — `/inicio`, botão "Gastei um valor" no card → modal que pede só o valor.
8. **Detalhe/histórico** — `/inicio`, clique no card fora dos botões → modal com o histórico do mês.

### D. Revisar o mês

9–11. **Marcar paga · Editar valor · Descartar ocorrência** — `/revisao-de-recorrentes`
   As três são ações na própria linha. "Marcar Pago" e "Editar" abrem diálogo; "Descartar" pede
   confirmação e a linha sai da lista.

### E. Consultar relatórios

12. **DRE** — `/dre`. As setas ← → ao lado do mês navegam de verdade; mês futuro mostra projeção.
13. **Trocar a visão** — dentro de qualquer relatório, o seletor Consolidado/PF/PJ. Ele **lembra a
    última escolha** entre telas.
14. **Balanço Patrimonial** — `/balanco-patrimonial`. Sem seletor de mês, de propósito: é foto do
    momento.
15. **Evolução Mensal** — `/evolucao-mensal`. Últimos 6 meses / Último ano, sem seletor de mês.
16. **Indicadores Financeiros** — `/indicadores-financeiros`.

### F. Destinar dinheiro

17. **Destinar o Lucro** — `/dre`, botão "Destinar este Lucro" → modal sobre o DRE. Com prejuízo no
    mês o botão não aparece, e o card diz por quê.
18. **Redirecionar saldo de um bloco** — `/inicio`, clique num bloco de "Onde Está Meu Dinheiro"
    → modal do bloco, com o campo de redirecionar.

### G. Ver o que compõe um número

19. **Categoria de despesa** — `/inicio`, clique num bloco de "Despesas por Categoria" → modal com
    os lançamentos do mês e um formulário rápido de gasto. **Exceção:** o bloco Consumo Livre abre o
    painel do próprio widget, nunca o formulário. **Da sétima categoria em diante** os gastos entram
    num bloco "Outras", que abre a soma do que agregou.
20. **Linha de Entradas e Saídas** — `/inicio`, clique numa linha do card → modal "Detalhe do
    Fluxo", só consulta.
    _Envelheceu duas vezes:_ a ação dizia "clicar num bloco do Mapa de Fluxo". O card mudou de nome
    na v7 do PRD **e** perdeu o diagrama Sankey — hoje é uma tabela de duas colunas, então não há
    bloco para clicar, há linha.

### H. Cadastrar patrimônio

21. **Conta bancária** — `/contas-bancarias`, formulário → "Adicionar conta bancária".
22. **Bem material** — `/bens-materiais`, formulário → "Adicionar bem material".
23. **Vender um bem e direcionar o valor** — `/bens-materiais`, "Vender" na linha → modal.
    Dentro dele, "+ Adicionar Direcionamento" abre um sub-formulário **empilhado sobre o modal**.
    Nada é gravado até "Confirmar Venda": a lista de direcionamentos é rascunho até ali.
24. **Investimento** — `/investimentos`.
25. **Passivo** — `/passivos`, formulário completo. O cadastro **já gera o cronograma de parcelas**.

### I. Acompanhar uma dívida

26. **Detalhe do passivo** — `/passivos`, "Analisar" na linha → `/passivos/{id}` (rota, não modal).
27. **Marcar parcela paga** — dentro do detalhe, card "Parcelas", botão "Marcar Paga" na linha
    Prevista; na linha já paga o botão é "Editar".
28. **Reajuste de juros** — dentro do detalhe, "Registrar reajuste de juros" → modal. O recálculo é
    **prospectivo**: parcela já paga não muda.

### J. Organizar a Home

29. **Entrar no modo de organização** — `/inicio`, botão "Organizar Home".
30. **Reordenar** — arrastar pelo punho de arraste, **ou** pelos botões "Mover para cima" / "Mover
    para baixo", que existem para quem não usa arraste.
31–32. **Minimizar e maximizar** — no modo de organização, o card colapsa numa linha fina com
    título, legenda e "Maximizar". A ordem e o que está minimizado **persistem** entre visitas.

### K. Consultar histórico

33. **Buscar/filtrar** — `/historico`, sete filtros: Status, Entidade, Mês, Categoria,
    Classificação, Conta e Recorrência. Vindo do ícone do card "Despesas por Categoria", a tela
    abre já filtrada pelo mês corrente (`/historico?mes=AAAA-MM`).

---

## O que observar, além de a pessoa conseguir

- **Onde ela procura antes de achar.** O caminho errado que ela tenta primeiro diz mais sobre o
  desenho do que o caminho certo que ela acha depois.
- **O que ela chama as coisas.** Se ela disser "transação", "painel" ou "ativos", o vocabulário
  fechado em `files_design/04` não está passando para a tela.
- **Onde ela hesita sem errar.** Hesitação sem erro não aparece em nenhuma métrica de sucesso e é
  onde o desenho custa caro.
- **O que ela não tenta.** Ação que ninguém tentou pode não estar descoberta — e uma ação
  descoberta por ninguém é igual a uma ação que não existe.
