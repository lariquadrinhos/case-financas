# ADR-0007 — O monolito é um app Next.js só, e o backend nasce dentro dele

- **Status:** aceita (decisão do dono, 2026-09-01)
- **Responde ao hotspot:** H7 do Event Storming (stack de persistência e empacotamento)
- **Supersede:** o item "instalação local, uma instância por pessoa/máquina" do PRD §5, e o
  ADR-0006 previsto no backlog do Event Storming, que tratava de empacotamento local e não é
  mais necessário. **A numeração 0006 fica vaga de propósito** — renumerar quebraria citações.

## Contexto

O PRD v6 previa "aplicação instalada localmente, uma instância por pessoa/máquina, sem
necessidade de login". O Event Storming levantou H7 sem decidir. A decisão do dono nesta fase é
outra: **aplicação web, ambiente privado, com LGPD e segurança da informação como premissa**.

Isso muda a pergunta. Não é mais "como empacotar para a máquina da pessoa", é "que forma o
código precisa ter para que o backend caiba depois sem reescrever a interface".

O risco real desta fase é construir a casca de um jeito que force retrabalho quando o backend
chegar. Já vimos qual é a forma cara desse erro: telas que chamam `fetch` direto, regra de
negócio dentro do componente, e um segundo serviço que precisa reimplementar a mesma cascata
do DRE em outra linguagem.

## Decisão

### §1 Um pacote só, na raiz do repositório

Não é workspace, não é monorepo, não é `apps/web`. É um `package.json` na raiz, com `src/`.
Um monolito não precisa da cerimônia de um workspace: quando houver servidor, ele vive nos
Route Handlers e Server Actions do mesmo app, em `src/app`. Não existe segundo serviço, segundo
deploy, segunda linguagem.

`docs/` e `files_design/` já estavam na raiz. Empurrá-los para dentro de um pacote só para ter
um workspace seria mover a documentação para acomodar uma ferramenta.

### §2 Next.js 15 com App Router

O critério não foi popularidade: foi **onde o backend vai caber**. O App Router permite que a
mesma árvore de arquivos que hoje serve telas passe a servir Route Handlers e Server Actions,
sem que a tela precise saber que a fronteira mudou. Uma SPA (Vite + React) exigiria um segundo
serviço para o backend — que é exatamente a forma que esta ADR quer evitar.

Consequências que aceitamos: acoplamento a um framework com opiniões fortes, e um modelo
mental (Server Components) que é mais difícil de ensinar que uma SPA.

### §3 Quatro camadas, com a dependência apontando para dentro

```
src/domain/     regras puras. Não sabe que existe React, Next, banco ou HTTP.
src/data/       fronteira de persistência: contracts/ (interfaces) + memory/ + fixtures/
src/features/   casos de uso e componentes por funcionalidade
src/app/        App Router: rotas, layouts, e — na fase 2 — Route Handlers e Server Actions
```

Mais `src/components` (ui/ e patterns/), `src/lib`, `src/server`, `src/styles`.

O bloqueio do domínio não é honra: está em `eslint.config.mjs`, como `no-restricted-imports`
sobre `src/domain/**/*.ts`. Importar React, Next ou qualquer camada de fora dentro do domínio é
erro de lint, não convenção.

Se você precisou driblar essa regra, a regra que você está escrevendo não é de domínio, ou está
no lugar errado.

### §4 A troca da fase 2 é a implementação do repositório, e nada mais

`src/data/contracts/` declara o que a aplicação exige. `src/data/memory/` é a implementação
desta fase. A fase 2 acrescenta `src/data/<banco>/` e troca a fábrica. Telas, features,
domínio e testes de domínio não mudam.

Toda função de repositório recebe `userId` desde hoje (ver ADR-0008), então nenhuma consulta
precisa ganhar escopo depois.

### §5 Ferramentas

TypeScript strict com `noUncheckedIndexedAccess`; Tailwind v4 com os tokens do Figma
(ADR-0011); Radix como base dos primitivos acessíveis; Zod para schema de formulário, que é
também o contrato de entrada do repositório; Vitest para domínio e componente; Playwright para
o caminho de ponta a ponta.

Node >= 20.9 é exigido e verificado pelo alvo `require-node` do Makefile, que falha com a
instrução de conserto em vez de um erro críptico três passos adiante.

## Consequências

- **`eslint.config.mjs`**: a regra que prende o domínio é parte do portão de arquitetura, não
  de estilo.
- **`Makefile`**: `check` = typecheck + lint + teste unitário. `test-e2e` fica **fora** do
  `test` padrão por depender de browser, e sai com 0 quando o Playwright não está instalado —
  um portão que não roda em toda máquina não é portão.
- **Fase 2 fica com um trabalho nomeado**: implementar `src/data/<banco>/` contra os contratos
  já escritos, e trocar o corpo de `getSession()`.
- **Não tocado**: a escolha do banco. Continua aberta de propósito — escolher agora seria
  decidir antes de o motor de DRE configurável (H10, ADR-0002, o hotspot de maior risco) dizer
  que forma o dado precisa ter.

## Explicitamente NÃO feito

- **Escolher o banco.** Ver acima.
- **Workspace / monorepo.** Ganho zero para um deploy só.
- **Empacotamento desktop (Tauri, Electron).** Era a leitura do PRD v6; a decisão de web
  privado a substitui. Se voltar a ser requisito, esta ADR é emendada, não substituída.
- **Backend separado.** Um segundo serviço obrigaria a reimplementar ou expor a cascata do DRE
  por HTTP, e ela é o núcleo de valor do produto.
