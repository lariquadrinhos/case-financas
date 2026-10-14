# Contribuindo com o Bigorna

Leia `CLAUDE.md` e as fontes da verdade antes de abrir um editor. Este arquivo diz
como trabalhar; as fontes dizem o que é verdade. Qualidade, segurança e LGPD são
premissa deste projeto, não etapa posterior — o produto guarda dado financeiro
pessoal e empresarial.

**Fontes da verdade, em ordem de precedência:**

| #   | Documento                                                                      | O que ele decide                                                                    |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | `docs/prd/financas-pf-pj.md` (v6)                                              | O produto: escopo, regras de negócio, casos de uso, plano de contas                 |
| 2   | `docs/event-storming/financas-pf-pj.md`                                        | O domínio: eventos, agregados, bounded contexts e os hotspots H1..H10 ainda abertos |
| 3   | `docs/adr/NNNN-titulo-curto.md`                                                | A decisão técnica. Vence sobre o código                                             |
| 4   | `files_design/01-especificacao-de-telas.md` e `03-modelo-de-dados-por-tela.md` | O que cada tela faz e com quais campos, obrigatoriedade e validação                 |
| 5   | `files_design/04-glossario-de-nomenclatura.md`                                 | O vocabulário fechado. Vence sobre qualquer nome inventado no código                |
| 6   | `docs/figma/INDEX.md` + `docs/figma/frames/*.xml`                              | A fidelidade visual: 130 frames extraídos do arquivo `7IZBeQV15kgZp7Shcqh4c8`       |
| 7   | `CLAUDE.md`                                                                    | Como trabalhar aqui                                                                 |

Quando dois documentos discordam, o de cima está certo e o de baixo está velho.
Conserte o de baixo em vez de programar por cima da divergência — a divergência
que ninguém corrige volta como bug seis meses depois, e aí ninguém lembra qual
dos dois era o certo.

O processo que gerou tudo isso está em `.claude/skills/loop-produto/SKILL.md`
(o método) e em `docs/loop-produto-playbook.md` (o traço real, prompt a prompt).

> **Nota de estado:** as ADRs desta fase são citadas por número nos comentários do
> código (`ADR-0007` camadas, `ADR-0008` sessão, `ADR-0009` segurança e LGPD,
> `ADR-0010` glossário, `ADR-0011` tokens), mas os arquivos correspondentes ainda
> não existem em `docs/adr/`. Até que existam, o comentário no código é o registro.
> Escrevê-los é dívida conhecida, não licença para decidir de novo.

## Se você é um agente de IA

- **Leia as fontes na ordem de precedência acima antes de propor qualquer coisa.**
  Quase tudo que parece lacuna já foi decidido em algum desses documentos, muitas
  vezes duas vezes e com a contradição resolvida. Redecidir por engano custa o
  dobro: primeiro o trabalho errado, depois a discussão para desfazê-lo.
- **Não assuma premissas.** É a diretriz nº 1 da skill `loop-produto`. Se algo não
  está escrito, pergunte à pessoa responsável e registre a resposta. O agente
  propõe, a pessoa decide, o documento guarda. Uma suposição silenciosa vira
  requisito sem que ninguém tenha concordado com ela.
- **Confirme que o problema é real antes de consertar.** Rode o comando, leia o
  arquivo, reproduza o erro. Uma causa deduzida é hipótese; só medição é causa.
  Um conserto de hipótese normalmente esconde o defeito em vez de removê-lo.
- **Não abra ADR para bug.** ADR é para mudança arquitetural ou proposta nova.
  Consertar o que uma decisão já prometia não é decisão nova: o porquê do conserto
  vai no comentário do código, onde será lido por quem tocar naquela linha, e na
  descrição do PR. ADR aberta para bug polui a numeração e some no meio.
- **Declare a autoria:** modelo, harness e skills usadas, e o trailer
  `Co-Authored-By:` no commit. Quem revisar daqui a seis meses precisa saber qual
  máquina escreveu aquilo e sob quais instruções, para saber o que reconferir.
