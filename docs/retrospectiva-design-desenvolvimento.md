# Do Frame ao Código — retrospectiva design → desenvolvimento

> Uma leitura factual de onde a fidelidade ao desenho travou na implementação do Bigorna — e onde,
> na verdade, ela nunca travou.

**Fontes:** 22 commits (jul–set/2026) · `docs/PERGUNTAS-EM-ABERTO.md` · `files_design/02` e `/05`
· ADR-0011 e ADR-0015 · `docs/figma/frames/*.xml`

**Publicado também como Artifact (leitura mais confortável):**
https://claude.ai/code/artifact/9dca8f16-b390-4700-a389-2e56eedc873d

---

## Como isso foi montado

Nada aqui é impressão de leitura corrida do código — é o que ficou escrito nos commits de correção
(que citam o frame, o número medido e o teste que provou vermelho→verde) e nos documentos que já
existiam: o log de perguntas em aberto, o log de decisões de UX e as duas ADRs de tokens visuais.
Onde uma dedução foi necessária, ela está marcada como tal.

## O placar de uma auditoria

Commit `11ba07d`. Uma rodada de 140 agentes cruzou as 5 páginas do Figma com o código inteiro,
catalogando todo ponto onde a implementação dizia "o design não desenha isso".

| Métrica                     | Valor |
| --------------------------- | ----- |
| Pontos catalogados          | 69    |
| Tinham frame no Figma       | 66    |
| Corrigidos nesta rodada     | 58    |
| Eram lacuna real de desenho | 2     |

## O que funcionou

**Extrair os 130 frames como XML local.** `docs/figma/frames/*.xml` tirou o processo da
dependência do limite de chamadas da API do Figma — foi o que tornou possível uma auditoria de 140
agentes, que via API teria sido inviável.

