# ADR-0008 — Sem autenticação agora, com a costura de sessão pronta desde o primeiro commit

- **Status:** aceita (decisão do dono, 2026-09-01)
- **Estende:** ADR-0007 §4

## Contexto

Três coisas verdadeiras ao mesmo tempo, e em tensão:

1. O PRD v6 diz "sem necessidade de login/autenticação" e "multiusuário / multi-tenant / login"
   está explicitamente **fora do escopo** do MVP.
2. O Figma não desenhou tela de login, de recuperação de senha, nem de conta. As 130 telas
   partem do onboarding direto para a Home. `files_design/01 §1` é explícito: "sem
   autenticação, abre direto no conteúdo".
3. A decisão desta fase é web privado, com **segurança da informação como premissa em tudo**.

Construir login agora contradiz (1) e (2), e adiciona telas que ninguém desenhou — o protótipo
deixa de servir para teste de usabilidade, que é o objetivo desta fase.

Não construir nada contradiz (3) do jeito caro: quando a autenticação chegar, toda consulta de
dado precisa ganhar escopo de usuário, e "toda consulta" quer dizer todas as telas.

## Decisão

### §1 Não há autenticação nesta fase, e isso é uma decisão, não um esquecimento

O app abre direto na Home, fiel ao Figma. Não existe tela de login.

**A mitigação é operacional, não técnica: o ambiente desta fase é privado e nunca exposto à
internet pública.** Está escrito em `SECURITY.md` como limitação declarada, não escondida.

### §2 Toda leitura de dado passa por `getSession()` e carrega `userId`, desde hoje

`src/server/session.ts` exporta:

```ts
getSession(): Promise<Session>      // { userId, allowedEntities, authenticated }
requireSession(): Promise<Session>  // lança quando não há sessão
```

Nesta fase devolve sempre a sessão local de desenvolvimento, com `authenticated: false` — o
campo diz a verdade em vez de fingir.

`requireSession()` é chamado uma vez no layout de `src/app/(app)`, de modo que toda rota do app
tem sessão com escopo antes de renderizar. **É o único lugar que vira um redirecionamento para
login na fase 2.**

### §3 Nenhuma função de repositório existe sem escopo de usuário

Todo contrato em `src/data/contracts/` recebe `userId`, inclusive a implementação in-memory,
onde ele hoje não filtra nada de útil. O ponto não é a filtragem de hoje: é que **não existe
assinatura de função para ser mudada depois**. Uma consulta sem `userId` é erro de compilação.

### §4 `allowedEntities` já está no tipo

`Session.allowedEntities: readonly ('PF' | 'PJ')[]`. Prepara o caso de múltiplas PJs, que o
time de design levantou como nota para produto (frame `158:2`) e que ainda não foi decidido.
Custa um campo agora; custaria uma migração de dados depois.

### §5 O que a costura garante, e o que ela não garante

**Garante:**

- Nenhuma consulta de repositório existe sem escopo de usuário.
- Trocar o stub por um provedor real não toca em nenhuma tela.
- O lugar exato onde a autorização vai entrar está nomeado e é um só.

**NÃO garante — e dizer isso é parte da decisão:**

- Não há autenticação. Quem alcança a URL vê os dados.
- Não há autorização, sessão expirável, rate limiting, nem auditoria de acesso.
- `authenticated: false` não é lido por ninguém para negar nada hoje.

Um documento de segurança que descreve a costura sem dizer o que ela não faz é pior que
nenhum, porque cria confiança que o código não sustenta.

## Consequências

- **`src/server/session.ts`**: existe desde o primeiro commit, com o contrato final.
- **`src/app/(app)/layout.tsx`**: `await requireSession()` antes de renderizar qualquer rota.
- **`SECURITY.md`**: "acesso indevido de quem alcança a URL" está listado como **não mitigado**
  na tabela do modelo de ameaça, com a mitigação operacional ao lado.
- **Fase 2**: trocar o corpo de `getSession()` por Auth.js e transformar o `throw` de
  `requireSession()` num `redirect()`. Nenhuma tela muda.
- **Não tocado**: autorização por recurso, papéis, compartilhamento entre pessoas. O produto é
  de uma pessoa só por instância (PRD §1).

## Explicitamente NÃO feito

- **Login nesta fase.** Adicionaria telas não desenhadas e atrasaria a validação de usabilidade,
  que é o objetivo da fase.
- **Autenticação "de mentirinha"** (senha fixa, basic auth no proxy). Daria a sensação de
  proteção sem a propriedade, que é pior que a ausência declarada.
- **Cookie de sessão.** Não há o que assinar ainda. Introduzi-lo agora seria decidir o formato
  do token antes de escolher o provedor.