- **Mostre o diff inteiro e obtenha aprovação humana antes de submeter.** Nada
  entra no repositório sem uma pessoa ter lido o que entra. "Rodou o teste" não
  substitui isso: o teste confere o que foi previsto, a pessoa confere o resto.
- **Nunca cole dado financeiro real em prompt, issue, PR ou log.** Nem valor, nem
  saldo, nem extrato, nem CPF/CNPJ, nem screenshot de tela preenchida com dado de
  verdade. Se precisar de exemplo, invente um — as fixtures de
  `src/data/fixtures` são sintéticas exatamente por isso, e `make audit-lgpd`
  existe para manter assim. Motivo: prompt, issue e PR saem da máquina e ficam
  gravados em lugares que você não controla. Um valor real colado uma vez não
  volta atrás.

## Antes de abrir um PR

Comece pela fonte da verdade, não pelo editor. Depois:

- **Comece por um teste que falha.** Regra de negócio mora em `src/domain`, que é
  puro e sem framework — não há dependência para simular, então não há desculpa
  para não testar. O nome do teste cita a regra (ex.: "eliminação intercompany na
  visão consolidada").
- **Respeite a direção das camadas:** `src/domain` ← `src/data` ← `src/features`
  ← `src/app`. A dependência aponta para dentro. O ESLint barra o domínio de
  importar `react`, `next` ou qualquer camada de fora, e a mensagem de erro diz o
  porquê.
- **A fase 1 não tem banco, backend nem login.** Repositório novo entra como
  contrato em `src/data/contracts` mais implementação in-memory em
  `src/data/memory`, alimentada por fixture sintética. Motivo: a fase 2 troca só
  a implementação por banco real e Auth.js, sem tocar em tela. Se uma tela conhecer
  a implementação de memória diretamente, essa troca deixa de ser troca e vira
  reescrita.
- **Toda leitura de dado passa pela costura de sessão** (`exigirSessao()` em
  `src/server/session.ts`), mesmo sem autenticação hoje. É o único lugar que define
  escopo de usuário; consulta que não passa por lá é consulta sem dono.
- **Nomes:** se é conceito de produto, o glossário manda ("Lançamento", nunca
  "transação"; "Bens Materiais", nunca "Ativos"). Todo o código em inglês,
  domínio incluído (`Entry`, `Recurrence`, `computeIncomeStatement`); texto de tela e rotas
  em português; a ponte entre os dois está em `src/domain/GLOSSARY.md`,
  documentação e comentários em pt-BR.
- **Nada de valor literal em componente.** Cor e medida saem de
  `src/styles/tokens.css`; `make audit-tokens` falha se aparecer hex ou px solto
  fora de `src/styles/`.
- **Nenhuma origem externa no cliente.** Sem CDN, sem fonte remota, sem analytics,
  sem imagem de terceiro. A CSP de `next.config.ts` bloqueia, então o recurso
  remoto quebra a página em produção antes de quebrar a privacidade — mas a regra
  existe pela privacidade, não pela CSP.
- **Fidelidade de tela vem dos XML**, não da API do Figma: a API tem limite de
  chamadas e a árvore dos 130 frames já está em `docs/figma/frames/`, com o texto
  literal de cada tela.
- **ADR só para mudança arquitetural ou proposta nova**, em
  `docs/adr/NNNN-titulo-curto.md`, com as alternativas descartadas e seus
  trade-offs. Numeração sequencial e imutável no nome do arquivo.

## Commits e PRs

- **Conventional Commits** no título: `<tipo>(escopo): <descrição>` — `feat`,
  `fix`, `docs`, `refactor`, `test`, `chore`. O escopo é a camada ou a tela
  (`domain`, `data`, `home`, `dre`, `onboarding`).
- **Branch a partir de `main`:** `feat/…`, `fix/…`, `docs/…`. Nunca comite direto
  em `main` — o diff precisa existir como diff para poder ser revisado.
- Descrição em pt-BR, imperativa e curta: "adiciona eliminação intercompany", não
  "adicionando" nem "adicionado".
- Todo commit assistido por IA termina com o trailer `Co-Authored-By:`.
- O PR responde três perguntas: **o que muda**, **a que fonte da verdade isso
  rastreia** (regra do PRD, hotspot do Event Storming, ADR, tela do
  `files_design`) e **como testar**.
- Screenshot em PR só com fixture sintética. Vale a mesma regra do prompt: o PR
  fica gravado.

## Checklist de qualidade

Copie esta lista na descrição do PR e marque o que conferiu.

- [ ] O teste veio primeiro e falhou antes do conserto (desligue o conserto e veja
      ficar vermelho — teste que nunca poderia falhar é pior que teste nenhum,
      porque é acreditado).
- [ ] Cada regra tocada tem teste, e o nome do teste cita a regra.
- [ ] `src/domain` continua puro: sem React, sem Next, sem import de camada de fora.
- [ ] As telas leem por contrato (`src/data/contracts`), nunca pela implementação
      de memória.
- [ ] Toda leitura de dado passa por `exigirSessao()`.
- [ ] Nomes conforme `files_design/04-glossario-de-nomenclatura.md`; domínio em
      todo o código em inglês; texto de tela em português (`src/domain/GLOSSARY.md`).
- [ ] Sem cor ou medida literal: `make audit-tokens` verde.
- [ ] Sem PII e sem `console.log`: `make audit-lgpd` verde; log só por
      `src/lib/log.ts`, que nunca registra valor nem texto digitado.
- [ ] Fixtures 100% sintéticas. Nenhum dado de pessoa real no diff, na descrição do
      PR ou no screenshot.
- [ ] Nenhuma origem externa adicionada (CDN, fonte, analytics, imagem remota).
- [ ] Sem travessão em texto de interface (convenção de design, `files_design/00`);
      em documentação, pode.
- [ ] Mudança arquitetural ou proposta nova registrada em `docs/adr/`; conserto de
      bug não ganha ADR.
- [ ] `make check` verde.
- [ ] Autoria de IA declarada (modelo, harness) e trailer `Co-Authored-By:`
      presente.
- [ ] Diff inteiro mostrado e aprovado por uma pessoa.

## Comandos

Toolchain: Node >= 20.9 (`.nvmrc` fixa a 24). O `Makefile` falha cedo, com a
instrução de conserto, se o Node for velho demais.

```
make help              # lista os alvos com a descrição de cada um
make install           # instala dependências (npm install, com checagem de versão do Node)
make dev               # servidor de desenvolvimento em localhost:3000
make check             # portão local: typecheck + lint + testes unitários
make typecheck         # tsc --noEmit (TypeScript strict)
make lint              # ESLint: barra console.log e import de framework no domínio
make fmt               # Prettier, escrevendo
make fmt-check         # Prettier, só conferindo
make test-unit         # Vitest: domínio, regras puras e componentes
make test-e2e          # Playwright (rode antes: make test-e2e-install)
make audit-tokens      # falha se houver hex ou px solto fora de src/styles/
make audit-lgpd        # falha se houver PII em fixture ou console.log em src/
make audit-deps        # npm audit --audit-level=high
make build             # build de produção (a CSP estrita só vale aqui)
make start             # sobe o build de produção
make storybook         # Storybook do design system em localhost:6006
make clean             # remove artefatos de build e teste
```

**Estado verificado em 2026-09-01:** `make typecheck` e `make audit-tokens` passam.
Três alvos ainda falham e são o primeiro trabalho de quem chegar — um portão que
não fica verde não é portão, é ruído que todo mundo aprende a ignorar:

- `make test-unit` sai com erro porque não existe nenhum arquivo de teste
  (`src/**/*.test.ts`) e o Vitest falha quando não encontra nada.
- `make lint` acusa `next-env.d.ts`, arquivo gerado pelo Next e ainda não listado
  nos `ignores` de `eslint.config.mjs`.
- `make audit-lgpd` acusa a própria palavra `console.log` escrita no comentário de
  `src/lib/log.ts` — falso positivo do `grep`, que ainda não distingue comentário
  de chamada.
- `make storybook` não roda: o alvo e o script existem, a dependência do Storybook
  ainda não está instalada.