**Notas de design dentro do próprio frame.** Nós como `164:2` ("cálculo automático de juros foi
escolha deliberada") e `44:88` registram o _porquê_ de uma decisão no lugar exato onde quem
implementa vai olhar — evitaram várias perguntas que, sem a nota, teriam virado suposição do dev.

**Separar "decisão de design" de "mudança de domínio".** `files_design/02` e `/05` registraram em
tempo real quando uma ideia esbarrava numa regra já fechada em vez de simplesmente ser
implementada — é o hábito que fez o processo funcionar quando funcionou.

## Onde causou retrabalho

### Padrão 01 — Duas páginas de fidelidade diferente, sem regra escrita de qual vence

O Wireframe (rascunho cinza — comportamento, fluxo, existência de estado) e o Mockup (visual
aprovado — geometria) discordavam, e por muito tempo não havia uma frase dizendo qual manda em
qual situação. A regra só foi escrita _depois_ do erro aparecer em produção.

> **ADR-0015 §1** — sidebar 278px → 272px · botão 43px → 44px · conteúdo 1066px → 1088px

### Padrão 02 — "O Figma não desenha isso" quase sempre era falso

Dos 69 pontos catalogados na auditoria, 66 tinham frame — só não estava na página que foi
consultada. Isso é sobretudo falha de processo de busca, não de desenho: mas um arquivo com 130
frames em 5 páginas sem índice central convida a essa falha.

> **commit** `11ba07d` — "implementa fiel ao Figma tudo que tinha sido inventado por 'não achei o
> frame'"

### Padrão 03 — Números inventados, travados por teste

`--width-dialog` (560px) e `--width-dialog-wide` (720px) não existiam em frame nenhum — e havia um
teste **verde** afirmando essas medidas como se fossem fato. Um teste verde protegendo um número
que ninguém desenhou é o pior tipo de dívida: parece certeza.

### Padrão 04 — O style guide chegou depois da primeira implementação

A primeira ADR de tokens foi escrita quando só existia o Wireframe cinza — cor e tipografia foram
_amostradas_ do rascunho. Só depois vieram os 38 tokens semânticos com contraste verificado nos
dois temas, e a primeira versão precisou ser inteiramente substituída.

> **ADR-0011** (amostragem) → substituída por **ADR-0015** (`files_design/07–08`)

### Padrão 05 — Estados de borda sem desenho — as lacunas reais

Regras de negócio decididas depois do desenho original não tinham campo, aviso ou controle
correspondente em nenhum frame: o campo "Conta do ganho/perda" na venda de um bem, a nota de
Patrimônio Líquido reconstruído, o toggle "renda passiva", o conteúdo do popover de editar no
Consumo Livre.

> **PERGUNTAS-EM-ABERTO** — `P33` · `P21` · `P22` · `P15b`

### Padrão 06 — Inconsistência de nome dentro do próprio arquivo

"Consumo Livre" (maiúsculo) aparece 151 vezes; "Consumo livre" aparece 1 vez, num único frame.
Precisou de uma contagem de nós para desempatar uma pergunta que não precisava existir.

> **PERGUNTAS-EM-ABERTO** — `P9`

## O padrão comum

> Só 2 dos ~70 problemas catalogados eram lacuna de desenho de verdade. O resto era desenho
> correto — só mal indexado, ou sem uma hierarquia escrita de qual página manda em qual tipo de
> decisão.
>
> — síntese, a partir do commit `11ba07d`

## Para a próxima vez

1. **Decida logo no início qual página manda em qual tipo de decisão.** Geometria por uma página,
   comportamento por outra — escrito no leia-primeiro antes da primeira tela, não depois do
   primeiro bug.
2. **Um índice por tela/estado, não só por frame.** "Tela X → frames Y, Z, notas W" evita que quem
   implementa desista de procurar cedo demais.
3. **Feche o style guide antes da primeira implementação visual.** Mesmo rascunhado — amostrar cor
   e tipografia de um wireframe cinza quase sempre precisa ser refeito depois.
4. **Regra de negócio nova entrando tarde é gatilho de revisão.** Quando o domínio muda, checar se
   isso introduziu um campo ou estado que a tela ainda não desenha — antes do dev topar com isso
   no meio da implementação.
5. **Consistência de texto dentro do próprio arquivo Figma.** Maiúsculas e nomes de categoria
   coerentes entre frames evitam perguntas em aberto que, no fundo, não são perguntas.

---

## Para você, sozinha, no próximo projeto

Tudo até aqui foi sobre design. Esta seção é diferente: é o playbook pra quando não houver mais um
dev entre você e o código — as práticas que, neste projeto, eram "problema do dev" viram, no
próximo, problema seu. Escrita como se fosse pra você mesma, no dia 1 do próximo projeto.

### Fase 0 — antes da primeira linha de design ou código

Este projeto seguiu uma sequência que funcionou de verdade — está registrada, passo a passo, em
`docs/loop-produto-playbook.md`: **brainstorming → PRD (regra em prosa) → Event Storming (regra
formal) → ADR (decisão técnica registrada) → Spec → implementação.** Comece o próximo projeto por
aí, nessa ordem, antes de abrir o Figma. O motivo de funcionar: cada etapa só existe pra resolver o
que a etapa anterior deixou em aberto — pular uma faz a próxima inventar respostas.

Duas coisas que vale fazer **antes** de precisar delas, porque neste projeto só foram feitas
**depois** de um susto:

- **Fixar a versão da ferramenta.** Uma bateria de testes travava com um erro grave (segfault) só
  sob Node 18 — que era a versão padrão do terminal — e ninguém tinha percebido, porque cada sessão
  usava a versão que já estava instalada. Só foi descoberto numa auditoria tardia (commit
  `965d7d5`). O projeto hoje já trava isso (`.nvmrc` + `"engines"` no `package.json`) — comece o
  próximo já travado, não depois de um teste falhar sem explicação.
- **Escrever a hierarquia de fontes cedo.** "Se o PRD e a especificação de tela discordarem, quem
  vence?" — essa pergunta só foi respondida por escrito depois de casos reais de conflito. Escreva
  a ordem de precedência no primeiro documento do projeto, não quando a dúvida já estiver custando
  retrabalho.

### Hábito 1 — commit é rede de segurança, não burocracia

O fato mais sério que encontrei no histórico inteiro: o primeiro commit real deste projeto
(`deb304f`) diz, literalmente, "projeto vive em `~/Desktop` (iCloud), **sem commit algum até
agora apesar de várias rodadas de trabalho** — este commit protege o estado atual contra
sincronização/perda acidental." Ou seja: várias sessões de trabalho de verdade aconteceram sem
nenhuma rede de segurança. Bastava um problema de sincronização do iCloud, ou um comando errado,
pra perder tudo.

E quase perdeu, depois: o commit `965d7d5` registra que "agentes do workflow rodaram `git reset
--hard HEAD` **seis vezes**, destruindo trabalho não commitado de rodadas anteriores desta mesma
sessão." Isso só foi possível porque o trabalho ainda não tinha sido commitado.

**Regra pro próximo projeto:** um commit pequeno, com o app ainda quebrado, vale mais do que
nenhum commit esperando "ficar pronto pra commitar". `git commit` é a única cópia de segurança que
sobrevive a um comando errado, uma sincronização de nuvem ruim ou uma sessão de IA que dá errado.

### Hábito 2 — sempre pergunte "isso foi visto vermelho antes de verde?"

A regra deste projeto era: teste primeiro, ver ele falhar, só depois escrever o código que faz ele
passar (TDD). Isso não é estética de programador — é o que impede a "afirmação disfarçada de
garantia": o caso real foi um teste **verde** afirmando que `--width-dialog` tinha 560px, quando
esse número não existia em frame nenhum do Figma. Um teste verde parece prova. Só é prova se
alguém viu ele vermelho primeiro.

**Pergunta pronta pra usar, sempre que uma correção for reportada como "pronta":** _"você viu esse
teste falhar antes de fazer ele passar?"_ Se a resposta for não, o teste protege uma suposição, não
um fato.

### Hábito 3 — fatos antes de dedução, sempre

Este é o princípio mais forte deste projeto (`CLAUDE.md` §7.1), e é também a sua ferramenta mais
poderosa trabalhando sozinha, mesmo sem saber programar: **uma explicação plausível não é um
diagnóstico.** Você não precisa saber ler código pra perguntar "isso foi medido, ou é um palpite
bem escrito?" — foi exatamente essa pergunta que, nesta própria conversa, trocou "aparece 404,
deve ser bug" por "tem um processo antigo preso na porta 3000, e o servidor novo subiu na 3001" —
fato, não suposição.

**Pergunta pronta:** _"isso você mediu, ou está deduzindo?"_ — e peça o print, o log, ou o comando
que prova.

### Hábito 4 — nomeie a dúvida, não resolva ela sozinha

`docs/PERGUNTAS-EM-ABERTO.md` — quase 40 perguntas registradas, cada uma com "o que foi assumido
hoje" e "o que muda se a resposta for outra" — é um dos maiores acertos deste projeto. Em vez de a
IA inventar uma resposta silenciosa quando uma fonte não dizia algo, ela escrevia a suposição num
lugar visível, revisável, e seguia em frente sem travar o trabalho.

**No próximo projeto, crie esse arquivo no primeiro dia**, não quando a primeira dúvida aparecer.
E leia ele de vez em quando — um documento de perguntas em aberto só funciona se alguém volta lá
pra responder.

### Hábito 5 — escopo consciente: adiar não é ignorar

Este projeto decidiu, deliberadamente, não construir login nesta fase (ADR-0008) — mas deixou o
"gancho" pronto: toda leitura de dado já passa por uma função (`getSession()`) que devolve um
identificador de usuário, mesmo sem autenticação real hoje. Trocar o "por dentro" dela na fase 2 —
ligar login de verdade — não vai exigir tocar em nenhuma tela.

**A lição não é "sempre construa tudo"** — é o oposto: dá pra adiar uma parte inteira do sistema
sem pagar o preço de reescrever tudo depois, **se** o ponto de encaixe for pensado agora. Antes de
adiar algo, pergunte: "o que eu preciso deixar pronto hoje pra não precisar reescrever quando isso
voltar?"

### Hábito 6 — dívida também se documenta, não se esconde

O projeto tem 11 vulnerabilidades conhecidas de dependências não corrigidas — e isso está
registrado, de propósito, com a tabela exata do que cada correção exigiria e por que não foi feita
agora (`P39`, commit `b921500`). Não é a mesma coisa que ignorar: é decidir conscientemente não
pagar aquele custo agora, e deixar a decisão visível pra quem vier depois (inclusive você mesma,
em 6 meses).

**No próximo projeto:** quando decidir não resolver algo agora, escreva **por que não** e **o que
custaria resolver depois** — não deixe a decisão implícita.

### Cuidado — trabalho em paralelo sem isolamento perde trabalho

Dois acidentes de processo, nenhum deles sobre design: (1) os seis `git reset --hard` do Hábito 1,
causados por múltiplos agentes de IA escrevendo na mesma árvore de trabalho ao mesmo tempo; (2) um
symlink de `node_modules` que vazou de um ambiente de trabalho isolado (worktree) pra dentro de um
commit e apagou as dependências reais do projeto no merge seguinte (commit `578e712`).

**Se no futuro você rodar tarefas de IA em paralelo no mesmo projeto**, pergunte explicitamente se
elas estão isoladas umas das outras (cada uma numa cópia própria da árvore de trabalho) — rodar
várias ao mesmo tempo sobre os mesmos arquivos é como pedir a duas pessoas pra editar o mesmo
documento do Word ao mesmo tempo, sem ninguém salvar: uma sempre apaga o trabalho da outra.

### Perguntas prontas pra usar no próximo projeto

Um resumo de bolso dos hábitos acima, pra colar em algum lugar visível:

| Situação                                       | Pergunte                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Uma correção foi reportada como pronta         | "Você viu o teste falhar antes de passar?"                         |
| Uma explicação parece plausível demais         | "Isso foi medido, ou é dedução? Me mostra o fato."                 |
| Uma ideia sua muda algo na tela                | "Isso é só visual, ou muda uma regra que o sistema calcula?"       |
| Uma fonte não responde uma dúvida              | "Isso virou uma pergunta registrada, ou foi decidido em silêncio?" |
| Algo ficou pra depois                          | "O que precisa ficar pronto hoje pra não reescrever isso depois?"  |
| Uma dívida (bug, vulnerabilidade) não foi paga | "Isso está documentado, com o motivo de não resolver agora?"       |
| Passou muito tempo sem commit                  | "Isso já está seguro num commit, ou ainda só existe no disco?"     |

---

_Retrospectiva compilada a partir do histórico de git, `docs/PERGUNTAS-EM-ABERTO.md`,
`files_design/02`, `files_design/05`, ADR-0011, ADR-0015 e `docs/loop-produto-playbook.md`._
