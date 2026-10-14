# A história por trás do nome · The story behind the name

> Uma bigorna não bate. Ela sustenta. É a única peça da forja que não muda de
> forma enquanto tudo o mais muda.
>
> An anvil doesn't strike. It holds. It is the one piece of the forge that
> keeps its shape while everything else changes.

## 🇧🇷 Português

Bigorna é o bloco de ferro sobre o qual o metal é trabalhado. Ela não é a
ferramenta que bate — quem bate é o martelo. Ela não é o que se transforma —
quem se transforma é o metal. A bigorna é a peça que não pode ceder. Se ceder,
cada golpe produz um resultado diferente, e nada do que sai da forja é
confiável.

Este produto nasceu para substituir uma planilha (`Meu DRE.xlsx`), e o problema
registrado no PRD não é falta de dado: é a fricção de lançar e o fechamento
mensal calculado à mão, aba por aba, com risco de erro e retrabalho. Quando a
conta é refeita na mão todo mês, a resposta passa a depender de quem a fez e de
quando. Não há base. É essa base que falta, e é o nome dela que o projeto
carrega.

Aqui, **os lançamentos são a bigorna**. Um lançamento é um fato: um valor, uma
data de pagamento, uma entidade (PF ou PJ), uma categoria. Registrado uma vez,
ele não muda de forma conforme a pergunta.

**Os relatórios são o que se molda em cima.** DRE, Balanço Patrimonial,
Evolução Mensal e Indicadores Financeiros são leituras derivadas, recalculadas
a qualquer momento a partir dos mesmos lançamentos pagos. Nenhum deles é fonte
da verdade. Todos são metal quente.

A metáfora só vale porque tem consequência no código. O mesmo lançamento
aparece nas três visões do DRE (consolidado, PF e PJ) sem nunca ser duplicado:
o que muda é a projeção, não o fato. Valor monetário é inteiro de centavos,
nunca ponto flutuante, porque uma base que arredonda não é base. E o domínio
não importa framework — o ESLint recusa o import —, para que trocar a tela ou o
banco não deforme a regra.

Um controle financeiro bom não é o que desenha o gráfico mais bonito. É o que
ainda dá a mesma resposta seis meses depois, quando a pergunta muda.

## 🇬🇧 English

_Bigorna_ is Portuguese for anvil: the iron block on which metal is worked. It
is not the tool that strikes — the hammer strikes. It is not what gets
reshaped — the metal does. The anvil is the piece that cannot give way. If it
gives way, every blow yields a different result, and nothing that leaves the
forge can be trusted.

This product was born to replace a spreadsheet (`Meu DRE.xlsx`), and the problem
recorded in the PRD is not missing data: it is the friction of entering records
and a monthly close computed by hand, tab by tab, with the risk of error and
rework that comes with it. When the arithmetic is redone by hand every month,
the answer starts to depend on who did it and when. There is no base. That base
is what was missing, and its name is what the project carries.

Here, **the entries are the anvil**. An entry (_lançamento_) is a fact: an
amount, a payment date, an entity (PF or PJ), a category. Recorded once, it does
not change shape according to the question being asked.

**The reports are what gets shaped on top.** The income statement (DRE), the
balance sheet, the monthly evolution and the financial indicators are derived
readings, recomputed at any moment from the same paid entries. None of them is
the source of truth. All of them are hot metal.

The metaphor only earns its place because it has consequences in the code. The
same entry appears in all three views of the DRE (consolidated, PF and PJ) and
is never duplicated: what changes is the projection, not the fact. Money is
always an integer number of cents, never floating point, because a base that
rounds is not a base. And the domain imports no framework — ESLint rejects the
import — so that swapping the screen or the database cannot deform the rule.

A good financial system is not the one that draws the prettiest chart. It is the
one that still gives the same answer six months later, when the question
changes.
